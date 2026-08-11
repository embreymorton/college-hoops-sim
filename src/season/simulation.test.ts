import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  simulateGame,
  cloneRotationV1,
  validateRotationV1,
  type GameResult,
  type RotationV1,
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
  simulatePendingGamesThroughRound,
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
): RotationV1 {
  const state = season.programStates[programId]!
  const rotation = cloneRotationV1(state.rotation)

  for (const player of state.team.roster) {
    const teammate = state.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutesByPosition[player.position][candidate.id] ?? 0) < 40,
    )
    const assignments = rotation.minutesByPosition[player.position]
    const minutes = assignments[player.id] ?? 0

    if (!teammate || minutes < 1) {
      continue
    }

    assignments[player.id] = minutes - 1
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) + 1

    if (validateRotationV1(state.team, rotation).valid) {
      return rotation
    }

    assignments[player.id] = minutes
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) - 1
  }

  throw new Error(`Could not alter Rotation for ${programId}.`)
}

function simulateFullSeason(
  season: SeasonState,
  simulationSeed: string | number = SIMULATION_SEED,
  throughRound: number = season.schedule.roundCount,
): SeasonState {
  let current = season

  for (let round = 1; round <= throughRound; round += 1) {
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

describe('simulatePendingGamesThroughRound (Super Sim)', () => {
  it('completes every pending game through the target round and leaves later rounds untouched', () => {
    const season = createSeason()

    const midseason = simulatePendingGamesThroughRound({
      season,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })

    for (let round = 1; round <= 12; round += 1) {
      expect(getPendingGamesForRound(midseason, round)).toHaveLength(0)
      expect(getCompletedGamesForRound(midseason, round)).toHaveLength(16)
    }
    for (let round = 13; round <= 24; round += 1) {
      expect(getCompletedGamesForRound(midseason, round)).toHaveLength(0)
    }
    expect(getCurrentRound(midseason)).toBe(13)
    expect(season.resultsByGameId).toEqual({})
  })

  it('completes the entire regular season through Round 24', () => {
    const season = createSeason()

    const complete = simulatePendingGamesThroughRound({
      season,
      throughRound: 24,
      simulationSeed: SIMULATION_SEED,
    })

    expect(Object.keys(complete.resultsByGameId)).toHaveLength(384)
    expect(isRegularSeasonComplete(complete)).toBe(true)
    expect(getCurrentRound(complete)).toBeUndefined()
  })

  it('rejects an out-of-range target round', () => {
    const season = createSeason()

    expect(() =>
      simulatePendingGamesThroughRound({
        season,
        throughRound: 0,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/Unknown Schedule round/)
    expect(() =>
      simulatePendingGamesThroughRound({
        season,
        throughRound: 25,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/Unknown Schedule round/)
  })

  it('never simulates backward once the Season has already progressed past the target round', () => {
    const season = createSeason()
    const throughRound13 = simulateFullSeason(season, SIMULATION_SEED, 13)

    const stillAtRound13 = simulatePendingGamesThroughRound({
      season: throughRound13,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })

    expect(stillAtRound13).toBe(throughRound13)
    expect(getCurrentRound(stillAtRound13)).toBe(14)
  })

  it('preserves already-completed results exactly and only simulates what is still pending, including mixed-source partial rounds', () => {
    const season = createSeason()
    const round1 = getGamesForRound(season, 1)
    // A mix of "already completed" games standing in for results that could
    // have come from Quick Sim, Game Prep, or AI rest-of-round simulation —
    // Super Sim must not care how a result was produced.
    const alreadyCompleted = round1.slice(0, 6)
    const partial = alreadyCompleted.reduce(
      (current, game) =>
        recordGameResult(current, game.id, resultFor(current, game)),
      season,
    )
    const preservedResults = alreadyCompleted.map(
      (game) => partial.resultsByGameId[game.id]!,
    )

    const midseason = simulatePendingGamesThroughRound({
      season: partial,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })

    alreadyCompleted.forEach((game, index) => {
      expect(midseason.resultsByGameId[game.id]).toBe(preservedResults[index])
    })
    expect(getCompletedGamesForRound(midseason, 1)).toHaveLength(16)
    expect(getCurrentRound(midseason)).toBe(13)
  })

  it('does not mutate the input Season', () => {
    const season = createSeason()
    const before = JSON.parse(JSON.stringify(season)) as SeasonState

    simulatePendingGamesThroughRound({
      season,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })

    expect(season).toEqual(before)
  })

  it("uses each Program's current Season Rotation, including a custom controlled-Program Rotation, throughout the bulk simulation", () => {
    const season = createSeason()
    const game = season.schedule.games[0]!
    const customRotation = alternativeRotation(season, game.homeProgramId)
    const withCustomRotation = updateProgramRotation(
      season,
      game.homeProgramId,
      customRotation,
    )

    const midseason = simulatePendingGamesThroughRound({
      season: withCustomRotation,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })

    // The Rotation is never regenerated or altered by Super Sim itself.
    expect(midseason.programStates[game.homeProgramId]!.rotation).toEqual(
      customRotation,
    )

    const expected = simulateFullSeason(withCustomRotation, SIMULATION_SEED, 12)
    expect(midseason.resultsByGameId).toEqual(expected.resultsByGameId)
  })

  it('produces full PlayerGameStats for every simulated game, still available for historical box scores', () => {
    const season = createSeason()

    const midseason = simulatePendingGamesThroughRound({
      season,
      throughRound: 12,
      simulationSeed: SIMULATION_SEED,
    })
    const game = getGamesForRound(midseason, 5)[0]!
    const result = midseason.resultsByGameId[game.id]!
    const homeTeam = midseason.programStates[game.homeProgramId]!.team
    const awayTeam = midseason.programStates[game.awayProgramId]!.team

    expect(result.homePlayerStats).toHaveLength(homeTeam.roster.length)
    expect(result.awayPlayerStats).toHaveLength(awayTeam.roster.length)
    for (const row of [...result.homePlayerStats, ...result.awayPlayerStats]) {
      expect(row).toMatchObject({
        playerId: expect.any(String),
        minutes: expect.any(Number),
        points: expect.any(Number),
        rebounds: expect.any(Number),
        assists: expect.any(Number),
        steals: expect.any(Number),
        blocks: expect.any(Number),
        turnovers: expect.any(Number),
        fieldGoalsMade: expect.any(Number),
        fieldGoalsAttempted: expect.any(Number),
        threePointersMade: expect.any(Number),
        threePointersAttempted: expect.any(Number),
        freeThrowsMade: expect.any(Number),
        freeThrowsAttempted: expect.any(Number),
      })
    }
  })

  describe('deterministic equivalence with normal progression', () => {
    it('is deterministic for repeated calls with the same inputs', () => {
      const season = createSeason()

      const first = simulatePendingGamesThroughRound({
        season,
        throughRound: 12,
        simulationSeed: SIMULATION_SEED,
      })
      const second = simulatePendingGamesThroughRound({
        season,
        throughRound: 12,
        simulationSeed: SIMULATION_SEED,
      })

      expect(second.resultsByGameId).toEqual(first.resultsByGameId)
    })

    it('produces identical GameResults to normal round-by-round progression through Round 12', () => {
      const season = createSeason()

      vi.spyOn(Math, 'random').mockImplementation(() => {
        throw new Error('Math.random must not be called')
      })

      const normal = simulateFullSeason(season, SIMULATION_SEED, 12)
      const superSim = simulatePendingGamesThroughRound({
        season,
        throughRound: 12,
        simulationSeed: SIMULATION_SEED,
      })

      expect(Object.keys(superSim.resultsByGameId).sort()).toEqual(
        Object.keys(normal.resultsByGameId).sort(),
      )
      for (const [gameId, result] of Object.entries(normal.resultsByGameId)) {
        expect(superSim.resultsByGameId[gameId]).toEqual(result)
      }
    })

    it('produces identical GameResults to normal round-by-round progression through Round 24', () => {
      const season = createSeason()

      const normal = simulateFullSeason(season, SIMULATION_SEED, 24)
      const superSim = simulatePendingGamesThroughRound({
        season,
        throughRound: 24,
        simulationSeed: SIMULATION_SEED,
      })

      expect(Object.keys(superSim.resultsByGameId).sort()).toEqual(
        Object.keys(normal.resultsByGameId).sort(),
      )
      for (const [gameId, result] of Object.entries(normal.resultsByGameId)) {
        expect(superSim.resultsByGameId[gameId]).toEqual(result)
      }
    })

    it('changes results under a different simulation seed', () => {
      const season = createSeason()

      const first = simulatePendingGamesThroughRound({
        season,
        throughRound: 12,
        simulationSeed: SIMULATION_SEED,
      })
      const second = simulatePendingGamesThroughRound({
        season,
        throughRound: 12,
        simulationSeed: 'a-different-super-sim-seed',
      })

      expect(second.resultsByGameId).not.toEqual(first.resultsByGameId)
    })
  })
})
