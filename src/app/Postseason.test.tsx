import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { GameResult, PlayerGameStats } from '../engine'
import {
  deriveNationalChampion,
  getCurrentTournamentRound,
  getTournamentGameForProgram,
  isTournamentComplete,
  recordTournamentGameResult,
  resolveTournamentGameParticipantSlots,
  resolveTournamentGameParticipants,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
  type PostseasonState,
} from '../postseason'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { deriveAnnouncedSeasonHonors, deriveRegularSeasonAwards } from '../dynasty'
import { derivePlayerSeasonStats } from '../season'
import { formatRating } from './formatters'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'
import { deriveGameLeaders } from './gameLeaders'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function selectProgram(programId = 'charlotte-tech'): void {
  useDynastyStore
    .getState()
    .selectProgram(programId, DEFAULT_INTERACTIVE_TEST_SEED)
}

function setActivePostseason(activePostseason: PostseasonState): void {
  const dynasty = useDynastyStore.getState().dynasty
  if (!dynasty) throw new Error('Expected an initialized Dynasty.')
  useDynastyStore.setState({ dynasty: { ...dynasty, activePostseason } })
}

function clickButtonByText(pattern: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: pattern }))
}

function stat(playerId: string, points: number): PlayerGameStats {
  return {
    playerId,
    minutes: 40,
    points,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }
}

function completeRegularSeasonAndEnterPostseason() {
  useDynastyStore.getState().generateControlledDraftBoard()
  useDynastyStore.getState().requestSuperSim('endOfRegularSeason')
  useDynastyStore.getState().confirmSuperSim()
  useDynastyStore.getState().dismissSuperSimSummary()
  useDynastyStore.getState().enterPostseason()
}

function tournamentHeader(): HTMLElement {
  return document.querySelector('.season-header') as HTMLElement
}

function forceControlledProgramLoss(): void {
  const dynasty = useDynastyStore.getState().dynasty!
  const controlledProgramId = dynasty.controlledProgramId!
  let postseason = dynasty.activePostseason!
  const round = getCurrentTournamentRound(postseason)!
  postseason = simulatePendingGamesInTournamentRound({
    postseason,
    round,
    simulationSeed: 'forced-controlled-loss:ai',
    excludedProgramIds: [controlledProgramId],
  })
  const game = getTournamentGameForProgram(postseason, controlledProgramId, round)!
  const participants = resolveTournamentGameParticipants(postseason, game.id)!
  const winnerId = participants.homeProgramId === controlledProgramId
    ? participants.awayProgramId
    : participants.homeProgramId
  const result: GameResult = {
    homeTeamId: participants.homeProgramId,
    awayTeamId: participants.awayProgramId,
    homeScore: participants.homeProgramId === winnerId ? 80 : 60,
    awayScore: participants.awayProgramId === winnerId ? 80 : 60,
    winnerId,
    overtimePeriods: 0,
    seed: `forced:${game.id}`,
    homePlayerStats: [stat(`${participants.homeProgramId}:player`, participants.homeProgramId === winnerId ? 80 : 60)],
    awayPlayerStats: [stat(`${participants.awayProgramId}:player`, participants.awayProgramId === winnerId ? 80 : 60)],
  }
  setActivePostseason(recordTournamentGameResult(postseason, game.id, result))
  useDynastyStore.setState({ lastPlayedTournamentGameId: game.id })
}

beforeEach(() => {
  resetStore()
})

describe('Postseason transition', () => {
  it('reveals a non-spoiler Awards route at the Final Four and preserves Back navigation', () => {
    selectProgram('pine-valley')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    expect(screen.queryByRole('button', { name: 'View Awards & Honors' })).not.toBeInTheDocument()
    act(() => useDynastyStore.getState().simulateRestOfCurrentTournamentRound())
    expect(screen.queryByRole('button', { name: 'View Awards & Honors' })).not.toBeInTheDocument()
    act(() => useDynastyStore.getState().simulateRestOfCurrentTournamentRound())

    const dynasty = useDynastyStore.getState().dynasty!
    const poy = deriveRegularSeasonAwards(dynasty.universe, dynasty.activeSeason!).honors[0]!
    const player = dynasty.activeSeason!.programStates[poy.programId]!.team.roster.find(({ id }) => id === poy.playerId)!
    expect(screen.getByText('Season Awards Announced')).toBeInTheDocument()
    expect(screen.queryByText(`${player.firstName} ${player.lastName}`)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View Awards & Honors' }))
    expect(screen.getByRole('heading', { name: 'Awards & Honors' })).toBeInTheDocument()
    expect(screen.getByText('Awarded after the National Championship')).toBeInTheDocument()
    expect(screen.getAllByText(`${player.firstName} ${player.lastName}`).length).toBeGreaterThan(0)
    const awards = screen.getByRole('heading', { name: 'Awards & Honors' }).closest('main')!
    const allAmerica = within(awards).getByRole('table', { name: 'First Team All-America' })
    expect(allAmerica.querySelectorAll('tbody tr')).toHaveLength(5)
    expect(within(awards).queryByRole('heading', { name: /Your Program Honors/ })).not.toBeInTheDocument()
    const stats = derivePlayerSeasonStats(dynasty.activeSeason!, poy.programId, poy.playerId)
    expect(within(awards).getAllByText(`${formatRating(stats.pointsPerGame)} PPG · ${formatRating(stats.reboundsPerGame)} RPG · ${formatRating(stats.assistsPerGame)} APG`).length).toBeGreaterThan(0)

    const announced = deriveAnnouncedSeasonHonors(dynasty)
    const controlledHonor = announced.find(({ program }) => program.id === dynasty.controlledProgramId!)
    if (controlledHonor) {
      const controlledName = `${controlledHonor.player.firstName} ${controlledHonor.player.lastName}`
      expect(within(awards).getAllByRole('button', { name: controlledName })[0]!.parentElement).toHaveTextContent(/You/i)
    }

    const conferenceTabs = within(awards).getByRole('group', { name: 'Conference' })
    const controlledConference = dynasty.universe.conferences.find(({ id }) => id === dynasty.universe.programs.find(({ id }) => id === dynasty.controlledProgramId!)!.conferenceId)!
    expect(within(conferenceTabs).getByRole('button', { name: controlledConference.name.replace(/ Conference$/, '') })).toHaveAttribute('aria-pressed', 'true')
    const otherConference = dynasty.universe.conferences.find(({ id }) => id !== controlledConference.id)!
    fireEvent.click(within(conferenceTabs).getByRole('button', { name: otherConference.name.replace(/ Conference$/, '') }))
    expect(within(conferenceTabs).getByRole('button', { name: otherConference.name.replace(/ Conference$/, '') })).toHaveAttribute('aria-pressed', 'true')
    expect(within(awards).getByRole('table', { name: 'First Team All-Conference' }).querySelectorAll('tbody tr')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: /back to tournament/i }))
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
  })

  it('shows the National Tournament entry point once the regular season completes, and enters it', () => {
    selectProgram()
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().requestSuperSim('endOfRegularSeason')
    useDynastyStore.getState().confirmSuperSim()
    useDynastyStore.getState().dismissSuperSimSummary()
    render(<App />)

    expect(
      screen.getByRole('button', { name: /enter national tournament/i }),
    ).toBeInTheDocument()

    clickButtonByText(/enter national tournament/i)

    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(within(tournamentHeader()).getByText('National Tournament')).toBeInTheDocument()
  })

  it('re-entering later only navigates and never replaces the initialized Postseason or the completed Season', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    const firstPostseason = useDynastyStore.getState().dynasty!.activePostseason
    const season = useDynastyStore.getState().dynasty!.activeSeason
    useDynastyStore.getState().goToHub()

    render(<App />)
    clickButtonByText(/enter national tournament/i)

    const state = useDynastyStore.getState()
    expect(state.dynasty!.activePostseason).toBe(firstPostseason)
    expect(state.dynasty!.activeSeason).toBe(season)
    expect(state.view).toBe('postseasonHub')
  })
})

describe('Postseason — qualified and alive', () => {
  it('shows the correct seed, bid, and canonical next Tournament matchup', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { activePostseason: postseason, controlledProgramId } = useDynastyStore.getState().dynasty!
    const entry = postseason!.field.find(
      (candidate) => candidate.programId === controlledProgramId,
    )!
    const currentRound = getCurrentTournamentRound(postseason!)!
    const game = getTournamentGameForProgram(
      postseason!,
      controlledProgramId!,
      currentRound,
    )!
    const participants = resolveTournamentGameParticipants(postseason!, game.id)!
    const opponentId =
      participants.homeProgramId === controlledProgramId
        ? participants.awayProgramId
        : participants.homeProgramId
    const opponentName = UNIVERSE_V0.programs.find((p) => p.id === opponentId)!.name

    const header = tournamentHeader()
    expect(within(header).getByText(`#${entry.seed}`)).toBeInTheDocument()

    const matchupCard = document.querySelector('.next-game-card') as HTMLElement
    expect(
      within(matchupCard).getAllByText(new RegExp(opponentName)).length,
    ).toBeGreaterThan(0)
    expect(within(matchupCard).getByText('Neutral Site')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /^simulate game$/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /game prep/i }),
    ).toBeInTheDocument()
  })

  it('Quick Sim stays on the Tournament Hub with the stored result and optional Box Score', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { activePostseason: postseason, controlledProgramId } = useDynastyStore.getState().dynasty!
    const currentRound = getCurrentTournamentRound(postseason!)!
    const expectedGame = getTournamentGameForProgram(
      postseason!,
      controlledProgramId!,
      currentRound,
    )!

    clickButtonByText(/^simulate game$/i)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('postseasonHub')
    expect(state.lastPlayedTournamentGameId).toBe(expectedGame.id)
    const result = state.dynasty!.activePostseason!.resultsByGameId[expectedGame.id]
    expect(result).toBeDefined()
    expect(Object.keys(state.dynasty!.activePostseason!.resultsByGameId)).toEqual([
      expectedGame.id,
    ])

    const completedCard = document.querySelector(
      '.next-game-card--final',
    ) as HTMLElement
    const homeTeam = state.dynasty!.activePostseason!.programStates[result!.homeTeamId]!.team
    const awayTeam = state.dynasty!.activePostseason!.programStates[result!.awayTeamId]!.team
    const leaders = deriveGameLeaders(result!, homeTeam, awayTeam)
    expect(within(completedCard).getByText(String(result!.homeScore))).toBeInTheDocument()
    expect(within(completedCard).getByText(String(result!.awayScore))).toBeInTheDocument()
    expect(
      within(completedCard).queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      within(completedCard).queryByRole('button', { name: /game prep/i }),
    ).not.toBeInTheDocument()
    expect(
      within(completedCard).getByText(
        result!.winnerId === controlledProgramId
          ? `${UNIVERSE_V0.programs.find((program) => program.id === controlledProgramId)!.name} Advances`
          : 'Tournament Run Ends',
      ),
    ).toBeInTheDocument()
    expect(within(completedCard).getByText('Neutral · Final')).toBeInTheDocument()
    for (const [stat, leader] of [
      ['pts', leaders.points],
      ['reb', leaders.rebounds],
      ['ast', leaders.assists],
    ] as const) {
      const column = completedCard.querySelector(
        `[data-stat="${stat}"]`,
      ) as HTMLElement
      expect(column).not.toBeNull()
      if (leader) {
        expect(column).toHaveTextContent(leader.playerName)
        expect(column).toHaveTextContent(leader.programAbbreviation)
        expect(column).toHaveTextContent(String(leader.value))
      } else {
        expect(column).toHaveTextContent('—')
      }
    }
    expect(screen.getByText('Round of 16 — 1 of 8 games complete')).toBeInTheDocument()
    expect(
      screen.getByText('Advance will simulate the remaining 7 Round of 16 games.'),
    ).toBeInTheDocument()

    clickButtonByText(/view box score/i)
    expect(useDynastyStore.getState().view).toBe('postseasonGameHistory')
    expect(
      useDynastyStore.getState().dynasty!.activePostseason!.resultsByGameId[expectedGame.id],
    ).toBe(result)
  })

  it('renders full Player box scores for the just-played Tournament game, with a neutral-site round tag', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/view box score/i)

    const { lastPlayedTournamentGameId } = useDynastyStore.getState()
    const postseason = useDynastyStore.getState().dynasty!.activePostseason
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!

    expect(screen.getByText(/neutral site/i)).toBeInTheDocument()
    const meaningHeading = screen.getByRole('heading', { name: 'What Changed' })
    const boxScoreHeading = screen.getByRole('heading', { name: 'Player Box Score' })
    expect(meaningHeading.compareDocumentPosition(boxScoreHeading) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy()
    expect(screen.getByText('Tournament')).toBeInTheDocument()
    expect(screen.getByText(/advanced to the Quarterfinals/)).toBeInTheDocument()
    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()
  })

  it('Game Prep opens Tournament Rotation editing without mutating the completed Season', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { activeSeason: season, controlledProgramId } = useDynastyStore.getState().dynasty!
    const originalSeasonRotation =
      season!.programStates[controlledProgramId!]!.rotation

    clickButtonByText(/game prep/i)
    expect(
      screen.getByRole('heading', { name: /your rotation/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('.simple-rotation-table')).not.toBeNull()
    expect(document.querySelector('.rotation-table')).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Matchup Scout' }),
    ).toBeInTheDocument()

    const scout = document.querySelector('.matchup-scout') as HTMLElement
    fireEvent.click(within(scout).getAllByRole('button')[0]!)
    expect(useDynastyStore.getState().view).toBe('playerDetails')
    clickButtonByText(/back to tournament game prep/i)
    expect(useDynastyStore.getState().view).toBe('postseasonGamePrep')

    const homePanel = document.querySelectorAll('.team-panel')[0] as HTMLElement
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    const originalValue = (input as HTMLInputElement).value

    // A legal nudge: move one minute to an over-budget value, then back —
    // exercising the same commit path as a real edit without needing a
    // same-position donor lookup in the test itself.
    fireEvent.change(input, {
      target: { value: String(Number(originalValue) + 6) },
    })
    const simulateButton = screen.getByRole('button', { name: /simulate game/i })
    expect(simulateButton).toBeDisabled()
    fireEvent.change(input, { target: { value: originalValue } })
    expect(simulateButton).not.toBeDisabled()

    expect(
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[controlledProgramId!]!
        .rotation,
    ).toEqual(originalSeasonRotation)

    fireEvent.click(simulateButton)
    const playedGameId = useDynastyStore.getState().lastPlayedTournamentGameId!
    const playedResult = useDynastyStore.getState().dynasty!.activePostseason!.resultsByGameId[
      playedGameId
    ]!
    expect(useDynastyStore.getState().view).toBe('postseasonPostgame')
    expect(screen.getByText(String(playedResult.homeScore))).toBeInTheDocument()

    clickButtonByText(/return to tournament hub/i)
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(document.querySelector('.next-game-card--final')).not.toBeNull()
    expect(
      useDynastyStore.getState().dynasty!.activePostseason!.resultsByGameId[playedGameId],
    ).toBe(playedResult)
  })

  it('Advance to Next Round resolves the remaining bracket games and preserves the controlled result', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    const controlledResult = useDynastyStore.getState().dynasty!.activePostseason!
      .resultsByGameId[useDynastyStore.getState().lastPlayedTournamentGameId!]!
    clickButtonByText(/advance to next round/i)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('postseasonHub')
    expect(getCurrentTournamentRound(state.dynasty!.activePostseason!)).toBe('quarterfinals')
    expect(
      state.dynasty!.activePostseason!.resultsByGameId[state.lastPlayedTournamentGameId!],
    ).toBe(controlledResult)
    // The Round of 16 is fully resolved — its own round-progress control is gone.
    expect(
      screen.queryByText(/round of 16 in progress/i),
    ).not.toBeInTheDocument()
  })
})

describe('Postseason — eliminated', () => {
  it('shows Eliminated (not Advancing) immediately after a current-round loss, and removes user game/Rotation actions', () => {
    // Construct the loss directly so this presentation regression does not
    // depend on a particular accepted seeding rule or simulation outcome.
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    forceControlledProgramLoss()
    render(<App />)

    const { lastPlayedTournamentGameId } = useDynastyStore.getState()
    const { activePostseason: postseason, controlledProgramId } =
      useDynastyStore.getState().dynasty!
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    expect(result.winnerId).not.toBe(controlledProgramId)

    expect(screen.getByText('Eliminated')).toBeInTheDocument()
    expect(screen.queryByText('Advancing')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /game prep/i }),
    ).not.toBeInTheDocument()
  })

  it('lets the AI Tournament continue past the eliminated controlled Program toward a Champion', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    forceControlledProgramLoss()
    render(<App />)

    for (let round = 0; round < 3; round += 1) {
      const button = screen.queryByRole('button', { name: /^simulate/i })
      if (button) {
        fireEvent.click(button)
      }
    }

    const state = useDynastyStore.getState()
    expect(isTournamentComplete(state.dynasty!.activePostseason!)).toBe(true)
    expect(deriveNationalChampion(state.dynasty!.activePostseason!)).toBeDefined()
    expect(screen.getByText('National Championship')).toBeInTheDocument()
  })
})

describe('Postseason — did not qualify', () => {
  it('opens valid completed-season Coaching and returns to the Tournament without inventing participation', () => {
    selectProgram('pine-valley')
    completeRegularSeasonAndEnterPostseason()
    const before = useDynastyStore.getState().dynasty!
    expect(before.activePostseason!.programStates[before.controlledProgramId!]).toBeUndefined()
    const seasonTeam = before.activeSeason!.programStates[before.controlledProgramId!]!.team
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Coaching' }))

    expect(useDynastyStore.getState().view).toBe('coaching')
    expect(screen.getByRole('heading', { name: /pine valley/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Roster' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText(`${seasonTeam.roster[0]!.firstName} ${seasonTeam.roster[0]!.lastName}`)).toBeInTheDocument()
    expect(useDynastyStore.getState().dynasty).toBe(before)

    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))
    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Starting Five')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Tournament' }))
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(screen.getByText(/did not qualify for the national tournament/i)).toBeInTheDocument()
  })

  it('shows No Bid with no fake matchup, and the Tournament remains simulatable to a Champion', () => {
    selectProgram('pine-valley')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    expect(
      screen.getByText(/did not qualify for the national tournament/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /game prep/i }),
    ).not.toBeInTheDocument()

    for (let round = 0; round < 4; round += 1) {
      const button = screen.queryByRole('button', { name: /^simulate/i })
      if (button) {
        fireEvent.click(button)
      }
    }

    const state = useDynastyStore.getState()
    expect(isTournamentComplete(state.dynasty!.activePostseason!)).toBe(true)
    expect(deriveNationalChampion(state.dynasty!.activePostseason!)).toBeDefined()
  })
})

describe('Postseason — bracket and historical results', () => {
  it('reveals future participants one feeder at a time, then preserves completed scores and winner styling', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const initial = useDynastyStore.getState()
    const currentRound = getCurrentTournamentRound(
      initial.dynasty!.activePostseason!,
    )!
    const controlledGame = getTournamentGameForProgram(
      initial.dynasty!.activePostseason!,
      initial.dynasty!.controlledProgramId!,
      currentRound,
    )!
    const futureGame = initial.dynasty!.activePostseason!.bracket.games.find(
      (game) =>
        game.round === 'quarterfinals' &&
        game.participantSources.some(
          (source) =>
            source.type === 'winner' && source.gameId === controlledGame.id,
        ),
    )!
    const otherFeeder = futureGame.participantSources.find(
      (source) =>
        source.type === 'winner' && source.gameId !== controlledGame.id,
    )!
    if (otherFeeder.type !== 'winner') {
      throw new Error('Expected the Quarterfinal slot to have a second feeder.')
    }

    const getSlot = (gameId: string): HTMLElement =>
      document.querySelector(`[data-game-id="${gameId}"]`) as HTMLElement

    expect(
      within(getSlot(futureGame.id)).getAllByText('TBD'),
    ).toHaveLength(2)
    expect(
      screen.getByRole('button', { name: /^simulate other games$/i }),
    ).toBeInTheDocument()

    clickButtonByText(/^simulate other games$/i)

    const partial = useDynastyStore.getState()
    expect(
      partial.dynasty!.activePostseason!.resultsByGameId[controlledGame.id],
    ).toBeUndefined()
    expect(
      partial.dynasty!.activePostseason!.resultsByGameId[otherFeeder.gameId],
    ).toBeDefined()
    const partialSlots = resolveTournamentGameParticipantSlots(
      partial.dynasty!.activePostseason!,
      futureGame.id,
    )
    expect(partialSlots.filter(Boolean)).toHaveLength(1)
    const knownProgramId = partialSlots.find(Boolean)!
    const knownProgram = UNIVERSE_V0.programs.find(
      (program) => program.id === knownProgramId,
    )!
    const partialSlot = getSlot(futureGame.id)
    expect(within(partialSlot).getAllByText('TBD')).toHaveLength(1)
    expect(within(partialSlot).getByText(knownProgram.name)).toBeInTheDocument()

    clickButtonByText(/^simulate game$/i)

    const completed = useDynastyStore.getState()
    const resolvedSlots = resolveTournamentGameParticipantSlots(
      completed.dynasty!.activePostseason!,
      futureGame.id,
    )
    expect(resolvedSlots.every(Boolean)).toBe(true)
    const resolvedSlot = getSlot(futureGame.id)
    expect(within(resolvedSlot).queryByText('TBD')).not.toBeInTheDocument()
    for (const programId of resolvedSlots) {
      const program = UNIVERSE_V0.programs.find(
        (candidate) => candidate.id === programId,
      )!
      expect(within(resolvedSlot).getByText(program.name)).toBeInTheDocument()
    }

    const result =
      completed.dynasty!.activePostseason!.resultsByGameId[controlledGame.id]!
    const completedSlot = getSlot(controlledGame.id)
    expect(completedSlot).toHaveClass('bracket-slot--complete')
    const renderedScores = [...completedSlot.querySelectorAll('.bracket-slot__score')]
      .map((element) => element.textContent)
    expect(renderedScores).toEqual(
      expect.arrayContaining([String(result.homeScore), String(result.awayScore)]),
    )
    const winner = UNIVERSE_V0.programs.find(
      (program) => program.id === result.winnerId,
    )!
    const winnerRow = completedSlot.querySelector(
      '.bracket-slot__row[data-winner="true"]',
    ) as HTMLElement
    expect(within(winnerRow).getByText(new RegExp(winner.name))).toBeInTheDocument()
    const loserId =
      result.homeTeamId === result.winnerId
        ? result.awayTeamId
        : result.homeTeamId
    const winnerSeed = completed.dynasty!.activePostseason!.field.find(
      (entry) => entry.programId === result.winnerId,
    )!.seed
    const loserSeed = completed.dynasty!.activePostseason!.field.find(
      (entry) => entry.programId === loserId,
    )!.seed
    if (winnerSeed > loserSeed) {
      expect(within(completedSlot).getByText('Upset')).toBeInTheDocument()
    } else {
      expect(within(completedSlot).queryByText('Upset')).not.toBeInTheDocument()
    }
  })

  it('opens a completed Tournament game as a read-only historical result with the full box score', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    const { lastPlayedTournamentGameId } = useDynastyStore.getState()
    const postseason = useDynastyStore.getState().dynasty!.activePostseason
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    const completedSlot = document.querySelector(
      '.bracket-slot--complete',
    ) as HTMLElement
    fireEvent.click(completedSlot)

    expect(useDynastyStore.getState().view).toBe('postseasonGameHistory')
    expect(screen.getByText(String(result.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result.awayScore))).toBeInTheDocument()
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!
    expect(
      document.querySelector(`tr[data-player-id="${topScorer.playerId}"]`),
    ).not.toBeNull()

    expect(
      screen.queryByRole('button', { name: /simulate rest of round/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /back to tournament hub/i }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: /back to tournament hub/i }),
    )
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
  })
})

describe('Postseason — Champion', () => {
  it('renders the National Champions state when the controlled Program wins it all', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()

    const { activePostseason: postseason, controlledProgramId } = useDynastyStore.getState().dynasty!
    let current: PostseasonState = postseason!

    // Force the controlled Program to win every game on its path to the
    // title — a direct domain-level construction, not a UI action, so this
    // test verifies rendering of the Champion state rather than re-testing
    // simulation odds. Every other bracket game is resolved normally first,
    // so the opponent side of each of the controlled Program's games is
    // actually resolvable.
    for (const round of TOURNAMENT_ROUNDS) {
      current = simulatePendingGamesInTournamentRound({
        postseason: current,
        round,
        simulationSeed: 'champion-test-ai-seed',
        excludedProgramIds: [controlledProgramId!],
      })
      const game = getTournamentGameForProgram(current, controlledProgramId!, round)!
      if (current.resultsByGameId[game.id]) continue
      const participants = resolveTournamentGameParticipants(current, game.id)!
      const homeScore = participants.homeProgramId === controlledProgramId ? 80 : 60
      const awayScore = participants.awayProgramId === controlledProgramId ? 80 : 60
      const result: GameResult = {
        homeTeamId: participants.homeProgramId,
        awayTeamId: participants.awayProgramId,
        homeScore,
        awayScore,
        winnerId: controlledProgramId!,
        overtimePeriods: 0,
        seed: `forced:${game.id}`,
        homePlayerStats: [stat(`${participants.homeProgramId}:player`, homeScore)],
        awayPlayerStats: [stat(`${participants.awayProgramId}:player`, awayScore)],
      }
      current = recordTournamentGameResult(current, game.id, result)
    }
    setActivePostseason(current)

    render(<App />)

    expect(within(tournamentHeader()).getByText('National Champion')).toBeInTheDocument()
    expect(within(tournamentHeader()).getByText('Finish')).toBeInTheDocument()
    expect(
      screen.getByText(/is your national champion./i),
    ).toBeInTheDocument()
  })

  it('renders another Program as National Champion when the controlled Program does not win it', () => {
    selectProgram()
    completeRegularSeasonAndEnterPostseason()
    forceControlledProgramLoss()
    render(<App />)

    for (let round = 0; round < 3; round += 1) {
      const button = screen.queryByRole('button', { name: /^simulate/i })
      if (button) {
        fireEvent.click(button)
      }
    }

    const { activePostseason: postseason, controlledProgramId } = useDynastyStore.getState().dynasty!
    const champion = deriveNationalChampion(postseason!)!
    expect(champion).not.toBe(controlledProgramId)
    expect(screen.getByText('National Championship')).toBeInTheDocument()
    expect(
      screen.getByText(/is your national champion\./i),
    ).toBeInTheDocument()
  })
})
