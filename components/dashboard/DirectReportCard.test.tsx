import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import DirectReportCard from './DirectReportCard'
import type { DashUser } from './types'

const weekOptions = ['2026-06-01']
const selectedWeek = '2026-06-01'

// A deliberately minimal fixture; cast to the full row type the component expects.
const user = {
  id: 'u1',
  full_name: 'Dana Whitfield',
  email: 'dana.whitfield@example.com',
  submitted: 2,
  totalSubs: 3,
  atRisk: 1,
  needsSupport: 0,
  offTrack: 0,
  objectives: [
    {
      id: 'o1',
      title: 'Grow revenue',
      sub_objectives: [
        { id: 's1', title: 'Close deals', thisWeekCheckin: { status: 'at_risk', progress_this_week: true } },
      ],
    },
  ],
} as unknown as DashUser

function setup(overrides = {}) {
  const props = {
    u: user,
    expandedUsers: new Set<string>(),
    setExpandedUsers: vi.fn(),
    router: { push: vi.fn() },
    filterStatus: 'all',
    weekOptions,
    selectedWeek,
    highlightedSub: null,
    setHistoryModal: vi.fn(),
    setExpandedModalSubs: vi.fn(),
    ...overrides,
  }
  render(<DirectReportCard {...props} />)
  return props
}

describe('DirectReportCard', () => {
  it('shows the report name, email and submission count when collapsed', () => {
    setup()
    expect(screen.getByText('Dana Whitfield')).toBeInTheDocument()
    expect(screen.getByText('dana.whitfield@example.com')).toBeInTheDocument()
    expect(screen.getByText('2/3')).toBeInTheDocument()
  })

  it('renders an alert chip for at-risk items', () => {
    setup()
    expect(screen.getByText('1 at risk')).toBeInTheDocument()
  })

  it('hides objective detail until expanded', () => {
    setup()
    expect(screen.queryByText(/Grow revenue/)).not.toBeInTheDocument()
  })

  it('shows objectives once the user is in the expanded set', () => {
    setup({ expandedUsers: new Set(['u1']) })
    expect(screen.getByText(/Grow revenue/)).toBeInTheDocument()
  })

  it('toggles expansion when the header is clicked', () => {
    const { setExpandedUsers } = setup()
    fireEvent.click(screen.getByText('Dana Whitfield'))
    expect(setExpandedUsers).toHaveBeenCalledOnce()
    const updater = setExpandedUsers.mock.calls[0][0]
    expect(updater(new Set())).toEqual(new Set(['u1']))
  })

  it('navigates to the view-as URL without toggling expansion', () => {
    const { router, setExpandedUsers } = setup()
    fireEvent.click(screen.getByTitle('View as Dana Whitfield'))
    expect(router.push).toHaveBeenCalledWith('/dashboard?viewAs=u1')
    expect(setExpandedUsers).not.toHaveBeenCalled()
  })
})
