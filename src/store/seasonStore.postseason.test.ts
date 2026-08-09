import { beforeEach, describe, expect, it } from 'vitest'
import {
  simulateGame,
  validateRotation,
  type GameResult,
  type PlayerGameStats,
  type Rotation,
} from '../engine'
import {
  deriveNationalChampion,
  deriveRemainingProgramIds,
  getCurrentTournamentRound,
  getGamesForTournamentRound,
  getTournamentGameForProgram,
  initializePostseason,
  isTournamentComplete,
  recordTournamentGameResult,
  resolveTournamentGameParticipants,
  type PostseasonState,
} from '../postseason'
import { generateRegularSeasonSchedule } from '../schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../season'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import { useSeasonStore } from './seasonStore'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
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

function forcedResult(
  participants: { homeProgramId: string; awayProgramId: string },
  winnerId: string,
): GameResult {
  const homeScore = winnerId === participants.homeProgramId ? 71 : 65
  const awayScore = winnerId === participants.awayProgramId ? 71 : 65
  return {
    homeTeamId: participants.homeProgramId,
    awayTeamId: participants.awayProgramId,
    homeScore,
    awayScore,
    winnerId,
    overtimePeriods: 0,
    seed: 'store-test-forced-result',
    homePlayerStats: [stat(`${participants.homeProgramId}:player`, homeScore)],
    awayPlayerStats: [stat(`${participants.awayProgramId}:player`, awayScore)],
  }
}

/** Nudges one minute between two same-position teammates, keeping the Rotation legal. */
function nudgeRotation(postseason: PostseasonState, programId: string): Rotation {
  const state = postseason.programStates[programId]!
  const rotation: Rotation = { minutes: { ...state.rotation.minutes } }

  for (const player of state.team.roster) {
    const teammate = state.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutes[candidate.id] ?? 0) < 40,
    )
    const minutes = rotation.minutes[player.id] ?? 0

    if (!teammate || minutes < 1) {
      continue
    }

    rotation.minutes[player.id] = minutes - 1
    rotation.minutes[teammate.id] = (rotation.minutes[teammate.id] ?? 0) + 1

    if (validateRotation(state.team, rotation).valid) {
      return rotation
    }

    rotation.minutes[player.id] = minutes
    rotation.minutes[teammate.id] = (rotation.minutes[teammate.id] ?? 0) - 1
  }

  throw new Error(`Could not nudge Rotation for ${programId}.`)
}

function buildCompletedSeason(seedSuffix: string): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    `postseason-store-test-universe:${seedSuffix}`,
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: `postseason-store-test-schedule:${seedSuffix}`,
  })
  let season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })

  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({
      season,
      round,
      simulationSeed: `postseason-store-test-sim:${seedSuffix}`,
    })
  }

  return season
}

/** Primes the store with a real completed Season + initialized Postseason, bypassing selectProgram(). */
function primeStore(seedSuffix = 'fixture') {
  const season = buildCompletedSeason(seedSuffix)
  const postseason = initializePostseason({ universe: UNIVERSE_V0, season })

  useSeasonStore.setState({ season, postseason, view: 'postseasonHub' })

  return { season, postseason }
}

/**
 * Assigns the controlled Program together with its Postseason default/draft
 * Rotation snapshots — mirroring exactly what `enterPostseason()` itself sets,
 * so draft-Rotation tests see the same invariants a real session would.
 */
function assignControlledProgram(postseason: PostseasonState, programId: string) {
  const controlledState = postseason.programStates[programId]

  useSeasonStore.setState({
    controlledProgramId: programId,
    postseasonControlledDefaultRotation: controlledState?.rotation ?? null,
    postseasonDraftRotation: controlledState?.rotation ?? null,
  })
}

function forceRoundOf16Loss(
  postseason: PostseasonState,
  controlledProgramId: string,
): PostseasonState {
  const game = getTournamentGameForProgram(
    postseason,
    controlledProgramId,
    'round-of-16',
  )!
  const participants = resolveTournamentGameParticipants(postseason, game.id)!
  const winnerId =
    participants.homeProgramId === controlledProgramId
      ? participants.awayProgramId
      : participants.homeProgramId

  return recordTournamentGameResult(
    postseason,
    game.id,
    forcedResult(participants, winnerId),
  )
}

beforeEach(() => {
  resetStore()
})

describe('seasonStore postseason transition', () => {
  it('initializes Postseason once from the completed Season; re-entry only navigates', () => {
    const season = buildCompletedSeason('init-once')
    useSeasonStore.setState({ controlledProgramId: 'charlotte-tech', season })

    useSeasonStore.getState().enterPostseason()
    const firstPostseason = useSeasonStore.getState().postseason
    expect(firstPostseason).not.toBeNull()
    expect(useSeasonStore.getState().view).toBe('postseasonHub')

    useSeasonStore.getState().goToHub()
    useSeasonStore.getState().enterPostseason()

    expect(useSeasonStore.getState().postseason).toBe(firstPostseason)
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
  })

  it('does not mutate the completed SeasonState', () => {
    const { season } = primeStore('unmutated')
    const before = JSON.parse(JSON.stringify(season)) as SeasonState

    useSeasonStore.getState().enterPostseason()

    expect(useSeasonStore.getState().season).toBe(season)
    expect(useSeasonStore.getState().season).toEqual(before)
  })

  it('persists Postseason across navigation to the Season Hub and back', () => {
    primeStore('persists')
    useSeasonStore.getState().enterPostseason()
    const postseason = useSeasonStore.getState().postseason

    useSeasonStore.getState().goToHub()
    expect(useSeasonStore.getState().view).toBe('hub')
    expect(useSeasonStore.getState().postseason).toBe(postseason)

    useSeasonStore.getState().enterPostseason()
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
    expect(useSeasonStore.getState().postseason).toBe(postseason)
  })
})

describe('seasonStore postseason — qualified and alive', () => {
  it('resolves the correct current-round matchup and Quick Sim records the real Tournament GameResult', () => {
    const { postseason } = primeStore('alive-quicksim')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const expectedGame = getTournamentGameForProgram(
      postseason,
      controlledProgramId,
      'round-of-16',
    )!
    const participants = resolveTournamentGameParticipants(
      postseason,
      expectedGame.id,
    )!
    const home = postseason.programStates[participants.homeProgramId]!
    const away = postseason.programStates[participants.awayProgramId]!

    useSeasonStore.getState().simulateNextPostseasonGame()

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postseasonPostgame')
    expect(state.lastPlayedTournamentGameId).toBe(expectedGame.id)
    const recorded = state.postseason!.resultsByGameId[expectedGame.id]
    expect(recorded).toBeDefined()

    const independent = simulateGame({
      homeTeam: home.team,
      awayTeam: away.team,
      homeRotation: home.rotation,
      awayRotation: away.rotation,
      seed: recorded!.seed,
      site: 'neutral',
    })
    expect(recorded).toEqual(independent)
  })

  it('is not blocked by a stale invalid Postseason Rotation draft', () => {
    const { postseason } = primeStore('alive-invalid-draft')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const controlledTeam = postseason.programStates[controlledProgramId]!.team
    const [firstPlayerId] = Object.keys(
      postseason.programStates[controlledProgramId]!.rotation.minutes,
    )

    useSeasonStore.getState().goToPostseasonGamePrep()
    const currentMinutes =
      useSeasonStore.getState().postseasonDraftRotation!.minutes[firstPlayerId!] ?? 0
    useSeasonStore
      .getState()
      .setPostseasonDraftPlayerMinutes(firstPlayerId!, currentMinutes + 5)
    expect(
      validateRotation(
        controlledTeam,
        useSeasonStore.getState().postseasonDraftRotation!,
      ).valid,
    ).toBe(false)

    useSeasonStore.getState().simulateNextPostseasonGame()

    expect(useSeasonStore.getState().view).toBe('postseasonPostgame')
    expect(useSeasonStore.getState().lastPlayedTournamentGameId).not.toBeNull()
  })

  it('commits Rotation edits to Postseason only, leaving the completed Season Rotation untouched', () => {
    const { postseason, season } = primeStore('alive-rotation-isolation')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const originalSeasonRotation = season.programStates[controlledProgramId]!.rotation
    const nudged = nudgeRotation(postseason, controlledProgramId)

    useSeasonStore.getState().goToPostseasonGamePrep()
    for (const [playerId, minutes] of Object.entries(nudged.minutes)) {
      useSeasonStore.getState().setPostseasonDraftPlayerMinutes(playerId, minutes)
    }

    const state = useSeasonStore.getState()
    expect(state.postseason!.programStates[controlledProgramId]!.rotation).toEqual(
      nudged,
    )
    expect(state.season!.programStates[controlledProgramId]!.rotation).toEqual(
      originalSeasonRotation,
    )
  })

  it('Reset to Default restores the Rotation the Program carried into the Tournament', () => {
    const { postseason } = primeStore('alive-reset')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const canonical = postseason.programStates[controlledProgramId]!.rotation
    const nudged = nudgeRotation(postseason, controlledProgramId)

    useSeasonStore.getState().goToPostseasonGamePrep()
    for (const [playerId, minutes] of Object.entries(nudged.minutes)) {
      useSeasonStore.getState().setPostseasonDraftPlayerMinutes(playerId, minutes)
    }
    useSeasonStore.getState().resetPostseasonDraftRotation()

    const state = useSeasonStore.getState()
    expect(state.postseasonDraftRotation).toEqual(canonical)
    expect(state.postseason!.programStates[controlledProgramId]!.rotation).toEqual(
      canonical,
    )
  })

  it('advances the bracket to the next round once the rest of the current round is simulated', () => {
    const { postseason } = primeStore('alive-round-advance')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)

    useSeasonStore.getState().simulateNextPostseasonGame()
    expect(getCurrentTournamentRound(useSeasonStore.getState().postseason!)).toBe(
      'round-of-16',
    )

    useSeasonStore.getState().simulateRestOfCurrentTournamentRound()

    const state = useSeasonStore.getState()
    expect(
      getGamesForTournamentRound(state.postseason!, 'round-of-16').every(
        (game) => state.postseason!.resultsByGameId[game.id] !== undefined,
      ),
    ).toBe(true)
    expect(getCurrentTournamentRound(state.postseason!)).toBe('quarterfinals')
  })
})

describe('seasonStore postseason — eliminated', () => {
  it('derives eliminated correctly and Quick Sim has no playable game for the controlled Program', () => {
    const { postseason } = primeStore('eliminated')
    const controlledProgramId = postseason.field[0]!.programId
    const afterLoss = forceRoundOf16Loss(postseason, controlledProgramId)
    useSeasonStore.setState({ controlledProgramId, postseason: afterLoss })

    expect(deriveRemainingProgramIds(afterLoss)).not.toContain(controlledProgramId)
    expect(
      getTournamentGameForProgram(afterLoss, controlledProgramId, 'quarterfinals'),
    ).toBeUndefined()

    useSeasonStore.getState().simulateNextPostseasonGame()
    expect(useSeasonStore.getState().lastPlayedTournamentGameId).toBeNull()
    expect(useSeasonStore.getState().postseason).toBe(afterLoss)
  })

  it('lets the AI Tournament continue past an eliminated controlled Program', () => {
    const { postseason } = primeStore('eliminated-ai-continue')
    const controlledProgramId = postseason.field[0]!.programId
    const afterLoss = forceRoundOf16Loss(postseason, controlledProgramId)
    useSeasonStore.setState({ controlledProgramId, postseason: afterLoss })

    useSeasonStore.getState().simulateRestOfCurrentTournamentRound()

    const state = useSeasonStore.getState()
    expect(
      getGamesForTournamentRound(state.postseason!, 'round-of-16').every(
        (game) => state.postseason!.resultsByGameId[game.id] !== undefined,
      ),
    ).toBe(true)
    expect(getCurrentTournamentRound(state.postseason!)).toBe('quarterfinals')
  })
})

describe('seasonStore postseason — did not qualify', () => {
  it('has no playable game and every user action no-ops for a non-field controlled Program', () => {
    const { postseason } = primeStore('dnq')
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !postseason.field.some((entry) => entry.programId === program.id),
    )!
    useSeasonStore.setState({ controlledProgramId: outsider.id })

    useSeasonStore.getState().simulateNextPostseasonGame()
    expect(useSeasonStore.getState().lastPlayedTournamentGameId).toBeNull()
    expect(useSeasonStore.getState().view).toBe('postseasonHub')

    useSeasonStore.getState().goToPostseasonGamePrep()
    expect(useSeasonStore.getState().view).toBe('postseasonHub')

    useSeasonStore.getState().playPostseasonScheduledGame()
    expect(useSeasonStore.getState().lastPlayedTournamentGameId).toBeNull()
  })

  it('lets the AI Tournament progress all the way to a National Champion', () => {
    const { postseason } = primeStore('dnq-full-tournament')
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !postseason.field.some((entry) => entry.programId === program.id),
    )!
    useSeasonStore.setState({ controlledProgramId: outsider.id })

    for (let round = 0; round < 4; round += 1) {
      useSeasonStore.getState().simulateRestOfCurrentTournamentRound()
    }

    const state = useSeasonStore.getState()
    expect(isTournamentComplete(state.postseason!)).toBe(true)
    expect(deriveNationalChampion(state.postseason!)).toBeDefined()
  })
})

describe('seasonStore postseason — historical results', () => {
  it('opens a completed Tournament game for historical review without resimulating it', () => {
    const { postseason } = primeStore('historical')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    useSeasonStore.getState().simulateNextPostseasonGame()
    const gameId = useSeasonStore.getState().lastPlayedTournamentGameId!
    const resultBefore = useSeasonStore.getState().postseason!.resultsByGameId[gameId]
    useSeasonStore.getState().goToPostseasonHub()

    useSeasonStore.getState().viewCompletedTournamentGame(gameId)

    const state = useSeasonStore.getState()
    expect(state.view).toBe('postseasonGameHistory')
    expect(state.viewedTournamentGameId).toBe(gameId)
    expect(state.postseason!.resultsByGameId[gameId]).toEqual(resultBefore)
  })

  it('is a no-op for a Tournament game that has not been played yet', () => {
    const { postseason } = primeStore('historical-pending')
    const pendingGame = postseason.bracket.games[0]!
    useSeasonStore.setState({ controlledProgramId: postseason.field[0]!.programId })

    useSeasonStore.getState().viewCompletedTournamentGame(pendingGame.id)

    expect(useSeasonStore.getState().view).toBe('postseasonHub')
    expect(useSeasonStore.getState().viewedTournamentGameId).toBeNull()
  })
})
