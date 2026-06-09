import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DragGrip from './DragGrip'

describe('DragGrip', () => {
  it('renders three handle bars', () => {
    const { container } = render(<DragGrip />)
    const grip = container.firstChild as HTMLElement
    expect(grip.childNodes).toHaveLength(3)
  })

  it('uses a narrower bar for the sub variant than the obj variant', () => {
    const { container: obj } = render(<DragGrip variant="obj" />)
    const { container: sub } = render(<DragGrip variant="sub" />)
    const objBar = obj.firstChild!.firstChild as HTMLElement
    const subBar = sub.firstChild!.firstChild as HTMLElement
    expect(objBar.style.width).toBe('16px')
    expect(subBar.style.width).toBe('12px')
  })

  it('falls back to the obj variant for an unknown variant', () => {
    // @ts-expect-error intentionally passing an unknown variant to test the fallback
    const { container } = render(<DragGrip variant="nope" />)
    const bar = container.firstChild!.firstChild as HTMLElement
    expect(bar.style.width).toBe('16px')
  })

  it('is a button exposing its label to assistive tech', () => {
    render(<DragGrip label="Reorder objective 2 of 5" />)
    const btn = screen.getByRole('button', { name: 'Reorder objective 2 of 5' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown')
  })

  it('moves up on ArrowUp and down on ArrowDown', () => {
    const onMoveUp = vi.fn()
    const onMoveDown = vi.fn()
    render(<DragGrip label="Reorder" onMoveUp={onMoveUp} onMoveDown={onMoveDown} />)
    const btn = screen.getByRole('button', { name: 'Reorder' })
    fireEvent.keyDown(btn, { key: 'ArrowUp' })
    expect(onMoveUp).toHaveBeenCalledTimes(1)
    expect(onMoveDown).not.toHaveBeenCalled()
    fireEvent.keyDown(btn, { key: 'ArrowDown' })
    expect(onMoveDown).toHaveBeenCalledTimes(1)
  })

  it('ignores keys other than the arrows', () => {
    const onMoveUp = vi.fn()
    const onMoveDown = vi.fn()
    render(<DragGrip label="Reorder" onMoveUp={onMoveUp} onMoveDown={onMoveDown} />)
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder' }), { key: 'Enter' })
    expect(onMoveUp).not.toHaveBeenCalled()
    expect(onMoveDown).not.toHaveBeenCalled()
  })
})
