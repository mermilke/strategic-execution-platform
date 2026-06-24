'use client'
import { useRef, useLayoutEffect } from 'react'
import type { CSSProperties, TextareaHTMLAttributes } from 'react'

// A textarea with no drag handle: it starts at one line and grows downward as the
// text wraps. Height is recomputed whenever the value changes.
export default function AutoTextarea({ value, style, ...props }: {
  value: string
  style?: CSSProperties
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'style'>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [value])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      style={{ resize: 'none', overflow: 'hidden', ...style }}
      {...props}
    />
  )
}
