import { describe, it, expect } from 'vitest'
import { isOneOnOneSubject, meetingPatternsFor } from './calendar-match'

describe('isOneOnOneSubject', () => {
  it('matches the common name-based 1:1 titles', () => {
    expect(isOneOnOneSubject('Dana 121', 'Dana', 'Sam')).toBe(true)
    expect(isOneOnOneSubject('Dana 1:1', 'Dana', 'Sam')).toBe(true)
    expect(isOneOnOneSubject('Sam - Dana', 'Dana', 'Sam')).toBe(true)
    expect(isOneOnOneSubject('Dana / Sam', 'Dana', 'Sam')).toBe(true)
  })

  it('matches a name plus a 1:1 marker even without a set pattern', () => {
    expect(isOneOnOneSubject('Weekly 1:1 with Dana', 'Dana', 'Sam')).toBe(true)
    expect(isOneOnOneSubject('Dana <> Sam 1-1', 'Dana', 'Sam')).toBe(true)
  })

  it('is case insensitive on both names and the subject', () => {
    expect(isOneOnOneSubject('DANA 121', 'dana', 'SAM')).toBe(true)
  })

  it('does not treat an ordinary meeting that mentions the name as a 1:1', () => {
    // the exact divergence the cron already avoided and the briefing used to miss
    expect(isOneOnOneSubject('Dana onboarding', 'Dana', 'Sam')).toBe(false)
    expect(isOneOnOneSubject('Team sync with Dana', 'Dana', 'Sam')).toBe(false)
  })

  it('does not match a different person', () => {
    expect(isOneOnOneSubject('Morgan 1:1', 'Dana', 'Sam')).toBe(false)
  })

  it('handles a missing subject', () => {
    expect(isOneOnOneSubject(null, 'Dana', 'Sam')).toBe(false)
    expect(isOneOnOneSubject(undefined, 'Dana', 'Sam')).toBe(false)
  })
})

describe('meetingPatternsFor', () => {
  it('builds lowercase patterns from both first names', () => {
    expect(meetingPatternsFor('Dana', 'Sam')).toContain('dana 121')
    expect(meetingPatternsFor('Dana', 'Sam')).toContain('sam - dana')
  })
})
