import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProgramReputationSnapshot } from '../dynasty'
import { ProgramReputationLabel, ProgramReputationSummary } from './ProgramReputationSummary'

function reputation(
  overrides: Partial<ProgramReputationSnapshot> = {},
): ProgramReputationSnapshot {
  return {
    programId: 'pine-valley',
    asOfCompletedSeasonNumber: 3,
    completedSeasons: 3,
    score: 79.4,
    tier: 'elite',
    trend: 'rising',
    facts: [
      { kind: 'recent-national-championship', seasonNumber: 3, seasonsAgo: 0 },
      { kind: 'multiple-deep-tournament-runs', count: 2, windowSeasons: 3 },
      { kind: 'strong-aggregate-record', wins: 63, losses: 9, seasons: 3 },
    ],
    ...overrides,
  }
}

describe('ProgramReputationLabel', () => {
  it('renders Rising and Falling accessibly with directional arrows', () => {
    const { rerender } = render(<p>Reputation <ProgramReputationLabel reputation={reputation()} /></p>)
    expect(screen.getByText('↑')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(/Rising/)).toHaveClass('visually-hidden')

    rerender(<p>Reputation <ProgramReputationLabel reputation={reputation({ tier: 'regional', trend: 'falling' })} /></p>)
    expect(screen.getByText('↓')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText(/Falling/)).toHaveClass('visually-hidden')
  })

  it('shows Steady accessibly without a sideways arrow', () => {
    render(<p>Reputation <ProgramReputationLabel reputation={reputation({ trend: 'steady' })} /></p>)
    expect(screen.getByText(/Steady/)).toHaveClass('visually-hidden')
    expect(screen.queryByText('→')).not.toBeInTheDocument()
  })
})

describe('ProgramReputationSummary', () => {
  it('renders at most the supplied structured facts without exposing the raw score', () => {
    render(<ProgramReputationSummary reputation={reputation()} />)
    expect(screen.getByText('National Champion last Season')).toBeInTheDocument()
    expect(screen.getByText('2 Final Fours in the last 3 Seasons')).toBeInTheDocument()
    expect(screen.getByText('63-9 over the last 3 Seasons')).toBeInTheDocument()
    expect(screen.queryByText('79.4')).not.toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders a restrained Unestablished explanation with no fact list', () => {
    render(<ProgramReputationSummary reputation={reputation({
      asOfCompletedSeasonNumber: null,
      completedSeasons: 0,
      score: null,
      tier: 'unestablished',
      trend: null,
      facts: [],
    })} />)
    expect(screen.getByText('Unestablished')).toBeInTheDocument()
    expect(screen.getByText(/establishes after completed Dynasty results/i)).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })
})
