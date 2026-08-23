import { describe, expect, it } from 'vitest'
import {
  calculateOverall,
  MAX_PLAYER_RATING,
  type ClassYear,
  type Player,
  type PlayerAttributes,
} from '../engine'
import {
  deriveAttributeDevelopmentGains,
  deriveDevelopmentTendency,
  deriveDevelopmentSummary,
  deriveHighPotentialDevelopmentOpportunity,
  developReturningPlayer,
  developReturningPlayerWithExplosion,
  deriveExplosionTargetTotalGain,
} from './index'
import { EXPLOSION_TOTAL_GAIN_CAP, ORDINARY_DEVELOPMENT_CAP } from './development'

const ATTRIBUTE_NAMES = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
] as const satisfies readonly (keyof PlayerAttributes)[]

function player(classYear: ClassYear, id = `player-${classYear}`): Player {
  return {
    id,
    firstName: 'Caleb',
    lastName: 'Daniels',
    position: 'PG',
    classYear,
    height: 74,
    attributes: {
      finishing: 66,
      shooting: 72,
      playmaking: 75,
      ballHandling: 76,
      perimeterDefense: 70,
      interiorDefense: 48,
      rebounding: 50,
      athleticism: 71,
      stamina: 73,
    },
    potential: 90,
  }
}

function develop(source: Player, seed: string | number = 'development-test') {
  return developReturningPlayer({
    player: source,
    dynastySeed: seed,
    completedSeasonNumber: 1,
    programId: 'charlotte-tech',
  })
}

describe('Player Development V1', () => {
  it.each([
    ['FR', 'SO'],
    ['SO', 'JR'],
    ['JR', 'SR'],
  ] as const)('advances %s to %s while preserving identity facts', (beforeClass, afterClass) => {
    const before = player(beforeClass)
    const snapshot = structuredClone(before)
    const after = develop(before)

    expect(after).toMatchObject({
      id: before.id,
      firstName: before.firstName,
      lastName: before.lastName,
      height: before.height,
      position: before.position,
      potential: before.potential,
      classYear: afterClass,
    })
    for (const name of ATTRIBUTE_NAMES) {
      expect(after.attributes[name]).toBeGreaterThanOrEqual(before.attributes[name])
      expect(after.attributes[name]).toBeLessThanOrEqual(MAX_PLAYER_RATING)
    }
    expect(calculateOverall(after)).toBeLessThanOrEqual(before.potential)
    expect(before).toEqual(snapshot)
  })

  it('rejects seniors because graduation owns their transition', () => {
    expect(() => develop(player('SR'))).toThrow(/Seniors graduate/)
  })

  it('stagnates at Potential without hidden attribute changes', () => {
    const before = player('SO')
    before.potential = calculateOverall(before)
    const after = develop(before)
    expect(after.attributes).toEqual(before.attributes)
    expect(after.classYear).toBe('JR')
  })

  it('uses pre-development OVR for zero-headroom summaries', () => {
    const before = player('FR', 'zero-headroom')
    before.potential = calculateOverall(before)
    const after = develop(before)
    const summary = deriveDevelopmentSummary('charlotte-tech', before, after)

    expect(summary.potentialHeadroom).toBe(0)
    expect(summary.previousOverall).toBe(before.potential)
    expect(summary.currentOverall).toBe(summary.previousOverall)
    expect(summary.overallChange).toBe(0)
  })

  it('constrains the same development opportunity when headroom is low', () => {
    const highHeadroom = player('FR', 'headroom-comparison')
    const currentOverall = calculateOverall(highHeadroom)
    highHeadroom.potential = 99
    const lowHeadroom = structuredClone(highHeadroom)
    lowHeadroom.potential = currentOverall + 1

    const highAfter = develop(highHeadroom, 'headroom-comparison')
    const lowAfter = develop(lowHeadroom, 'headroom-comparison')

    expect(calculateOverall(lowAfter)).toBeLessThanOrEqual(lowHeadroom.potential)
    expect(calculateOverall(lowAfter) - currentOverall).toBeLessThanOrEqual(1)
    expect(calculateOverall(highAfter) - currentOverall).toBeGreaterThan(1)
  })

  it('lets high-headroom Players improve deterministically', () => {
    const before = player('FR')
    const first = develop(before)
    const second = develop(structuredClone(before))
    expect(first).toEqual(second)
    expect(calculateOverall(first)).toBeGreaterThan(calculateOverall(before))
  })

  it('locks the accepted high-POT and headroom opportunity thresholds', () => {
    expect(deriveHighPotentialDevelopmentOpportunity(84, 20)).toBe(0)
    expect(deriveHighPotentialDevelopmentOpportunity(85, 7)).toBe(0)
    expect(deriveHighPotentialDevelopmentOpportunity(85, 8)).toBe(1)
    expect(deriveHighPotentialDevelopmentOpportunity(89, 20)).toBe(1)
    expect(deriveHighPotentialDevelopmentOpportunity(90, 11)).toBe(1)
    expect(deriveHighPotentialDevelopmentOpportunity(90, 12)).toBe(2)
    expect(deriveHighPotentialDevelopmentOpportunity(99, 30)).toBe(2)
  })

  it('keeps weak-tendency elite-POT Players capable of disappointing', () => {
    const dynastySeed = 'weak-elite-disappointment'
    const before = Array.from({ length: 100 }, (_, index) =>
      player('FR', `weak-elite-${index}`),
    ).find((candidate) => deriveDevelopmentTendency(candidate, dynastySeed) === 'weak')!
    before.potential = 99
    let current = before
    for (let season = 1; season <= 3; season += 1) {
      current = developReturningPlayer({
        player: current,
        dynastySeed,
        completedSeasonNumber: season,
        programId: 'charlotte-tech',
      })
    }

    expect(deriveDevelopmentTendency(before, dynastySeed)).toBe('weak')
    expect(current.classYear).toBe('SR')
    expect(calculateOverall(current)).toBeLessThan(before.potential - 10)
    expect(calculateOverall(current)).toBeGreaterThanOrEqual(calculateOverall(before))
  })

  it('uses independent Player identity seeds and changes at least some development across dynasty seeds', () => {
    const players = Array.from({ length: 20 }, (_, index) =>
      player((['FR', 'SO', 'JR'] as const)[index % 3]!, `player-${index}`),
    )
    const developAll = (seed: string, values = players) =>
      values.map((candidate) => develop(candidate, seed)).sort((a, b) => a.id.localeCompare(b.id))

    expect(developAll('same', [...players].reverse())).toEqual(developAll('same'))
    expect(developAll('different')).not.toEqual(developAll('same'))
  })

  it('derives one stable hidden tendency per Player and Dynasty seed', () => {
    const source = player('FR', 'tendency-player')
    expect(deriveDevelopmentTendency(source, 'same')).toBe(
      deriveDevelopmentTendency(source, 'same'),
    )
    expect(['weak', 'steady', 'strong']).toContain(
      deriveDevelopmentTendency(source, 'same'),
    )
  })

  it('gives high-headroom Players a wider deterministic upside distribution', () => {
    const outcomes = (potential: number) => Array.from({ length: 80 }, (_, index) => {
      const source = player('FR', `headroom-v1-${index}`)
      source.potential = potential
      let current = source
      for (let season = 1; season <= 3; season += 1) {
        current = developReturningPlayer({
          player: current,
          dynastySeed: 'headroom-v1',
          completedSeasonNumber: season,
          programId: 'charlotte-tech',
        })
      }
      return calculateOverall(current) - calculateOverall(source)
    })
    const low = outcomes(78)
    const high = outcomes(99)
    const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
    expect(average(high)).toBeGreaterThan(average(low) + 3)
    expect(Math.max(...high)).toBeGreaterThanOrEqual(15)
  })

  it('derives only positive attribute gains in deterministic gain/order priority', () => {
    const before = player('SO', 'attribute-gains')
    const after = structuredClone(before)
    after.attributes.playmaking += 2
    after.attributes.shooting += 2
    after.attributes.finishing += 1

    expect(deriveAttributeDevelopmentGains(before, after)).toEqual([
      { attribute: 'shooting', change: 2 },
      { attribute: 'playmaking', change: 2 },
      { attribute: 'finishing', change: 1 },
    ])
  })
})

describe('Offseason Development Explosions', () => {
  function explosionFixture(
    classYear: Exclude<ClassYear, 'SR'>,
    test: (result: ReturnType<typeof developReturningPlayerWithExplosion>) => boolean,
    potential = 99,
  ) {
    for (let index = 0; index < 30_000; index += 1) {
      const source = player(classYear, `explosion-${classYear}-${index}`)
      source.potential = potential
      const result = developReturningPlayerWithExplosion({ player: source, dynastySeed: 'explosion-fixtures', completedSeasonNumber: 7, programId: 'charlotte-tech' })
      if (test(result)) return { source, result }
    }
    throw new Error(`Unable to resolve deterministic ${classYear} Explosion fixture.`)
  }

  it('locks the M2 boundaries and structurally reachable +20 target', () => {
    expect(deriveExplosionTargetTotalGain(0, 0)).toBe(8)
    expect(deriveExplosionTargetTotalGain(.579999, .999999)).toBe(11)
    expect(deriveExplosionTargetTotalGain(.58, 0)).toBe(12)
    expect(deriveExplosionTargetTotalGain(.919999, .999999)).toBe(15)
    expect(deriveExplosionTargetTotalGain(.92, 0)).toBe(16)
    expect(deriveExplosionTargetTotalGain(.999999, .999999)).toBe(20)
    expect(EXPLOSION_TOTAL_GAIN_CAP).toEqual({ FR: 20, SO: 18, JR: 16 })
  })

  it.each(['FR', 'SO', 'JR'] as const)('preserves exact ordinary %s results whenever no event is official', (classYear) => {
    for (let index = 0; index < 120; index += 1) {
      const source = player(classYear, `preservation-${classYear}-${index}`)
      source.potential = index % 2 ? 99 : calculateOverall(source) + 5
      const options = { player: source, dynastySeed: 'preservation', completedSeasonNumber: 3, programId: 'charlotte-tech' }
      const ordinary = developReturningPlayer(options)
      const candidate = developReturningPlayerWithExplosion(options)
      if (!candidate.explosion) {
        expect(candidate.player).toEqual(ordinary)
        expect(candidate.ordinaryPlayer).toEqual(ordinary)
        expect(deriveDevelopmentSummary(options.programId, source, candidate.player)).toEqual(deriveDevelopmentSummary(options.programId, source, ordinary))
      }
    }
  })

  it.each(['weak', 'steady', 'strong'] as const)('does not alter non-event %s-tendency Players', (band) => {
    const source = Array.from({ length: 200 }, (_, index) => player('FR', `${band}-${index}`))
      .find(candidate => deriveDevelopmentTendency(candidate, 'tendency-preservation') === band)!
    source.potential = calculateOverall(source) + 5
    const options = { player: source, dynastySeed: 'tendency-preservation', completedSeasonNumber: 2, programId: 'charlotte-tech' }
    const ordinary = developReturningPlayer(options)
    expect(developReturningPlayerWithExplosion(options)).toEqual({ player: ordinary, ordinaryPlayer: ordinary, explosion: null })
  })

  it.each(['FR', 'SO', 'JR'] as const)('creates canonical, POT-safe official %s events above the ordinary cap', (classYear) => {
    const { source, result } = explosionFixture(classYear, candidate => candidate.explosion !== null)
    const event = result.explosion!
    expect(calculateOverall(result.player)).toBe(event.currentOverall)
    expect(event.totalGain).toBeGreaterThan(ORDINARY_DEVELOPMENT_CAP[classYear])
    expect(event.explosionContribution).toBe(event.currentOverall - event.ordinaryOverall)
    expect(event.totalGain).toBe(event.currentOverall - event.previousOverall)
    expect(event.totalGain).toBeLessThanOrEqual(EXPLOSION_TOTAL_GAIN_CAP[classYear])
    expect(event.currentOverall).toBeLessThanOrEqual(source.potential)
    expect(result.player.potential).toBe(source.potential)
    expect(Object.values(result.player.attributes).every(value => value >= 40 && value <= MAX_PLAYER_RATING)).toBe(true)
  })

  it('records POT truncation only when the truncated result remains exceptional', () => {
    const base = player('FR', 'pot-template')
    const potential = calculateOverall(base) + 13
    const { result } = explosionFixture('FR', candidate => candidate.explosion !== null && candidate.explosion.potentialTruncation > 0, potential)
    expect(result.explosion!.totalGain).toBe(13)
    expect(result.explosion!.currentOverall).toBe(potential)
  })

  it('replays exactly and is independent across Player processing order', () => {
    const sources = Array.from({ length: 80 }, (_, index) => {
      const source = player((['FR', 'SO', 'JR'] as const)[index % 3]!, `order-${index}`)
      source.potential = 99
      return source
    })
    const run = (values: readonly Player[]) => values.map(source => developReturningPlayerWithExplosion({ player: source, dynastySeed: 'order-independence', completedSeasonNumber: 4, programId: 'charlotte-tech' })).sort((a, b) => a.player.id.localeCompare(b.player.id))
    expect(run(sources)).toEqual(run([...sources].reverse()))
    expect(run(sources)).toEqual(run(structuredClone(sources)))
  })
})
