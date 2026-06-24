import { supabase } from './supabase'
import { SPECIAL_KINDS, specialProgress, type SpecialProgress } from './subkinds'

// Sub with the loaded progress descriptor attached. The dashboards read `special`.
type SubLike = { id: string; kind?: string | null; special?: SpecialProgress | null }
type ObjLike = { sub_objectives?: SubLike[] | null }

// Given a flat list of objectives (each with `.sub_objectives`), bulk-load the
// structured-list rows for every special sub (training/monthly) and attach
// `sub.special`. Mutates the subs in place and returns the objectives.
export async function attachSpecialProgress<T extends ObjLike>(objectives: T[]): Promise<T[]> {
  const subs = (objectives || []).flatMap(o => o.sub_objectives || [])
  const special = subs.filter(s => (SPECIAL_KINDS as readonly string[]).includes(s.kind || ''))
  if (!special.length) return objectives

  const idsOf = (kind: string) => special.filter(s => s.kind === kind).map(s => s.id)
  const trainingIds = idsOf('training')
  const monthlyIds = idsOf('monthly')

  const [trainingRows, monthlyRows] = await Promise.all([
    trainingIds.length
      ? supabase.from('training_sessions').select('*').in('sub_objective_id', trainingIds).then(r => r.data || [])
      : Promise.resolve([] as any[]),
    monthlyIds.length
      ? supabase.from('monthly_checks').select('sub_objective_id, month, status').in('sub_objective_id', monthlyIds).then(r => r.data || [])
      : Promise.resolve([] as any[]),
  ])

  const group = (rows: any[]) => {
    const g: Record<string, any[]> = {}
    for (const r of rows) (g[r.sub_objective_id] || (g[r.sub_objective_id] = [])).push(r)
    return g
  }
  const tg = group(trainingRows), mg = group(monthlyRows)
  for (const s of special) {
    const rows = s.kind === 'training' ? tg[s.id] : mg[s.id]
    s.special = specialProgress(s, rows || [])
  }
  return objectives
}
