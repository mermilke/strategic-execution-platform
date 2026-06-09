import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SnapshotTiles from './SnapshotTiles'
import type { DashUser } from './types'

const weekOptions = ['2026-06-01']
const selectedWeek = '2026-06-01'

// A deliberately minimal fixture; cast to the full row type the component expects.
const data = [
  {
    id: 'u1',
    full_name: 'Dana Whitfield',
    objectives: [
      {
        id: 'o1',
        short_title: 'Revenue',
        title: 'Grow revenue',
        sub_objectives: [
          { id: 's1', title: 'Close deals', thisWeekCheckin: { status: 'at_risk', progress_this_week: true } },
        ],
      },
    ],
  },
] as unknown as DashUser[]

describe('SnapshotTiles', () => {
  it('renders a tile per report with its objective title', () => {
    render(<SnapshotTiles data={data} weekOptions={weekOptions} selectedWeek={selectedWeek}
      setExpandedUsers={vi.fn()} setHighlightedSub={vi.fn()} />)
    expect(screen.getByText('Dana Whitfield')).toBeInTheDocument()
    expect(screen.getByText('1. Revenue')).toBeInTheDocument()
  })

  it('expands the report when its name is clicked', () => {
    const setExpandedUsers = vi.fn()
    render(<SnapshotTiles data={data} weekOptions={weekOptions} selectedWeek={selectedWeek}
      setExpandedUsers={setExpandedUsers} setHighlightedSub={vi.fn()} />)
    fireEvent.click(screen.getByText('Dana Whitfield'))
    expect(setExpandedUsers).toHaveBeenCalledOnce()
    // it passes an updater that adds this user's id to the set
    const updater = setExpandedUsers.mock.calls[0][0]
    expect(updater(new Set())).toEqual(new Set(['u1']))
  })

  it('highlights the sub-objective when its bar is clicked', () => {
    const setHighlightedSub = vi.fn()
    render(<SnapshotTiles data={data} weekOptions={weekOptions} selectedWeek={selectedWeek}
      setExpandedUsers={vi.fn()} setHighlightedSub={setHighlightedSub} />)
    fireEvent.click(screen.getByTitle('Close deals'))
    expect(setHighlightedSub).toHaveBeenCalledWith('s1')
  })
})
