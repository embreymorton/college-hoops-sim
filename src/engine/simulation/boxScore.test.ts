import { describe, expect, it } from 'vitest'
import {
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type Rotation,
  type Team,
} from '../domain'
import { createRng } from '../random'
import { generateDefaultRotation, generateTeam } from '../generation'
import { simulateGame, type GameResult } from './game'
import type { PlayerGameStats } from './boxScore'

const STAT_FIELDS = [
  'minutes',
  'points',
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

function attributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  return {
    finishing: 70,
    shooting: 70,
    playmaking: 70,
    ballHandling: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    rebounding: 70,
    athleticism: 70,
    stamina: 70,
    ...overrides,
  }
}

function player(
  teamId: string,
  position: Position,
  suffix: string,
  playerAttributes: PlayerAttributes,
): Player {
  return {
    id: `${teamId}-${position}-${suffix}`,
    firstName: suffix,
    lastName: position,
    position,
    classYear: 'JR',
    height: { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 }[position],
    attributes: playerAttributes,
    potential: 99,
  }
}

function twoDeepTeam(
  id: string,
  playerAttributes: (
    position: Position,
    depth: 'primary' | 'backup',
  ) => PlayerAttributes = () => attributes(),
): Team {
  return {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    prestige: 60,
    roster: POSITIONS.flatMap((position) => [
      player(id, position, 'primary', playerAttributes(position, 'primary')),
      player(id, position, 'backup', playerAttributes(position, 'backup')),
    ]),
  }
}

function rotationWithSplit(
  team: Team,
  primaryMinutes: number,
): Rotation {
  return {
    minutes: Object.fromEntries(
      team.roster.map((teamPlayer) => [
        teamPlayer.id,
        teamPlayer.id.endsWith('-primary')
          ? primaryMinutes
          : 40 - primaryMinutes,
      ]),
    ),
  }
}

function simulate(
  homeTeam: Team,
  awayTeam: Team,
  homeRotation: Rotation,
  awayRotation: Rotation,
  seed: string | number,
): GameResult {
  return simulateGame({
    homeTeam,
    awayTeam,
    homeRotation,
    awayRotation,
    seed,
  })
}

function sum(
  rows: readonly PlayerGameStats[],
  field: (typeof STAT_FIELDS)[number],
): number {
  return rows.reduce((total, row) => total + row[field], 0)
}

function findRow(
  rows: readonly PlayerGameStats[],
  playerId: string,
): PlayerGameStats {
  const row = rows.find(({ playerId: rowPlayerId }) => rowPlayerId === playerId)

  if (!row) {
    throw new Error(`Missing box-score row for ${playerId}`)
  }

  return row
}

function assertBoxScoreInvariants(
  team: Team,
  rotation: Rotation,
  rows: readonly PlayerGameStats[],
  teamScore: number,
  overtimePeriods: number,
): void {
  expect(rows.map(({ playerId }) => playerId)).toEqual(
    team.roster.map(({ id }) => id),
  )
  expect(sum(rows, 'points')).toBe(teamScore)
  expect(sum(rows, 'minutes')).toBe(200 + overtimePeriods * 5)

  for (const row of rows) {
    for (const field of STAT_FIELDS) {
      expect(Number.isInteger(row[field])).toBe(true)
      expect(row[field]).toBeGreaterThanOrEqual(0)
    }

    expect(row.fieldGoalsMade).toBeLessThanOrEqual(row.fieldGoalsAttempted)
    expect(row.threePointersMade).toBeLessThanOrEqual(
      row.threePointersAttempted,
    )
    expect(row.threePointersMade).toBeLessThanOrEqual(row.fieldGoalsMade)
    expect(row.threePointersAttempted).toBeLessThanOrEqual(
      row.fieldGoalsAttempted,
    )
    expect(row.freeThrowsMade).toBeLessThanOrEqual(row.freeThrowsAttempted)
    expect(row.points).toBe(
      2 * (row.fieldGoalsMade - row.threePointersMade) +
        3 * row.threePointersMade +
        row.freeThrowsMade,
    )

    if ((rotation.minutes[row.playerId] ?? 0) === 0) {
      expect(STAT_FIELDS.every((field) => row[field] === 0)).toBe(true)
    }
  }
}

describe('Player box scores', () => {
  it('reconciles points, regulation minutes, shooting, and every integer invariant', () => {
    const homeTeam = generateTeam({
      name: 'Invariant Home',
      abbreviation: 'INH',
      prestige: 70,
      rng: createRng('box-invariant-home-team'),
    })
    const awayTeam = generateTeam({
      name: 'Invariant Away',
      abbreviation: 'INA',
      prestige: 65,
      rng: createRng('box-invariant-away-team'),
    })
    const homeRotation = generateDefaultRotation(homeTeam)
    const awayRotation = generateDefaultRotation(awayTeam)

    for (let index = 0; index < 500; index += 1) {
      const result = simulate(
        homeTeam,
        awayTeam,
        homeRotation,
        awayRotation,
        `box-invariant-${index}`,
      )

      assertBoxScoreInvariants(
        homeTeam,
        homeRotation,
        result.homePlayerStats,
        result.homeScore,
        result.overtimePeriods,
      )
      assertBoxScoreInvariants(
        awayTeam,
        awayRotation,
        result.awayPlayerStats,
        result.awayScore,
        result.overtimePeriods,
      )

      if (result.overtimePeriods === 0) {
        for (const row of result.homePlayerStats) {
          expect(row.minutes).toBe(homeRotation.minutes[row.playerId] ?? 0)
        }
      }
    }
  })

  it('adds exactly five deterministic active-player minutes per overtime', () => {
    const homeTeam = twoDeepTeam('overtime-home')
    const awayTeam = twoDeepTeam('overtime-away')
    const homeRotation = rotationWithSplit(homeTeam, 32)
    const awayRotation = rotationWithSplit(awayTeam, 32)
    let overtimeResult: GameResult | undefined

    for (let index = 0; index < 2_000; index += 1) {
      const result = simulate(
        homeTeam,
        awayTeam,
        homeRotation,
        awayRotation,
        `box-overtime-${index}`,
      )

      if (result.overtimePeriods > 0) {
        overtimeResult = result
        break
      }
    }

    expect(overtimeResult).toBeDefined()

    if (!overtimeResult) {
      return
    }

    for (const [rows, rotation] of [
      [overtimeResult.homePlayerStats, homeRotation],
      [overtimeResult.awayPlayerStats, awayRotation],
    ] as const) {
      expect(sum(rows, 'minutes')).toBe(
        200 + overtimeResult.overtimePeriods * 5,
      )
      expect(
        rows.reduce(
          (total, row) =>
            total + row.minutes - (rotation.minutes[row.playerId] ?? 0),
          0,
        ),
      ).toBe(overtimeResult.overtimePeriods * 5)

      for (const row of rows) {
        const regulationMinutes = rotation.minutes[row.playerId] ?? 0

        expect(row.minutes).toBe(
          row.playerId.endsWith('-primary')
            ? regulationMinutes + overtimeResult.overtimePeriods
            : regulationMinutes,
        )
      }
    }
  })

  it('returns explicit all-zero rows for zero-minute players', () => {
    const homeTeam = twoDeepTeam('zero-row-home')
    const awayTeam = twoDeepTeam('zero-row-away')
    const homeRotation = rotationWithSplit(homeTeam, 40)
    const awayRotation = rotationWithSplit(awayTeam, 40)
    const result = simulate(
      homeTeam,
      awayTeam,
      homeRotation,
      awayRotation,
      'zero-row-game',
    )

    for (const row of [
      ...result.homePlayerStats,
      ...result.awayPlayerStats,
    ]) {
      if (row.playerId.endsWith('-backup')) {
        expect(STAT_FIELDS.every((field) => row[field] === 0)).toBe(true)
      }
    }
  })

  it('gives elite high-minute scorers more points in aggregate', () => {
    const homeTeam = twoDeepTeam('scoring-opportunity', (position, depth) =>
      position === 'SG'
        ? attributes({
            shooting: depth === 'primary' ? 99 : 40,
            finishing: depth === 'primary' ? 99 : 40,
            playmaking: depth === 'primary' ? 90 : 50,
            ballHandling: depth === 'primary' ? 95 : 45,
          })
        : attributes(),
    )
    const awayTeam = twoDeepTeam('scoring-opponent')
    const homeRotation = rotationWithSplit(homeTeam, 35)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    const eliteId = `${homeTeam.id}-SG-primary`
    const reserveId = `${homeTeam.id}-SG-backup`
    let elitePoints = 0
    let reservePoints = 0

    for (let index = 0; index < 750; index += 1) {
      const result = simulate(
        homeTeam,
        awayTeam,
        homeRotation,
        awayRotation,
        `scoring-opportunity-${index}`,
      )
      elitePoints += findRow(result.homePlayerStats, eliteId).points
      reservePoints += findRow(result.homePlayerStats, reserveId).points
    }

    expect(elitePoints).toBeGreaterThan(reservePoints * 12)
  })

  it('uses shooting skill to create greater three-point involvement', () => {
    const homeTeam = twoDeepTeam('shooting-tendency', (position, depth) =>
      position === 'SG'
        ? attributes({ shooting: depth === 'primary' ? 99 : 40 })
        : attributes(),
    )
    const awayTeam = twoDeepTeam('shooting-opponent')
    const evenRotation = rotationWithSplit(homeTeam, 20)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    const shooterId = `${homeTeam.id}-SG-primary`
    const nonShooterId = `${homeTeam.id}-SG-backup`
    let shooterAttempts = 0
    let nonShooterAttempts = 0

    for (let index = 0; index < 750; index += 1) {
      const result = simulate(
        homeTeam,
        awayTeam,
        evenRotation,
        awayRotation,
        `shooting-tendency-${index}`,
      )
      shooterAttempts += findRow(
        result.homePlayerStats,
        shooterId,
      ).threePointersAttempted
      nonShooterAttempts += findRow(
        result.homePlayerStats,
        nonShooterId,
      ).threePointersAttempted
    }

    expect(shooterAttempts).toBeGreaterThan(nonShooterAttempts * 2)
  })

  it('makes rebounding and playmaking attributes matter in aggregate', () => {
    const homeTeam = twoDeepTeam('rebounds-assists', (position, depth) => {
      if (position === 'C') {
        return attributes({ rebounding: depth === 'primary' ? 99 : 40 })
      }

      if (position === 'PG') {
        return attributes({
          playmaking: depth === 'primary' ? 99 : 40,
          ballHandling: depth === 'primary' ? 99 : 40,
        })
      }

      return attributes()
    })
    const awayTeam = twoDeepTeam('rebounds-assists-opponent')
    const evenRotation = rotationWithSplit(homeTeam, 20)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    let strongRebounds = 0
    let weakRebounds = 0
    let strongAssists = 0
    let weakAssists = 0

    for (let index = 0; index < 750; index += 1) {
      const rows = simulate(
        homeTeam,
        awayTeam,
        evenRotation,
        awayRotation,
        `rebound-assist-${index}`,
      ).homePlayerStats

      strongRebounds += findRow(rows, `${homeTeam.id}-C-primary`).rebounds
      weakRebounds += findRow(rows, `${homeTeam.id}-C-backup`).rebounds
      strongAssists += findRow(rows, `${homeTeam.id}-PG-primary`).assists
      weakAssists += findRow(rows, `${homeTeam.id}-PG-backup`).assists
    }

    expect(strongRebounds).toBeGreaterThan(weakRebounds * 1.7)
    expect(strongAssists).toBeGreaterThan(weakAssists * 2)
  })

  it('makes perimeter and interior defense matter for steals and blocks', () => {
    const homeTeam = twoDeepTeam('defensive-production', (position, depth) => {
      if (position === 'SG') {
        return attributes({
          perimeterDefense: depth === 'primary' ? 99 : 40,
        })
      }

      if (position === 'C') {
        return attributes({
          interiorDefense: depth === 'primary' ? 99 : 40,
        })
      }

      return attributes()
    })
    const awayTeam = twoDeepTeam('defensive-production-opponent')
    const evenRotation = rotationWithSplit(homeTeam, 20)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    let strongSteals = 0
    let weakSteals = 0
    let strongBlocks = 0
    let weakBlocks = 0

    for (let index = 0; index < 1_000; index += 1) {
      const rows = simulate(
        homeTeam,
        awayTeam,
        evenRotation,
        awayRotation,
        `defensive-production-${index}`,
      ).homePlayerStats

      strongSteals += findRow(rows, `${homeTeam.id}-SG-primary`).steals
      weakSteals += findRow(rows, `${homeTeam.id}-SG-backup`).steals
      strongBlocks += findRow(rows, `${homeTeam.id}-C-primary`).blocks
      weakBlocks += findRow(rows, `${homeTeam.id}-C-backup`).blocks
    }

    expect(strongSteals).toBeGreaterThan(weakSteals * 1.6)
    expect(strongBlocks).toBeGreaterThan(weakBlocks * 1.6)
  })

  it('is deeply deterministic while different seeds vary player performances', () => {
    const homeTeam = twoDeepTeam('deterministic-home')
    const awayTeam = twoDeepTeam('deterministic-away')
    const homeRotation = rotationWithSplit(homeTeam, 30)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    const options = {
      homeTeam,
      awayTeam,
      homeRotation,
      awayRotation,
      seed: 'deterministic-box-score',
    } as const

    expect(simulateGame(options)).toEqual(simulateGame(options))

    const performances = new Set(
      Array.from({ length: 30 }, (_, index) =>
        JSON.stringify(
          simulate(
            homeTeam,
            awayTeam,
            homeRotation,
            awayRotation,
            `box-variety-${index}`,
          ).homePlayerStats,
        ),
      ),
    )

    expect(performances.size).toBeGreaterThan(25)
  })

  it('preserves inputs and returns JSON-serializable full results', () => {
    const homeTeam = twoDeepTeam('immutable-box-home')
    const awayTeam = twoDeepTeam('immutable-box-away')
    const homeRotation = rotationWithSplit(homeTeam, 30)
    const awayRotation = rotationWithSplit(awayTeam, 30)
    const before = JSON.parse(
      JSON.stringify({ homeTeam, awayTeam, homeRotation, awayRotation }),
    )
    const result = simulate(
      homeTeam,
      awayTeam,
      homeRotation,
      awayRotation,
      98765,
    )

    expect(
      JSON.parse(
        JSON.stringify({ homeTeam, awayTeam, homeRotation, awayRotation }),
      ),
    ).toEqual(before)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('preserves accepted team-level score outcomes before box-score allocation', () => {
    const regressionAttributes = () =>
      attributes({
        finishing: 72,
        shooting: 72,
        playmaking: 72,
        ballHandling: 72,
        perimeterDefense: 72,
        interiorDefense: 72,
        rebounding: 72,
        athleticism: 72,
        stamina: 72,
      })
    const homeTeam = twoDeepTeam('home-regression', regressionAttributes)
    const awayTeam = twoDeepTeam('away-regression', regressionAttributes)
    const homeRotation = rotationWithSplit(homeTeam, 40)
    const awayRotation = rotationWithSplit(awayTeam, 40)
    const expected = [
      ['regression-a', 80, 65, 'home-regression', 0],
      ['regression-b', 72, 65, 'home-regression', 0],
      ['regression-c', 69, 81, 'away-regression', 0],
      [12345, 70, 46, 'home-regression', 0],
    ] as const

    for (const [
      seed,
      homeScore,
      awayScore,
      winnerId,
      overtimePeriods,
    ] of expected) {
      const result = simulate(
        homeTeam,
        awayTeam,
        homeRotation,
        awayRotation,
        seed,
      )

      expect({
        homeScore: result.homeScore,
        awayScore: result.awayScore,
        winnerId: result.winnerId,
        overtimePeriods: result.overtimePeriods,
      }).toEqual({ homeScore, awayScore, winnerId, overtimePeriods })
    }
  })
})
