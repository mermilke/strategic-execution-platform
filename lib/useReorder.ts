import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent } from 'react'

type ReorderFn = (scopeId: string, itemId: string, newIndex: number, oldIndex: number) => void | Promise<void>

// Visually hidden but read by screen readers. Used inline rather than a `sr-only` class
// because this project's Tailwind build does not generate that utility.
export const srOnlyStyle: CSSProperties = {
  position: 'absolute', width: 1, height: 1, padding: 0, margin: -1,
  overflow: 'hidden', clip: 'rect(0, 0, 0, 0)', whiteSpace: 'nowrap', border: 0,
}

// Shared reordering for the admin objective / sub-objective lists. All four reorder
// callbacks take (scopeId, itemId, newIndex, oldIndex) and reload on success, so one
// hook can drive both the mouse drag and an accessible keyboard path: arrow-up/down
// moves a row, a polite live-region message announces the move, and focus returns to
// the moved row's handle once the list reloads. `nested` is set for the sub-objective
// rows, which sit inside draggable objective rows and must stop drag events bubbling.
export function useReorder(scopeId: string, count: number, reorder: ReorderFn, noun: string, nested = false) {
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)
  const gripRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const pendingFocus = useRef<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // After a keyboard move reloads the list, return focus to the row that moved.
  useEffect(() => {
    if (pendingFocus.current && gripRefs.current[pendingFocus.current]) {
      gripRefs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  })

  const onDragStart = useCallback((e: DragEvent, index: number) => {
    if (nested) e.stopPropagation()
    dragItem.current = index
  }, [nested])

  const onDragEnter = useCallback((index: number) => { dragOverItem.current = index }, [])

  const onDragEnd = useCallback(async (e: DragEvent, itemId: string) => {
    if (nested) e.stopPropagation()
    if (dragItem.current === null || dragOverItem.current === null || dragItem.current === dragOverItem.current) return
    await reorder(scopeId, itemId, dragOverItem.current, dragItem.current)
    dragItem.current = null; dragOverItem.current = null
  }, [nested, reorder, scopeId])

  const move = useCallback(async (index: number, itemId: string, title: string, dir: -1 | 1) => {
    const newIndex = index + dir
    if (newIndex < 0 || newIndex >= count) return
    pendingFocus.current = itemId
    setAnnouncement(`Moved ${noun} "${title}" to position ${newIndex + 1} of ${count}.`)
    await reorder(scopeId, itemId, newIndex, index)
  }, [count, noun, reorder, scopeId])

  const setGripRef = useCallback((itemId: string) => (el: HTMLButtonElement | null) => { gripRefs.current[itemId] = el }, [])

  return { onDragStart, onDragEnter, onDragEnd, move, announcement, setGripRef }
}
