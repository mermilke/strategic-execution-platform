import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { getCurrentWeekStart } from '../lib/utils'

// A training/monthly sub tracks its own structured list, so the DR's own
// dashboard should render it as a read-only SubKindBlock (not a weekly status
// card) and leave it out of the "submitted X/Y" weekly tally.

// Stub the block so we can assert it renders without mounting the editors
// (which would try to self-load their rows from Supabase).
vi.mock('./subkinds/SubKindBlock', () => ({
  default: ({ sub }: { sub: { kind?: string | null; title: string } }) => (
    <div data-testid="subkind" data-kind={sub.kind ?? ''}>{sub.title}</div>
  ),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}))

const week = getCurrentWeekStart()

// One objective with a standard weekly sub (checked in this week) plus a
// training and a monthly sub.
const objectivesResult = {
  data: [
    {
      id: 'o1', title: 'Grow the practice', target_date: null, is_active: true, sort_order: 1,
      sub_objectives: [
        { id: 's1', title: 'Close deals', kind: 'standard', is_active: true, sort_order: 1,
          weekly_checkins: [{ week_start: week, status: 'on_track', progress_this_week: 'Yes', support_needed: null, comments: null, discuss_in_meeting: false }] },
        { id: 's2', title: 'Quarterly training', kind: 'training', is_active: true, sort_order: 2, weekly_checkins: [] },
        { id: 's3', title: 'Monthly review', kind: 'monthly', is_active: true, sort_order: 3, weekly_checkins: [] },
      ],
    },
  ],
}

// supabase-js query builders are thenable and chainable; every method returns
// the same object, which resolves to the fixture when awaited.
vi.mock('../lib/supabase', () => {
  const builder: any = {}
  for (const m of ['from', 'select', 'eq', 'order']) builder[m] = () => builder
  builder.then = (resolve: (v: unknown) => unknown) => resolve(objectivesResult)
  return { supabase: builder }
})

import DirectReportDashboard from './DirectReportDashboard'

describe('DirectReportDashboard special kinds', () => {
  it('renders training/monthly subs as blocks and excludes them from the weekly tally', async () => {
    render(<DirectReportDashboard currentUser={{ id: 'u1', full_name: 'Yuki Tanaka' }} />)

    // Both special subs render as their own block, tagged by kind.
    const blocks = await screen.findAllByTestId('subkind')
    expect(blocks.map(b => b.getAttribute('data-kind')).sort()).toEqual(['monthly', 'training'])

    // The standard sub still renders as a normal card.
    expect(screen.getByText('A. Close deals')).toBeInTheDocument()

    // Only the one standard sub counts toward submitted/total (special subs are
    // off the weekly cadence): 1 submitted of 1, not 1 of 3.
    await waitFor(() => expect(screen.getByText('1 / 1 submitted')).toBeInTheDocument())
  })
})
