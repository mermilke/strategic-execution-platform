import { startOfWeek, format, subWeeks } from 'date-fns'

// Always returns the most recent Monday as YYYY-MM-DD
export function getCurrentWeekStart() {
  const now = new Date()
  const monday = startOfWeek(now, { weekStartsOn: 1 })
  return format(monday, 'yyyy-MM-dd')
}

// Returns last week's Monday
export function getLastWeekStart() {
  const now = new Date()
  const monday = startOfWeek(now, { weekStartsOn: 1 })
  const lastMonday = subWeeks(monday, 1)
  return format(lastMonday, 'yyyy-MM-dd')
}

// Format a date string like "Week of Jan 6, 2025"
export function formatWeekLabel(dateStr) {
  const date = new Date(dateStr + 'T00:00:00')
  return `Week of ${format(date, 'MMM d, yyyy')}`
}

export const STATUS_CONFIG = {
  on_track:    { label: 'On Track',    color: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/25', dot: 'bg-emerald-500', hex: '#34D399' },
  at_risk:     { label: 'At Risk',     color: 'bg-amber-500/15  text-amber-700  border-amber-500/25',  dot: 'bg-amber-500', hex: '#F59E0B'   },
  off_track:   { label: 'Off Track',   color: 'bg-red-500/15    text-red-700    border-red-500/25',    dot: 'bg-red-500', hex: '#D62027'     },
  on_hold:     { label: 'On Hold',     color: 'bg-purple-500/15 text-purple-700 border-purple-500/25', dot: 'bg-purple-500', hex: '#A78BFA' },
  not_started: { label: 'Not Started', color: 'bg-slate-500/15  text-slate-600  border-slate-500/25',  dot: 'bg-slate-500', hex: '#94A3B8' },
  completed:   { label: 'Completed',   color: 'bg-sky-500/15    text-sky-700    border-sky-500/25',    dot: 'bg-sky-500', hex: '#38BDF8'     },
}
