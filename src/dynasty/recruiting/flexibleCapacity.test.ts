import { describe, expect, it } from 'vitest'
import { POSITIONS, TEAM_ROSTER_SIZE } from '../../engine'
import {
  deriveActiveOfferCountsByPosition,
  deriveFlexibleOpenings,
  deriveMandatoryNeedsByPosition,
  deriveProjectedCountsByPosition,
  deriveRemainingScholarships,
  isProgramOfferSetFeasible,
} from './queries'
import { createRecruitingDynasty } from './testSupport'

describe('flexible recruiting capacity', () => {
  it('derives one scholarship pool and a jointly feasible offer set', () => {
    const dynasty = createRecruitingDynasty('flex-capacity')
    const recruiting = dynasty.recruiting!
    for (const program of Object.values(recruiting.programs)) {
      expect('capacityModel' in program && program.capacityModel).toBe('flexible-v1')
      const projected = deriveProjectedCountsByPosition(recruiting, program)
      const mandatory = deriveMandatoryNeedsByPosition(recruiting, program)
      const scholarships = deriveRemainingScholarships(recruiting, program)
      const flexible = deriveFlexibleOpenings(recruiting, program)
      expect(POSITIONS.every((position) => projected[position] <= 3)).toBe(true)
      expect(POSITIONS.reduce((sum, position) => sum + mandatory[position], 0) + flexible)
        .toBe(scholarships)
      expect(isProgramOfferSetFeasible(
        recruiting,
        program,
        deriveActiveOfferCountsByPosition(recruiting, program),
      )).toBe(true)
      expect(('projectedReturningPlayerCount' in program
        ? program.projectedReturningPlayerCount
        : TEAM_ROSTER_SIZE) + scholarships).toBe(TEAM_ROSTER_SIZE)
    }
  })
})
