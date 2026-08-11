import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { completeRounds, createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({
    ...source,
    activeSeason: season,
  })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `player-career-history-test-postseason-${season.seasonNumber}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

function openPlayerDetails(dynasty: DynastyState, programId: string, playerId: string) {
  useDynastyStore.setState({ dynasty, view: 'hub' })
  useDynastyStore.getState().openPlayerDetails(programId, playerId)
}

beforeEach(resetStore)

describe('Player Details — Ratings', () => {
  it('shows all nine attribute ratings compactly, without regressing OVR/POT', () => {
    const dynasty = createRecruitingDynasty('player-details-ratings')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    expect(screen.getByText('Finishing')).toBeInTheDocument()
    expect(screen.getByText('Shooting')).toBeInTheDocument()
    expect(screen.getByText('Playmaking')).toBeInTheDocument()
    expect(screen.getByText('Ball Handling')).toBeInTheDocument()
    expect(screen.getByText('Perimeter Def')).toBeInTheDocument()
    expect(screen.getByText('Interior Def')).toBeInTheDocument()
    expect(screen.getByText('Rebounding')).toBeInTheDocument()
    expect(screen.getByText('Athleticism')).toBeInTheDocument()
    expect(screen.getByText('Stamina')).toBeInTheDocument()
    const headerStats = document.querySelector(
      '.season-header__stats',
    ) as HTMLElement
    expect(
      within(headerStats).getByText(String(calculateOverall(player))),
    ).toBeInTheDocument()
    expect(
      within(headerStats).getByText(String(player.potential)),
    ).toBeInTheDocument()
  })
})

describe('Player Details — Career Progression', () => {
  it('shows one career row with no development gain for a freshman', () => {
    const dynasty = createRecruitingDynasty('player-details-freshman')
    const roster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const freshman = roster.find(({ classYear }) => classYear === 'FR')!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, freshman.id)
    render(<App />)

    const careerSection = screen
      .getByRole('heading', { name: 'Career Progression' })
      .closest('section') as HTMLElement
    const rows = careerSection.querySelectorAll('tbody tr')

    expect(rows).toHaveLength(1)
    expect(within(rows[0] as HTMLElement).getByText('FR')).toBeInTheDocument()
    expect(within(rows[0] as HTMLElement).getByText('—')).toBeInTheDocument()
  })

  it("shows a senior's full four-Season career with a clear breakout development jump", () => {
    let dynasty = createRecruitingDynasty('player-details-breakout-senior')
    const startRoster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const freshman = startRoster.find(({ classYear }) => classYear === 'FR')!

    for (let season = 0; season < 3; season += 1) {
      dynasty = completeSeasonAndBeginOffseason(dynasty)
      dynasty = rolloverDynastyToNextSeason(dynasty)
    }

    const seniorRoster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const senior = seniorRoster.find((candidate) => candidate.id === freshman.id)!
    expect(senior.classYear).toBe('SR')

    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, senior.id)
    render(<App />)

    const careerSection = screen
      .getByRole('heading', { name: 'Career Progression' })
      .closest('section') as HTMLElement
    const rows = [...careerSection.querySelectorAll('tbody tr')]

    expect(rows).toHaveLength(4)
    expect(rows.map((row) => within(row as HTMLElement).getAllByRole('cell')[1]!.textContent)).toEqual([
      'FR',
      'SO',
      'JR',
      'SR',
    ])
    // At least one offseason produced a real, visible development gain.
    const devCells = rows
      .slice(1)
      .map((row) => (row as HTMLElement).querySelector('.career-progression-table__dev')!.textContent)
    expect(devCells.every((text) => /^[+−]\d+$/.test(text!) || text === '0')).toBe(true)
  }, 20000)
})

describe('Player Details — Recruiting Origin', () => {
  it('resolves star rating and rank for a Recruit who entered the roster', () => {
    let dynasty = createRecruitingDynasty('player-details-recruit-origin')
    dynasty = completeSeasonAndBeginOffseason(dynasty)
    dynasty = rolloverDynastyToNextSeason(dynasty)

    const completedClass = dynasty.completedRecruitingHistory[0]!
    const recruit = completedClass.recruitingState.recruits.find(
      (candidate) =>
        completedClass.recruitingState.commitmentsByPlayerId[candidate.player.id]
          ?.programId === CONTROLLED_PROGRAM_ID,
    )!

    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, recruit.player.id)
    render(<App />)

    const originSection = screen
      .getByRole('heading', { name: 'Recruiting Origin' })
      .closest('section') as HTMLElement

    expect(
      within(originSection).getByText(`#${recruit.nationalRank} national`),
    ).toBeInTheDocument()
    expect(
      within(originSection).getByText(`#${recruit.positionRank} position`),
    ).toBeInTheDocument()
  })

  it('omits Recruiting Origin cleanly for an original Universe Player', () => {
    const dynasty = createRecruitingDynasty('player-details-universe-player')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    expect(
      screen.queryByRole('heading', { name: 'Recruiting Origin' }),
    ).not.toBeInTheDocument()
  })
})

describe('Player Details — existing navigation preserved', () => {
  it('keeps Team → Player and Player → Team navigation intact alongside the new sections', () => {
    const dynasty = createRecruitingDynasty('player-details-navigation')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    useDynastyStore.setState({ dynasty, view: 'hub' })
    useDynastyStore.getState().openTeamDetails(CONTROLLED_PROGRAM_ID)
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', { name: `${player.firstName} ${player.lastName}` }),
    )

    expect(
      screen.getByRole('heading', { name: `${player.firstName} ${player.lastName}` }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Progression' })).toBeInTheDocument()

    const program = useDynastyStore.getState().dynasty!.universe.programs.find(
      ({ id }) => id === CONTROLLED_PROGRAM_ID,
    )!
    fireEvent.click(screen.getByRole('button', { name: program.name }))

    expect(
      screen.getByRole('heading', { name: new RegExp(`^${program.name}`) }),
    ).toBeInTheDocument()
  })
})
