import { beforeEach, describe, expect, it } from 'vitest'
import {
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../dynasty'
import {
  cloneRotationV1,
  derivePlayerMinutesV1,
  simulateGame,
  validateRotationV1,
  type GameResult,
  type PlayerGameStats,
  type RotationV1,
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
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function updateDynasty(update: Partial<DynastyState>): void {
  const dynasty = useDynastyStore.getState().dynasty
  if (!dynasty) throw new Error('Expected an initialized Dynasty.')
  useDynastyStore.setState({ dynasty: { ...dynasty, ...update } })
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
function nudgeRotation(postseason: PostseasonState, programId: string): RotationV1 {
  const state = postseason.programStates[programId]!
  const rotation = cloneRotationV1(state.rotation)

  for (const player of state.team.roster) {
    const teammate = state.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutesByPosition[player.position][candidate.id] ?? 0) < 40,
    )
    const minutes = rotation.minutesByPosition[player.position][player.id] ?? 0

    if (!teammate || minutes < 1) {
      continue
    }

    rotation.minutesByPosition[player.position][player.id] = minutes - 1
    rotation.minutesByPosition[player.position][teammate.id] =
      (rotation.minutesByPosition[player.position][teammate.id] ?? 0) + 1

    if (validateRotationV1(state.team, rotation).valid) {
      return rotation
    }

    rotation.minutesByPosition[player.position][player.id] = minutes
    rotation.minutesByPosition[player.position][teammate.id] =
      (rotation.minutesByPosition[player.position][teammate.id] ?? 0) - 1
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
  useDynastyStore
    .getState()
    .selectProgram('charlotte-tech', DEFAULT_INTERACTIVE_TEST_SEED)
  const dynasty = useDynastyStore.getState().dynasty!
  const synchronized = syncRecruitingThroughCompletedRounds({
    ...dynasty,
    activeSeason: season,
  })
  useDynastyStore.setState({
    dynasty: { ...synchronized, activePostseason: postseason },
    view: 'postseasonHub',
  })

  return { season, postseason }
}

/**
 * Assigns the controlled Program together with its Postseason default/draft
 * Rotation snapshots — mirroring exactly what `enterPostseason()` itself sets,
 * so draft-Rotation tests see the same invariants a real session would.
 */
function assignControlledProgram(postseason: PostseasonState, programId: string) {
  const controlledState = postseason.programStates[programId]

  updateDynasty({ controlledProgramId: programId })
  useDynastyStore.setState({
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
    useDynastyStore
      .getState()
      .selectProgram('charlotte-tech', DEFAULT_INTERACTIVE_TEST_SEED)
    updateDynasty({ activeSeason: season })

    useDynastyStore.getState().enterPostseason()
    const firstPostseason = useDynastyStore.getState().dynasty!.activePostseason
    expect(firstPostseason).not.toBeNull()
    expect(useDynastyStore.getState().view).toBe('postseasonHub')

    useDynastyStore.getState().goToHub()
    useDynastyStore.getState().enterPostseason()

    expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(firstPostseason)
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
  })

  it('does not mutate the completed SeasonState', () => {
    const { season } = primeStore('unmutated')
    const before = JSON.parse(JSON.stringify(season)) as SeasonState

    useDynastyStore.getState().enterPostseason()

    expect(useDynastyStore.getState().dynasty!.activeSeason).toBe(season)
    expect(useDynastyStore.getState().dynasty!.activeSeason).toEqual(before)
  })

  it('persists Postseason across navigation to the Season Hub and back', () => {
    primeStore('persists')
    useDynastyStore.getState().enterPostseason()
    const postseason = useDynastyStore.getState().dynasty!.activePostseason

    useDynastyStore.getState().goToHub()
    expect(useDynastyStore.getState().view).toBe('hub')
    expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(postseason)

    useDynastyStore.getState().enterPostseason()
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(postseason)
  })
})

describe('seasonStore postseason — qualified and alive', () => {
  it('opens Coaching from canonical Postseason state without advancing the Tournament', () => {
    const { postseason } = primeStore('coaching-navigation')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const canonical = postseason.programStates[controlledProgramId]!.rotation
    const resultsBefore = postseason.resultsByGameId

    useDynastyStore.getState().goToCoaching()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('coaching')
    expect(state.postseasonDraftRotation).toEqual(canonical)
    const aggregate = derivePlayerMinutesV1(canonical)
    expect(state.coachingSimpleMinutesByPlayerId).toEqual(
      Object.fromEntries(
        postseason.programStates[controlledProgramId]!.team.roster.map(({ id }) => [
          id,
          aggregate[id] ?? 0,
        ]),
      ),
    )
    expect(state.dynasty!.activePostseason!.resultsByGameId).toBe(resultsBefore)
    expect(getCurrentTournamentRound(state.dynasty!.activePostseason!)).toBe(
      getCurrentTournamentRound(postseason),
    )
  })

  it('routes a valid Coaching edit to the canonical Postseason Rotation only', () => {
    const { postseason, season } = primeStore('coaching-rotation')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const originalSeasonRotation = season.programStates[controlledProgramId]!.rotation
    const nudged = nudgeRotation(postseason, controlledProgramId)

    useDynastyStore.getState().goToCoaching()
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      for (const [playerId, minutes] of Object.entries(nudged.minutesByPosition[position])) {
        useDynastyStore.getState().setCoachingDraftPlayerPositionMinutes(
          playerId,
          position,
          minutes,
        )
      }
    }

    const state = useDynastyStore.getState()
    expect(state.postseasonDraftRotation).toEqual(nudged)
    expect(
      state.dynasty!.activePostseason!.programStates[controlledProgramId]!.rotation,
    ).toEqual(nudged)
    expect(
      state.dynasty!.activeSeason!.programStates[controlledProgramId]!.rotation,
    ).toEqual(originalSeasonRotation)
    expect(state.coachingSimpleMinutesByPlayerId).toEqual(
      Object.fromEntries(
        postseason.programStates[controlledProgramId]!.team.roster.map(({ id }) => [
          id,
          derivePlayerMinutesV1(nudged)[id] ?? 0,
        ]),
      ),
    )
  })

  it('applies Simple intent to Postseason canonical state and refreshes Advanced only', () => {
    const { postseason, season } = primeStore('coaching-simple-apply')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const originalSeasonRotation = season.programStates[controlledProgramId]!.rotation
    const intendedRotation = nudgeRotation(postseason, controlledProgramId)
    const intendedTotals = derivePlayerMinutesV1(intendedRotation)

    useDynastyStore.getState().goToCoaching()
    for (const player of postseason.programStates[controlledProgramId]!.team.roster) {
      useDynastyStore.getState().setCoachingSimplePlayerMinutes(
        player.id,
        intendedTotals[player.id] ?? 0,
      )
    }

    const result = useDynastyStore.getState().applyCoachingSimpleRotation()

    expect(result?.valid).toBe(true)
    const state = useDynastyStore.getState()
    const committed = state.dynasty!.activePostseason!
      .programStates[controlledProgramId]!.rotation
    expect(validateRotationV1(
      postseason.programStates[controlledProgramId]!.team,
      committed,
    ).valid).toBe(true)
    expect(derivePlayerMinutesV1(committed)).toEqual(intendedTotals)
    expect(state.postseasonDraftRotation).toEqual(committed)
    expect(state.dynasty!.activeSeason!.programStates[controlledProgramId]!.rotation)
      .toEqual(originalSeasonRotation)
  })

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

    useDynastyStore.getState().simulateNextPostseasonGame()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('postseasonHub')
    expect(state.lastPlayedTournamentGameId).toBe(expectedGame.id)
    const recorded = state.dynasty!.activePostseason!.resultsByGameId[expectedGame.id]
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
    const firstPlayer = controlledTeam.roster.find(
      (player) =>
        (postseason.programStates[controlledProgramId]!.rotation
          .minutesByPosition[player.position][player.id] ?? 0) > 0,
    )!

    useDynastyStore.getState().goToPostseasonGamePrep()
    const currentMinutes =
      useDynastyStore.getState().postseasonDraftRotation!
        .minutesByPosition[firstPlayer.position][firstPlayer.id] ?? 0
    useDynastyStore
      .getState()
      .setPostseasonDraftPlayerPositionMinutes(
        firstPlayer.id,
        firstPlayer.position,
        currentMinutes + 5,
      )
    expect(
      validateRotationV1(
        controlledTeam,
        useDynastyStore.getState().postseasonDraftRotation!,
      ).valid,
    ).toBe(false)

    useDynastyStore.getState().simulateNextPostseasonGame()

    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(useDynastyStore.getState().lastPlayedTournamentGameId).not.toBeNull()
  })

  it('initializes Tournament Game Prep Simple state from Postseason and clears stale transient feedback', () => {
    const { postseason } = primeStore('game-prep-simple-initialization')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const controlledState = postseason.programStates[controlledProgramId]!
    const aggregate = derivePlayerMinutesV1(controlledState.rotation)
    useDynastyStore.setState({
      coachingSimpleMinutesByPlayerId: { stale: 200 },
      coachingSimplePreservedPlayerIds: ['stale'],
      coachingSimpleRotationIssues: [{
        code: 'UNKNOWN_PLAYER',
        message: 'stale',
        playerId: 'stale',
      }],
    })

    useDynastyStore.getState().goToPostseasonGamePrep()

    const state = useDynastyStore.getState()
    expect(state.postseasonDraftRotation).toEqual(controlledState.rotation)
    expect(state.coachingSimpleMinutesByPlayerId).toEqual(
      Object.fromEntries(
        controlledState.team.roster.map(({ id }) => [id, aggregate[id] ?? 0]),
      ),
    )
    expect(state.coachingSimplePreservedPlayerIds).toEqual([])
    expect(state.coachingSimpleRotationIssues).toEqual([])
  })

  it('commits Rotation edits to Postseason only, leaving the completed Season Rotation untouched', () => {
    const { postseason, season } = primeStore('alive-rotation-isolation')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const originalSeasonRotation = season.programStates[controlledProgramId]!.rotation
    const nudged = nudgeRotation(postseason, controlledProgramId)

    useDynastyStore.getState().goToPostseasonGamePrep()
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      for (const [playerId, minutes] of Object.entries(nudged.minutesByPosition[position])) {
        useDynastyStore.getState().setPostseasonDraftPlayerPositionMinutes(
          playerId,
          position,
          minutes,
        )
      }
    }

    const state = useDynastyStore.getState()
    expect(state.dynasty!.activePostseason!.programStates[controlledProgramId]!.rotation).toEqual(
      nudged,
    )
    expect(state.dynasty!.activeSeason!.programStates[controlledProgramId]!.rotation).toEqual(
      originalSeasonRotation,
    )
  })

  it('Reset to Default restores the Rotation the Program carried into the Tournament', () => {
    const { postseason } = primeStore('alive-reset')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    const canonical = postseason.programStates[controlledProgramId]!.rotation
    const nudged = nudgeRotation(postseason, controlledProgramId)

    useDynastyStore.getState().goToPostseasonGamePrep()
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      for (const [playerId, minutes] of Object.entries(nudged.minutesByPosition[position])) {
        useDynastyStore.getState().setPostseasonDraftPlayerPositionMinutes(
          playerId,
          position,
          minutes,
        )
      }
    }
    useDynastyStore.getState().resetPostseasonDraftRotation()

    const state = useDynastyStore.getState()
    expect(state.postseasonDraftRotation).toEqual(canonical)
    expect(state.dynasty!.activePostseason!.programStates[controlledProgramId]!.rotation).toEqual(
      canonical,
    )
  })

  it('advances the bracket to the next round once the rest of the current round is simulated', () => {
    const { postseason } = primeStore('alive-round-advance')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)

    useDynastyStore.getState().simulateNextPostseasonGame()
    expect(getCurrentTournamentRound(useDynastyStore.getState().dynasty!.activePostseason!)).toBe(
      'round-of-16',
    )

    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()

    const state = useDynastyStore.getState()
    expect(
      getGamesForTournamentRound(state.dynasty!.activePostseason!, 'round-of-16').every(
        (game) => state.dynasty!.activePostseason!.resultsByGameId[game.id] !== undefined,
      ),
    ).toBe(true)
    expect(getCurrentTournamentRound(state.dynasty!.activePostseason!)).toBe('quarterfinals')
  })
})

describe('seasonStore postseason — eliminated', () => {
  it('derives eliminated correctly and Quick Sim has no playable game for the controlled Program', () => {
    const { postseason } = primeStore('eliminated')
    const controlledProgramId = postseason.field[0]!.programId
    const afterLoss = forceRoundOf16Loss(postseason, controlledProgramId)
    updateDynasty({ controlledProgramId, activePostseason: afterLoss })

    expect(deriveRemainingProgramIds(afterLoss)).not.toContain(controlledProgramId)
    expect(
      getTournamentGameForProgram(afterLoss, controlledProgramId, 'quarterfinals'),
    ).toBeUndefined()

    useDynastyStore.getState().simulateNextPostseasonGame()
    expect(useDynastyStore.getState().lastPlayedTournamentGameId).toBeNull()
    expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(afterLoss)
  })

  it('lets the AI Tournament continue past an eliminated controlled Program', () => {
    const { postseason } = primeStore('eliminated-ai-continue')
    const controlledProgramId = postseason.field[0]!.programId
    const afterLoss = forceRoundOf16Loss(postseason, controlledProgramId)
    updateDynasty({ controlledProgramId, activePostseason: afterLoss })

    useDynastyStore.getState().simulateRestOfCurrentTournamentRound()

    const state = useDynastyStore.getState()
    expect(
      getGamesForTournamentRound(state.dynasty!.activePostseason!, 'round-of-16').every(
        (game) => state.dynasty!.activePostseason!.resultsByGameId[game.id] !== undefined,
      ),
    ).toBe(true)
    expect(getCurrentTournamentRound(state.dynasty!.activePostseason!)).toBe('quarterfinals')
  })
})

describe('seasonStore postseason — did not qualify', () => {
  it('opens Coaching from completed Season team/rotation state without mutating Tournament facts', () => {
    const { postseason, season } = primeStore('dnq-coaching')
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !postseason.field.some((entry) => entry.programId === program.id),
    )!
    const seasonState = season.programStates[outsider.id]!
    updateDynasty({ controlledProgramId: outsider.id })
    useDynastyStore.setState({
      controlledProgramDefaultRotation: seasonState.rotation,
      postseasonControlledDefaultRotation: null,
      postseasonDraftRotation: null,
    })
    const dynastyBefore = useDynastyStore.getState().dynasty

    useDynastyStore.getState().goToCoaching()

    const state = useDynastyStore.getState()
    expect(state.view).toBe('coaching')
    expect(state.draftRotation).toEqual(seasonState.rotation)
    expect(state.postseasonDraftRotation).toBeNull()
    const aggregate = derivePlayerMinutesV1(seasonState.rotation)
    expect(state.coachingSimpleMinutesByPlayerId).toEqual(
      Object.fromEntries(
        seasonState.team.roster.map(({ id }) => [id, aggregate[id] ?? 0]),
      ),
    )
    expect(state.dynasty).toBe(dynastyBefore)
    expect(state.dynasty!.activePostseason).toBe(postseason)
    expect(state.dynasty!.activeSeason).toBe(season)
    expect(state.dynasty!.activePostseason!.programStates[outsider.id]).toBeUndefined()
  })

  it('has no playable game and every user action no-ops for a non-field controlled Program', () => {
    const { postseason } = primeStore('dnq')
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !postseason.field.some((entry) => entry.programId === program.id),
    )!
    updateDynasty({ controlledProgramId: outsider.id })

    useDynastyStore.getState().simulateNextPostseasonGame()
    expect(useDynastyStore.getState().lastPlayedTournamentGameId).toBeNull()
    expect(useDynastyStore.getState().view).toBe('postseasonHub')

    useDynastyStore.getState().goToPostseasonGamePrep()
    expect(useDynastyStore.getState().view).toBe('postseasonHub')

    useDynastyStore.getState().playPostseasonScheduledGame()
    expect(useDynastyStore.getState().lastPlayedTournamentGameId).toBeNull()
  })

  it('lets the AI Tournament progress all the way to a National Champion', () => {
    const { postseason } = primeStore('dnq-full-tournament')
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !postseason.field.some((entry) => entry.programId === program.id),
    )!
    updateDynasty({ controlledProgramId: outsider.id })

    for (let round = 0; round < 4; round += 1) {
      useDynastyStore.getState().simulateRestOfCurrentTournamentRound()
    }

    const state = useDynastyStore.getState()
    expect(isTournamentComplete(state.dynasty!.activePostseason!)).toBe(true)
    expect(deriveNationalChampion(state.dynasty!.activePostseason!)).toBeDefined()
  })
})

describe('seasonStore postseason — historical results', () => {
  it('opens a completed Tournament game for historical review without resimulating it', () => {
    const { postseason } = primeStore('historical')
    const controlledProgramId = postseason.field[0]!.programId
    assignControlledProgram(postseason, controlledProgramId)
    useDynastyStore.getState().simulateNextPostseasonGame()
    const gameId = useDynastyStore.getState().lastPlayedTournamentGameId!
    const resultBefore = useDynastyStore.getState().dynasty!.activePostseason!.resultsByGameId[gameId]
    useDynastyStore.getState().goToPostseasonHub()

    useDynastyStore.getState().viewCompletedTournamentGame(gameId)

    const state = useDynastyStore.getState()
    expect(state.view).toBe('postseasonGameHistory')
    expect(state.viewedTournamentGameId).toBe(gameId)
    expect(state.dynasty!.activePostseason!.resultsByGameId[gameId]).toEqual(resultBefore)
  })

  it('is a no-op for a Tournament game that has not been played yet', () => {
    const { postseason } = primeStore('historical-pending')
    const pendingGame = postseason.bracket.games[0]!
    updateDynasty({ controlledProgramId: postseason.field[0]!.programId })

    useDynastyStore.getState().viewCompletedTournamentGame(pendingGame.id)

    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(useDynastyStore.getState().viewedTournamentGameId).toBeNull()
  })
})
