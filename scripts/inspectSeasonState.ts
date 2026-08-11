import {
  cloneRotationV1,
  simulateGame,
  validateRotationV1,
  type GameResult,
  type RotationV1,
} from '../src/engine'
import { generateRegularSeasonSchedule, type ScheduledGame } from '../src/schedule'
import {
  deriveConferenceRecord,
  deriveProgramRecord,
  getCompletedGamesForRound,
  getCurrentRound,
  getGamesForRound,
  initializeSeason,
  isRegularSeasonComplete,
  isRoundComplete,
  recordGameResult,
  updateProgramRotation,
  validateSeasonState,
  type SeasonState,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const DYNASTY_SEED = 'season-state-inspection-universe'
const SCHEDULE_SEED = 'season-state-inspection-schedule'
const SEASON_NUMBER = 1

function gameSeed(season: SeasonState, game: ScheduledGame): string {
  return JSON.stringify({
    namespace: 'season-state-inspection-game-v0',
    seasonNumber: season.seasonNumber,
    scheduledGameId: game.id,
  })
}

function simulateScheduledGame(
  season: SeasonState,
  game: ScheduledGame,
): GameResult {
  const home = season.programStates[game.homeProgramId]
  const away = season.programStates[game.awayProgramId]

  if (!home || !away) {
    throw new Error('Scheduled game references missing Season Program state.')
  }

  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: gameSeed(season, game),
  })
}

function simulateAndRecord(
  season: SeasonState,
  games: readonly ScheduledGame[],
): SeasonState {
  return games.reduce(
    (current, game) =>
      recordGameResult(
        current,
        game.id,
        simulateScheduledGame(current, game),
      ),
    season,
  )
}

function createAlternativeRotation(
  season: SeasonState,
  programId: string,
): RotationV1 {
  const state = season.programStates[programId]

  if (!state) {
    throw new Error(`Missing Season Program "${programId}".`)
  }

  const rotation = cloneRotationV1(state.rotation)

  for (const player of state.team.roster) {
    const teammate = state.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutesByPosition[player.position][candidate.id] ?? 0) < 40,
    )
    const assignments = rotation.minutesByPosition[player.position]
    const playerMinutes = assignments[player.id] ?? 0

    if (!teammate || playerMinutes < 1) {
      continue
    }

    assignments[player.id] = playerMinutes - 1
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) + 1

    if (validateRotationV1(state.team, rotation).valid) {
      return rotation
    }

    assignments[player.id] = playerMinutes
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) - 1
  }

  throw new Error('Could not create a different legal inspection Rotation.')
}

function rejectionPassed(operation: () => unknown): boolean {
  try {
    operation()
    return false
  } catch {
    return true
  }
}

function yesNo(value: boolean): string {
  return value ? 'YES' : 'NO'
}

function main(): void {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, DYNASTY_SEED)
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: SCHEDULE_SEED,
  })
  const initialSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: SEASON_NUMBER,
  })
  const initialValidation = validateSeasonState(UNIVERSE_V0, initialSeason)

  process.stdout.write(
    'COLLEGE HOOPS SIM — SEASON STATE V0 INSPECTION\n' +
      `Season: ${initialSeason.seasonNumber}\n` +
      `Programs: ${Object.keys(initialSeason.programStates).length}\n` +
      `Rounds: ${initialSeason.schedule.roundCount}\n` +
      `Scheduled games: ${initialSeason.schedule.games.length}\n` +
      `Completed games: ${Object.keys(initialSeason.resultsByGameId).length}\n` +
      `Current round: ${getCurrentRound(initialSeason) ?? 'COMPLETE'}\n` +
      `Season complete: ${yesNo(isRegularSeasonComplete(initialSeason))}\n` +
      `Validation: ${initialValidation.valid ? 'PASS' : 'FAIL'}\n\n`,
  )

  const roundOneGames = getGamesForRound(initialSeason, 1)
  const partialSeason = simulateAndRecord(initialSeason, roundOneGames.slice(0, 5))
  const recordProgramIds = roundOneGames
    .slice(0, 3)
    .map(({ homeProgramId }) => homeProgramId)

  process.stdout.write(
    'PARTIAL ROUND 1\n' +
      `Round 1: ${getCompletedGamesForRound(partialSeason, 1).length} / ${roundOneGames.length}\n` +
      `Round 1 complete: ${yesNo(isRoundComplete(partialSeason, 1))}\n` +
      `Current round: ${getCurrentRound(partialSeason)}\n` +
      'Derived records:\n',
  )

  for (const programId of recordProgramIds) {
    const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)
    const overall = deriveProgramRecord(partialSeason, programId)
    const conference = deriveConferenceRecord(partialSeason, programId)

    process.stdout.write(
      `  ${program?.name ?? programId}: ${overall.wins}-${overall.losses} ` +
        `(CONF ${conference.wins}-${conference.losses})\n`,
    )
  }

  const completedRoundSeason = simulateAndRecord(
    partialSeason,
    roundOneGames.slice(5),
  )

  process.stdout.write(
    '\nCOMPLETED ROUND 1\n' +
      `Round 1: ${getCompletedGamesForRound(completedRoundSeason, 1).length} / ${roundOneGames.length}\n` +
      `Round 1 complete: ${yesNo(isRoundComplete(completedRoundSeason, 1))}\n` +
      `Current round: ${getCurrentRound(completedRoundSeason)}\n` +
      `Season complete: ${yesNo(isRegularSeasonComplete(completedRoundSeason))}\n\n`,
  )

  const programId = 'charlotte-tech'
  const stateBefore = completedRoundSeason.programStates[programId]

  if (!stateBefore) {
    throw new Error(`Missing inspection Program "${programId}".`)
  }

  const alternativeRotation = createAlternativeRotation(
    completedRoundSeason,
    programId,
  )
  const updatedSeason = updateProgramRotation(
    completedRoundSeason,
    programId,
    alternativeRotation,
  )
  const stateAfter = updatedSeason.programStates[programId]
  const updatedValidation = validateSeasonState(UNIVERSE_V0, updatedSeason)

  process.stdout.write(
    'ROTATION UPDATE — CHARLOTTE TECH\n' +
      `Default Rotation valid: ${yesNo(validateRotationV1(stateBefore.team, stateBefore.rotation).valid)}\n` +
      `Current Rotation valid: ${yesNo(Boolean(stateAfter && validateRotationV1(stateAfter.team, stateAfter.rotation).valid))}\n` +
      `Rotation changed: ${yesNo(JSON.stringify(stateBefore.rotation) !== JSON.stringify(stateAfter?.rotation))}\n` +
      `Team unchanged: ${yesNo(JSON.stringify(stateBefore.team) === JSON.stringify(stateAfter?.team))}\n` +
      `Season validation after update: ${updatedValidation.valid ? 'PASS' : 'FAIL'}\n\n`,
  )

  const firstGame = roundOneGames[0] as ScheduledGame
  const firstResult = updatedSeason.resultsByGameId[firstGame.id] as GameResult
  const duplicateRejected = rejectionPassed(() =>
    recordGameResult(updatedSeason, firstGame.id, firstResult),
  )
  const mismatchRejected = rejectionPassed(() =>
    recordGameResult(initialSeason, firstGame.id, {
      ...firstResult,
      awayTeamId: 'mismatched-program',
    }),
  )
  const unknownRejected = rejectionPassed(() =>
    recordGameResult(initialSeason, 'unknown-scheduled-game', firstResult),
  )
  const invalidRotationRejected = rejectionPassed(() =>
    updateProgramRotation(updatedSeason, programId, {
      minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} },
    }),
  )
  const roundTripped = JSON.parse(
    JSON.stringify(updatedSeason),
  ) as SeasonState

  process.stdout.write(
    'REJECTIONS AND SERIALIZATION\n' +
      `Duplicate result rejected: ${duplicateRejected ? 'PASS' : 'FAIL'}\n` +
      `Mismatched Teams rejected: ${mismatchRejected ? 'PASS' : 'FAIL'}\n` +
      `Unknown ScheduledGame rejected: ${unknownRejected ? 'PASS' : 'FAIL'}\n` +
      `Invalid Rotation rejected: ${invalidRotationRejected ? 'PASS' : 'FAIL'}\n` +
      `JSON roundtrip: ${JSON.stringify(roundTripped) === JSON.stringify(updatedSeason) ? 'PASS' : 'FAIL'}\n`,
  )
}

main()
