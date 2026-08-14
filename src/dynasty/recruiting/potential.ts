import { createRng, type RngSeed } from '../../engine'

export const RECRUIT_POTENTIAL_NAMESPACE = 'recruit-pot-gap-candidate-b:v1'

export interface RecruitPotentialIntervention {
  readonly eligible: boolean
  readonly preservedZero: boolean
  readonly grantedRunway: number
  readonly cappedAt99: boolean
}

export interface RecruitPotentialResult extends RecruitPotentialIntervention {
  readonly potential: number
}

function recruitPotentialSeed(
  dynastySeed: RngSeed,
  targetSeasonNumber: number,
  playerId: string,
) {
  return JSON.stringify({
    namespace: RECRUIT_POTENTIAL_NAMESPACE,
    dynastySeed: { type: typeof dynastySeed, value: dynastySeed },
    targetSeasonNumber,
    playerId,
  })
}

/** Accepted Recruit POT finalization: independent from readiness/player RNG streams. */
export function finalizeRecruitPotential({
  overall,
  rawCeiling,
  dynastySeed,
  targetSeasonNumber,
  playerId,
}: {
  readonly overall: number
  readonly rawCeiling: number
  readonly dynastySeed: RngSeed
  readonly targetSeasonNumber: number
  readonly playerId: string
}): RecruitPotentialResult {
  if (rawCeiling > overall || overall < 78) {
    const potential = Math.max(overall, rawCeiling)
    return { potential, eligible: false, preservedZero: false, grantedRunway: 0, cappedAt99: false }
  }

  const rng = createRng(recruitPotentialSeed(dynastySeed, targetSeasonNumber, playerId))
  if (rng.chance(0.35)) {
    return { potential: overall, eligible: true, preservedZero: true, grantedRunway: 0, cappedAt99: false }
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
