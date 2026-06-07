import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeekFilterBar from './WeekFilterBar'

const weekOptions = ['2026-05-25', '2026-06-01', '2026-06-08']

function setup(overrides = {}) {
  const props = {
    selectedWeek: '2026-06-01',
    setSelectedWeek: vi.fn(),
    weekOptions,
    thisWeek: '2026-06-08',
    weekIdx: 1,
    goBack: vi.fn(),
    goForward: vi.fn(),
    filterStatus: 'all',
    applyFilter: vi.fn(),
    totalNotSubmitted: 2,
    totalAtRisk: 3,
    totalNeedsSupport: 1,
    staleCount: 4,
    ...overrides,
  }
  render(<WeekFilterBar {...props} />)
  return props
}

describe('WeekFilterBar', () => {
  it('renders one option per week and marks the current week', () => {
    setup()
    expect(screen.getAllByRole('option')).toHaveLength(3)
    expect(screen.getByRole('option', { name: /\(current\)/ })).toBeInTheDocument()
  })

  it('shows the filter chips with their counts', () => {
    setup()
    expect(screen.getByRole('button', { name: 'Missing (2)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'At Risk (3)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Needs Support (1)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No Update (4)' })).toBeInTheDocument()
  })

  it('calls applyFilter when a chip is clicked', () => {
    const { applyFilter } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'At Risk (3)' }))
    expect(applyFilter).toHaveBeenCalledWith('at_risk')
  })

  it('disables Previous on the first week and Next on the last', () => {
    setup({ weekIdx: 0 })
    expect(screen.getByTitle('Previous week')).toBeDisabled()
    expect(screen.getByTitle('Next week')).not.toBeDisabled()
  })

  it('steps the week with the arrow buttons', () => {
    const { goBack, goForward } = setup()
    fireEvent.click(screen.getByTitle('Previous week'))
    fireEvent.click(screen.getByTitle('Next week'))
    expect(goBack).toHaveBeenCalledOnce()
    expect(goForward).toHaveBeenCalledOnce()
  })
})
