import { describe, it, expect } from 'vitest'
import {
  isSessionComplete,
  trainingProgress,
  monthlyProgress,
  specialProgress,
  quarterOf,
  monthsForYear,
  isSpecialKind,
  MONTHS,
} from './subkinds'

const fullSession = (date: string) => ({
  session_date: date,
  topic: 'Onboarding',
  participants: 'Team',
  follow_up: 'Email recap',
  next_steps: 'Schedule round two',
  results: 'Went well',
})

describe('isSpecialKind', () => {
  it('recognizes the two special kinds and nothing else', () => {
    expect(isSpecialKind('training')).toBe(true)
    expect(isSpecialKind('monthly')).toBe(true)
    expect(isSpecialKind('standard')).toBe(false)
    expect(isSpecialKind(null)).toBe(false)
  })
})

describe('quarterOf', () => {
  it('maps a date to its calendar quarter', () => {
    expect(quarterOf('2026-02-10')).toBe(1)
    expect(quarterOf('2026-05-01')).toBe(2)
    expect(quarterOf('2026-09-30')).toBe(3)
    expect(quarterOf('2026-12-31')).toBe(4)
    expect(quarterOf(null)).toBe(null)
  })
})

describe('isSessionComplete', () => {
  it('requires every field', () => {
    expect(isSessionComplete(fullSession('2026-01-05'))).toBe(true)
    expect(isSessionComplete({ ...fullSession('2026-01-05'), results: '' })).toBe(false)
    expect(isSessionComplete({ ...fullSession('2026-01-05'), session_date: null })).toBe(false)
    expect(isSessionComplete(null)).toBe(false)
  })
})

describe('trainingProgress', () => {
  it('is complete only when all four quarters have a complete session', () => {
    const allFour = ['2026-01-05', '2026-04-05', '2026-07-05', '2026-10-05'].map(fullSession)
    expect(trainingProgress(allFour).complete).toBe(true)
    expect(trainingProgress(allFour).quartersCovered.size).toBe(4)
  })

  it('ignores incomplete sessions when counting quarters', () => {
    const sessions = [fullSession('2026-01-05'), { ...fullSession('2026-04-05'), topic: '' }]
    const p = trainingProgress(sessions)
    expect(p.quartersCovered.size).toBe(1) // Q2 session is incomplete
    expect(p.complete).toBe(false)
  })
})

describe('monthlyProgress', () => {
  it('counts only months marked done and completes at all twelve', () => {
    const checks = MONTHS.map(m => ({ month: m.key, status: 'done' }))
    const p = monthlyProgress(checks)
    expect(p.done).toBe(12)
    expect(p.complete).toBe(true)
    expect(p.pct).toBe(100)
  })

  it('treats missing or non-done months as not done', () => {
    const p = monthlyProgress([{ month: MONTHS[0].key, status: 'done' }, { month: MONTHS[1].key, status: 'in_progress' }])
    expect(p.done).toBe(1)
    expect(p.complete).toBe(false)
  })
})

describe('specialProgress', () => {
  it('returns null for a standard sub', () => {
    expect(specialProgress({ kind: 'standard' }, [])).toBe(null)
  })

  it('summarizes a training sub', () => {
    const p = specialProgress({ kind: 'training' }, [fullSession('2026-01-05')])
    expect(p?.kind).toBe('training')
    expect(p?.short).toBe('1/4')
  })

  it('summarizes a monthly sub', () => {
    const checks = MONTHS.slice(0, 3).map(m => ({ month: m.key, status: 'done' }))
    const p = specialProgress({ kind: 'monthly' }, checks)
    expect(p?.kind).toBe('monthly')
    expect(p?.short).toBe('3/12')
  })
})

describe('monthsForYear', () => {
  it('returns twelve YYYY-MM keys for the given year', () => {
    const months = monthsForYear(2026)
    expect(months).toHaveLength(12)
    expect(months[0].key).toBe('2026-01')
    expect(months[11].key).toBe('2026-12')
  })
})
