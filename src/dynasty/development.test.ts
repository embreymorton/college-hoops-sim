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
  deriveDevelopmentSummary,
  developReturningPlayer,
} from './index'

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

describe('Player Development V0', () => {
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

  it('uses independent Player identity seeds and changes at least some development across dynasty seeds', () => {
    const players = Array.from({ length: 20 }, (_, index) =>
      player((['FR', 'SO', 'JR'] as const)[index % 3]!, `player-${index}`),
    )
    const developAll = (seed: string, values = players) =>
      values.map((candidate) => develop(candidate, seed)).sort((a, b) => a.id.localeCompare(b.id))

    expect(developAll('same', [...players].reverse())).toEqual(developAll('same'))
    expect(developAll('different')).not.toEqual(developAll('same'))
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
