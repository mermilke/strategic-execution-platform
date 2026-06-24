import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { ModelMessage } from 'ai'
import { buildBriefingContext } from './briefing-context'
import type { Database } from './database.types'

// Shared building blocks for the weekly briefing, used by both the streaming
// route (app/api/ai/insights) and the Monday pre-generation cron
// (app/api/cron/briefing). Keeping the model, schema, prompt, costing, and
// post-processing here means the streamed and pre-generated briefings can't
// drift apart.

export type BriefingContext = Awaited<ReturnType<typeof buildBriefingContext>>

// Latest Sonnet at implementation time. Check the gateway before bumping:
//   GET https://ai-gateway.vercel.sh/v1/models
export const MODEL = 'anthropic/claude-sonnet-4.6'

// Manager the briefing is written for, plus the clock it's written in. Both
// configurable so the app isn't tied to one organization.
const MANAGER_NAME = process.env.MANAGER_NAME || 'the manager'
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'UTC'

// Sonnet 4.x family pricing (USD per million tokens), rough cost estimate.
// Adjust if Anthropic moves pricing.
const PRICE = {
  input_per_mtok: 3.0,
  output_per_mtok: 15.0,
  cache_read_per_mtok: 0.30,
  cache_write_per_mtok: 3.75,
}

export function calcCostCents({ input_tokens = 0, output_tokens = 0, cache_read = 0, cache_write = 0 }: {
  input_tokens?: number
  output_tokens?: number
  cache_read?: number
  cache_write?: number
}) {
  const uncached_in = Math.max(0, input_tokens - cache_read - cache_write)
  const dollars =
    uncached_in * PRICE.input_per_mtok / 1e6 +
    cache_read * PRICE.cache_read_per_mtok / 1e6 +
    cache_write * PRICE.cache_write_per_mtok / 1e6 +
    output_tokens * PRICE.output_per_mtok / 1e6
  return Math.round(dollars * 100)
}

// what the model has to produce. arrays can all be empty so a thin week can
// come back as a one-sentence briefing.
export const BriefingSchema = z.object({
  headline: z.string().describe(
    'One sentence summarizing the week for the manager. Punchy, factual, no hedging. ' +
    'If the week was flat, say so plainly.'
  ),
  top_items: z.array(z.string()).max(3).describe(
    '0-3 most important things the manager needs to know. ' +
    'Skip if nothing material happened -- empty array is fine. ' +
    'No need to invent a third just because the field allows 3.'
  ),
  risks: z.array(z.object({
    item: z.string().describe('Brief description of the risk or blocker.'),
    owner_name: z.string().nullable().describe('DR full name, or null if cross-cutting.'),
    severity: z.enum(['high', 'medium', 'low']),
  })).describe('Real risks only. Empty array if none.'),
  momentum: z.array(z.object({
    item: z.string().describe('Status flip, sub-objective completed, or new opportunity logged.'),
    owner_name: z.string().nullable(),
  })).describe('Genuine wins only -- status flips, completions, new opportunities. Empty if a hold-the-line week.'),
  talking_points: z.array(z.object({
    dr_name: z.string(),
    upcoming_meeting_label: z.string().nullable().describe(
      'e.g. "Mon May 26, 10:00 AM UTC" or null if no 1:1 in next 14 days.'
    ),
    points: z.array(z.string()).describe(
      'Direct questions/items for the manager to raise. Be specific. Skip DRs with nothing worth discussing.'
    ),
  })).describe('Only DRs with material to discuss. Skip DRs whose week was uneventful.'),
  data_caveats: z.array(z.string()).describe(
    'Honest call-outs only when material to the manager -- e.g. "no upcoming 1:1 found with a direct report". ' +
    'Skip operational noise (reminders, narrative length, etc.). Empty if nothing worth flagging.'
  ),
})

// voice + section rules, cached as a stable system block
export const SYSTEM_PROMPT = `You are ${MANAGER_NAME}'s chief of staff. You are writing a Monday-morning briefing in under 4 minutes of reading time.

VOICE:
- Direct, factual, prioritized.
- Punchy sentences. No buzzwords, no hedging, no "I'd recommend", no "consider".
- First name is fine in the headline and in prose ("Dana hasn't…", "Priya flipped…"). Use FULL name (first + last) when used as an attribution label (e.g. the "owner" of a risk, the dr_name field in talking_points).
- Honest about thin-data weeks -- if nothing material happened, say so. Do not invent drama.

LANGUAGE -- STATUS VALUES:
- The status enum uses underscored values (not_started, on_track, at_risk, off_track, on_hold, completed). NEVER write these in prose -- convert to natural English: "not started", "on track", "at risk", "off track", "on hold", "completed". e.g. write "two sub-objectives stuck at not started", NOT "stuck at not_started".

SECTIONS (you fill these via the structured schema):
- headline: one sentence summarizing the week.
- top_items: the 1-3 most important things the manager needs to know. Empty if none.
- risks: real risks/blockers with severity. Empty if none.
- momentum: genuine wins only -- status flips (e.g. at-risk to on-track), sub-objective completions, new opportunities logged. NOT "submitted on time" or "consistency". Empty if a hold-the-line week.
- talking_points: per-DR prep for upcoming 1:1s. Only include DRs with something specific worth raising. Use the upcoming_meeting_label from the calendar data if present.
- data_caveats: only flag things material to the manager (e.g. "no upcoming 1:1 found with a direct report"). Skip operational noise.

RULES:
- Assume DRs will NEVER write narrative in their check-ins. Status fields are the signal. Do not complain that progress_this_week is empty or "Yes" -- that is the norm.
- Do not mention reminder emails or nudge behavior.
- Compare this week vs previous week to identify real changes.
- A sub-objective that has been "not started" or "on hold" for multiple consecutive weeks is a genuine risk.
- A sub-objective that flipped status this week is genuine momentum.
- CHECK-IN TIMING (very important -- read carefully):
  - Each DR is expected to submit their check-in by the day of their 1:1 with the manager.
  - Inspect today_date and the DR's meetings_next_14d list (which now includes CANCELLED meetings, flagged with is_cancelled: true).
  - If the DR's next confirmed 1:1 is today or in the future, the check-in is NOT yet due. Frame as "check-in not yet due, 1:1 is Thursday". DO NOT say "missed".
  - If the DR's most recent scheduled 1:1 this week was CANCELLED and no replacement is on the calendar yet, frame as "1:1 cancelled; check-in not late, awaiting reschedule". DO NOT say "missed".
  - Only call a check-in "missed" / "didn't submit" if a confirmed 1:1 already happened this week AND no check-in exists. That is a real miss.
  - This applies to the headline too. If neither DR has a real miss, the headline should NOT say they "didn't submit" -- describe the actual situation (e.g. "Quiet week -- Dana's 1:1 is Thursday; Priya's 1:1 was cancelled, awaiting reschedule").
- Each DR's latest_meeting_note holds what was discussed in their most recent 1:1. Use it for continuity in talking_points: follow up on the commitments or blockers raised there, and don't re-raise something already resolved.
- Use objective short_title if present; otherwise the full title.
- ONE entry per DR in talking_points. Never include the same DR more than once -- consolidate their points under a single entry.`

function userPromptFromContext(ctx: BriefingContext) {
  const today = new Date().toISOString().slice(0, 10)
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: APP_TIMEZONE })
  return [
    `Today: ${today} (${dayName}, the manager's local time).`,
    `Briefing week: Mon ${ctx.week_start} to Sun (compare against previous week: ${ctx.previous_week_start}).`,
    `Calendar fetch status: ${ctx.calendar_status}.`,
    '',
    'DIRECT REPORTS WITH FULL DATA:',
    JSON.stringify(ctx.direct_reports, null, 2),
    '',
    'Generate the briefing now. Be terse.',
  ].join('\n')
}

// The user turn for streamObject/generateObject. The long context block (DR
// roster + objectives + check-ins) is marked ephemeral so a regenerate within
// ~5min only pays ~10% of input cost.
export function buildMessages(ctx: BriefingContext): ModelMessage[] {
  return [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: userPromptFromContext(ctx),
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } },
          },
        },
      ],
    },
  ]
}

export function newAdmin() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Status enum scrub. Despite the prompt rule, the model sometimes copies the
// raw enum (not_started, on_hold, etc.) from the data context into prose. Walk
// every string in the JSON and rewrite them to bold natural English so no
// underscored variable names ever reach the UI.
// NOTE: the ** markdown couples this stored JSON to the markdown renderer in the
// UI. It's a deliberate shortcut -- if the briefing is ever delivered another
// way (the email/PDF on the roadmap), rewrite to plain English here and let each
// surface apply its own emphasis.
const STATUS_REWRITES: [RegExp, string][] = [
  [/\bnot_started\b/gi,  '**not started**'],
  [/\bon_track\b/gi,     '**on track**'],
  [/\bat_risk\b/gi,      '**at risk**'],
  [/\boff_track\b/gi,    '**off track**'],
  [/\bon_hold\b/gi,      '**on hold**'],
  [/\bcompleted\b/gi,    '**completed**'],
]

export function scrubStrings(node: any): any {
  if (typeof node === 'string') {
    return STATUS_REWRITES.reduce((s, [re, repl]) => s.replace(re, repl), node)
  }
  if (Array.isArray(node)) return node.map(scrubStrings)
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {}
    for (const k of Object.keys(node)) out[k] = scrubStrings(node[k])
    return out
  }
  return node
}

// DR dedupe in talking_points. The model occasionally duplicates a DR despite
// the prompt rule, so collapse by dr_name (keeping first-seen order) and merge
// their point lists. Mutates and returns the object.
export function dedupeTalkingPoints(obj: any): any {
  if (obj?.talking_points?.length) {
    const seen = new Map<string, any>()
    for (const tp of obj.talking_points) {
      const name = tp?.dr_name?.trim()
      if (!name) continue
      const existing = seen.get(name)
      if (!existing) {
        seen.set(name, { ...tp, points: [...(tp.points || [])] })
      } else {
        for (const p of (tp.points || [])) {
          if (!existing.points.includes(p)) existing.points.push(p)
        }
        if (!existing.upcoming_meeting_label && tp.upcoming_meeting_label) {
          existing.upcoming_meeting_label = tp.upcoming_meeting_label
        }
      }
    }
    obj.talking_points = Array.from(seen.values())
  }
  return obj
}

export type AdminClient = ReturnType<typeof newAdmin>

// Single write path for a finished briefing, keyed on week_start so a
// regenerate (or a cron re-run with ?force=1) overwrites the week's row.
export function persistBriefing(admin: AdminClient, row: Database['public']['Tables']['ai_briefings']['Insert']) {
  return admin.from('ai_briefings').upsert(row, { onConflict: 'week_start' })
}
