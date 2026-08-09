import { describe, expect, it } from 'vitest'
import type { PlayerGameStats } from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  deriveProgramPlayerSeasonStats,
  deriveSeasonTeamStats,
  deriveTeamSeasonStats,
  getCompletedGamesForProgram,
  getScheduleForProgram,
  initializeSeason,
  simulatePendingGamesThroughRound,
  type SeasonState,
  type TeamSeasonStats,
} from './index'

const PROGRAM_ID = 'charlotte-tech'
const TOTAL_FIELDS = [
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fieldGoalsMade',
  'fieldGoalsAttempted',
  'threePointersMade',
  'threePointersAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
] as const satisfies readonly (keyof PlayerGameStats)[]

function createSeason(): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'team-stats-test-universe',
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'team-stats-test-schedule',
  })

  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
}

function numericValues(stats: TeamSeasonStats): number[] {
  return Object.values(stats).filter(
    (value): value is number => typeof value === 'number',
  )
}

function expectedTotals(season: SeasonState, programId: string) {
  const totals = {
    gamesPlayed: 0,
    points: 0,
    pointsAllowed: 0,
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

  for (const { game, result } of getCompletedGamesForProgram(season, programId)) {
    const isHome = game.homeProgramId === programId
    const rows = isHome ? result.homePlayerStats : result.awayPlayerStats
    const teamScore = isHome ? result.homeScore : result.awayScore

    totals.gamesPlayed += 1
    totals.points += teamScore
    totals.pointsAllowed += isHome ? result.awayScore : result.homeScore
    expect(rows.reduce((sum, row) => sum + row.points, 0)).toBe(teamScore)

    for (const row of rows) {
      for (const field of TOTAL_FIELDS) {
        totals[field] += row[field]
      }
    }
  }

  return totals
}

describe('Team Season Stats projections', () => {
  it('returns safe serializable zero-game totals, rates, and percentages', () => {
    const stats = deriveTeamSeasonStats(createSeason(), PROGRAM_ID)

    expect(stats.programId).toBe(PROGRAM_ID)
    expect(numericValues(stats).every((value) => value === 0)).toBe(true)
    expect(numericValues(stats).every(Number.isFinite)).toBe(true)
    expect(stats.fieldGoalPercentage).toBe(0)
    expect(stats.threePointPercentage).toBe(0)
    expect(stats.freeThrowPercentage).toBe(0)
    expect(JSON.parse(JSON.stringify(stats))).toEqual(stats)
  })

  it('reconciles partial-season scores and every Team box-score total', () => {
    const season = simulatePendingGamesThroughRound({
      season: createSeason(),
      throughRound: 3,
      simulationSeed: 'team-stats-partial',
    })
    const stats = deriveTeamSeasonStats(season, PROGRAM_ID)
    const expected = expectedTotals(season, PROGRAM_ID)

    expect(stats).toMatchObject(expected)
    expect(stats.gamesPlayed).toBe(3)
    expect(stats.pointsPerGame).toBe(expected.points / expected.gamesPlayed)
    expect(stats.opponentPointsPerGame).toBe(
      expected.pointsAllowed / expected.gamesPlayed,
    )
    expect(stats.pointDifferentialPerGame).toBe(
      (expected.points - expected.pointsAllowed) / expected.gamesPlayed,
    )
    expect(stats.reboundsPerGame).toBe(
      expected.rebounds / expected.gamesPlayed,
    )
    expect(stats.assistsPerGame).toBe(expected.assists / expected.gamesPlayed)
    expect(stats.stealsPerGame).toBe(expected.steals / expected.gamesPlayed)
    expect(stats.blocksPerGame).toBe(expected.blocks / expected.gamesPlayed)
    expect(stats.turnoversPerGame).toBe(
      expected.turnovers / expected.gamesPlayed,
    )
    expect(stats.fieldGoalPercentage).toBe(
      expected.fieldGoalsMade / expected.fieldGoalsAttempted,
    )
    expect(stats.threePointPercentage).toBe(
      expected.threePointersMade / expected.threePointersAttempted,
    )
    expect(stats.freeThrowPercentage).toBe(
      expected.freeThrowsMade / expected.freeThrowsAttempted,
    )

    const playerRows = deriveProgramPlayerSeasonStats(season, PROGRAM_ID)
    for (const field of TOTAL_FIELDS) {
      expect(playerRows.reduce((sum, row) => sum + row[field], 0)).toBe(
        stats[field],
      )
    }
    expect(playerRows.reduce((sum, row) => sum + row.points, 0)).toBe(
      stats.points,
    )
    expect(numericValues(stats).every(Number.isFinite)).toBe(true)
  })

  it('counts every completed regular-season game without hardcoding the schedule length', () => {
    const initial = createSeason()
    const complete = simulatePendingGamesThroughRound({
      season: initial,
      throughRound: initial.schedule.roundCount,
      simulationSeed: 'team-stats-complete',
    })
    const stats = deriveTeamSeasonStats(complete, PROGRAM_ID)

    expect(stats.gamesPlayed).toBe(
      getScheduleForProgram(complete, PROGRAM_ID).length,
    )
    expect(stats).toMatchObject(expectedTotals(complete, PROGRAM_ID))
  })

  it('is result-insertion-order independent and derives every Program stably', () => {
    const partial = simulatePendingGamesThroughRound({
      season: createSeason(),
      throughRound: 4,
      simulationSeed: 'team-stats-order',
    })
    const reversed: SeasonState = {
      ...partial,
      resultsByGameId: Object.fromEntries(
        Object.entries(partial.resultsByGameId).reverse(),
      ),
    }
    const rows = deriveSeasonTeamStats(partial)

    expect(deriveSeasonTeamStats(reversed)).toEqual(rows)
    expect(rows).toHaveLength(UNIVERSE_V0.programs.length)
    expect(rows.map(({ programId }) => programId)).toEqual(
      [...rows.map(({ programId }) => programId)].sort((a, b) =>
        a.localeCompare(b),
      ),
    )
    expect(rows.flatMap(numericValues).every(Number.isFinite)).toBe(true)
    expect(JSON.parse(JSON.stringify(rows))).toEqual(rows)
  })

  it('rejects an unknown Program explicitly', () => {
    expect(() => deriveTeamSeasonStats(createSeason(), 'unknown-program')).toThrow(
      /Unknown Season Program/,
    )
  })
})
