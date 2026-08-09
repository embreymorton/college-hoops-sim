import { fireEvent, render, screen, within } from '@testing-library/react'
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
import { useSeasonStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'
import { deriveGameLeaders } from './gameLeaders'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
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
  useSeasonStore.getState().requestSuperSim('endOfRegularSeason')
  useSeasonStore.getState().confirmSuperSim()
  useSeasonStore.getState().dismissSuperSimSummary()
  useSeasonStore.getState().enterPostseason()
}

function tournamentHeader(): HTMLElement {
  return document.querySelector('.season-header') as HTMLElement
}

beforeEach(() => {
  resetStore()
})

describe('Postseason transition', () => {
  it('shows the National Tournament entry point once the regular season completes, and enters it', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    useSeasonStore.getState().requestSuperSim('endOfRegularSeason')
    useSeasonStore.getState().confirmSuperSim()
    useSeasonStore.getState().dismissSuperSimSummary()
    render(<App />)

    expect(
      screen.getByRole('button', { name: /enter national tournament/i }),
    ).toBeInTheDocument()

    clickButtonByText(/enter national tournament/i)

    expect(useSeasonStore.getState().view).toBe('postseasonHub')
    expect(within(tournamentHeader()).getByText('National Tournament')).toBeInTheDocument()
  })

  it('re-entering later only navigates and never replaces the initialized Postseason or the completed Season', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    const firstPostseason = useSeasonStore.getState().postseason
    const season = useSeasonStore.getState().season
    useSeasonStore.getState().goToHub()

    render(<App />)
    clickButtonByText(/enter national tournament/i)

    const state = useSeasonStore.getState()
    expect(state.postseason).toBe(firstPostseason)
    expect(state.season).toBe(season)
    expect(state.view).toBe('postseasonHub')
  })
})

describe('Postseason — qualified and alive', () => {
  it('shows the correct seed, bid, and canonical next Tournament matchup', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { postseason, controlledProgramId } = useSeasonStore.getState()
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
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { postseason, controlledProgramId } = useSeasonStore.getState()
    const currentRound = getCurrentTournamentRound(postseason!)!
    const expectedGame = getTournamentGameForProgram(
      postseason!,
      controlledProgramId!,
      currentRound,
    )!

    clickButtonByText(/^simulate game$/i)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postseasonHub')
    expect(state.lastPlayedTournamentGameId).toBe(expectedGame.id)
    const result = state.postseason!.resultsByGameId[expectedGame.id]
    expect(result).toBeDefined()
    expect(Object.keys(state.postseason!.resultsByGameId)).toEqual([
      expectedGame.id,
    ])

    const completedCard = document.querySelector(
      '.next-game-card--final',
    ) as HTMLElement
    const homeTeam = state.postseason!.programStates[result!.homeTeamId]!.team
    const awayTeam = state.postseason!.programStates[result!.awayTeamId]!.team
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
        expect(column).toHaveTextContent(leader.programName)
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
    expect(useSeasonStore.getState().view).toBe('postseasonGameHistory')
    expect(
      useSeasonStore.getState().postseason!.resultsByGameId[expectedGame.id],
    ).toBe(result)
  })

  it('renders full Player box scores for the just-played Tournament game, with a neutral-site round tag', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/view box score/i)

    const { postseason, lastPlayedTournamentGameId } = useSeasonStore.getState()
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!

    expect(screen.getByText(/neutral site/i)).toBeInTheDocument()
    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()
  })

  it('Game Prep opens Tournament Rotation editing without mutating the completed Season', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const originalSeasonRotation =
      season!.programStates[controlledProgramId!]!.rotation

    clickButtonByText(/game prep/i)
    expect(
      screen.getByRole('heading', { name: /your rotation/i }),
    ).toBeInTheDocument()

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
      useSeasonStore.getState().season!.programStates[controlledProgramId!]!
        .rotation,
    ).toEqual(originalSeasonRotation)

    fireEvent.click(simulateButton)
    const playedGameId = useSeasonStore.getState().lastPlayedTournamentGameId!
    const playedResult = useSeasonStore.getState().postseason!.resultsByGameId[
      playedGameId
    ]!
    expect(useSeasonStore.getState().view).toBe('postseasonPostgame')
    expect(screen.getByText(String(playedResult.homeScore))).toBeInTheDocument()

    clickButtonByText(/return to tournament hub/i)
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
    expect(document.querySelector('.next-game-card--final')).not.toBeNull()
    expect(
      useSeasonStore.getState().postseason!.resultsByGameId[playedGameId],
    ).toBe(playedResult)
  })

  it('Advance to Next Round resolves the remaining bracket games and preserves the controlled result', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    const controlledResult = useSeasonStore.getState().postseason!
      .resultsByGameId[useSeasonStore.getState().lastPlayedTournamentGameId!]!
    clickButtonByText(/advance to next round/i)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postseasonHub')
    expect(getCurrentTournamentRound(state.postseason!)).toBe('quarterfinals')
    expect(
      state.postseason!.resultsByGameId[state.lastPlayedTournamentGameId!],
    ).toBe(controlledResult)
    // The Round of 16 is fully resolved — its own round-progress control is gone.
    expect(
      screen.queryByText(/round of 16 in progress/i),
    ).not.toBeInTheDocument()
  })
})

describe('Postseason — eliminated', () => {
  it('shows Eliminated (not Advancing) immediately after a current-round loss, and removes user game/Rotation actions', () => {
    // Deterministic under the fixed master seed: Charlotte Tech wins Round
    // of 16, then loses the Quarterfinal — regression coverage for a real
    // bug where a resolved loss in the *current* round was misread as an
    // already-won game still waiting on the rest of the round.
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/advance to next round/i)
    clickButtonByText(/^simulate game$/i)

    const { postseason, controlledProgramId, lastPlayedTournamentGameId } =
      useSeasonStore.getState()
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    expect(result.winnerId).not.toBe(controlledProgramId)

    expect(screen.getByText('Tournament Run Ends')).toBeInTheDocument()
    expect(screen.queryByText('Advancing')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /game prep/i }),
    ).not.toBeInTheDocument()
  })

  it('lets the AI Tournament continue past the eliminated controlled Program toward a Champion', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/advance to next round/i)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/advance to next round/i)

    for (let round = 0; round < 3; round += 1) {
      const button = screen.queryByRole('button', { name: /^simulate/i })
      if (button) {
        fireEvent.click(button)
      }
    }

    const state = useSeasonStore.getState()
    expect(isTournamentComplete(state.postseason!)).toBe(true)
    expect(deriveNationalChampion(state.postseason!)).toBeDefined()
    expect(screen.getByText('Tournament Complete')).toBeInTheDocument()
  })
})

describe('Postseason — did not qualify', () => {
  it('shows No Bid with no fake matchup, and the Tournament remains simulatable to a Champion', () => {
    useSeasonStore.getState().selectProgram('pine-valley')
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

    const state = useSeasonStore.getState()
    expect(isTournamentComplete(state.postseason!)).toBe(true)
    expect(deriveNationalChampion(state.postseason!)).toBeDefined()
  })
})

describe('Postseason — bracket and historical results', () => {
  it('reveals future participants one feeder at a time, then preserves completed scores and winner styling', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)

    const initial = useSeasonStore.getState()
    const currentRound = getCurrentTournamentRound(initial.postseason!)!
    const controlledGame = getTournamentGameForProgram(
      initial.postseason!,
      initial.controlledProgramId!,
      currentRound,
    )!
    const futureGame = initial.postseason!.bracket.games.find(
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

    const partial = useSeasonStore.getState()
    expect(partial.postseason!.resultsByGameId[controlledGame.id]).toBeUndefined()
    expect(partial.postseason!.resultsByGameId[otherFeeder.gameId]).toBeDefined()
    const partialSlots = resolveTournamentGameParticipantSlots(
      partial.postseason!,
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

    const completed = useSeasonStore.getState()
    const resolvedSlots = resolveTournamentGameParticipantSlots(
      completed.postseason!,
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

    const result = completed.postseason!.resultsByGameId[controlledGame.id]!
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
    const winnerSeed = completed.postseason!.field.find(
      (entry) => entry.programId === result.winnerId,
    )!.seed
    const loserSeed = completed.postseason!.field.find(
      (entry) => entry.programId === loserId,
    )!.seed
    if (winnerSeed > loserSeed) {
      expect(within(completedSlot).getByText('Upset')).toBeInTheDocument()
    } else {
      expect(within(completedSlot).queryByText('Upset')).not.toBeInTheDocument()
    }
  })

  it('opens a completed Tournament game as a read-only historical result with the full box score', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    const { postseason, lastPlayedTournamentGameId } = useSeasonStore.getState()
    const result = postseason!.resultsByGameId[lastPlayedTournamentGameId!]!
    const completedSlot = document.querySelector(
      '.bracket-slot--complete',
    ) as HTMLElement
    fireEvent.click(completedSlot)

    expect(useSeasonStore.getState().view).toBe('postseasonGameHistory')
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
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
  })
})

describe('Postseason — Champion', () => {
  it('renders the National Champions state when the controlled Program wins it all', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()

    const { postseason, controlledProgramId } = useSeasonStore.getState()
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
    useSeasonStore.setState({ postseason: current })

    render(<App />)

    expect(screen.getByText('National Champions')).toBeInTheDocument()
    expect(
      screen.getByText(/are your national champions/i),
    ).toBeInTheDocument()
  })

  it('renders another Program as National Champion when the controlled Program does not win it', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    completeRegularSeasonAndEnterPostseason()
    render(<App />)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/advance to next round/i)
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/advance to next round/i)

    for (let round = 0; round < 3; round += 1) {
      const button = screen.queryByRole('button', { name: /^simulate/i })
      if (button) {
        fireEvent.click(button)
      }
    }

    const { postseason, controlledProgramId } = useSeasonStore.getState()
    const champion = deriveNationalChampion(postseason!)!
    expect(champion).not.toBe(controlledProgramId)
    expect(screen.getByText('Tournament Complete')).toBeInTheDocument()
    expect(
      screen.getByText(/is your national champion\./i),
    ).toBeInTheDocument()
  })
})
