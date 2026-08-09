import { simulateGame, type RngSeed } from '../engine'
import type { ScheduledGame } from '../schedule'
import type {
  SeasonState,
  SimulatePendingGamesInCurrentRoundOptions,
  SimulatePendingGamesInRoundOptions,
  SimulatePendingGamesThroughRoundOptions,
  SimulateScheduledGameOptions,
} from './domain'
import { getCurrentRound, getGamesForRound } from './queries'
import { recordGameResult } from './seasonState'

const SEASON_GAME_SIMULATION_NAMESPACE =
  'college-hoops-sim:season-game-simulation:v0'

interface SeasonGameSimulationSeedNamespace {
  readonly namespace: typeof SEASON_GAME_SIMULATION_NAMESPACE
  readonly simulationSeed: {
    readonly type: 'number' | 'string'
    readonly value: RngSeed
  }
  readonly season: {
    readonly id: string
    readonly number: number
    readonly universeId: string
    readonly universeVersion: string
  }
  readonly scheduledGameId: string
}

function deriveGameSeed(
  season: SeasonState,
  scheduledGameId: string,
  simulationSeed: RngSeed,
): string {
  if (typeof simulationSeed === 'number' && !Number.isFinite(simulationSeed)) {
    throw new RangeError(
      'Season simulation seed must be a finite number or a string.',
    )
  }

  const namespace: SeasonGameSimulationSeedNamespace = {
    namespace: SEASON_GAME_SIMULATION_NAMESPACE,
    simulationSeed: {
      type: typeof simulationSeed === 'number' ? 'number' : 'string',
      value: simulationSeed,
    },
    season: {
      id: season.id,
      number: season.seasonNumber,
      universeId: season.universeId,
      universeVersion: season.universeVersion,
    },
    scheduledGameId,
  }

  return JSON.stringify(namespace)
}

function getScheduledGame(
  season: SeasonState,
  scheduledGameId: string,
): ScheduledGame {
  const game = season.schedule.games.find(({ id }) => id === scheduledGameId)

  if (!game) {
    throw new RangeError(`Unknown ScheduledGame ID "${scheduledGameId}".`)
  }

  return game
}

/** Simulates and records one pending game from current Season basketball state. */
export function simulateScheduledGame({
  season,
  scheduledGameId,
  simulationSeed,
}: SimulateScheduledGameOptions): SeasonState {
  const game = getScheduledGame(season, scheduledGameId)

  if (season.resultsByGameId[scheduledGameId] !== undefined) {
    throw new RangeError(
      `ScheduledGame "${scheduledGameId}" already has a completed result.`,
    )
  }

  const home = season.programStates[game.homeProgramId]
  const away = season.programStates[game.awayProgramId]

  if (!home || !away) {
    const missingProgramId = home
      ? game.awayProgramId
      : game.homeProgramId
    throw new RangeError(
      `ScheduledGame "${scheduledGameId}" references missing Season Program "${missingProgramId}".`,
    )
  }

  const result = simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: deriveGameSeed(season, scheduledGameId, simulationSeed),
  })

  return recordGameResult(season, scheduledGameId, result)
}

/** Simulates only eligible pending games; completed and excluded games are kept. */
export function simulatePendingGamesInRound({
  season,
  round,
  simulationSeed,
  excludedProgramIds = [],
}: SimulatePendingGamesInRoundOptions): SeasonState {
  const games = getGamesForRound(season, round)

  if (!Number.isSafeInteger(round) || games.length === 0) {
    throw new RangeError(`Unknown Schedule round "${round}".`)
  }

  const excluded = new Set(excludedProgramIds)

  return games.reduce((current, game) => {
    if (
      current.resultsByGameId[game.id] !== undefined ||
      excluded.has(game.homeProgramId) ||
      excluded.has(game.awayProgramId)
    ) {
      return current
    }

    return simulateScheduledGame({
      season: current,
      scheduledGameId: game.id,
      simulationSeed,
    })
  }, season)
}

/** No-ops after regular-season completion because no current round remains. */
export function simulatePendingGamesInCurrentRound({
  season,
  simulationSeed,
  excludedProgramIds,
}: SimulatePendingGamesInCurrentRoundOptions): SeasonState {
  const round = getCurrentRound(season)

  if (round === undefined) {
    return season
  }

  return simulatePendingGamesInRound({
    season,
    round,
    simulationSeed,
    excludedProgramIds,
  })
}

/**
 * Super Sim's sole basketball primitive: a bulk-progression convenience over
 * the same per-game pipeline `simulatePendingGamesInRound` already uses, with
 * no Program exclusions. Advances round by round — using each round's
 * genuinely current pending games, so out-of-order or partially completed
 * rounds behave identically to hand-played progression — until either no
 * round remains pending or the next pending round is beyond `throughRound`.
 *
 * A no-op when the Season has already progressed past `throughRound`: this
 * never simulates backward or touches already-recorded results.
 */
export function simulatePendingGamesThroughRound({
  season,
  throughRound,
  simulationSeed,
}: SimulatePendingGamesThroughRoundOptions): SeasonState {
  if (
    !Number.isSafeInteger(throughRound) ||
    throughRound < 1 ||
    throughRound > season.schedule.roundCount
  ) {
    throw new RangeError(`Unknown Schedule round "${throughRound}".`)
  }

  let current = season
  let round = getCurrentRound(current)

  while (round !== undefined && round <= throughRound) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed,
    })
    round = getCurrentRound(current)
  }

  return current
}
