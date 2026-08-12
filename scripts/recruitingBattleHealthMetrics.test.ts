import { describe, expect, it } from 'vitest'
import {
  buildDefaultRecruitingBoard,
  manageProgramRecruitingOffers,
  resolveRecruitingPeriod,
} from '../src/dynasty'
import { completeRounds, createRecruitingDynasty } from '../src/dynasty/recruiting/testSupport'
import {
  classifySparseCompetitionReason,
  countBucket,
  observePlanCoherence,
  observeReadinessBeforeCommitment,
  observeRecruitCompetition,
} from './recruitingBattleHealthMetrics'

describe('Recruiting battle health metrics', () => {
  it('buckets pursuit and Offer counts', () => {
    expect([0, 1, 2, 3, 8].map(countBucket)).toEqual(['0', '1', '2', '3+', '3+'])
  })

  it('classifies generated Focus-with-Offer coherence separately from AI', () => {
    const initial = createRecruitingDynasty('health-plan')
    const id = initial.controlledProgramId
    const recruiting = initial.recruiting!
    const empty = { ...recruiting.programs[id]!, board: [] }
    const context = { ...initial, recruiting: { ...recruiting, programs: { ...recruiting.programs, [id]: empty } } }
    const board = buildDefaultRecruitingBoard(context, context.recruiting!, id)
    const program = manageProgramRecruitingOffers(context, { ...context.recruiting!, programs: { ...context.recruiting!.programs, [id]: { ...empty, board } } }, id)
    const generated = { ...context, recruiting: { ...context.recruiting!, programs: { ...context.recruiting!.programs, [id]: program } } }
    expect(observePlanCoherence(generated, id, 'controlled-baseline').focused).toBe(3)
    const aiId = Object.keys(recruiting.programs).sort().find((programId) => programId !== id)!
    expect(observePlanCoherence(initial, aiId, 'ai').programKind).toBe('ai')
  })

  it('captures previous readiness and first-ready-period commitment facts', () => {
    let dynasty = createRecruitingDynasty('health-readiness')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 24) }
    for (let period = 1; period <= 24; period += 1) {
      const before = dynasty
      dynasty = resolveRecruitingPeriod(dynasty, period)
      const newCommitment = Object.values(dynasty.recruiting!.commitmentsByPlayerId)
        .find(({ playerId }) => !before.recruiting!.commitmentsByPlayerId[playerId])
      if (newCommitment) {
        const observation = observeReadinessBeforeCommitment(before, newCommitment.playerId, period, newCommitment.programId)
        expect(observation.firstDecisionReadyPeriod).toBe(
          period === before.recruiting!.recruits.find(({ player }) => player.id === newCommitment.playerId)!.decisionReadyPeriod,
        )
        return
      }
    }
    throw new Error('Expected a commitment in the deterministic fixture.')
  })

  it('partitions competition by canonical star tier and active pursuits only', () => {
    const dynasty = createRecruitingDynasty('health-competition')
    const recruit = dynasty.recruiting!.recruits.find(({ stars }) => stars === 5)!
    const observed = observeRecruitCompetition(dynasty, recruit)
    expect(observed.stars).toBe(5)
    expect(observed.pursuers).toBeGreaterThanOrEqual(observed.offers)
  })

  it('returns a deterministic observable sparse-competition constraint', () => {
    const first = createRecruitingDynasty('health-cause')
    const second = createRecruitingDynasty('health-cause')
    const recruit = first.recruiting!.recruits.find(({ stars }) => stars === 5)!
    expect(classifySparseCompetitionReason(first, recruit)).toBe(
      classifySparseCompetitionReason(second, second.recruiting!.recruits.find(({ player }) => player.id === recruit.player.id)!),
    )
  })
})
