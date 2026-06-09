import { forwardRef, useState } from 'react'
import type { KeyboardEvent } from 'react'

// Three-bar drag handle shown on draggable objective ("obj") and sub-objective ("sub") rows.
// It is a real button so the row can be reordered by keyboard: arrow up/down call the move
// handlers, and the parent keeps a ref to return focus here after the list reloads. The focus
// ring is inline (not a Tailwind focus utility) because this build does not generate those.
const VARIANTS = {
  obj: { gap: 3, padding: '4px 6px', opacity: 0.4, width: 16 },
  sub: { gap: 2.5, padding: '2px 4px', opacity: 0.35, width: 12 },
}

const DragGrip = forwardRef<HTMLButtonElement, {
  variant?: 'obj' | 'sub'
  label?: string
  onMoveUp?: () => void
  onMoveDown?: () => void
}>(function DragGrip({ variant = 'obj', label, onMoveUp, onMoveDown }, ref) {
  const v = VARIANTS[variant] || VARIANTS.obj
  const [focused, setFocused] = useState(false)

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'ArrowUp') { e.preventDefault(); onMoveUp?.() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); onMoveDown?.() }
  }

  return (
    <button
      ref={ref}
      type="button"
      onKeyDown={onKeyDown}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      aria-label={label}
      aria-keyshortcuts="ArrowUp ArrowDown"
      title={label ? `${label} (drag, or use arrow keys)` : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: v.gap, padding: v.padding, cursor: 'grab', opacity: v.opacity, flexShrink: 0, background: 'transparent', border: 'none', borderRadius: 4, outline: focused ? '2px solid #2563EB' : 'none', outlineOffset: 2 }}>
      {[0, 1, 2].map(i => <div key={i} style={{ width: v.width, height: 1.5, background: 'var(--text-muted)', borderRadius: 1 }} />)}
    </button>
  )
})

export default DragGrip
