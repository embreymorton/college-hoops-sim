import { calculateOverall, createRng, POSITIONS, type Position, type RngSeed } from '../src/engine'
import type { Recruit, RecruitStarRating } from '../src/dynasty'

export const CANDIDATE_B_NAMESPACE = 'recruit-pot-gap-candidate-b:v1'

export interface CandidateBIntervention {
  readonly eligible: boolean
  readonly preservedZero: boolean
  readonly grantedRunway: number
  readonly cappedAt99: boolean
}

export interface CandidateBResult extends CandidateBIntervention {
  readonly potential: number
}

function candidateSeed(dynastySeed: RngSeed, targetSeasonNumber: number, playerId: string) {
  return JSON.stringify({
    namespace: CANDIDATE_B_NAMESPACE,
    dynastySeed: { type: typeof dynastySeed, value: dynastySeed },
    targetSeasonNumber,
    playerId,
  })
}

export function finalizeCandidateBPotential({
  overall,
  baselinePotential,
  dynastySeed,
  targetSeasonNumber,
  playerId,
}: {
  readonly overall: number
  readonly baselinePotential: number
  readonly dynastySeed: RngSeed
  readonly targetSeasonNumber: number
  readonly playerId: string
}): CandidateBResult {
  if (baselinePotential < overall) throw new RangeError('Baseline POT must be at least OVR.')
  if (baselinePotential > overall || overall < 78) {
    return { potential: baselinePotential, eligible: false, preservedZero: false, grantedRunway: 0, cappedAt99: false }
  }

  const rng = createRng(candidateSeed(dynastySeed, targetSeasonNumber, playerId))
  if (rng.chance(0.35)) {
    return { potential: baselinePotential, eligible: true, preservedZero: true, grantedRunway: 0, cappedAt99: false }
  }

  const range: readonly [number, number] = overall >= 90 ? [1, 3] : overall >= 85 ? [2, 5] : [2, 6]
  const drawnRunway = rng.int(range[0], range[1])
  const potential = Math.min(99, overall + drawnRunway)
  return {
    potential,
    eligible: true,
    preservedZero: false,
    grantedRunway: potential - overall,
    cappedAt99: potential < overall + drawnRunway,
  }
}

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
    const result = finalizeCandidateBPotential({
      overall,
      baselinePotential: recruit.player.potential,
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
