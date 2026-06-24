// Shared shapes for the manager dashboard view layer. The data is assembled by
// ManagerDashboard from a set of Supabase joins (objectives -> sub-objectives ->
// weekly check-ins, plus opportunities), then handed to the presentational
// components below. These types capture only the fields those components read.
import type { SpecialProgress } from '../../lib/subkinds'

export type DashCheckin = {
  week_start: string
  status?: string | null
  progress_this_week?: string | null
  support_needed?: string | null
  comments?: string | null
  discuss_in_meeting?: boolean | null
}

export type DashOpportunity = {
  id?: string
  customer?: string | null
  project_description?: string | null
  segment?: string | null
  estimated_value_text?: string | null
  status?: string | null
  sort_order?: number | null
  created_at?: string | null
}

export type DashSub = {
  id: string
  title: string
  short_title?: string | null
  is_implicit?: boolean | null
  kind?: string | null
  // progress descriptor for a training/monthly sub, attached by attachSpecialProgress
  special?: SpecialProgress | null
  thisWeekCheckin?: DashCheckin | null
  weekly_checkins?: DashCheckin[] | null
}

export type DashObjective = {
  id: string
  title: string
  short_title?: string | null
  opportunity_target?: number | null
  objective_opportunities?: DashOpportunity[] | null
  sub_objectives: DashSub[]
}

export type DashUser = {
  id: string
  full_name?: string | null
  email?: string | null
  submitted: number
  totalSubs: number
  atRisk: number
  needsSupport: number
  offTrack: number
  objectives: DashObjective[]
  // explicit "week 0" from admin, if set
  start_week?: string | null
  // resolved week 0 used by the stale counter: start_week, else first check-in week
  startWeek?: string | null
}

// The history modal opens for a single sub-objective or a whole objective's subs.
export type HistoryModalState = {
  type: 'objective' | 'sub'
  title: string
  userName?: string | null
  subs: DashSub[]
}
