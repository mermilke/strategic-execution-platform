import { describe, it, expect } from 'vitest'
import { previousMonday } from './briefing-context'

describe('previousMonday', () => {
  it('steps back exactly one week', () => {
    expect(previousMonday('2026-06-08')).toBe('2026-06-01')
  })

  it('crosses month and year boundaries correctly', () => {
    expect(previousMonday('2026-01-05')).toBe('2025-12-29')
    expect(previousMonday('2026-03-02')).toBe('2026-02-23')
  })
})
