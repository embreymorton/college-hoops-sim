import { assertValidPlayerAttributes, type Player, type PlayerAttributes, type Position } from '../src/engine/domain/player'

type Attribute = keyof PlayerAttributes

export const OVR_CANDIDATE_B_CONFIG = Object.freeze({
  coreCount: 3,
  minimumThirdCore: 88,
  premiumDeadZone: 2,
  premiumRate: 0.45,
  maximumPremium: 5,
  completenessThresholdHigh: 80,
  completenessBonusHigh: 0.5,
  completenessThresholdLow: 75,
  completenessBonusLow: 0.25,
  weaknessThreshold: 65,
  weaknessPenaltyPerPoint: 0.1,
  maximumWeaknessPenalty: 2,
})

const ATTRIBUTE_KEYS: readonly Attribute[] = ['finishing', 'shooting', 'playmaking', 'ballHandling', 'perimeterDefense', 'interiorDefense', 'rebounding', 'athleticism', 'stamina']
const CORE_CANDIDATES = ATTRIBUTE_KEYS.filter((key) => key !== 'stamina')
const SUPPORT: Readonly<Record<Position, readonly Attribute[]>> = {
  PG: ['shooting', 'playmaking', 'ballHandling', 'perimeterDefense', 'finishing'],
  SG: ['finishing', 'shooting', 'ballHandling', 'perimeterDefense', 'playmaking'],
  SF: ['finishing', 'shooting', 'playmaking', 'ballHandling', 'perimeterDefense', 'interiorDefense', 'rebounding', 'athleticism'],
  PF: ['finishing', 'interiorDefense', 'rebounding', 'athleticism'],
  C: ['finishing', 'interiorDefense', 'rebounding', 'athleticism'],
}
const WEIGHTS: Readonly<Record<Position, Readonly<Record<Attribute, number>>>> = {
  PG: { finishing: .08, shooting: .18, playmaking: .22, ballHandling: .22, perimeterDefense: .14, interiorDefense: .02, rebounding: .03, athleticism: .06, stamina: .05 },
  SG: { finishing: .18, shooting: .24, playmaking: .08, ballHandling: .15, perimeterDefense: .17, interiorDefense: .03, rebounding: .04, athleticism: .07, stamina: .04 },
  SF: { finishing: .14, shooting: .14, playmaking: .10, ballHandling: .10, perimeterDefense: .13, interiorDefense: .10, rebounding: .11, athleticism: .11, stamina: .07 },
  PF: { finishing: .20, shooting: .07, playmaking: .05, ballHandling: .05, perimeterDefense: .07, interiorDefense: .17, rebounding: .19, athleticism: .14, stamina: .06 },
  C: { finishing: .19, shooting: .03, playmaking: .04, ballHandling: .03, perimeterDefense: .05, interiorDefense: .23, rebounding: .23, athleticism: .14, stamina: .06 },
}

export interface OverallCandidateBExplanation {
  readonly overall: number
  readonly rawCurrentValue: number
  readonly coreAttributes: readonly Attribute[]
  readonly coreMean: number
  readonly supportMean: number
  readonly specializationPremium: number
  readonly completenessBonus: number
  readonly weaknessPenalty: number
  readonly rawCandidateValue: number
}

/** Pure experimental valuation; production calculateOverall remains untouched. */
export function explainOverallCandidateB(player: Player): OverallCandidateBExplanation {
  assertValidPlayerAttributes(player.attributes)
  const weights = WEIGHTS[player.position]
  const rawCurrentValue = ATTRIBUTE_KEYS.reduce((sum, key) => sum + player.attributes[key] * weights[key], 0)
  const ranked = CORE_CANDIDATES.slice().sort((a, b) => player.attributes[b] - player.attributes[a] || a.localeCompare(b))
  const coreAttributes = ranked.slice(0, OVR_CANDIDATE_B_CONFIG.coreCount)
  const coreMean = coreAttributes.reduce((sum, key) => sum + player.attributes[key], 0) / coreAttributes.length
  const support = SUPPORT[player.position]
  const supportMean = support.reduce((sum, key) => sum + player.attributes[key], 0) / support.length
  const thirdCore = player.attributes[coreAttributes.at(-1)!]
  const specializationPremium = thirdCore < OVR_CANDIDATE_B_CONFIG.minimumThirdCore
    ? 0
    : Math.min(OVR_CANDIDATE_B_CONFIG.maximumPremium, OVR_CANDIDATE_B_CONFIG.premiumRate * Math.max(0, coreMean - rawCurrentValue - OVR_CANDIDATE_B_CONFIG.premiumDeadZone))
  const minimumSupport = Math.min(...support.map((key) => player.attributes[key]))
  const completenessBonus = minimumSupport >= OVR_CANDIDATE_B_CONFIG.completenessThresholdHigh
    ? OVR_CANDIDATE_B_CONFIG.completenessBonusHigh
    : minimumSupport >= OVR_CANDIDATE_B_CONFIG.completenessThresholdLow
      ? OVR_CANDIDATE_B_CONFIG.completenessBonusLow
      : 0
  const weaknessPenalty = Math.min(OVR_CANDIDATE_B_CONFIG.maximumWeaknessPenalty, support.reduce((sum, key) => sum + Math.max(0, OVR_CANDIDATE_B_CONFIG.weaknessThreshold - player.attributes[key]) * OVR_CANDIDATE_B_CONFIG.weaknessPenaltyPerPoint, 0))
  const rawCandidateValue = rawCurrentValue + specializationPremium + completenessBonus - weaknessPenalty
  return { overall: Math.max(0, Math.min(99, Math.round(rawCandidateValue))), rawCurrentValue, coreAttributes, coreMean, supportMean, specializationPremium, completenessBonus, weaknessPenalty, rawCandidateValue }
}

export function calculateOverallCandidateB(player: Player): number {
  return explainOverallCandidateB(player).overall
}
