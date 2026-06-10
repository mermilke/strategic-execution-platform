import { describe, it, expect } from 'vitest'
import { getCurrentWeekStart, getLastWeekStart, formatWeekLabel, fmtDate, STATUS_CONFIG, oauthExpiresAt } from './utils'
import type { StatusKey } from './utils'

const dayOf = (yyyymmdd: string) => new Date(yyyymmdd + 'T00:00:00').getDay()

describe('week helpers', () => {
  it('getCurrentWeekStart lands on a Monday', () => {
    expect(dayOf(getCurrentWeekStart())).toBe(1)
  })

  it('getLastWeekStart is exactly seven days before this week', () => {
    const cur = new Date(getCurrentWeekStart() + 'T00:00:00Z')
    const last = new Date(getLastWeekStart() + 'T00:00:00Z')
    expect((cur.getTime() - last.getTime()) / 86_400_000).toBe(7)
  })

  it('formatWeekLabel reads like a date a person would write', () => {
    expect(formatWeekLabel('2026-06-01')).toBe('Week of Jun 1, 2026')
  })
})

describe('fmtDate', () => {
  it('renders a bare YYYY-MM-DD on the same calendar day in any timezone', () => {
    // Parsed as local midnight, not UTC, so it never slips to the prior day.
    expect(fmtDate('2026-06-06')).toBe('Jun 6, 2026')
  })

  it('returns an empty string for a missing value', () => {
    expect(fmtDate(null)).toBe('')
    expect(fmtDate(undefined)).toBe('')
  })
})

describe('STATUS_CONFIG', () => {
  const statuses: StatusKey[] = ['on_track', 'at_risk', 'off_track', 'on_hold', 'not_started', 'completed']

  it('has an entry for every check-in status', () => {
    for (const s of statuses) {
      expect(STATUS_CONFIG[s], `missing config for ${s}`).toBeDefined()
    }
  })

  it('gives each status a label and a hex color', () => {
    for (const s of statuses) {
      expect(STATUS_CONFIG[s].label).toBeTruthy()
      expect(STATUS_CONFIG[s].hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })
})

describe('oauthExpiresAt', () => {
  it('returns a valid ISO timestamp roughly expires_in seconds out', () => {
    const iso = oauthExpiresAt(3600)
    const ms = new Date(iso).getTime() - Date.now()
    expect(Number.isNaN(new Date(iso).getTime())).toBe(false)
    expect(ms).toBeGreaterThan(3590_000)
    expect(ms).toBeLessThan(3610_000)
  })

  it('falls back to one hour for a missing or non-numeric value', () => {
    for (const bad of [undefined, null, NaN, 'abc', 0, -10]) {
      const ms = new Date(oauthExpiresAt(bad)).getTime() - Date.now()
      expect(Number.isNaN(ms)).toBe(false)
      expect(ms).toBeGreaterThan(3590_000)
      expect(ms).toBeLessThan(3610_000)
    }
  })
})
