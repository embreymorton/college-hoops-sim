import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  simulateGame,
  validateRotation,
  type GameResult,
  type Rotation,
} from '../engine'
import {
  generateRegularSeasonSchedule,
  type ScheduledGame,
} from '../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  getCompletedGamesForProgram,
  getCompletedGamesForRound,
  getCurrentRound,
  getGamesForRound,
  getPendingGamesForRound,
  initializeSeason,
  isRegularSeasonComplete,
  recordGameResult,
  simulatePendingGamesInCurrentRound,
  simulatePendingGamesInRound,
  simulateScheduledGame,
  updateProgramRotation,
  validateSeasonState,
  type SeasonState,
} from './index'

const SIMULATION_SEED = 'season-simulation-test-v0'

function createSeason(): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'ai-season-universe-test',
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'ai-season-schedule-test',
  })

  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
}

function resultFor(season: SeasonState, game: ScheduledGame): GameResult {
  const home = season.programStates[game.homeProgramId]!
  const away = season.programStates[game.awayProgramId]!

  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: `precompleted:${game.id}`,
  })
}

function alternativeRotation(
  season: SeasonState,
  programId: string,
): Rotation {
  const state = season.programStates[programId]!
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
    rotation.minutes[teammate.id] =
      (rotation.minutes[teammate.id] ?? 0) + 1

    if (validateRotation(state.team, rotation).valid) {
      return rotation
    }

    rotation.minutes[player.id] = minutes
    rotation.minutes[teammate.id] =
      (rotation.minutes[teammate.id] ?? 0) - 1
  }

  throw new Error(`Could not alter Rotation for ${programId}.`)
}

function simulateFullSeason(
  season: SeasonState,
  simulationSeed: string | number = SIMULATION_SEED,
): SeasonState {
  let current = season

  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed,
    })
  }

  return current
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('simulateScheduledGame', () => {
  it('uses current Teams and Rotations and records the full result purely', () => {
    const original = createSeason()
    const game = original.schedule.games[0]!
    const homeRotation = alternativeRotation(original, game.homeProgramId)
    const homeUpdated = updateProgramRotation(
      original,
      game.homeProgramId,
      homeRotation,
    )
    const awayRotation = alternativeRotation(homeUpdated, game.awayProgramId)
    const season = updateProgramRotation(
      homeUpdated,
      game.awayProgramId,
      awayRotation,
    )
    const before = JSON.parse(JSON.stringify(season)) as SeasonState
    const next = simulateScheduledGame({
      season,
      scheduledGameId: game.id,
      simulationSeed: SIMULATION_SEED,
    })
    const result = next.resultsByGameId[game.id]!
    const home = season.programStates[game.homeProgramId]!
    const away = season.programStates[game.awayProgramId]!
    const expected = simulateGame({
      homeTeam: home.team,
      awayTeam: away.team,
      homeRotation: home.rotation,
      awayRotation: away.rotation,
      seed: result.seed,
    })
    const defaultResult = simulateScheduledGame({
      season: original,
      scheduledGameId: game.id,
      simulationSeed: SIMULATION_SEED,
    }).resultsByGameId[game.id]

    expect(result).toEqual(expected)
    expect(result.homePlayerStats).toHaveLength(home.team.roster.length)
    expect(result.awayPlayerStats).toHaveLength(away.team.roster.length)
    expect(result).not.toEqual(defaultResult)
    expect(season).toEqual(before)
    expect(original.resultsByGameId).toEqual({})
    expect(next.schedule).toBe(season.schedule)
  })

  it('rejects unknown and already-completed ScheduledGames', () => {
    const season = createSeason()
    const game = season.schedule.games[0]!
    const completed = simulateScheduledGame({
      season,
      scheduledGameId: game.id,
      simulationSeed: SIMULATION_SEED,
    })

    expect(() =>
      simulateScheduledGame({
        season,
        scheduledGameId: 'unknown-game',
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/Unknown ScheduledGame/)
    expect(() =>
      simulateScheduledGame({
        season: completed,
        scheduledGameId: game.id,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/already has a completed result/)
  })

  it('is deterministic, seed-sensitive, and preserves seed-type identity', () => {
    const season = createSeason()
    const game = season.schedule.games[0]!
    const simulate = (simulationSeed: string | number) =>
      simulateScheduledGame({
        season,
        scheduledGameId: game.id,
        simulationSeed,
      }).resultsByGameId[game.id]!
    const first = simulate('repeatable')
    const second = simulate('repeatable')
    const different = simulate('different')
    const numeric = simulate(1)
    const string = simulate('1')

    expect(second).toEqual(first)
    const { seed: firstSeed, ...firstOutcome } = first
    const { seed: differentSeed, ...differentOutcome } = different
    expect(firstSeed).not.toBe(differentSeed)
    expect(differentOutcome).not.toEqual(firstOutcome)
    expect(numeric.seed).not.toBe(string.seed)
    expect(numeric).not.toEqual(string)
    expect(() => simulate(Number.NaN)).toThrow(/finite number or a string/)
  })

  it('makes individual outcomes independent of execution order', () => {
    const season = createSeason()
    const games = season.schedule.games.slice(0, 3)
    const execute = (orderedGames: readonly ScheduledGame[]) =>
      orderedGames.reduce(
        (current, game) =>
          simulateScheduledGame({
            season: current,
            scheduledGameId: game.id,
            simulationSeed: SIMULATION_SEED,
          }),
        season,
      )
    const forward = execute(games)
    const reverse = execute([...games].reverse())

    for (const game of games) {
      expect(reverse.resultsByGameId[game.id]).toEqual(
        forward.resultsByGameId[game.id],
      )
    }
  })
})

describe('pending round simulation', () => {
  it('preserves completed games and skips games for multiple exclusions', () => {
    const season = createSeason()
    const round = getGamesForRound(season, 1)
    const completedGame = round[0]!
    const completedResult = resultFor(season, completedGame)
    const partial = recordGameResult(
      season,
      completedGame.id,
      completedResult,
    )
    const storedCompletedResult = partial.resultsByGameId[completedGame.id]
    const excludedGames = [round[1]!, round[2]!]
    const excludedProgramIds = excludedGames.map(
      ({ homeProgramId }) => homeProgramId,
    )
    const next = simulatePendingGamesInRound({
      season: partial,
      round: 1,
      simulationSeed: SIMULATION_SEED,
      excludedProgramIds,
    })

    expect(next.resultsByGameId[completedGame.id]).toBe(storedCompletedResult)
    expect(getCompletedGamesForRound(next, 1)).toHaveLength(14)
    expect(getPendingGamesForRound(next, 1).map(({ id }) => id).sort()).toEqual(
      excludedGames.map(({ id }) => id).sort(),
    )
    expect(getCurrentRound(next)).toBe(1)

    const completedRound = excludedGames.reduce(
      (current, game) =>
        simulateScheduledGame({
          season: current,
          scheduledGameId: game.id,
          simulationSeed: SIMULATION_SEED,
        }),
      next,
    )

    expect(getCompletedGamesForRound(completedRound, 1)).toHaveLength(16)
    expect(getCurrentRound(completedRound)).toBe(2)
  })

  it('rejects unknown rounds and current-round simulation derives progress', () => {
    const season = createSeason()
    const roundOneComplete = simulatePendingGamesInCurrentRound({
      season,
      simulationSeed: SIMULATION_SEED,
    })

    expect(getCurrentRound(roundOneComplete)).toBe(2)
    expect(() =>
      simulatePendingGamesInRound({
        season,
        round: 0,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/Unknown Schedule round/)
  })
})

describe('full regular-season execution', () => {
  it('completes all Universe V0 games through production APIs', () => {
    const season = createSeason()

    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    const complete = simulateFullSeason(season)

    expect(Object.keys(complete.resultsByGameId)).toHaveLength(384)
    expect(isRegularSeasonComplete(complete)).toBe(true)
    expect(getCurrentRound(complete)).toBeUndefined()
    expect(validateSeasonState(UNIVERSE_V0, complete)).toEqual({
      valid: true,
      issues: [],
    })
    expect(JSON.parse(JSON.stringify(complete))).toEqual(complete)

    for (const program of UNIVERSE_V0.programs) {
      expect(getCompletedGamesForProgram(complete, program.id)).toHaveLength(24)
    }

    for (const conference of UNIVERSE_V0.conferences) {
      const rows = deriveConferenceStandings(
        UNIVERSE_V0,
        complete,
        conference.id,
      )
      const expectedProgramIds = UNIVERSE_V0.programs
        .filter(({ conferenceId }) => conferenceId === conference.id)
        .map(({ id }) => id)

      expect(rows).toHaveLength(8)
      expect(rows.map(({ programId }) => programId).sort()).toEqual(
        expectedProgramIds.sort(),
      )
      for (const row of rows) {
        expect({ wins: row.wins, losses: row.losses }).toEqual(
          deriveProgramRecord(complete, row.programId),
        )
        expect({
          wins: row.conferenceWins,
          losses: row.conferenceLosses,
        }).toEqual(deriveConferenceRecord(complete, row.programId))
      }
    }

    expect(
      simulatePendingGamesInCurrentRound({
        season: complete,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toBe(complete)
    expect(season.resultsByGameId).toEqual({})
  })
})
