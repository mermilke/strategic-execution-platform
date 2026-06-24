import { NextResponse } from 'next/server'
import { generateObject } from 'ai'
import { verifyCronAuth } from '../../../../lib/cron-auth'
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

export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds (Vercel Fluid Compute) -- generation takes ~17s

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'UTC'

// Same key check the streaming route uses: generating needs the service-role
// key (to read across reports) and an AI gateway key.
function isConfigured() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.AI_GATEWAY_API_KEY
}

// Monday (start of the current week) as YYYY-MM-DD in APP_TIMEZONE. Reads the
// zone's own date + weekday from Intl, then anchors that wall date in UTC for
// the day-of-week math so it can't re-drift around a DST boundary.
function currentWeekStart(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
  }).formatToParts(new Date())
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const WD: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const day = WD[get('weekday')] ?? 0
  const d = new Date(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`)
  const offset = day === 0 ? -6 : 1 - day // Sunday rolls back to the prior Monday
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

/**
 * GET /api/cron/briefing
 *   Pre-generates the current week's briefing so the dashboard loads it
 *   instantly instead of streaming (~17s) for the first visitor. Scheduled
 *   Monday morning via GitHub Actions (.github/workflows/briefing-cron.yml).
 *
 *   Idempotent: skips a week that already has a briefing, unless ?force=1.
 *   Optional ?week_start=YYYY-MM-DD overrides the week (must be a Monday today
 *   or earlier). Fails CLOSED -- rejected unless CRON_SECRET matches.
 */
export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Quietly no-op rather than erroring when the AI keys aren't set, so a
  // deployment without the briefing configured doesn't turn the scheduled run
  // red every week.
  if (!isConfigured()) {
    return NextResponse.json({ status: 'skipped', reason: 'briefing not configured' })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('force') === '1'
  const weekParam = url.searchParams.get('week_start')
  const weekStart = weekParam || currentWeekStart(APP_TIMEZONE)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return NextResponse.json({ error: 'Invalid week_start' }, { status: 400 })
  }
  if (weekStart > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'week_start cannot be in the future' }, { status: 400 })
  }

  const admin = newAdmin()

  // Idempotency -- don't regenerate (or re-bill) a week that already has one.
  if (!force) {
    const { data: existing } = await admin
      .from('ai_briefings')
      .select('week_start')
      .eq('week_start', weekStart)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ status: 'already_exists', week_start: weekStart })
    }
  }

  // Assemble context (DB + best-effort calendar)
  let ctx
  try {
    ctx = await buildBriefingContext(weekStart)
  } catch (err) {
    console.error('Cron briefing -- context build failed:', err)
    return NextResponse.json({ error: 'Failed to assemble briefing data' }, { status: 500 })
  }

  // Generate (non-streaming -- the cron only needs the final object).
  const startTime = Date.now()
  let result
  try {
    result = await generateObject({
      model: MODEL,
      schema: BriefingSchema,
      system: SYSTEM_PROMPT,
      messages: buildMessages(ctx),
      maxRetries: 0, // fail fast on non-retryable gateway errors (403 etc.)
    })
  } catch (err: any) {
    console.error('Cron briefing -- generation failed:', err)
    let detail = err?.message || 'Generation failed'
    try {
      const causeBody = err?.cause?.responseBody
      if (causeBody) {
        const parsed = JSON.parse(causeBody)
        if (parsed?.error?.message) detail = parsed.error.message
      }
    } catch {}
    return NextResponse.json({ error: detail }, { status: 502 })
  }

  const latency_ms = Date.now() - startTime
  const anthropicMeta: Record<string, unknown> = result.providerMetadata?.anthropic || {}
  const cache_read = Number(anthropicMeta.cacheReadInputTokens) || 0
  const cache_write = Number(anthropicMeta.cacheCreationInputTokens) || 0
  const input_tokens = result.usage?.inputTokens || 0
  const output_tokens = result.usage?.outputTokens || 0
  const cost_cents = calcCostCents({ input_tokens, output_tokens, cache_read, cache_write })

  // Same belt-and-suspenders the streaming route applies before persisting.
  const content = dedupeTalkingPoints(scrubStrings(result.object))

  const { error: upsertErr } = await persistBriefing(admin, {
    week_start: weekStart,
    content,
    model: MODEL,
    input_tokens,
    output_tokens,
    cached_tokens: cache_read,
    cost_cents,
    latency_ms,
    generated_by: null, // no user -- pre-generated by the cron
    generated_at: new Date().toISOString(),
  })
  if (upsertErr) {
    console.error('Cron briefing -- upsert failed:', upsertErr)
    return NextResponse.json({ error: 'Persisted generation failed' }, { status: 500 })
  }

  return NextResponse.json({
    status: 'generated',
    week_start: weekStart,
    latency_ms,
    input_tokens,
    output_tokens,
    cached_tokens: cache_read,
    cost_cents,
  })
}
