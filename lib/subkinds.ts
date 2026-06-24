// Sub-objective "kinds". A sub can track its own structured list instead of the
// standard weekly check-in:
//   training -> training_sessions (>= 1 complete session per calendar quarter)
//   monthly  -> monthly_checks    (a 12-month grid, complete when every month is done)
// A 'standard' sub uses the normal weekly check-in; nothing here applies to it.

export const SPECIAL_KINDS = ['training', 'monthly'] as const
export type SpecialKind = (typeof SPECIAL_KINDS)[number]
export const isSpecialKind = (kind?: string | null): kind is SpecialKind =>
  !!kind && (SPECIAL_KINDS as readonly string[]).includes(kind)

// Special kinds carry their own progress, so they sit off the weekly cadence and
// are never counted toward the weekly "no update" stale tracker.
export const LIST_ONLY_KINDS: readonly string[] = SPECIAL_KINDS

export const QUARTERS = [
  { key: 'Q1', label: 'Q1' },
  { key: 'Q2', label: 'Q2' },
  { key: 'Q3', label: 'Q3' },
  { key: 'Q4', label: 'Q4' },
]

export const MONTHLY_STATUSES = [
  { key: 'not_started', label: 'Not started', hex: '#94A3B8' },
  { key: 'in_progress', label: 'In progress', hex: '#F59E0B' },
  { key: 'done', label: 'Done', hex: '#34D399' },
]

// The 12 months of a year as { key: 'YYYY-MM', label: 'Jan' }. The monthly grid
// tracks a full calendar year; defaults to the current year.
export function monthsForYear(year: number = new Date().getFullYear()) {
  return Array.from({ length: 12 }, (_, i) => ({
    key: `${year}-${String(i + 1).padStart(2, '0')}`,
    label: new Date(year, i, 1).toLocaleDateString('en-US', { month: 'short' }),
  }))
}
export const MONTHS = monthsForYear()

// Calendar quarter (1-4) for a YYYY-MM-DD string, or null.
export function quarterOf(dateStr?: string | null): number | null {
  if (!dateStr) return null
  const month = parseInt(String(dateStr).slice(5, 7), 10)
  if (!month) return null
  return Math.floor((month - 1) / 3) + 1
}

export type TrainingSession = {
  session_date?: string | null
  topic?: string | null
  participants?: string | null
  follow_up?: string | null
  next_steps?: string | null
  results?: string | null
}

// A session counts only when every field is filled in.
export function isSessionComplete(s?: TrainingSession | null): boolean {
  return !!(s && s.session_date && (s.topic || '').trim() && (s.participants || '').trim()
    && (s.follow_up || '').trim() && (s.next_steps || '').trim() && (s.results || '').trim())
}

// Training sub is complete when each quarter has at least one complete session.
export function trainingProgress(sessions: TrainingSession[]) {
  const done = sessions.filter(isSessionComplete)
  const quartersCovered = new Set(
    done.map(s => quarterOf(s.session_date)).filter((q): q is number => q != null)
  )
  const complete = [1, 2, 3, 4].every(q => quartersCovered.has(q))
  return { completeSessions: done.length, quartersCovered, complete }
}

export type MonthlyCheck = { month: string; status?: string | null }

// Monthly sub is complete when every tracked month is 'done'.
export function monthlyProgress(checks: MonthlyCheck[]) {
  const byMonth: Record<string, string> = {}
  for (const c of checks) byMonth[c.month] = c.status || 'not_started'
  const done = MONTHS.filter(m => byMonth[m.key] === 'done').length
  return { byMonth, done, total: MONTHS.length, pct: Math.round((done / MONTHS.length) * 100), complete: done === MONTHS.length }
}

export type SpecialProgress =
  | { kind: 'training'; completeSessions: number; quartersCovered: Set<number>; complete: boolean; pct: number; short: string; label: string }
  | { kind: 'monthly'; byMonth: Record<string, string>; done: number; total: number; complete: boolean; pct: number; short: string; label: string }

// Uniform progress descriptor for a special sub, given its loaded rows. Returns
// null for a standard sub. `pct`/`complete` drive the dashboard bar; `short` is a
// compact numeric for the snapshot tile, `label` a fuller phrase for the tooltip.
export function specialProgress(sub: { kind?: string | null }, rows: any[] = []): SpecialProgress | null {
  if (sub.kind === 'training') {
    const p = trainingProgress(rows)
    const covered = p.quartersCovered.size
    return { kind: 'training', ...p, pct: Math.round((covered / QUARTERS.length) * 100), short: `${covered}/4`, label: `${covered} of 4 quarters covered` }
  }
  if (sub.kind === 'monthly') {
    const p = monthlyProgress(rows)
    return { kind: 'monthly', ...p, short: `${p.done}/${p.total}`, label: `${p.done} of ${p.total} months done` }
  }
  return null
}
