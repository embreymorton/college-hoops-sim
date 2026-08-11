import { validateRotationV1, type GameResult, type RotationV1 } from '../engine'
import { cloneGameResult, cloneRotation } from './cloning'
import type { PostseasonState } from './domain'
import { resolveTournamentGameParticipants } from './queries'
import { getTournamentResultProblems } from './resultValidation'

export function recordTournamentGameResult(
  postseason: PostseasonState,
  tournamentGameId: string,
  result: GameResult,
): PostseasonState {
  const game = postseason.bracket.games.find(({ id }) => id === tournamentGameId)
  if (!game) throw new RangeError(`Unknown Tournament game ID "${tournamentGameId}".`)
  if (postseason.resultsByGameId[tournamentGameId]) {
    throw new RangeError(`Tournament game "${tournamentGameId}" already has a completed result.`)
  }
  const participants = resolveTournamentGameParticipants(postseason, tournamentGameId)
  if (!participants) {
    throw new RangeError(`Tournament game "${tournamentGameId}" participants are not resolved.`)
  }
  const problems = getTournamentResultProblems(participants, result)
  if (problems.length > 0) {
    throw new RangeError(`Cannot record invalid GameResult: ${problems.join(' ')}`)
  }

  const next = {
    ...postseason.resultsByGameId,
    [tournamentGameId]: cloneGameResult(result),
  }
  const indexById = new Map(postseason.bracket.games.map(({ id, index }) => [id, index]))
  return {
    ...postseason,
    resultsByGameId: Object.fromEntries(
      Object.entries(next).sort(
        ([first], [second]) =>
          (indexById.get(first) ?? Number.MAX_SAFE_INTEGER) -
            (indexById.get(second) ?? Number.MAX_SAFE_INTEGER) ||
          first.localeCompare(second),
      ),
    ),
  }
}

export function updatePostseasonProgramRotation(
  postseason: PostseasonState,
  programId: string,
  rotation: RotationV1,
): PostseasonState {
  const state = postseason.programStates[programId]
  if (!state) throw new RangeError(`Unknown Postseason Program ID "${programId}".`)
  const validation = validateRotationV1(state.team, rotation)
  if (!validation.valid) {
    throw new RangeError(
      `Cannot store invalid Rotation for Program "${programId}": ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }
  return {
    ...postseason,
    programStates: {
      ...postseason.programStates,
      [programId]: { team: state.team, rotation: cloneRotation(rotation) },
    },
  }
}
