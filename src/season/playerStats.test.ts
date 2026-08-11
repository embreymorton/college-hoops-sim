import { afterEach, describe, expect, it, vi } from 'vitest'
import type { GameResult, Player, PlayerGameStats, Team } from '../engine'
import {
  generateRegularSeasonSchedule,
  type RegularSeasonSchedule,
  type ScheduledGame,
} from '../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  derivePlayerSeasonStats,
  deriveProgramPlayerSeasonStats,
  deriveSeasonPlayerStats,
  getCompletedGamesForProgram,
  getPlayerGameLog,
  initializeSeason,
  simulatePendingGamesInRound,
  simulatePendingGamesThroughRound,
  type PlayerSeasonStats,
  type SeasonState,
} from './index'

const PROGRAM_ID = 'alpha'
const OPPONENT_ID = 'beta'
const PLAYER_ID = 'alpha-1'
const DNP_PLAYER_ID = 'alpha-2'

function player(id: string): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position: 'PG',
    classYear: 'SO',
    height: 74,
    attributes: {
      finishing: 70,
      shooting: 70,
      playmaking: 70,
      ballHandling: 70,
      perimeterDefense: 70,
      interiorDefense: 70,
      rebounding: 70,
      athleticism: 70,
      stamina: 70,
    },
    potential: 80,
  }
}

function team(id: string, playerIds: readonly string[]): Team {
  return {
    id,
    name: `${id} University`,
    abbreviation: id.toUpperCase(),
    prestige: 50,
    roster: playerIds.map(player),
  }
}

function stats(
  playerId: string,
  values: Partial<Omit<PlayerGameStats, 'playerId'>> = {},
): PlayerGameStats {
  return {
    playerId,
    minutes: 0,
    points: 0,
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
    ...values,
  }
}

const GAME_ONE: ScheduledGame = {
  id: 'game-1',
  index: 0,
  round: 1,
  homeProgramId: PROGRAM_ID,
  awayProgramId: OPPONENT_ID,
  type: 'nonconference',
}

const GAME_TWO: ScheduledGame = {
  id: 'game-2',
  index: 1,
  round: 2,
  homeProgramId: OPPONENT_ID,
  awayProgramId: PROGRAM_ID,
  type: 'nonconference',
}

const PENDING_GAME: ScheduledGame = {
  id: 'game-3',
  index: 2,
  round: 3,
  homeProgramId: PROGRAM_ID,
  awayProgramId: OPPONENT_ID,
  type: 'nonconference',
}

const GAME_ONE_ALPHA_STATS = [
  stats(PLAYER_ID, {
    minutes: 30,
    points: 10,
    rebounds: 4,
    assists: 3,
    steals: 1,
    turnovers: 2,
    fieldGoalsMade: 1,
    fieldGoalsAttempted: 2,
    freeThrowsMade: 8,
    freeThrowsAttempted: 8,
  }),
  stats(DNP_PLAYER_ID),
  stats('alpha-3', {
    minutes: 10,
    points: 40,
    rebounds: 2,
    fieldGoalsMade: 15,
    fieldGoalsAttempted: 20,
    threePointersMade: 5,
    threePointersAttempted: 7,
    freeThrowsMade: 5,
    freeThrowsAttempted: 6,
  }),
]

const GAME_TWO_ALPHA_STATS = [
  stats(PLAYER_ID, {
    minutes: 20,
    points: 20,
    rebounds: 6,
    assists: 5,
    steals: 2,
    blocks: 1,
    turnovers: 1,
    fieldGoalsMade: 8,
    fieldGoalsAttempted: 18,
    threePointersMade: 2,
    threePointersAttempted: 5,
    freeThrowsMade: 2,
    freeThrowsAttempted: 4,
  }),
  stats(DNP_PLAYER_ID, {
    minutes: 20,
    points: 35,
    rebounds: 8,
    assists: 2,
    fieldGoalsMade: 12,
    fieldGoalsAttempted: 20,
    threePointersMade: 3,
    threePointersAttempted: 8,
    freeThrowsMade: 8,
    freeThrowsAttempted: 10,
  }),
  stats('alpha-3'),
]

function result(
  game: ScheduledGame,
  homeScore: number,
  awayScore: number,
  alphaStats: PlayerGameStats[],
): GameResult {
  const alphaIsHome = game.homeProgramId === PROGRAM_ID
  const opponentScore = alphaIsHome ? awayScore : homeScore
  const opponentStats = [stats('beta-1', { minutes: 40, points: opponentScore })]

  return {
    homeTeamId: game.homeProgramId,
    awayTeamId: game.awayProgramId,
    homeScore,
    awayScore,
    winnerId:
      homeScore > awayScore ? game.homeProgramId : game.awayProgramId,
    overtimePeriods: 0,
    seed: `fixture:${game.id}`,
    homePlayerStats: alphaIsHome ? alphaStats : opponentStats,
    awayPlayerStats: alphaIsHome ? opponentStats : alphaStats,
  }
}

const RESULT_ONE = result(GAME_ONE, 50, 40, GAME_ONE_ALPHA_STATS)
const RESULT_TWO = result(GAME_TWO, 60, 55, GAME_TWO_ALPHA_STATS)

function schedule(): RegularSeasonSchedule {
  return {
    version: 'test-v0',
    universeId: 'test-universe',
    universeVersion: 'v0',
    seed: 'test-schedule',
    configuration: {
      conferenceFormat: 'double-round-robin',
      nonConferenceGamesPerProgram: 3,
      targetHomeGamesPerProgram: 2,
      targetAwayGamesPerProgram: 1,
    },
    roundCount: 3,
    // Deliberately not chronological: projections must use round/index facts.
    games: [GAME_TWO, PENDING_GAME, GAME_ONE],
  }
}

function fixtureSeason(
  resultsByGameId: Record<string, GameResult> = {
    [GAME_TWO.id]: RESULT_TWO,
    [GAME_ONE.id]: RESULT_ONE,
  },
): SeasonState {
  return {
    id: 'test-season',
    seasonNumber: 1,
    universeId: 'test-universe',
    universeVersion: 'v0',
    schedule: schedule(),
    programStates: {
      [PROGRAM_ID]: {
        team: team(PROGRAM_ID, [PLAYER_ID, DNP_PLAYER_ID, 'alpha-3']),
        rotation: { minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} } },
      },
      [OPPONENT_ID]: {
        team: team(OPPONENT_ID, ['beta-1']),
        rotation: { minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} } },
      },
    },
    resultsByGameId,
  }
}

function createUniverseSeason(): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'player-stats-test-universe',
  )
  const regularSeasonSchedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'player-stats-test-schedule',
  })

  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: regularSeasonSchedule,
    seasonNumber: 1,
  })
}

function numericValues(row: PlayerSeasonStats): number[] {
  return Object.values(row).filter(
    (value): value is number => typeof value === 'number',
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Player Season Stats projections', () => {
  it('returns an all-zero row for every current roster Player before any games', () => {
    const season = fixtureSeason({})
    const rows = deriveProgramPlayerSeasonStats(season, PROGRAM_ID)

    expect(rows).toHaveLength(3)
    expect(rows.map(({ playerId }) => playerId)).toEqual([
      PLAYER_ID,
      DNP_PLAYER_ID,
      'alpha-3',
    ])

    for (const row of rows) {
      expect(row.programId).toBe(PROGRAM_ID)
      expect(numericValues(row).every((value) => value === 0)).toBe(true)
      expect(numericValues(row).every(Number.isFinite)).toBe(true)
    }
  })

  it('aggregates only completed games in a partial Season', () => {
    const season = fixtureSeason({ [GAME_ONE.id]: RESULT_ONE })

    expect(derivePlayerSeasonStats(season, PROGRAM_ID, PLAYER_ID)).toMatchObject({
      gamesPlayed: 1,
      minutes: 30,
      points: 10,
      rebounds: 4,
      assists: 3,
      fieldGoalsMade: 1,
      fieldGoalsAttempted: 2,
    })
    expect(getPlayerGameLog(season, PROGRAM_ID, PLAYER_ID)).toHaveLength(1)
  })

  it('sums counting and shooting totals exactly and derives unrounded rates', () => {
    const row = derivePlayerSeasonStats(fixtureSeason(), PROGRAM_ID, PLAYER_ID)

    expect(row).toMatchObject({
      gamesPlayed: 2,
      minutes: 50,
      points: 30,
      rebounds: 10,
      assists: 8,
      steals: 3,
      blocks: 1,
      turnovers: 3,
      fieldGoalsMade: 9,
      fieldGoalsAttempted: 20,
      threePointersMade: 2,
      threePointersAttempted: 5,
      freeThrowsMade: 10,
      freeThrowsAttempted: 12,
      minutesPerGame: 25,
      pointsPerGame: 15,
      reboundsPerGame: 5,
      assistsPerGame: 4,
      stealsPerGame: 1.5,
      blocksPerGame: 0.5,
      turnoversPerGame: 1.5,
      fieldGoalPercentage: 9 / 20,
      threePointPercentage: 0.4,
      freeThrowPercentage: 10 / 12,
    })
  })

  it('counts games played only when minutes are positive and returns safe zero rates', () => {
    const dnpThenActive = derivePlayerSeasonStats(
      fixtureSeason(),
      PROGRAM_ID,
      DNP_PLAYER_ID,
    )
    const thirdPlayer = derivePlayerSeasonStats(
      fixtureSeason(),
      PROGRAM_ID,
      'alpha-3',
    )

    expect(dnpThenActive.gamesPlayed).toBe(1)
    expect(dnpThenActive.minutesPerGame).toBe(20)
    expect(dnpThenActive.points).toBe(35)
    expect(dnpThenActive.rebounds).toBe(8)
    expect(thirdPlayer.gamesPlayed).toBe(1)

    const empty = derivePlayerSeasonStats(
      fixtureSeason({}),
      PROGRAM_ID,
      DNP_PLAYER_ID,
    )
    expect(empty.gamesPlayed).toBe(0)
    expect(empty.minutesPerGame).toBe(0)
    expect(empty.pointsPerGame).toBe(0)
    expect(empty.fieldGoalPercentage).toBe(0)
    expect(empty.threePointPercentage).toBe(0)
    expect(empty.freeThrowPercentage).toBe(0)
    expect(numericValues(empty).every(Number.isFinite)).toBe(true)
  })

  it('returns only rostered Players and handles invalid IDs explicitly', () => {
    const season = fixtureSeason()
    const programRows = deriveProgramPlayerSeasonStats(season, PROGRAM_ID)
    const seasonRows = deriveSeasonPlayerStats(season)

    expect(programRows.every(({ programId }) => programId === PROGRAM_ID)).toBe(
      true,
    )
    expect(seasonRows).toHaveLength(4)
    expect(new Set(seasonRows.map(({ playerId }) => playerId)).size).toBe(4)
    expect(() =>
      deriveProgramPlayerSeasonStats(season, 'unknown-program'),
    ).toThrow(/Unknown Season Program/)
    expect(() =>
      derivePlayerSeasonStats(season, PROGRAM_ID, 'unknown-player'),
    ).toThrow(/Unknown Season Player/)
    expect(() =>
      derivePlayerSeasonStats(season, PROGRAM_ID, 'beta-1'),
    ).toThrow(/does not belong/)
  })

  it('projects chronological completed-game logs with location, result, and DNPs', () => {
    const log = getPlayerGameLog(fixtureSeason(), PROGRAM_ID, DNP_PLAYER_ID)

    expect(log.map(({ scheduledGameId }) => scheduledGameId)).toEqual([
      GAME_ONE.id,
      GAME_TWO.id,
    ])
    expect(log[0]).toEqual({
      scheduledGameId: GAME_ONE.id,
      round: 1,
      opponentProgramId: OPPONENT_ID,
      location: 'home',
      teamScore: 50,
      opponentScore: 40,
      result: 'W',
      didPlay: false,
      stats: GAME_ONE_ALPHA_STATS[1],
    })
    expect(log[1]).toEqual({
      scheduledGameId: GAME_TWO.id,
      round: 2,
      opponentProgramId: OPPONENT_ID,
      location: 'away',
      teamScore: 55,
      opponentScore: 60,
      result: 'L',
      didPlay: true,
      stats: GAME_TWO_ALPHA_STATS[1],
    })
    expect(log.some(({ scheduledGameId }) => scheduledGameId === PENDING_GAME.id)).toBe(
      false,
    )
  })

  it('is insertion-order independent, serializable, pure, and randomness-free', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const first = fixtureSeason({
      [GAME_ONE.id]: RESULT_ONE,
      [GAME_TWO.id]: RESULT_TWO,
    })
    const second = fixtureSeason({
      [GAME_TWO.id]: RESULT_TWO,
      [GAME_ONE.id]: RESULT_ONE,
    })
    const before = JSON.parse(JSON.stringify(first)) as SeasonState
    const firstStats = deriveSeasonPlayerStats(first)
    const firstLog = getPlayerGameLog(first, PROGRAM_ID, PLAYER_ID)

    expect(deriveSeasonPlayerStats(second)).toEqual(firstStats)
    expect(getPlayerGameLog(second, PROGRAM_ID, PLAYER_ID)).toEqual(firstLog)
    expect(JSON.parse(JSON.stringify(firstStats))).toEqual(firstStats)
    expect(JSON.parse(JSON.stringify(firstLog))).toEqual(firstLog)
    expect(first).toEqual(before)
  })
})

describe('Player Season Stats integration', () => {
  it(
    'derives every Universe V0 roster Player and reconciles raw box-score totals',
    () => {
      const initial = createUniverseSeason()
      const complete = simulatePendingGamesThroughRound({
        season: initial,
        throughRound: initial.schedule.roundCount,
        simulationSeed: 'player-stats-test-simulation',
      })
      const rows = deriveSeasonPlayerStats(complete)
      const expectedPlayerCount = Object.values(complete.programStates).reduce(
        (total, { team: currentTeam }) => total + currentTeam.roster.length,
        0,
      )

      expect(rows).toHaveLength(expectedPlayerCount)
      expect(new Set(rows.map(({ playerId }) => playerId)).size).toBe(
        expectedPlayerCount,
      )
      expect(rows.flatMap(numericValues).every(Number.isFinite)).toBe(true)

      const programId = 'charlotte-tech'
      const programRows = deriveProgramPlayerSeasonStats(complete, programId)
      const rawRows = getCompletedGamesForProgram(complete, programId).flatMap(
        ({ game, result: completedResult }) =>
          game.homeProgramId === programId
            ? completedResult.homePlayerStats
            : completedResult.awayPlayerStats,
      )
      const fields = [
        'minutes',
        'points',
        'rebounds',
        'assists',
        'fieldGoalsMade',
        'fieldGoalsAttempted',
        'threePointersMade',
        'threePointersAttempted',
        'freeThrowsMade',
        'freeThrowsAttempted',
      ] as const

      for (const field of fields) {
        const derivedTotal = programRows.reduce(
          (total, row) => total + row[field],
          0,
        )
        const rawTotal = rawRows.reduce(
          (total, row) => total + row[field],
          0,
        )
        expect(derivedTotal).toBe(rawTotal)
      }
    },
    20_000,
  )

  it('derives identical stats from equivalent round-by-round and bulk progression', () => {
    const initial = createUniverseSeason()
    let normal = initial

    for (let round = 1; round <= 3; round += 1) {
      normal = simulatePendingGamesInRound({
        season: normal,
        round,
        simulationSeed: 'player-stats-equivalence',
      })
    }

    const bulk = simulatePendingGamesThroughRound({
      season: initial,
      throughRound: 3,
      simulationSeed: 'player-stats-equivalence',
    })

    expect(bulk.resultsByGameId).toEqual(normal.resultsByGameId)
    expect(deriveSeasonPlayerStats(bulk)).toEqual(
      deriveSeasonPlayerStats(normal),
    )
  })
})
