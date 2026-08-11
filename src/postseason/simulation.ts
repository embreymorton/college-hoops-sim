import { simulateGame, validateRotationV1, type RngSeed } from '../engine'
import type {
  PostseasonState,
  SimulatePendingCurrentTournamentRoundOptions,
  SimulatePendingTournamentRoundOptions,
  SimulateTournamentGameOptions,
} from './domain'
import {
  getCurrentTournamentRound,
  getGamesForTournamentRound,
  resolveTournamentGameParticipants,
} from './queries'
import { recordTournamentGameResult } from './postseasonState'

const POSTSEASON_GAME_SIMULATION_NAMESPACE =
  'college-hoops-sim:postseason-game-simulation:v0'

function deriveTournamentGameSeed(
  postseason: PostseasonState,
  tournamentGameId: string,
  simulationSeed: RngSeed,
): string {
  if (typeof simulationSeed === 'number' && !Number.isFinite(simulationSeed)) {
    throw new RangeError(
      'Postseason simulation seed must be a finite number or a string.',
    )
  }
  return JSON.stringify({
    namespace: POSTSEASON_GAME_SIMULATION_NAMESPACE,
    simulationSeed: {
      type: typeof simulationSeed === 'number' ? 'number' : 'string',
      value: simulationSeed,
    },
    postseason: {
      id: postseason.id,
      seasonId: postseason.seasonId,
      universeId: postseason.universeId,
      universeVersion: postseason.universeVersion,
    },
    tournamentGameId,
  })
}

export function simulateTournamentGame({
  postseason,
  tournamentGameId,
  simulationSeed,
}: SimulateTournamentGameOptions): PostseasonState {
  if (postseason.resultsByGameId[tournamentGameId]) {
    throw new RangeError(
      `Tournament game "${tournamentGameId}" already has a completed result.`,
    )
  }
  const participants = resolveTournamentGameParticipants(
    postseason,
    tournamentGameId,
  )
  if (!participants) {
    throw new RangeError(
      `Tournament game "${tournamentGameId}" participants are not resolved.`,
    )
  }
  const home = postseason.programStates[participants.homeProgramId]
  const away = postseason.programStates[participants.awayProgramId]
  if (!home || !away) {
    const missing = home
      ? participants.awayProgramId
      : participants.homeProgramId
    throw new RangeError(
      `Tournament game "${tournamentGameId}" references missing Postseason Program "${missing}".`,
    )
  }
  for (const [programId, state] of [
    [participants.homeProgramId, home],
    [participants.awayProgramId, away],
  ] as const) {
    const validation = validateRotationV1(state.team, state.rotation)
    if (!validation.valid) {
      throw new RangeError(
        `Postseason Program "${programId}" has an invalid Rotation.`,
      )
    }
  }

  const result = simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: deriveTournamentGameSeed(
      postseason,
      tournamentGameId,
      simulationSeed,
    ),
    site: 'neutral',
  })
  return recordTournamentGameResult(postseason, tournamentGameId, result)
}

export function simulatePendingGamesInTournamentRound({
  postseason,
  round,
  simulationSeed,
  excludedProgramIds = [],
}: SimulatePendingTournamentRoundOptions): PostseasonState {
  const games = getGamesForTournamentRound(postseason, round)
  if (games.length === 0) {
    throw new RangeError(`Unknown Tournament round "${round}".`)
  }
  const excluded = new Set(excludedProgramIds)
  return games.reduce((current, game) => {
    if (current.resultsByGameId[game.id]) return current
    const participants = resolveTournamentGameParticipants(current, game.id)
    if (
      !participants ||
      excluded.has(participants.homeProgramId) ||
      excluded.has(participants.awayProgramId)
    ) {
      return current
    }
    return simulateTournamentGame({
      postseason: current,
      tournamentGameId: game.id,
      simulationSeed,
    })
  }, postseason)
}

export function simulatePendingGamesInCurrentTournamentRound({
  postseason,
  simulationSeed,
  excludedProgramIds,
}: SimulatePendingCurrentTournamentRoundOptions): PostseasonState {
  const round = getCurrentTournamentRound(postseason)
  return round === undefined
    ? postseason
    : simulatePendingGamesInTournamentRound({
        postseason,
        round,
        simulationSeed,
        excludedProgramIds,
      })
}
