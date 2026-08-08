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
  deriveProgramRecord,
  getCompletedGamesForProgram,
  getCompletedGamesForRound,
  getCurrentRound,
  getGamesForRound,
  getNextGameForProgram,
  getPendingGamesForProgram,
  getPendingGamesForRound,
  getScheduleForProgram,
  initializeSeason,
  isRegularSeasonComplete,
  isRoundComplete,
  recordGameResult,
  updateProgramRotation,
  validateSeasonState,
  type SeasonState,
} from './index'

function createInputs() {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'season-state-universe',
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'season-state-schedule',
  })

  return { initializedUniverse, schedule }
}

function createSeason(): SeasonState {
  const { initializedUniverse, schedule } = createInputs()

  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
}

function simulateScheduledGame(
  season: SeasonState,
  game: ScheduledGame,
): GameResult {
  const home = season.programStates[game.homeProgramId]
  const away = season.programStates[game.awayProgramId]

  if (!home || !away) {
    throw new Error('Test Schedule references missing Season Program state.')
  }

  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: `season-state-game:${game.id}`,
  })
}

function recordGames(
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

function createAlternativeRotation(season: SeasonState, programId: string) {
  const programState = season.programStates[programId]

  if (!programState) {
    throw new Error(`Missing test Program "${programId}".`)
  }

  const rotation: Rotation = {
    minutes: { ...programState.rotation.minutes },
  }

  for (const player of programState.team.roster) {
    const teammate = programState.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutes[candidate.id] ?? 0) < 40,
    )
    const playerMinutes = rotation.minutes[player.id] ?? 0

    if (teammate && playerMinutes > 0) {
      rotation.minutes[player.id] = playerMinutes - 1
      rotation.minutes[teammate.id] =
        (rotation.minutes[teammate.id] ?? 0) + 1

      if (validateRotation(programState.team, rotation).valid) {
        return rotation
      }

      rotation.minutes[player.id] = playerMinutes
      rotation.minutes[teammate.id] =
        (rotation.minutes[teammate.id] ?? 0) - 1
    }
  }

  throw new Error('Could not create a different legal test Rotation.')
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Season State initialization', () => {
  it('initializes every Program with legal current state and zero results', () => {
    const { initializedUniverse, schedule } = createInputs()
    const inputsBefore = JSON.parse(
      JSON.stringify({ initializedUniverse, schedule }),
    )
    const season = initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse,
      schedule,
      seasonNumber: 1,
    })

    expect(season.id).toBe('season:fictional-us-v0:v0:number-1')
    expect(season.seasonNumber).toBe(1)
    expect(Object.keys(season.programStates)).toHaveLength(32)
    expect(season.resultsByGameId).toEqual({})
    expect(season.schedule).toBe(schedule)
    expect(season.schedule.games).toHaveLength(384)
    expect(getCurrentRound(season)).toBe(1)
    expect(isRegularSeasonComplete(season)).toBe(false)

    for (const { id } of UNIVERSE_V0.programs) {
      const state = season.programStates[id]
      expect(state).toBeDefined()
      expect(state?.team.id).toBe(id)
      expect(validateRotation(state!.team, state!.rotation).valid).toBe(true)
    }

    expect(validateSeasonState(UNIVERSE_V0, season)).toEqual({
      valid: true,
      issues: [],
    })
    expect({ initializedUniverse, schedule }).toEqual(inputsBefore)
  })

  it('rejects invalid Season numbers and mismatched initialization inputs', () => {
    const { initializedUniverse, schedule } = createInputs()

    expect(() =>
      initializeSeason({
        universe: UNIVERSE_V0,
        initializedUniverse,
        schedule,
        seasonNumber: 0,
      }),
    ).toThrow(/positive safe integer/)

    expect(() =>
      initializeSeason({
        universe: { ...UNIVERSE_V0, id: 'different-universe' },
        initializedUniverse,
        schedule,
        seasonNumber: 1,
      }),
    ).toThrow(/does not match/)
  })
})

describe('completed GameResult facts', () => {
  it('records a complete result without mutating Season or result inputs', () => {
    const season = createSeason()
    const game = season.schedule.games[0] as ScheduledGame
    const result = simulateScheduledGame(season, game)
    const seasonBefore = JSON.parse(JSON.stringify(season)) as SeasonState
    const resultBefore = JSON.parse(JSON.stringify(result)) as GameResult
    const next = recordGameResult(season, game.id, result)

    expect(season).toEqual(seasonBefore)
    expect(result).toEqual(resultBefore)
    expect(next.resultsByGameId[game.id]).toEqual(result)
    expect(next.resultsByGameId[game.id]).not.toBe(result)
    expect(next.resultsByGameId[game.id]?.homePlayerStats).toEqual(
      result.homePlayerStats,
    )
    expect(next.resultsByGameId[game.id]?.awayPlayerStats).toEqual(
      result.awayPlayerStats,
    )
    expect(next.schedule).toBe(season.schedule)
  })

  it('rejects unknown, duplicate, mismatched, reversed, and invalid results', () => {
    const season = createSeason()
    const game = season.schedule.games[0] as ScheduledGame
    const result = simulateScheduledGame(season, game)
    const completed = recordGameResult(season, game.id, result)

    expect(() => recordGameResult(season, 'unknown-game', result)).toThrow(
      /Unknown ScheduledGame/,
    )
    expect(() => recordGameResult(completed, game.id, result)).toThrow(
      /already has/,
    )
    expect(() =>
      recordGameResult(season, game.id, {
        ...result,
        awayTeamId: 'another-program',
      }),
    ).toThrow(/do not match scheduled orientation/)
    expect(() =>
      recordGameResult(season, game.id, {
        ...result,
        homeTeamId: result.awayTeamId,
        awayTeamId: result.homeTeamId,
      }),
    ).toThrow(/do not match scheduled orientation/)
    expect(() =>
      recordGameResult(season, game.id, {
        ...result,
        winnerId:
          result.winnerId === result.homeTeamId
            ? result.awayTeamId
            : result.homeTeamId,
      }),
    ).toThrow(/winner/)
  })

  it('canonicalizes result storage independently of recording order', () => {
    const season = createSeason()
    const [first, second] = season.schedule.games as [
      ScheduledGame,
      ScheduledGame,
      ...ScheduledGame[],
    ]
    const firstResult = simulateScheduledGame(season, first)
    const secondResult = simulateScheduledGame(season, second)
    const forward = recordGameResult(
      recordGameResult(season, first.id, firstResult),
      second.id,
      secondResult,
    )
    const reverse = recordGameResult(
      recordGameResult(season, second.id, secondResult),
      first.id,
      firstResult,
    )

    expect(reverse.resultsByGameId).toEqual(forward.resultsByGameId)
    expect(deriveProgramRecord(reverse, first.homeProgramId)).toEqual(
      deriveProgramRecord(forward, first.homeProgramId),
    )
  })
})

describe('round and completion derivation', () => {
  it('supports partial rounds and advances only after the final game', () => {
    const season = createSeason()
    const roundOne = getGamesForRound(season, 1)
    const partial = recordGames(season, roundOne.slice(0, 7))

    expect(roundOne).toHaveLength(16)
    expect(getCompletedGamesForRound(partial, 1)).toHaveLength(7)
    expect(getPendingGamesForRound(partial, 1)).toHaveLength(9)
    expect(isRoundComplete(partial, 1)).toBe(false)
    expect(getCurrentRound(partial)).toBe(1)

    const completedRound = recordGames(partial, roundOne.slice(7).reverse())

    expect(getCompletedGamesForRound(completedRound, 1)).toHaveLength(16)
    expect(getPendingGamesForRound(completedRound, 1)).toEqual([])
    expect(isRoundComplete(completedRound, 1)).toBe(true)
    expect(getCurrentRound(completedRound)).toBe(2)
    expect(isRegularSeasonComplete(completedRound)).toBe(false)
  })

  it('derives current round from the earliest pending fact despite later results', () => {
    const season = createSeason()
    const roundThreeGame = getGamesForRound(season, 3)[0] as ScheduledGame
    const outOfOrder = recordGameResult(
      season,
      roundThreeGame.id,
      simulateScheduledGame(season, roundThreeGame),
    )

    expect(getCurrentRound(outOfOrder)).toBe(1)
    expect(getCompletedGamesForRound(outOfOrder, 3)).toHaveLength(1)
  })

  it('derives completion only when every ScheduledGame has a result', () => {
    const season = createSeason()
    const allButLast = recordGames(season, season.schedule.games.slice(0, -1))

    expect(isRegularSeasonComplete(allButLast)).toBe(false)
    expect(getCurrentRound(allButLast)).toBe(24)

    const finalGame = season.schedule.games.at(-1) as ScheduledGame
    const complete = recordGameResult(
      allButLast,
      finalGame.id,
      simulateScheduledGame(allButLast, finalGame),
    )

    expect(isRegularSeasonComplete(complete)).toBe(true)
    expect(getCurrentRound(complete)).toBeUndefined()
  })
})

describe('Program queries and derived records', () => {
  it('returns canonical Program schedule, pending, completed, and next games', () => {
    const season = createSeason()
    const programId = 'great-lakes'
    const schedule = getScheduleForProgram(season, programId)
    const firstGame = schedule[0] as ScheduledGame
    const afterFirst = recordGameResult(
      season,
      firstGame.id,
      simulateScheduledGame(season, firstGame),
    )

    expect(schedule).toHaveLength(24)
    expect(getPendingGamesForProgram(season, programId)).toHaveLength(24)
    expect(getCompletedGamesForProgram(season, programId)).toEqual([])
    expect(getNextGameForProgram(season, programId)).toEqual(firstGame)
    expect(getCompletedGamesForProgram(afterFirst, programId)).toHaveLength(1)
    expect(getPendingGamesForProgram(afterFirst, programId)).toHaveLength(23)
    expect(getNextGameForProgram(afterFirst, programId)).toEqual(schedule[1])

    const completedProgramSchedule = recordGames(
      season,
      [...schedule].reverse(),
    )
    expect(
      getNextGameForProgram(completedProgramSchedule, programId),
    ).toBeUndefined()
  })

  it('derives overall and Conference records only from completed results', () => {
    const season = createSeason()
    const programId = 'great-lakes'
    const schedule = getScheduleForProgram(season, programId)
    const conferenceGame = schedule.find(
      ({ type }) => type === 'conference',
    ) as ScheduledGame
    const nonConferenceGame = schedule.find(
      ({ type }) => type === 'nonconference',
    ) as ScheduledGame
    const withResults = recordGames(season, [
      nonConferenceGame,
      conferenceGame,
    ])
    const completed = getCompletedGamesForProgram(withResults, programId)
    const expectedWins = completed.filter(
      ({ result }) => result.winnerId === programId,
    ).length
    const conferenceResult = withResults.resultsByGameId[conferenceGame.id]

    expect(deriveProgramRecord(season, programId)).toEqual({
      wins: 0,
      losses: 0,
    })
    expect(deriveProgramRecord(withResults, programId)).toEqual({
      wins: expectedWins,
      losses: 2 - expectedWins,
    })
    expect(deriveConferenceRecord(withResults, programId)).toEqual({
      wins: conferenceResult?.winnerId === programId ? 1 : 0,
      losses: conferenceResult?.winnerId === programId ? 0 : 1,
    })
  })
})

describe('persistent Rotation updates and purity', () => {
  it('updates one legal Rotation while preserving Teams and unrelated state', () => {
    const season = createSeason()
    const programId = 'charlotte-tech'
    const unrelatedId = 'capital-state'
    const rotation = createAlternativeRotation(season, programId)
    const teamBefore = JSON.parse(
      JSON.stringify(season.programStates[programId]?.team),
    )
    const next = updateProgramRotation(season, programId, rotation)

    expect(next).not.toBe(season)
    expect(next.programStates[programId]?.rotation).toEqual(rotation)
    expect(next.programStates[programId]?.rotation).not.toBe(rotation)
    expect(next.programStates[programId]?.team).toBe(
      season.programStates[programId]?.team,
    )
    expect(next.programStates[programId]?.team).toEqual(teamBefore)
    expect(next.programStates[unrelatedId]).toBe(
      season.programStates[unrelatedId],
    )
    expect(next.schedule).toBe(season.schedule)
    expect(season.programStates[programId]?.rotation).not.toEqual(rotation)
  })

  it('rejects unknown Programs and invalid Rotations', () => {
    const season = createSeason()

    expect(() =>
      updateProgramRotation(season, 'unknown-program', { minutes: {} }),
    ).toThrow(/Unknown Season Program/)
    expect(() =>
      updateProgramRotation(season, 'charlotte-tech', { minutes: {} }),
    ).toThrow(/invalid Rotation/)
  })

  it('round-trips through JSON and uses no ambient Math.random path', () => {
    const { initializedUniverse, schedule } = createInputs()
    const resultSource = createSeason()
    const game = resultSource.schedule.games[0] as ScheduledGame
    const result = simulateScheduledGame(resultSource, game)

    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    const season = initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse,
      schedule,
      seasonNumber: 1,
    })
    const withResult = recordGameResult(season, game.id, result)
    const withRotation = updateProgramRotation(
      withResult,
      'charlotte-tech',
      createAlternativeRotation(withResult, 'charlotte-tech'),
    )

    expect(JSON.parse(JSON.stringify(withRotation))).toEqual(withRotation)
    expect(() => getCurrentRound(withRotation)).not.toThrow()
    expect(() => deriveProgramRecord(withRotation, 'great-lakes')).not.toThrow()
  })
})
