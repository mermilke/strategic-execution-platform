import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import SummaryCards from './SummaryCards'

describe('SummaryCards', () => {
  it('renders the four headline stats with their values', () => {
    render(<SummaryCards totalAtRisk={3} totalNeedsSupport={1} totalNotSubmitted={2} staleCount={4} />)
    expect(screen.getByText('At Risk Items').previousSibling).toHaveTextContent('3')
    expect(screen.getByText('Needs Manager Support').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Missing Submissions').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('No Update (2+ weeks)').previousSibling).toHaveTextContent('4')
  })

  it('renders zeros without crashing', () => {
    render(<SummaryCards totalAtRisk={0} totalNeedsSupport={0} totalNotSubmitted={0} staleCount={0} />)
    expect(screen.getByText('At Risk Items').previousSibling).toHaveTextContent('0')
  })
})
