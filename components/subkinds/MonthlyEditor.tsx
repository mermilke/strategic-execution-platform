'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { MONTHS, MONTHLY_STATUSES, monthlyProgress } from '../../lib/subkinds'

const NEXT: Record<string, string> = { not_started: 'in_progress', in_progress: 'done', done: 'not_started' }
const HEX = Object.fromEntries(MONTHLY_STATUSES.map(s => [s.key, s.hex]))
const LABEL = Object.fromEntries(MONTHLY_STATUSES.map(s => [s.key, s.label]))

// A 12-month grid for a 'monthly' sub. Tap a month to cycle its status; each
// change upserts immediately. Read-only on the dashboards.
export default function MonthlyEditor({ subId, readOnly }: { subId: string; readOnly?: boolean }) {
  const [byMonth, setByMonth] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.from('monthly_checks').select('month, status').eq('sub_objective_id', subId)
      .then(({ data }) => {
        if (!alive) return
        const m: Record<string, string> = {}
        ;(data || []).forEach(r => { m[r.month] = r.status })
        setByMonth(m)
        setLoading(false)
      })
    return () => { alive = false }
  }, [subId])

  async function cycle(monthKey: string) {
    if (readOnly) return
    const next = NEXT[byMonth[monthKey] || 'not_started']
    setByMonth(prev => ({ ...prev, [monthKey]: next }))
    await supabase.from('monthly_checks')
      .upsert({ sub_objective_id: subId, month: monthKey, status: next, updated_at: new Date().toISOString() },
        { onConflict: 'sub_objective_id,month' })
  }

  if (loading) return <div style={muted}>Loading…</div>
  const prog = monthlyProgress(MONTHS.map(m => ({ month: m.key, status: byMonth[m.key] || 'not_started' })))

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: prog.complete ? '#059669' : 'var(--text-secondary)' }}>
          {prog.done}/{prog.total} months done
        </span>
        {!readOnly && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Tap a month to cycle: not started → in progress → done
          </span>
        )}
      </div>
      <div style={gridWrap}>
        {MONTHS.map(m => {
          const st = byMonth[m.key] || 'not_started'
          return (
            <button key={m.key} onClick={() => cycle(m.key)} disabled={readOnly}
              title={LABEL[st]}
              style={{
                ...cell,
                cursor: readOnly ? 'default' : 'pointer',
                background: st === 'not_started' ? 'var(--bg-base)' : `${HEX[st]}1f`,
                borderColor: st === 'not_started' ? 'var(--border)' : HEX[st],
                color: st === 'not_started' ? 'var(--text-muted)' : HEX[st],
              }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{m.label}</span>
              <span style={{ fontSize: 9, fontWeight: 600, marginTop: 2 }}>
                {st === 'done' ? '✓ Done' : st === 'in_progress' ? 'In prog.' : '—'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: 13, padding: '6px 0' }
const gridWrap: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))', gap: 6 }
const cell: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 4px', borderRadius: 8, border: '1px solid var(--border)', fontFamily: 'inherit' }
