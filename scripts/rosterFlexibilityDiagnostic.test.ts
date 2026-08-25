import { describe, expect, it } from 'vitest'
import { POSITIONS, type Position } from '../src/engine'
import {
  deriveBalancedSupplyDemand,
  deriveFlexibleCapacity,
  determinismFingerprint,
  isJointOfferSetFeasible,
  runModelCycle,
  shuffleProgramOrder,
} from './rosterFlexibilityDiagnostic'
import { createRecruitingDynasty } from '../src/dynasty/recruiting/testSupport'

const counts = (values: readonly number[]) => Object.fromEntries(POSITIONS.map((position, index) => [position, values[index]!])) as Record<Position, number>

describe('Roster flexibility diagnostic-only model', () => {
  it('derives the focused-design examples exactly', () => {
    expect(deriveFlexibleCapacity(counts([1, 2, 2, 2, 2]))).toMatchObject({ mandatory: counts([1, 0, 0, 0, 0]), flexible: 2 })
    expect(deriveFlexibleCapacity(counts([2, 2, 2, 2, 2]))).toMatchObject({ mandatory: counts([0, 0, 0, 0, 0]), flexible: 2 })
    expect(deriveFlexibleCapacity(counts([1, 3, 2, 1, 2]))).toMatchObject({ mandatory: counts([1, 0, 0, 1, 0]), flexible: 1 })
  })

  it('accepts only jointly feasible meaningful offer sets', () => {
    const returners = counts([1, 2, 2, 2, 2])
    expect(isJointOfferSetFeasible(returners, counts([0, 0, 0, 0, 0]), counts([1, 0, 1, 0, 1]))).toBe(true)
    expect(isJointOfferSetFeasible(returners, counts([0, 0, 0, 0, 0]), counts([0, 1, 1, 0, 1]))).toBe(false)
    expect(isJointOfferSetFeasible(counts([2, 2, 2, 2, 1]), counts([0, 0, 0, 0, 1]), counts([0, 0, 0, 0, 2]))).toBe(false)
  })

  it('builds a balanced deterministic supply demand', () => {
    const first = deriveBalancedSupplyDemand(150, counts([2, 4, 1, 5, 3]))
    const second = deriveBalancedSupplyDemand(150, counts([2, 4, 1, 5, 3]))
    expect(first).toEqual(second)
    expect(Object.values(first).every((value) => value >= 0)).toBe(true)
  })

  it('completes one paired diagnostic cycle legally and deterministically', () => {
    for (const model of ['baseline', 'b1', 'b2'] as const) {
      const first = runModelCycle(model, 'roster-flex-test')
      const second = runModelCycle(model, 'roster-flex-test')
      expect(first.success).toBe(true)
      expect(determinismFingerprint(first)).toBe(determinismFingerprint(second))
    }
  })

  it('is independent of Program record iteration order', () => {
    const dynasty = createRecruitingDynasty('roster-flex-order')
    const teams = Object.fromEntries(Object.entries(dynasty.activeSeason!.programStates).map(([id, state]) => [id, state.team]))
    const ordered = runModelCycle('b2', 'roster-flex-order', teams)
    const shuffled = runModelCycle('b2', 'roster-flex-order', shuffleProgramOrder(teams, 'shuffle'))
    expect(determinismFingerprint(shuffled)).toBe(determinismFingerprint(ordered))
  })
})
