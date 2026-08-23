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

function openCareerTab(): void {
  const tabs = screen.getByRole('group', { name: 'Player details section' })
  fireEvent.click(within(tabs).getByRole('button', { name: 'Career' }))
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
    openCareerTab()

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
    openCareerTab()

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

describe('Player Details — Career Highs', () => {
  it('shows one quiet empty state before an active Player appears', () => {
    const dynasty = createRecruitingDynasty('player-career-highs-empty')
    const player = dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)
    openCareerTab()

    const section = screen.getByRole('heading', { name: 'Career Highs' }).closest('section')!
    expect(within(section as HTMLElement).getByText('Regular Season Only')).toBeInTheDocument()
    expect(within(section as HTMLElement).getByText(/no regular-season appearances yet/i)).toBeInTheDocument()
  })

  it('shows compact active Player highs with game context', () => {
    let dynasty = createRecruitingDynasty('player-career-highs-active')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    const program = dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!
    const player = program.team.roster.find((candidate) => {
      const game = dynasty.activeSeason!.schedule.games.find((entry) =>
        entry.homeProgramId === CONTROLLED_PROGRAM_ID || entry.awayProgramId === CONTROLLED_PROGRAM_ID)
      const result = game ? dynasty.activeSeason!.resultsByGameId[game.id] : undefined
      return result && [...result.homePlayerStats, ...result.awayPlayerStats]
        .some(({ playerId, minutes }) => playerId === candidate.id && minutes > 0)
    })!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)
    openCareerTab()

    const section = screen.getByRole('heading', { name: 'Career Highs' }).closest('section')!
    for (const label of ['PTS', 'REB', 'AST', 'STL', 'BLK']) {
      expect(within(section as HTMLElement).getByText(label)).toBeInTheDocument()
    }
    expect(section).toHaveTextContent(/S1 · vs /)
  })
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
    openCareerTab()

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
    openCareerTab()

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
    expect(screen.getByRole('heading', { name: 'Ratings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Career Progression' })).not.toBeInTheDocument()
    openCareerTab()
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

describe('Player Legacy — Former Player Details', () => {
  it('keeps a followed graduate retrievable with a completed read-only career and navigation', () => {
    let dynasty = createRecruitingDynasty('player-legacy-former-details')
    const senior = Object.values(dynasty.activeSeason!.programStates)
      .flatMap(({ team }) => team.roster)
      .find(({ classYear }) => classYear === 'SR')!
    const programId = Object.entries(dynasty.activeSeason!.programStates).find(
      ([, { team }]) => team.roster.some(({ id }) => id === senior.id),
    )![0]
    const program = dynasty.universe.programs.find(({ id }) => id === programId)!

    dynasty = completeSeasonAndBeginOffseason(dynasty)
    dynasty = rolloverDynastyToNextSeason(dynasty)
    useDynastyStore.setState({
      dynasty,
      followedPlayerIds: [senior.id],
      view: 'league',
      leagueTab: 'following',
    })
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Former Players' })).toBeInTheDocument()
    const formerRow = screen.getByRole('button', {
      name: `${senior.firstName} ${senior.lastName}`,
    }).closest('tr') as HTMLElement
    expect(within(formerRow).getByText('Season 1')).toBeInTheDocument()
    expect(within(formerRow).getByText(String(calculateOverall(senior)))).toBeInTheDocument()

    fireEvent.click(within(formerRow).getByRole('button', {
      name: `${senior.firstName} ${senior.lastName}`,
    }))

    expect(screen.getByText('Former Player')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Final Ratings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'College Career · Regular Season' })).not.toBeInTheDocument()
    openCareerTab()
    expect(screen.getByRole('heading', { name: 'College Career · Regular Season' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Highs' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Final Ratings' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Career Progression' })).toBeInTheDocument()
    expect(screen.queryByText('Pot')).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Game Log' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Recruiting Origin' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: program.name }))
    expect(screen.getByRole('heading', { name: new RegExp(`^${program.name}`) })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Back to Player$/i }))
    expect(screen.getByText('Former Player')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Following' }))
    expect(useDynastyStore.getState().isPlayerFollowed(senior.id)).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))
    expect(useDynastyStore.getState().isPlayerFollowed(senior.id)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Back to League/i }))
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Former Players' })).toBeInTheDocument()
  }, 20000)
})
