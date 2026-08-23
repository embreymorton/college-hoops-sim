import { describe, expect, it } from 'vitest'
import {
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  calculateOverall,
} from '../../engine'
import {
  deriveNationalPositionDemand,
  deriveRecruitSupplyByPosition,
  classifyRecruitReadinessTier,
  generateLegacyRecruitingClass,
  generateRecruitingClass,
  generateRecruitingClassWithTalentTrace,
  recruitCeilingRange,
  selectRecruitCeilingTier,
} from './generation'
import { createRecruitingDynasty } from './testSupport'

function correlation(first: readonly number[], second: readonly number[]): number {
  const firstMean = first.reduce((sum, value) => sum + value, 0) / first.length
  const secondMean = second.reduce((sum, value) => sum + value, 0) / second.length
  const covariance = first.reduce((sum, value, index) => sum +
    (value - firstMean) * (second[index]! - secondMean), 0)
  const firstDeviation = Math.sqrt(first.reduce((sum, value) => sum + (value - firstMean) ** 2, 0))
  const secondDeviation = Math.sqrt(second.reduce((sum, value) => sum + (value - secondMean) ** 2, 0))
  return covariance / (firstDeviation * secondDeviation)
}

describe('national recruiting class generation', () => {
  it('uses the accepted V2 conditional ceiling thresholds and ranges', () => {
    const boundaries = {
      'raw/depth': [0.37, 0.876, 0.976, 0.994],
      developmental: [0.34, 0.864, 0.974, 0.994],
      good: [0.30, 0.86, 0.97, 0.995],
      'ready-now': [0.24, 0.815, 0.955, 0.99],
      exceptional: [0.19, 0.74, 0.93, 0.98],
    } as const
    const tiers = ['limited', 'normal', 'high', 'elite', 'exceptional'] as const
    for (const [readinessTier, thresholds] of Object.entries(boundaries) as [keyof typeof boundaries, readonly number[]][]) {
      expect(selectRecruitCeilingTier(readinessTier, 0)).toBe('limited')
      thresholds.forEach((threshold, index) => {
        expect(selectRecruitCeilingTier(readinessTier, threshold - Number.EPSILON)).toBe(tiers[index])
        expect(selectRecruitCeilingTier(readinessTier, threshold)).toBe(tiers[index + 1])
      })
      expect(selectRecruitCeilingTier(readinessTier, 1 - Number.EPSILON)).toBe('exceptional')
    }
    expect(Object.fromEntries(tiers.map((tier) => [tier, recruitCeilingRange(tier)]))).toEqual({
      limited: [60, 74], normal: [75, 84], high: [85, 94], elite: [95, 96], exceptional: [97, 99],
    })
    expect([59, 60, 71, 78, 86].map(classifyRecruitReadinessTier)).toEqual(['raw/depth', 'developmental', 'good', 'ready-now', 'exceptional'])
    expect(() => selectRecruitCeilingTier('good', 1)).toThrow(RangeError)
  })

  it('is deterministic, seed-sensitive, serializable, and Program-order independent', () => {
    const first = createRecruitingDynasty('class-determinism')
    const repeat = createRecruitingDynasty('class-determinism')
    const different = createRecruitingDynasty('class-variety')
    expect(repeat.recruiting!.recruits).toEqual(first.recruiting!.recruits)
    expect(different.recruiting!.recruits).not.toEqual(first.recruiting!.recruits)

    const reversedSeason = {
      ...first.activeSeason!,
      programStates: Object.fromEntries(Object.entries(first.activeSeason!.programStates).reverse()),
    }
    expect(generateRecruitingClass({
      dynastySeed: first.dynastySeed,
      targetSeasonNumber: 2,
      season: reversedSeason,
    })).toEqual(first.recruiting!.recruits)
    expect(JSON.parse(JSON.stringify(first.recruiting))).toEqual(first.recruiting)
  })

  it('creates stable future Players with valid identity, ratings, heights, and Potential', () => {
    const dynasty = createRecruitingDynasty('class-player-validity')
    const recruits = dynasty.recruiting!.recruits
    const ids = new Set(recruits.map(({ player }) => player.id))
    const currentIds = new Set(Object.values(dynasty.activeSeason!.programStates)
      .flatMap(({ team }) => team.roster.map(({ id }) => id)))
    const heightRanges = {
      PG: [70, 77], SG: [73, 79], SF: [76, 81], PF: [78, 83], C: [80, 86],
    } as const

    expect(ids.size).toBe(recruits.length)
    for (const recruit of recruits) {
      const { player } = recruit
      expect(player.id).toMatch(/^recruit-2-/)
      expect(currentIds.has(player.id)).toBe(false)
      expect(POSITIONS).toContain(player.position)
      expect(player.classYear).toBe('FR')
      expect(player.height).toBeGreaterThanOrEqual(heightRanges[player.position][0])
      expect(player.height).toBeLessThanOrEqual(heightRanges[player.position][1])
      expect(Object.values(player.attributes).every(
        (rating) => rating >= MIN_PLAYER_RATING && rating <= MAX_PLAYER_RATING,
      )).toBe(true)
      expect(player.potential).toBeGreaterThanOrEqual(calculateOverall(player))
      expect(player.potential).toBeLessThanOrEqual(MAX_PLAYER_RATING)
    }
  })

  it('provides a healthy demand-aware surplus at every position', () => {
    const dynasty = createRecruitingDynasty('class-supply')
    const demand = deriveNationalPositionDemand(dynasty.activeSeason!)
    const supply = deriveRecruitSupplyByPosition(demand)
    for (const position of POSITIONS) {
      expect(supply[position]).toBeGreaterThan(demand[position])
      expect(dynasty.recruiting!.recruits.filter(
        ({ player }) => player.position === position,
      )).toHaveLength(supply[position])
    }
  })

  it('stores unique stable national/position ranks and distribution-derived stars', () => {
    const recruits = createRecruitingDynasty('class-ranks').recruiting!.recruits
    expect(recruits.map(({ nationalRank }) => nationalRank)).toEqual(
      Array.from({ length: recruits.length }, (_, index) => index + 1),
    )
    for (const position of POSITIONS) {
      const atPosition = recruits.filter(({ player }) => player.position === position)
      expect(atPosition.map(({ positionRank }) => positionRank)).toEqual(
        Array.from({ length: atPosition.length }, (_, index) => index + 1),
      )
    }
    expect(recruits.filter(({ stars }) => stars === 5)).toHaveLength(Math.ceil(recruits.length * 0.06))
    expect(recruits.every(({ stars }) => [2, 3, 4, 5].includes(stars))).toBe(true)
  })

  it('keeps premium positional supply within projected national openings', () => {
    const dynasty = createRecruitingDynasty('premium-capacity')
    const demand = deriveNationalPositionDemand(dynasty.activeSeason!)
    for (const position of POSITIONS) {
      const premium = dynasty.recruiting!.recruits.filter(
        (recruit) => recruit.player.position === position && recruit.stars >= 4,
      ).length
      expect(premium).toBeLessThanOrEqual(demand[position])
    }
  })

  it('permits earlier five-star readiness while keeping elite timing latest on average', () => {
    const dynasty = createRecruitingDynasty('elite-readiness')
    const samples = Array.from({ length: 20 }, (_, index) =>
      generateRecruitingClass({
        dynastySeed: `elite-readiness:${index}`,
        targetSeasonNumber: 2,
        season: dynasty.activeSeason!,
      }),
    ).flat()
    const averageReady = (stars: number) => {
      const periods = samples.filter((recruit) => recruit.stars === stars)
        .map(({ decisionReadyPeriod }) => decisionReadyPeriod)
      return periods.reduce((sum, period) => sum + period, 0) / periods.length
    }
    expect(Math.min(...samples.filter(({ stars }) => stars === 5)
      .map(({ decisionReadyPeriod }) => decisionReadyPeriod))).toBeLessThanOrEqual(15)
    expect(averageReady(5)).toBeGreaterThan(averageReady(4))
    expect(averageReady(4)).toBeGreaterThan(averageReady(3))
  })

  it('creates deterministic readiness-versus-ceiling variety without breaking rank or Player invariants', () => {
    const season = createRecruitingDynasty('readiness-ceiling-source').activeSeason!
    const samples = Array.from({ length: 20 }, (_, index) => generateRecruitingClass({
      dynastySeed: `readiness-ceiling:${index}`,
      targetSeasonNumber: 2,
      season,
    })).flat()
    const overalls = samples.map(({ player }) => calculateOverall(player))
    const potentials = samples.map(({ player }) => player.potential)
    const ranks = samples.map(({ nationalRank }) => nationalRank)
    const rawProjects = samples.filter(({ player }) => {
      const overall = calculateOverall(player)
      return overall >= 55 && overall <= 64 && player.potential >= 85
    })
    const readyNow = samples.filter(({ player }) =>
      calculateOverall(player) >= 75 && player.potential - calculateOverall(player) <= 5,
    )

    expect(rawProjects.length).toBeGreaterThan(0)
    expect(readyNow.length).toBeGreaterThan(0)
    expect(samples.every(({ player }) => player.potential >= calculateOverall(player))).toBe(true)
    expect(Math.abs(correlation(ranks, overalls))).toBeLessThan(0.95)
    expect(Math.abs(correlation(ranks, potentials))).toBeLessThan(0.9)
    expect(Math.abs(correlation(overalls, potentials))).toBeLessThan(0.75)
  })

  it('changes only POT-derived output relative to the historical V1 generation stream', () => {
    const dynasty = createRecruitingDynasty('candidate-b-integration')
    const options = {
      dynastySeed: dynasty.dynastySeed,
      targetSeasonNumber: 2,
      season: dynasty.activeSeason!,
    }
    const production = generateRecruitingClass(options)
    const legacy = generateLegacyRecruitingClass(options)
    const legacyById = new Map(legacy.map((recruit) => [recruit.player.id, recruit]))

    expect(production).toEqual(generateRecruitingClass(options))
    expect(production.some((recruit) => recruit.player.potential !== legacyById.get(recruit.player.id)!.player.potential)).toBe(true)
    for (const recruit of production) {
      const old = legacyById.get(recruit.player.id)!
      const { potential: productionPotential, ...productionPlayer } = recruit.player
      const { potential: legacyPotential, ...legacyPlayer } = old.player
      expect(productionPlayer).toEqual(legacyPlayer)
      expect(calculateOverall(recruit.player)).toBe(calculateOverall(old.player))
      expect(productionPotential).toBeGreaterThanOrEqual(calculateOverall(recruit.player))
      expect(productionPotential).toBeLessThanOrEqual(MAX_PLAYER_RATING)
      expect(legacyPotential).toBeGreaterThanOrEqual(calculateOverall(old.player))
    }
  })

  it('exposes talent diagnostics without changing generated Recruits', () => {
    const dynasty = createRecruitingDynasty('talent-trace-equivalence')
    const options = {
      dynastySeed: dynasty.dynastySeed,
      targetSeasonNumber: 2,
      season: dynasty.activeSeason!,
    }
    const traced = generateRecruitingClassWithTalentTrace(options)

    expect(traced.recruits).toEqual(generateRecruitingClass(options))
    expect(traced.traces).toHaveLength(traced.recruits.length)
    const recruitsById = new Map(traced.recruits.map(({ player }) => [player.id, player]))
    for (const trace of traced.traces) {
      const player = recruitsById.get(trace.playerId)!
      expect(trace.startingOverall).toBe(calculateOverall(player))
      expect(trace.finalPotential).toBe(player.potential)
    }
  })
})
