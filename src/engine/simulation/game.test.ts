import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type Rotation,
  type Team,
} from '../domain'
import { simulateGame } from './game'

function makeAttributes(
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

function makePlayer(
  teamId: string,
  position: Position,
  attributes: PlayerAttributes,
): Player {
  return {
    id: `${teamId}-${position}`,
    firstName: teamId,
    lastName: position,
    position,
    classYear: 'JR',
    height: 78,
    attributes,
    potential: 99,
  }
}

function makeTeam(
  id: string,
  attributesForPosition: (position: Position) => PlayerAttributes,
): Team {
  return {
    id,
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    prestige: 60,
    roster: POSITIONS.map((position) =>
      makePlayer(id, position, attributesForPosition(position)),
    ),
  }
}

function makeUniformTeam(id: string, rating: number): Team {
  return makeTeam(id, () =>
    makeAttributes({
      finishing: rating,
      shooting: rating,
      playmaking: rating,
      ballHandling: rating,
      perimeterDefense: rating,
      interiorDefense: rating,
      rebounding: rating,
      athleticism: rating,
      stamina: rating,
    }),
  )
}

function makeSpecializedTeam(
  id: string,
  offenseRating: number,
  defenseRating: number,
): Team {
  return makeTeam(id, () =>
    makeAttributes({
      finishing: offenseRating,
      shooting: offenseRating,
      playmaking: offenseRating,
      ballHandling: offenseRating,
      perimeterDefense: defenseRating,
      interiorDefense: defenseRating,
    }),
  )
}

function fullRotation(team: Team): Rotation {
  return {
    minutes: Object.fromEntries(
      team.roster.map((player) => [player.id, 40]),
    ),
  }
}

function simulateFixture(
  homeTeam: Team,
  awayTeam: Team,
  seed: string | number,
  site: 'home' | 'neutral' = 'home',
) {
  return simulateGame({
    homeTeam,
    awayTeam,
    homeRotation: fullRotation(homeTeam),
    awayRotation: fullRotation(awayTeam),
    seed,
    site,
  })
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('simulateGame', () => {
  it('returns deeply equal results for identical inputs and seed', () => {
    const homeTeam = makeUniformTeam('home-deterministic', 72)
    const awayTeam = makeUniformTeam('away-deterministic', 72)
    const options = {
      homeTeam,
      awayTeam,
      homeRotation: fullRotation(homeTeam),
      awayRotation: fullRotation(awayTeam),
      seed: 'same-game-seed',
    } as const

    expect(simulateGame(options)).toEqual(simulateGame(options))
  })

  it('produces meaningful score variety from different seeds', () => {
    const homeTeam = makeUniformTeam('home-variety', 70)
    const awayTeam = makeUniformTeam('away-variety', 70)
    const scorelines = new Set(
      Array.from({ length: 50 }, (_, index) => {
        const result = simulateFixture(homeTeam, awayTeam, `variety-${index}`)
        return `${result.homeScore}-${result.awayScore}`
      }),
    )

    expect(scorelines.size).toBeGreaterThan(30)
  })

  it('always returns non-negative integer scores and exactly one winner', () => {
    const homeTeam = makeUniformTeam('home-invariants', 55)
    const awayTeam = makeUniformTeam('away-invariants', 85)

    for (let index = 0; index < 2_000; index += 1) {
      const result = simulateFixture(homeTeam, awayTeam, `invariant-${index}`)

      expect(Number.isInteger(result.homeScore)).toBe(true)
      expect(Number.isInteger(result.awayScore)).toBe(true)
      expect(result.homeScore).toBeGreaterThanOrEqual(0)
      expect(result.awayScore).toBeGreaterThanOrEqual(0)
      expect(result.homeScore).not.toBe(result.awayScore)
      expect([homeTeam.id, awayTeam.id]).toContain(result.winnerId)
      expect(result.winnerId).toBe(
        result.homeScore > result.awayScore ? homeTeam.id : awayTeam.id,
      )
      expect(Number.isInteger(result.overtimePeriods)).toBe(true)
      expect(result.overtimePeriods).toBeGreaterThanOrEqual(0)
      expect(result.overtimePeriods).toBeLessThanOrEqual(10)
    }
  })

  it('resolves regulation ties through overtime', () => {
    const homeTeam = makeUniformTeam('home-overtime', 70)
    const awayTeam = makeUniformTeam('away-overtime', 70)
    const overtimeResults = Array.from({ length: 2_000 }, (_, index) =>
      simulateFixture(homeTeam, awayTeam, `overtime-search-${index}`),
    ).filter(({ overtimePeriods }) => overtimePeriods > 0)

    expect(overtimeResults.length).toBeGreaterThan(10)
    expect(
      overtimeResults.every(
        (result) =>
          result.homeScore !== result.awayScore && result.overtimePeriods >= 1,
      ),
    ).toBe(true)
  })

  it('raises scoring when the same team has a stronger offense', () => {
    const highOffense = makeSpecializedTeam('high-offense', 95, 70)
    const lowOffense = makeSpecializedTeam('low-offense', 45, 70)
    const opponent = makeSpecializedTeam('average-opponent', 70, 70)
    const highScores = Array.from({ length: 500 }, (_, index) =>
      simulateFixture(highOffense, opponent, `offense-effect-${index}`),
    ).map(({ homeScore }) => homeScore)
    const lowScores = Array.from({ length: 500 }, (_, index) =>
      simulateFixture(lowOffense, opponent, `offense-effect-${index}`),
    ).map(({ homeScore }) => homeScore)

    expect(average(highScores) - average(lowScores)).toBeGreaterThan(15)
  })

  it('suppresses scoring when the opponent has a stronger defense', () => {
    const homeTeam = makeSpecializedTeam('fixed-offense', 75, 70)
    const strongDefense = makeSpecializedTeam('strong-defense', 70, 95)
    const weakDefense = makeSpecializedTeam('weak-defense', 70, 45)
    const scoresAgainstStrongDefense = Array.from(
      { length: 500 },
      (_, index) =>
        simulateFixture(
          homeTeam,
          strongDefense,
          `defense-effect-${index}`,
        ).homeScore,
    )
    const scoresAgainstWeakDefense = Array.from(
      { length: 500 },
      (_, index) =>
        simulateFixture(
          homeTeam,
          weakDefense,
          `defense-effect-${index}`,
        ).homeScore,
    )

    expect(
      average(scoresAgainstWeakDefense) - average(scoresAgainstStrongDefense),
    ).toBeGreaterThan(8)
  })

  it('makes stronger teams favorites while preserving realistic upsets', () => {
    const strongTeam = makeUniformTeam('strong-favorite', 80)
    const weakTeam = makeUniformTeam('weak-underdog', 60)
    const games = Array.from({ length: 5_000 }, (_, index) =>
      simulateFixture(strongTeam, weakTeam, `favorite-${index}`),
    )
    const strongWinRate =
      games.filter(({ winnerId }) => winnerId === strongTeam.id).length /
      games.length

    expect(strongWinRate).toBeGreaterThan(0.9)
    expect(strongWinRate).toBeLessThan(0.995)
  })

  it('is roughly balanced for identical teams when home roles are reversed', () => {
    const firstTeam = makeUniformTeam('balanced-first', 70)
    const secondTeam = makeUniformTeam('balanced-second', 70)
    let firstTeamWins = 0
    const gamesPerOrientation = 2_500

    for (let index = 0; index < gamesPerOrientation; index += 1) {
      const firstAtHome = simulateFixture(
        firstTeam,
        secondTeam,
        `balanced-home-${index}`,
      )
      const secondAtHome = simulateFixture(
        secondTeam,
        firstTeam,
        `balanced-away-${index}`,
      )

      firstTeamWins += Number(firstAtHome.winnerId === firstTeam.id)
      firstTeamWins += Number(secondAtHome.winnerId === firstTeam.id)
    }

    const firstTeamWinRate = firstTeamWins / (gamesPerOrientation * 2)
    expect(firstTeamWinRate).toBeGreaterThan(0.47)
    expect(firstTeamWinRate).toBeLessThan(0.53)
  })

  it('gives identical home teams a measurable but modest advantage', () => {
    const homeTeam = makeUniformTeam('home-advantage', 70)
    const awayTeam = makeUniformTeam('away-identical', 70)
    const games = Array.from({ length: 5_000 }, (_, index) =>
      simulateFixture(homeTeam, awayTeam, `home-court-${index}`),
    )
    const homeWinRate =
      games.filter(({ winnerId }) => winnerId === homeTeam.id).length /
      games.length

    expect(homeWinRate).toBeGreaterThan(0.54)
    expect(homeWinRate).toBeLessThan(0.68)
  })

  it('preserves the existing default and removes only home court at neutral sites', () => {
    const homeTeam = makeUniformTeam('neutral-home', 70)
    const awayTeam = makeUniformTeam('neutral-away', 70)
    const defaultResult = simulateFixture(homeTeam, awayTeam, 'site-default')
    const explicitHome = simulateGame({
      homeTeam,
      awayTeam,
      homeRotation: fullRotation(homeTeam),
      awayRotation: fullRotation(awayTeam),
      seed: 'site-default',
      site: 'home',
    })
    const neutralGames = Array.from({ length: 5_000 }, (_, index) =>
      simulateFixture(homeTeam, awayTeam, `neutral-${index}`, 'neutral'),
    )
    const homeWinRate =
      neutralGames.filter(({ winnerId }) => winnerId === homeTeam.id).length /
      neutralGames.length

    expect(defaultResult).toEqual(explicitHome)
    expect(homeWinRate).toBeGreaterThan(0.47)
    expect(homeWinRate).toBeLessThan(0.53)
  })

  it('retains reconciled full Player box scores at neutral sites', () => {
    const homeTeam = makeUniformTeam('neutral-box-home', 70)
    const awayTeam = makeUniformTeam('neutral-box-away', 70)
    const result = simulateFixture(homeTeam, awayTeam, 'neutral-box', 'neutral')

    expect(result.homePlayerStats).toHaveLength(homeTeam.roster.length)
    expect(result.awayPlayerStats).toHaveLength(awayTeam.roster.length)
    expect(result.homePlayerStats.reduce((sum, row) => sum + row.points, 0)).toBe(
      result.homeScore,
    )
    expect(result.awayPlayerStats.reduce((sum, row) => sum + row.points, 0)).toBe(
      result.awayScore,
    )
  })

  it('rejects invalid rotations', () => {
    const homeTeam = makeUniformTeam('home-invalid', 70)
    const awayTeam = makeUniformTeam('away-valid', 70)
    const invalidRotation = fullRotation(homeTeam)
    invalidRotation.minutes[homeTeam.roster[0]?.id ?? ''] = 39

    expect(() =>
      simulateGame({
        homeTeam,
        awayTeam,
        homeRotation: invalidRotation,
        awayRotation: fullRotation(awayTeam),
        seed: 'invalid-rotation',
      }),
    ).toThrow(RangeError)
  })

  it('rejects a team playing itself', () => {
    const team = makeUniformTeam('same-team', 70)

    expect(() =>
      simulateGame({
        homeTeam: team,
        awayTeam: team,
        homeRotation: fullRotation(team),
        awayRotation: fullRotation(team),
        seed: 'same-team',
      }),
    ).toThrow(RangeError)
  })

  it('does not mutate inputs, use Math.random, or return non-serializable data', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const homeTeam = makeUniformTeam('home-immutable', 74)
    const awayTeam = makeUniformTeam('away-immutable', 68)
    const homeRotation = fullRotation(homeTeam)
    const awayRotation = fullRotation(awayTeam)
    const inputsBefore = JSON.parse(
      JSON.stringify({ homeTeam, awayTeam, homeRotation, awayRotation }),
    )
    const result = simulateGame({
      homeTeam,
      awayTeam,
      homeRotation,
      awayRotation,
      seed: 12345,
    })

    expect(
      JSON.parse(JSON.stringify({
        homeTeam,
        awayTeam,
        homeRotation,
        awayRotation,
      })),
    ).toEqual(inputsBefore)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(result.seed).toBe(12345)
  })
})
