import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { streamObject } from 'ai'
import { getAuthenticatedUser } from '../../../../lib/auth'
import { buildBriefingContext } from '../../../../lib/briefing-context'
import {
  MODEL,
  BriefingSchema,
  SYSTEM_PROMPT,
  buildMessages,
  calcCostCents,
  scrubStrings,
  dedupeTalkingPoints,
  newAdmin,
  persistBriefing,
} from '../../../../lib/briefing-shared'
import type { Database } from '../../../../lib/database.types'

// Cache reads run under the caller's session, so row-level security applies and
// a stored briefing is viewable by any manager/admin without the service-role key.
async function sessionClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll() { return cookieStore.getAll() } } }
  )
}

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true'

// Generating needs the service-role key (to read across reports) and an AI
// gateway key. On the public demo it's still allowed -- the first visitor to
// open an empty week generates it once and it's cached for everyone -- but
// regeneration is blocked in the POST handler so nobody can run up the bill on
// an already-filled week.
function canGenerate() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.AI_GATEWAY_API_KEY
}

type AuthCtx = NonNullable<Awaited<ReturnType<typeof getAuthenticatedUser>>>
type GateResult =
  | { error: string; status: number; auth?: undefined }
  | { error?: undefined; status?: undefined; auth: AuthCtx }

async function gateRequest(): Promise<GateResult> {
  const auth = await getAuthenticatedUser()
  if (!auth) return { error: 'Unauthorized', status: 401 }
  const role = auth.profile?.role
  if (role !== 'manager' && role !== 'admin') {
    return { error: 'Forbidden -- manager/admin only', status: 403 }
  }
  return { auth }
}

function ndjsonChunk(obj: unknown) {
  return new TextEncoder().encode(JSON.stringify(obj) + '\n')
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds (Vercel Fluid Compute)

/**
 * POST /api/ai/insights
 *   body: { week_start: 'YYYY-MM-DD', regenerate?: boolean }
 *   response: application/x-ndjson stream
 *     - {type:'cached', content, meta}          (single line, if hit)
 *     - {type:'partial', data}                  (many lines)
 *     - {type:'done', meta}                     (final line)
 *     - {type:'error', message}                 (terminal)
 */
export async function POST(request: Request) {
  const gate = await gateRequest()
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (!canGenerate()) {
    return NextResponse.json({ error: 'Weekly briefing is not configured in this environment.' }, { status: 503 })
  }

  let body
  try { body = await request.json() } catch { body = {} }
  const { week_start, regenerate = false } = body
  if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) {
    return NextResponse.json({ error: 'Missing or invalid week_start' }, { status: 400 })
  }

  // Bound the week to today or earlier. Past weeks are naturally finite, but
  // without this a caller could POST arbitrary future weeks and trigger an
  // unbounded number of paid generations.
  if (week_start > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'week_start cannot be in the future' }, { status: 400 })
  }

  // On the public demo a visitor can populate an empty week once (it's then
  // cached and served to everyone), but regeneration is off so an already-filled
  // week can't be re-run repeatedly to drive up the AI bill.
  if (DEMO_MODE && regenerate) {
    return NextResponse.json({ error: 'Regeneration is disabled in the demo.' }, { status: 403 })
  }

  const admin = newAdmin()

  if (!regenerate) {
    const { data: cached } = await admin
      .from('ai_briefings')
      .select('*')
      .eq('week_start', week_start)
      .maybeSingle()
    if (cached) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(ndjsonChunk({
            type: 'cached',
            content: cached.content,
            meta: {
              model: cached.model,
              input_tokens: cached.input_tokens,
              cached_tokens: cached.cached_tokens,
              output_tokens: cached.output_tokens,
              cost_cents: cached.cost_cents,
              latency_ms: cached.latency_ms,
              generated_at: cached.generated_at,
            },
          }))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
      })
    }
  }

  // Build context (one set of DB round-trips + a calendar fetch that may fail)
  let ctx
  try {
    ctx = await buildBriefingContext(week_start)
  } catch (err) {
    console.error('Context build failed:', err)
    return NextResponse.json({ error: 'Failed to assemble briefing data' }, { status: 500 })
  }

  const startTime = Date.now()

  const result = streamObject({
    model: MODEL,
    schema: BriefingSchema,
    // system goes top-level per AI SDK guidance, safer than stuffing it in user messages
    system: SYSTEM_PROMPT,
    messages: buildMessages(ctx),
    // Fail fast on non-retryable errors (403, schema/auth, etc.). The AI SDK
    // default of 2 retries with backoff once cost us 247s on a 403.
    maxRetries: 0,
    onError({ error }) {
      console.error('streamObject error:', error)
    },
  })

  const stream = new ReadableStream({
    async start(controller) {
      let finalObject: any = null
      try {
        for await (const partial of result.partialObjectStream) {
          finalObject = partial
          controller.enqueue(ndjsonChunk({ type: 'partial', data: partial }))
        }

        const usage = await result.usage
        const providerMeta = await result.providerMetadata
        const latency_ms = Date.now() - startTime

        const anthropicMeta: Record<string, unknown> = providerMeta?.anthropic || {}
        const cache_read = Number(anthropicMeta.cacheReadInputTokens) || 0
        const cache_write = Number(anthropicMeta.cacheCreationInputTokens) || 0
        const input_tokens = usage.inputTokens || 0
        const output_tokens = usage.outputTokens || 0
        const cost_cents = calcCostCents({
          input_tokens, output_tokens, cache_read, cache_write,
        })

        // Same post-processing the cron applies: rewrite raw status enums to
        // bold English, then collapse any duplicated DR in talking_points.
        finalObject = dedupeTalkingPoints(scrubStrings(finalObject))

        // upsert overwrites this week's previous row on regenerate
        const { error: upsertErr } = await persistBriefing(admin, {
          week_start,
          content: finalObject,
          model: MODEL,
          input_tokens,
          output_tokens,
          cached_tokens: cache_read,
          cost_cents,
          latency_ms,
          generated_by: gate.auth!.user.id,
          generated_at: new Date().toISOString(),
        })
        if (upsertErr) {
          console.error('Briefing upsert failed:', upsertErr)
        }

        controller.enqueue(ndjsonChunk({
          type: 'done',
          meta: {
            model: MODEL,
            input_tokens,
            output_tokens,
            cached_tokens: cache_read,
            cost_cents,
            latency_ms,
            generated_at: new Date().toISOString(),
          },
        }))
        controller.close()
      } catch (err: any) {
        console.error('Stream failure, discarding partial:', err)
        // Dig out the most useful error string. Gateway errors stash the
        // human-readable message in responseBody.
        let detail = err?.message || 'Unknown error'
        try {
          const causeBody = err?.cause?.responseBody
          if (causeBody) {
            const parsed = JSON.parse(causeBody)
            if (parsed?.error?.message) detail = parsed.error.message
          }
        } catch {}
        controller.enqueue(ndjsonChunk({
          type: 'error',
          message: detail,
        }))
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * GET /api/ai/insights?week_start=YYYY-MM-DD
 *   returns the cached row or 404. Used by past-weeks dropdown.
 *
 * GET /api/ai/insights?history=1
 *   returns list of past briefings (week_start, generated_at, model, cost_cents).
 */
export async function GET(request: Request) {
  const gate = await gateRequest()
  if (gate.error) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const { searchParams } = new URL(request.url)
  const db = await sessionClient()

  if (searchParams.get('history') === '1') {
    const { data, error } = await db
      .from('ai_briefings')
      .select('week_start, generated_at, model, cost_cents, input_tokens, output_tokens, cached_tokens, latency_ms')
      .order('week_start', { ascending: false })
      .limit(52)
    if (error) { console.error('briefing history read error:', error); return NextResponse.json({ error: 'Failed to load briefing history' }, { status: 500 }) }
    return NextResponse.json({ briefings: data || [] })
  }

  const week_start = searchParams.get('week_start')
  if (!week_start) {
    return NextResponse.json({ error: 'Missing week_start' }, { status: 400 })
  }

  const { data, error } = await db
    .from('ai_briefings')
    .select('*')
    .eq('week_start', week_start)
    .maybeSingle()
  if (error) { console.error('briefing read error:', error); return NextResponse.json({ error: 'Failed to load briefing' }, { status: 500 }) }
  if (!data) {
    // No stored briefing. Offer generation if it's available, otherwise report
    // the feature as dormant so the card shows a quiet note rather than an error.
    if (canGenerate()) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ unconfigured: true })
  }

  return NextResponse.json({
    content: data.content,
    meta: {
      model: data.model,
      input_tokens: data.input_tokens,
      cached_tokens: data.cached_tokens,
      output_tokens: data.output_tokens,
      cost_cents: data.cost_cents,
      latency_ms: data.latency_ms,
      generated_at: data.generated_at,
    },
  })
}
