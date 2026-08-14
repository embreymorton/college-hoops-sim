import { calculateOverall, POSITIONS, type Position, type RngSeed } from '../src/engine'
import type { Recruit, RecruitStarRating } from '../src/dynasty'
import {
  finalizeRecruitPotential,
  RECRUIT_POTENTIAL_NAMESPACE,
  type RecruitPotentialIntervention,
} from '../src/dynasty/recruiting/potential'

export const CANDIDATE_B_NAMESPACE = RECRUIT_POTENTIAL_NAMESPACE
export type CandidateBIntervention = RecruitPotentialIntervention

function starsForRank(rank: number, classSize: number): RecruitStarRating {
  if (rank <= Math.ceil(classSize * 0.06)) return 5
  if (rank <= Math.ceil(classSize * 0.26)) return 4
  if (rank <= Math.ceil(classSize * 0.72)) return 3
  return 2
}

export interface CandidateBRecruit extends Recruit {
  readonly candidateB: CandidateBIntervention
  readonly baselineNationalRank: number
  readonly baselineStars: RecruitStarRating
}

/** Derives an experimental population without mutating or consuming production generation RNG. */
export function applyCandidateBToRecruitingClass(
  baseline: readonly Recruit[],
  dynastySeed: RngSeed,
  targetSeasonNumber: number,
): CandidateBRecruit[] {
  const candidates = baseline.map((recruit) => {
    const overall = calculateOverall(recruit.player)
    const result = finalizeRecruitPotential({
      overall,
      rawCeiling: recruit.player.potential,
      dynastySeed,
      targetSeasonNumber,
      playerId: recruit.player.id,
    })
    const player = { ...recruit.player, potential: result.potential }
    return {
      ...recruit,
      player,
      qualityScore: Number((overall * 0.56 + result.potential * 0.44).toFixed(2)),
      candidateB: {
        eligible: result.eligible,
        preservedZero: result.preservedZero,
        grantedRunway: result.grantedRunway,
        cappedAt99: result.cappedAt99,
      },
      baselineNationalRank: recruit.nationalRank,
      baselineStars: recruit.stars,
    }
  })

  candidates.sort((first, second) =>
    second.qualityScore - first.qualityScore ||
    calculateOverall(second.player) - calculateOverall(first.player) ||
    second.player.potential - first.player.potential ||
    first.player.id.localeCompare(second.player.id),
  )
  const positionRanks = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
  return candidates.map((candidate, index) => ({
    ...candidate,
    nationalRank: index + 1,
    positionRank: (positionRanks[candidate.player.position] += 1),
    stars: starsForRank(index + 1, candidates.length),
  }))
}
