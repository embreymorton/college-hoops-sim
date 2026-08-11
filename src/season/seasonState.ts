import { validateRotationV1, type GameResult, type RotationV1 } from '../engine'
import { cloneGameResult, cloneRotation } from './cloning'
import type { SeasonState } from './domain'
import {
  getGameResultParticipantProblem,
  getGameResultStructureProblems,
} from './gameResultValidation'

/** Stores one completed result as an immutable fact keyed by ScheduledGame ID. */
export function recordGameResult(
  season: SeasonState,
  scheduledGameId: string,
  result: GameResult,
): SeasonState {
  const scheduledGame = season.schedule.games.find(
    ({ id }) => id === scheduledGameId,
  )

  if (!scheduledGame) {
    throw new RangeError(`Unknown ScheduledGame ID "${scheduledGameId}".`)
  }

  if (season.resultsByGameId[scheduledGameId] !== undefined) {
    throw new RangeError(
      `ScheduledGame "${scheduledGameId}" already has a completed result.`,
    )
  }

  const participantProblem = getGameResultParticipantProblem(
    scheduledGame,
    result,
  )

  if (participantProblem) {
    throw new RangeError(participantProblem)
  }

  const structureProblems = getGameResultStructureProblems(result)

  if (structureProblems.length > 0) {
    throw new RangeError(
      `Cannot record invalid GameResult: ${structureProblems.join(' ')}`,
    )
  }

  const nextResults = {
    ...season.resultsByGameId,
    [scheduledGameId]: cloneGameResult(result),
  }
  const gameIndexById = new Map(
    season.schedule.games.map(({ id, index }) => [id, index]),
  )
  const resultsByGameId = Object.fromEntries(
    Object.entries(nextResults).sort(
      ([firstId], [secondId]) =>
        (gameIndexById.get(firstId) ?? Number.MAX_SAFE_INTEGER) -
          (gameIndexById.get(secondId) ?? Number.MAX_SAFE_INTEGER) ||
        firstId.localeCompare(secondId),
    ),
  )

  return { ...season, resultsByGameId }
}

/** Replaces one Program's current legal Rotation without changing its Team. */
export function updateProgramRotation(
  season: SeasonState,
  programId: string,
  rotation: RotationV1,
): SeasonState {
  const programState = season.programStates[programId]

  if (!programState) {
    throw new RangeError(`Unknown Season Program ID "${programId}".`)
  }

  const validation = validateRotationV1(programState.team, rotation)

  if (!validation.valid) {
    throw new RangeError(
      `Cannot store invalid Rotation for Program "${programId}": ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return {
    ...season,
    programStates: {
      ...season.programStates,
      [programId]: {
        team: programState.team,
        rotation: cloneRotation(rotation),
      },
    },
  }
}
