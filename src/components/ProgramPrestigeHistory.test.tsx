import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProgramPrestigeHistory } from './ProgramPrestigeHistory'

describe('ProgramPrestigeHistory', () => {
  it('shows compact context and progressively discloses the Season trail', () => {
    render(<ProgramPrestigeHistory history={{
      programId: 'pine-valley',
      startingPrestige: 36,
      currentPrestige: 42,
      dynastyChange: 6,
      peakPrestige: 43,
      rows: [
        { label: 'Start', seasonNumber: null, prestige: 36, change: null, current: false },
        { label: 'Season 1', seasonNumber: 1, prestige: 39, change: 3, current: false },
        { label: 'Season 2', seasonNumber: 2, prestige: 42, change: 3, current: true },
      ],
    }} />)

    expect(screen.getByText('Started 36 · +6 Dynasty · Peak 43')).toBeInTheDocument()
    const details = screen.getByText('Season-by-Season Prestige').closest('details')!
    expect(details).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Season-by-Season Prestige'))
    expect(details).toHaveAttribute('open')
    expect(screen.getByRole('table', { name: 'Season-by-Season Prestige' })).toHaveTextContent(
      'Season 2 · Current42+3',
    )
  })
})
