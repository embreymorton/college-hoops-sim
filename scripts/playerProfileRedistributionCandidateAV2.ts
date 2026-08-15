import { calculateOverall } from '../src/engine/domain/overall'
import type { Player, PlayerAttributes, Position } from '../src/engine/domain/player'
import { createRng } from '../src/engine/random/rng'
import {
  applyPlayerProfileRedistributionCandidateA,
  CANDIDATE_A_CONFIG,
  type CandidateAProfileKind,
  type CandidateAResult,
} from './playerProfileRedistributionCandidateA'

type Attribute = keyof PlayerAttributes
type WeaknessPair = readonly [Attribute, Attribute]

export const CANDIDATE_A_V2_NAMESPACE =
  'player-profile-redistribution-candidate-a-v2'

/** V2 changes only weakness funding; every V1 selection/value parameter stays fixed. */
export const CANDIDATE_A_V2_WEAKNESS_CONFIG = Object.freeze({
  maximumWeaknessChannels: 2,
  primaryMaximumDecrease: 14,
  secondaryMaximumDecrease: 10,
})

const WEIGHTS: Readonly<Record<Position, Readonly<Record<Attribute, number>>>> = {
  PG: { finishing: .08, shooting: .18, playmaking: .22, ballHandling: .22, perimeterDefense: .14, interiorDefense: .02, rebounding: .03, athleticism: .06, stamina: .05 },
  SG: { finishing: .18, shooting: .24, playmaking: .08, ballHandling: .15, perimeterDefense: .17, interiorDefense: .03, rebounding: .04, athleticism: .07, stamina: .04 },
  SF: { finishing: .14, shooting: .14, playmaking: .10, ballHandling: .10, perimeterDefense: .13, interiorDefense: .10, rebounding: .11, athleticism: .11, stamina: .07 },
  PF: { finishing: .20, shooting: .07, playmaking: .05, ballHandling: .05, perimeterDefense: .07, interiorDefense: .17, rebounding: .19, athleticism: .14, stamina: .06 },
  C: { finishing: .19, shooting: .03, playmaking: .04, ballHandling: .03, perimeterDefense: .05, interiorDefense: .23, rebounding: .23, athleticism: .14, stamina: .06 },
}

const STRENGTHS: Readonly<Record<string, readonly Attribute[]>> = {
  'lead-guard-creator': ['playmaking', 'ballHandling', 'shooting'],
  'point-of-attack-guard': ['perimeterDefense', 'athleticism', 'stamina'],
  'scoring-wing': ['shooting', 'finishing', 'ballHandling'],
  'two-way-stopper': ['perimeterDefense', 'athleticism', 'stamina'],
  'perimeter-wing': ['shooting', 'finishing', 'ballHandling'],
  'defensive-wing': ['perimeterDefense', 'interiorDefense', 'athleticism', 'rebounding'],
  'scoring-forward': ['finishing', 'shooting', 'athleticism'],
  'interior-forward': ['interiorDefense', 'rebounding', 'athleticism'],
  'interior-scorer': ['finishing', 'athleticism', 'rebounding'],
  'rim-protector': ['interiorDefense', 'rebounding', 'athleticism'],
  'rebounding-point-guard': ['rebounding', 'athleticism', 'interiorDefense'],
  'rebounding-combo-guard': ['rebounding', 'interiorDefense', 'athleticism'],
  'point-forward': ['playmaking', 'ballHandling', 'shooting'],
  'playmaking-big': ['playmaking', 'ballHandling', 'shooting'],
}

const WEAKNESS_PAIRS: Readonly<Record<string, readonly WeaknessPair[]>> = {
  'lead-guard-creator': [['perimeterDefense', 'stamina'], ['perimeterDefense', 'finishing']],
  'point-of-attack-guard': [['shooting', 'playmaking'], ['shooting', 'ballHandling']],
  'scoring-wing': [['perimeterDefense', 'playmaking'], ['perimeterDefense', 'rebounding']],
  'two-way-stopper': [['shooting', 'finishing'], ['shooting', 'ballHandling']],
  'perimeter-wing': [['interiorDefense', 'rebounding'], ['perimeterDefense', 'rebounding']],
  'defensive-wing': [['shooting', 'finishing'], ['shooting', 'ballHandling']],
  'scoring-forward': [['interiorDefense', 'rebounding'], ['interiorDefense', 'perimeterDefense']],
  'interior-forward': [['finishing', 'shooting'], ['finishing', 'perimeterDefense']],
  'interior-scorer': [['interiorDefense', 'perimeterDefense'], ['interiorDefense', 'shooting']],
  'rim-protector': [['finishing', 'shooting'], ['finishing', 'perimeterDefense']],
  'rebounding-point-guard': [['shooting', 'playmaking'], ['shooting', 'ballHandling']],
  'rebounding-combo-guard': [['shooting', 'ballHandling'], ['shooting', 'finishing']],
  'point-forward': [['rebounding', 'interiorDefense'], ['rebounding', 'perimeterDefense']],
  'playmaking-big': [['rebounding', 'interiorDefense'], ['rebounding', 'finishing']],
}

export interface CandidateAV2Result extends CandidateAResult {
  readonly weaknessChannels?: WeaknessPair
  readonly changedStrengths: readonly Attribute[]
  readonly changedWeaknesses: readonly Attribute[]
}

/**
 * Pure V2 diagnostic transform. V1 fixes selection/kind/path; a separate V2
 * namespace chooses one semantic weakness pair and never expands beyond it.
 */
export function applyPlayerProfileRedistributionCandidateAV2(player: Player): CandidateAV2Result {
  const v1 = applyPlayerProfileRedistributionCandidateA(player)
  if (!v1.selected || !v1.kind || !v1.path) {
    return { ...v1, changedStrengths: [], changedWeaknesses: [] }
  }

  const kind: CandidateAProfileKind = v1.kind
  const strengths = STRENGTHS[v1.path]
  const weaknessPairs = WEAKNESS_PAIRS[v1.path]
  if (!strengths || !weaknessPairs) throw new Error(`Missing V2 profile path: ${v1.path}`)
  const rng = createRng(`${CANDIDATE_A_V2_NAMESPACE}:${player.id}`)
  const weaknessChannels = rng.pick(weaknessPairs)
  const attributes = { ...player.attributes }
  const starts = { ...player.attributes }
  const weights = WEIGHTS[player.position]
  const configuredBudget = kind === 'conventional'
    ? CANDIDATE_A_CONFIG.conventionalBudget
    : CANDIDATE_A_CONFIG.unusualSecondaryBudget
  const absorbable = strengths.reduce((sum, attribute) =>
    sum + Math.min(CANDIDATE_A_CONFIG.maximumAttributeIncrease, CANDIDATE_A_CONFIG.attributeCap - starts[attribute]) * weights[attribute], 0)
  const weaknessLimits = [
    CANDIDATE_A_V2_WEAKNESS_CONFIG.primaryMaximumDecrease,
    CANDIDATE_A_V2_WEAKNESS_CONFIG.secondaryMaximumDecrease,
  ] as const
  const fundable = weaknessChannels.reduce((sum, attribute, index) =>
    sum + Math.min(weaknessLimits[index], starts[attribute] - CANDIDATE_A_CONFIG.attributeFloor) * weights[attribute], 0)
  const budget = Math.min(configuredBudget, absorbable, fundable)
  let weightedRemoved = 0
  let weightedAdded = 0

  for (let pass = 0; pass < 100 && weightedRemoved < budget - 1e-9; pass += 1) {
    const channelIndex = pass % weaknessChannels.length
    const attribute = weaknessChannels[channelIndex]!
    if (starts[attribute] - attributes[attribute] < weaknessLimits[channelIndex] && attributes[attribute] > CANDIDATE_A_CONFIG.attributeFloor) {
      attributes[attribute] -= 1
      weightedRemoved += weights[attribute]
    }
  }
  for (let pass = 0; pass < 200; pass += 1) {
    const attribute = strengths[(pass + rng.int(0, strengths.length - 1)) % strengths.length]!
    const weight = weights[attribute]
    if (weightedAdded + weight > weightedRemoved + 1e-9) continue
    if (attributes[attribute] < CANDIDATE_A_CONFIG.attributeCap && attributes[attribute] - starts[attribute] < CANDIDATE_A_CONFIG.maximumAttributeIncrease) {
      attributes[attribute] += 1
      weightedAdded += weight
    }
  }

  const changedStrengths = strengths.filter((name) => attributes[name] > starts[name])
  const changedWeaknesses = weaknessChannels.filter((name) => attributes[name] < starts[name])
  const baselineOverall = calculateOverall(player)
  const candidate = { ...player, attributes }
  const candidateOverall = calculateOverall(candidate)
  if (changedStrengths.length < 2 || changedWeaknesses.length < 1 || weightedRemoved <= 0 || Math.abs(candidateOverall - baselineOverall) > CANDIDATE_A_CONFIG.maximumOverallDelta) {
    return { player, eligible: true, selected: true, applied: false, kind, path: v1.path, baselineOverall, candidateOverall: baselineOverall, weightedRemoved: 0, weightedAdded: 0, skipReason: Math.abs(candidateOverall - baselineOverall) > 1 ? 'overall-guardrail' : 'bounds', weaknessChannels, changedStrengths: [], changedWeaknesses: [] }
  }
  return { player: candidate, eligible: true, selected: true, applied: true, kind, path: v1.path, baselineOverall, candidateOverall, weightedRemoved, weightedAdded, weaknessChannels, changedStrengths, changedWeaknesses }
}
