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
  generateRecruitingClass,
} from './generation'
import { createRecruitingDynasty } from './testSupport'

describe('national recruiting class generation', () => {
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
})
