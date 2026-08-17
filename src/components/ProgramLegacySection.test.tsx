import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { ProgramLegacy } from '../dynasty'
import { ProgramLegacySection } from './ProgramLegacySection'

const oneSeasonLegacy: ProgramLegacy = {
  programId: 'northbridge',
  completedSeasons: 1,
  wins: 21,
  losses: 3,
  tournamentAppearances: 1,
  championships: 0,
  runnerUpFinishes: 1,
  bestTournamentOutcome: { status: 'runner-up', seed: 2, bidType: 'automatic' },
  bestRegularSeason: {
    seasonNumber: 1,
    record: { wins: 21, losses: 3 },
    tournamentOutcome: { status: 'runner-up', seed: 2, bidType: 'automatic' },
  },
  recentSeasons: [{
    seasonNumber: 1,
    record: { wins: 21, losses: 3 },
    tournamentOutcome: { status: 'runner-up', seed: 2, bidType: 'automatic' },
  }],
}

describe('ProgramLegacySection', () => {
  it('renders a deliberate empty state before any completed Season', () => {
    render(<ProgramLegacySection legacy={{
      ...oneSeasonLegacy,
      completedSeasons: 0,
      wins: 0,
      losses: 0,
      tournamentAppearances: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: null,
      bestRegularSeason: null,
      recentSeasons: [],
    }} />)

    expect(screen.getByText(/history will appear after this Season/i)).toBeInTheDocument()
  })

  it('renders the résumé and compact recent-Season trail', () => {
    render(<ProgramLegacySection legacy={oneSeasonLegacy} />)

    expect(within(screen.getByText('Dynasty Record').parentElement!).getByText('21-3')).toBeInTheDocument()
    expect(screen.getByText('Runner-Up', { selector: '.program-legacy__season span' })).toBeInTheDocument()
    expect(screen.getByText('Season 1 · 21-3')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Season 1')
  })
})
