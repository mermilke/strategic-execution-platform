'use client'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { supabase } from '../../lib/supabase'
import { QUARTERS, quarterOf, isSessionComplete, trainingProgress } from '../../lib/subkinds'
import type { Database } from '../../lib/database.types'
import AutoTextarea from './AutoTextarea'

type Session = Database['public']['Tables']['training_sessions']['Row']

const FIELDS: [keyof Session, string, 'date' | 'textarea'][] = [
  ['session_date', 'Date', 'date'],
  ['topic', 'Content', 'textarea'],
  ['participants', 'Participants', 'textarea'],
  ['follow_up', 'Follow-up', 'textarea'],
  ['next_steps', 'Next steps', 'textarea'],
  ['results', 'Results', 'textarea'],
]

const todayStr = () => new Date().toISOString().slice(0, 10)

// The 'topic' label reads as planned vs delivered depending on the date:
// future/undated -> "Content to cover"; past/today -> "Content covered".
function labelFor(field: keyof Session, defLabel: string, row: Session) {
  if (field !== 'topic') return defLabel
  return (!row.session_date || row.session_date > todayStr()) ? 'Content to cover' : 'Content covered'
}

// Quarterly session log for a 'training' sub. Each session counts only when every
// field is filled; the sub is complete when all four quarters have one. Read-only
// on the dashboards.
export default function TrainingEditor({ subId, readOnly }: { subId: string; readOnly?: boolean }) {
  const [rows, setRows] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    supabase.from('training_sessions').select('*').eq('sub_objective_id', subId)
      .order('session_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (alive) { setRows(data || []); setLoading(false) } })
    return () => { alive = false }
  }, [subId])

  async function addRow() {
    const { data } = await supabase.from('training_sessions')
      .insert({ sub_objective_id: subId, sort_order: rows.length }).select().single()
    if (data) setRows(prev => [...prev, data])
  }
  async function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    await supabase.from('training_sessions').delete().eq('id', id)
  }
  function setLocal(id: string, field: keyof Session, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }
  async function persist(id: string, field: keyof Session, value: string) {
    const patch = { [field]: value || null, updated_at: new Date().toISOString() } as Database['public']['Tables']['training_sessions']['Update']
    await supabase.from('training_sessions').update(patch).eq('id', id)
  }

  if (loading) return <div style={muted}>Loading sessions…</div>

  const prog = trainingProgress(rows)

  return (
    <div>
      <div style={quarterBar}>
        {QUARTERS.map((q, i) => {
          const covered = prog.quartersCovered.has(i + 1)
          return (
            <span key={q.key} style={{ ...quarterPill, background: covered ? 'rgba(52,211,153,0.15)' : 'rgba(148,163,184,0.12)', color: covered ? '#059669' : 'var(--text-muted)', border: `1px solid ${covered ? 'rgba(52,211,153,0.4)' : 'var(--border)'}` }}>
              {covered ? '✓ ' : ''}{q.label}
            </span>
          )
        })}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: prog.complete ? '#059669' : 'var(--text-muted)', fontWeight: 600 }}>
          {prog.completeSessions} complete · {prog.complete ? 'all quarters covered' : 'need 1 per quarter'}
        </span>
      </div>

      {rows.length === 0 && <div style={muted}>No sessions yet. Add one per quarter (at least 4 total).</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((r, idx) => {
          const done = isSessionComplete(r)
          const q = quarterOf(r.session_date)
          return (
            <div key={r.id} style={{ ...card, borderColor: done ? 'rgba(52,211,153,0.4)' : 'var(--border)' }}>
              <div style={cardHeader}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Session {idx + 1}{q ? ` · Q${q}` : ''}
                </span>
                <span style={{ fontSize: 11, fontWeight: 600, color: done ? '#059669' : '#B45309' }}>
                  {done ? '✓ Complete' : 'Incomplete'}
                </span>
                {!readOnly && (
                  <button onClick={() => removeRow(r.id)} style={delBtn} title="Delete session" aria-label="Delete session">✕</button>
                )}
              </div>
              <div style={grid}>
                {FIELDS.map(([field, label, type]) => (
                  <label key={field} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={fieldLabel}>{labelFor(field, label, r)}</span>
                    {readOnly ? (
                      <span style={readVal}>{(r[field] as string) || <em style={{ color: 'var(--text-muted)' }}>—</em>}</span>
                    ) : type === 'date' ? (
                      <input type="date" value={r.session_date || ''} style={input}
                        onChange={e => { setLocal(r.id, 'session_date', e.target.value); persist(r.id, 'session_date', e.target.value) }} />
                    ) : (
                      <AutoTextarea value={(r[field] as string) || ''} style={textarea}
                        onChange={e => setLocal(r.id, field, e.target.value)}
                        onBlur={e => persist(r.id, field, e.target.value)} />
                    )}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {!readOnly && (
        <button onClick={addRow} style={addBtn}>+ Add training session</button>
      )}
    </div>
  )
}

const muted: CSSProperties = { color: 'var(--text-muted)', fontSize: 13, padding: '6px 0' }
const quarterBar: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }
const quarterPill: CSSProperties = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999 }
const card: CSSProperties = { background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 10, padding: 10 }
const cardHeader: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }
const delBtn: CSSProperties = { marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 2 }
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }
const fieldLabel: CSSProperties = { fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-muted)' }
const input: CSSProperties = { padding: '4px 6px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 11, width: '100%' }
const textarea: CSSProperties = { ...input }
const readVal: CSSProperties = { fontSize: 11, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }
const addBtn: CSSProperties = { marginTop: 10, padding: '8px 14px', borderRadius: 8, border: '1px dashed var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer' }
