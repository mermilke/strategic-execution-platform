'use client'
import type { CSSProperties } from 'react'
import TrainingEditor from './TrainingEditor'
import MonthlyEditor from './MonthlyEditor'

type Sub = { id: string; title: string; kind?: string | null; is_implicit?: boolean | null }

// A special sub-kind block (training / monthly). Used both on the check-in form
// (editable) and on the dashboards (readOnly).
export default function SubKindBlock({ sub, subLabel, readOnly, titleClassName = 'text-sm font-semibold mb-2', titleColor = 'var(--text-primary)' }: {
  sub: Sub
  subLabel?: string | null
  readOnly?: boolean
  titleClassName?: string
  titleColor?: CSSProperties['color']
}) {
  return (
    <div className="rounded-lg px-3 py-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {!sub.is_implicit && subLabel != null && (
        <div className={titleClassName} style={{ color: titleColor }}>{subLabel}. {sub.title}</div>
      )}
      {sub.kind === 'training' && <TrainingEditor subId={sub.id} readOnly={readOnly} />}
      {sub.kind === 'monthly' && <MonthlyEditor subId={sub.id} readOnly={readOnly} />}
    </div>
  )
}
