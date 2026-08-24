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
    teamOverall: 78.4,
    record: { wins: 21, losses: 3 },
    conferencePlace: 1,
    tournamentOutcome: { status: 'runner-up', seed: 2, bidType: 'automatic' },
    incomingClass: null,
  },
  trajectorySeasons: [{
    seasonNumber: 1,
    teamOverall: 78.4,
    record: { wins: 21, losses: 3 },
    conferencePlace: 1,
    tournamentOutcome: { status: 'runner-up', seed: 2, bidType: 'automatic' },
    incomingClass: null,
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
      trajectorySeasons: [],
    }} />)

    expect(screen.getByText(/history will appear after this Season/i)).toBeInTheDocument()
  })

  it('renders the résumé and compact full-history trajectory', () => {
    render(<ProgramLegacySection legacy={oneSeasonLegacy} />)

    expect(within(screen.getByText('Dynasty Record').parentElement!).getByText('21-3')).toBeInTheDocument()
    expect(screen.getByText(/#2 · Runner-Up/, { selector: '.program-legacy__season > span' })).toBeInTheDocument()
    expect(screen.getByText('Season 1 · 21-3')).toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('Season 1')
    expect(screen.getByText('Program Trajectory')).toBeInTheDocument()
    expect(screen.queryByText('Recent Seasons')).not.toBeInTheDocument()
    expect(screen.getByRole('listitem')).toHaveTextContent('78')
    expect(screen.getByRole('listitem')).toHaveTextContent('1st')
    expect(screen.getByRole('listitem')).toHaveTextContent('Incoming —')
  })

  it('shows "No Tournament Appearances" rather than "Did Not Qualify" when the Program has never made the Tournament', () => {
    render(<ProgramLegacySection legacy={{
      ...oneSeasonLegacy,
      tournamentAppearances: 0,
      championships: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'did-not-qualify' },
      trajectorySeasons: [3, 2, 1].map((seasonNumber) => ({
        seasonNumber,
        teamOverall: 70,
        record: { wins: 10, losses: 14 },
        conferencePlace: 4,
        tournamentOutcome: { status: 'did-not-qualify' } as const,
        incomingClass: { signeeCount: 0, averageOverall: null },
      })),
    }} />)

    expect(screen.getByText('No Tournament Appearances')).toBeInTheDocument()
    expect(screen.queryByText('Did Not Qualify', { selector: '.program-legacy__highlights strong' })).not.toBeInTheDocument()
    expect(screen.getAllByText(/Did Not Qualify/, { selector: '.program-legacy__season > span' })).toHaveLength(3)
    for (const row of screen.getAllByRole('listitem')) {
      expect(row).toHaveTextContent('Incoming 0 signees')
    }
  })

  it('still shows canonical Tournament finish labels once a Program has made the Tournament', () => {
    render(<ProgramLegacySection legacy={oneSeasonLegacy} />)

    expect(screen.getByText('Runner-Up', { selector: '.program-legacy__highlights strong' })).toBeInTheDocument()
  })

  it('renders National Champion with emphasis in both the highlight and trajectory', () => {
    render(<ProgramLegacySection legacy={{
      ...oneSeasonLegacy,
      championships: 1,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'national-champion', seed: 1, bidType: 'automatic' },
      trajectorySeasons: [{
        seasonNumber: 1,
        teamOverall: 82,
        record: { wins: 21, losses: 3 },
        conferencePlace: 1,
        tournamentOutcome: { status: 'national-champion', seed: 1, bidType: 'automatic' },
        incomingClass: { signeeCount: 3, averageOverall: 75.666 },
      }],
    }} />)

    const highlight = screen.getByText('National Champion', { selector: '.program-legacy__highlights strong' })
    expect(highlight).toHaveClass('program-legacy__champion')

    const row = screen.getByText(/#1 · National Champion/, { selector: '.program-legacy__season > span' })
    expect(row).toHaveClass('program-legacy__champion')
    expect(screen.getByRole('listitem')).toHaveTextContent('Incoming 3 · 75.7 OVR')
  })
})
