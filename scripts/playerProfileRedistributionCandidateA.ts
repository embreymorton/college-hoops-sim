import { calculateOverall } from '../src/engine/domain/overall'
import type {
  Player,
  PlayerAttributes,
  Position,
} from '../src/engine/domain/player'
import { createRng } from '../src/engine/random/rng'

type Attribute = keyof PlayerAttributes
export type CandidateAProfileKind = 'conventional' | 'unusual-secondary'

export const CANDIDATE_A_NAMESPACE =
  'player-profile-redistribution-candidate-a-v1'

/** Frozen before the first experimental run on 2026-08-14. */
export const CANDIDATE_A_CONFIG = Object.freeze({
  minimumOverall: 70,
  selectionProbabilityAtMinimum: 0.02,
  selectionProbabilityPerOverall: 0.005,
  maximumSelectionProbability: 0.15,
  unusualSecondaryShare: 0.08,
  conventionalBudget: 4,
  unusualSecondaryBudget: 3,
  maximumAttributeIncrease: 12,
  maximumAttributeDecrease: 18,
  attributeFloor: 45,
  attributeCap: 99,
  maximumOverallDelta: 1,
})

const WEIGHTS: Readonly<Record<Position, Readonly<Record<Attribute, number>>>> = {
  PG: { finishing: .08, shooting: .18, playmaking: .22, ballHandling: .22, perimeterDefense: .14, interiorDefense: .02, rebounding: .03, athleticism: .06, stamina: .05 },
  SG: { finishing: .18, shooting: .24, playmaking: .08, ballHandling: .15, perimeterDefense: .17, interiorDefense: .03, rebounding: .04, athleticism: .07, stamina: .04 },
  SF: { finishing: .14, shooting: .14, playmaking: .10, ballHandling: .10, perimeterDefense: .13, interiorDefense: .10, rebounding: .11, athleticism: .11, stamina: .07 },
  PF: { finishing: .20, shooting: .07, playmaking: .05, ballHandling: .05, perimeterDefense: .07, interiorDefense: .17, rebounding: .19, athleticism: .14, stamina: .06 },
  C: { finishing: .19, shooting: .03, playmaking: .04, ballHandling: .03, perimeterDefense: .05, interiorDefense: .23, rebounding: .23, athleticism: .14, stamina: .06 },
}

interface Path { readonly name: string; readonly strengths: readonly Attribute[]; readonly weaknesses: readonly Attribute[] }

const CONVENTIONAL_PATHS: Readonly<Record<Position, readonly Path[]>> = {
  PG: [
    { name: 'lead-guard-creator', strengths: ['playmaking', 'ballHandling', 'shooting'], weaknesses: ['rebounding', 'interiorDefense', 'finishing', 'stamina'] },
    { name: 'point-of-attack-guard', strengths: ['perimeterDefense', 'athleticism', 'stamina'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'finishing'] },
  ],
  SG: [
    { name: 'scoring-wing', strengths: ['shooting', 'finishing', 'ballHandling'], weaknesses: ['rebounding', 'interiorDefense', 'playmaking', 'stamina'] },
    { name: 'two-way-stopper', strengths: ['perimeterDefense', 'athleticism', 'stamina'], weaknesses: ['shooting', 'finishing', 'ballHandling', 'playmaking'] },
  ],
  SF: [
    { name: 'perimeter-wing', strengths: ['shooting', 'finishing', 'ballHandling'], weaknesses: ['interiorDefense', 'rebounding', 'perimeterDefense', 'stamina'] },
    { name: 'defensive-wing', strengths: ['perimeterDefense', 'interiorDefense', 'athleticism', 'rebounding'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'finishing'] },
  ],
  PF: [
    { name: 'scoring-forward', strengths: ['finishing', 'shooting', 'athleticism'], weaknesses: ['perimeterDefense', 'interiorDefense', 'rebounding', 'stamina'] },
    { name: 'interior-forward', strengths: ['interiorDefense', 'rebounding', 'athleticism'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'perimeterDefense'] },
  ],
  C: [
    { name: 'interior-scorer', strengths: ['finishing', 'athleticism', 'rebounding'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'perimeterDefense'] },
    { name: 'rim-protector', strengths: ['interiorDefense', 'rebounding', 'athleticism'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'finishing'] },
  ],
}

const UNUSUAL_PATHS: Readonly<Record<Position, readonly Path[]>> = {
  PG: [{ name: 'rebounding-point-guard', strengths: ['rebounding', 'athleticism', 'interiorDefense'], weaknesses: ['shooting', 'playmaking', 'ballHandling', 'perimeterDefense'] }],
  SG: [{ name: 'rebounding-combo-guard', strengths: ['rebounding', 'interiorDefense', 'athleticism'], weaknesses: ['shooting', 'finishing', 'ballHandling', 'perimeterDefense'] }],
  SF: [{ name: 'point-forward', strengths: ['playmaking', 'ballHandling', 'shooting'], weaknesses: ['rebounding', 'interiorDefense', 'perimeterDefense', 'finishing'] }],
  PF: [{ name: 'point-forward', strengths: ['playmaking', 'ballHandling', 'shooting'], weaknesses: ['rebounding', 'interiorDefense', 'perimeterDefense', 'finishing'] }],
  C: [{ name: 'playmaking-big', strengths: ['playmaking', 'ballHandling', 'shooting'], weaknesses: ['rebounding', 'interiorDefense', 'finishing', 'athleticism'] }],
}

export interface CandidateAResult {
  readonly player: Player
  readonly eligible: boolean
  readonly selected: boolean
  readonly applied: boolean
  readonly kind?: CandidateAProfileKind
  readonly path?: string
  readonly baselineOverall: number
  readonly candidateOverall: number
  readonly weightedRemoved: number
  readonly weightedAdded: number
  readonly skipReason?: 'not-eligible' | 'not-selected' | 'bounds' | 'overall-guardrail'
}

export function candidateASelectionProbability(overall: number): number {
  if (overall < CANDIDATE_A_CONFIG.minimumOverall) return 0
  return Math.min(
    CANDIDATE_A_CONFIG.maximumSelectionProbability,
    CANDIDATE_A_CONFIG.selectionProbabilityAtMinimum +
      (overall - CANDIDATE_A_CONFIG.minimumOverall) *
        CANDIDATE_A_CONFIG.selectionProbabilityPerOverall,
  )
}

/** Pure, isolated experimental transform. It never adds a persistent archetype field. */
export function applyPlayerProfileRedistributionCandidateA(player: Player): CandidateAResult {
  const baselineOverall = calculateOverall(player)
  const probability = candidateASelectionProbability(baselineOverall)
  if (probability === 0) return unchanged(player, baselineOverall, 'not-eligible')

  const rng = createRng(`${CANDIDATE_A_NAMESPACE}:${player.id}`)
  if (!rng.chance(probability)) return unchanged(player, baselineOverall, 'not-selected', true)

  const kind: CandidateAProfileKind = rng.chance(CANDIDATE_A_CONFIG.unusualSecondaryShare)
    ? 'unusual-secondary'
    : 'conventional'
  const paths = kind === 'conventional' ? CONVENTIONAL_PATHS[player.position] : UNUSUAL_PATHS[player.position]
  const path = rng.pick(paths)
  const configuredBudget = kind === 'conventional' ? CANDIDATE_A_CONFIG.conventionalBudget : CANDIDATE_A_CONFIG.unusualSecondaryBudget
  const attributes = { ...player.attributes }
  const starts = { ...player.attributes }
  const weights = WEIGHTS[player.position]
  // The preregistered budget is a ceiling. Shrink it before transferring when
  // strength caps/per-attribute bounds cannot absorb the full weighted value.
  const absorbable = path.strengths.reduce((sum, attribute) => sum + Math.min(CANDIDATE_A_CONFIG.maximumAttributeIncrease, CANDIDATE_A_CONFIG.attributeCap - starts[attribute]) * weights[attribute], 0)
  const budget = Math.min(configuredBudget, absorbable)
  let weightedRemoved = 0
  let weightedAdded = 0

  for (let pass = 0; pass < 200 && weightedRemoved < budget; pass += 1) {
    const attribute = path.weaknesses[(pass + rng.int(0, path.weaknesses.length - 1)) % path.weaknesses.length] as Attribute
    if (attributes[attribute] > CANDIDATE_A_CONFIG.attributeFloor && starts[attribute] - attributes[attribute] < CANDIDATE_A_CONFIG.maximumAttributeDecrease) {
      attributes[attribute] -= 1
      weightedRemoved += weights[attribute]
    }
  }
  for (let pass = 0; pass < 200; pass += 1) {
    const attribute = path.strengths[(pass + rng.int(0, path.strengths.length - 1)) % path.strengths.length] as Attribute
    const weight = weights[attribute]
    if (weightedAdded + weight > weightedRemoved + 1e-9) continue
    if (attributes[attribute] < CANDIDATE_A_CONFIG.attributeCap && attributes[attribute] - starts[attribute] < CANDIDATE_A_CONFIG.maximumAttributeIncrease) {
      attributes[attribute] += 1
      weightedAdded += weight
    }
  }

  const raised = path.strengths.filter((name) => attributes[name] > starts[name]).length
  const lowered = path.weaknesses.filter((name) => attributes[name] < starts[name]).length
  if (raised < 2 || lowered < 2 || weightedRemoved < budget * .8) {
    return { ...unchanged(player, baselineOverall, 'bounds', true), selected: true, kind, path: path.name }
  }
  const candidate = { ...player, attributes }
  const candidateOverall = calculateOverall(candidate)
  if (Math.abs(candidateOverall - baselineOverall) > CANDIDATE_A_CONFIG.maximumOverallDelta) {
    return { ...unchanged(player, baselineOverall, 'overall-guardrail', true), selected: true, kind, path: path.name }
  }
  return { player: candidate, eligible: true, selected: true, applied: true, kind, path: path.name, baselineOverall, candidateOverall, weightedRemoved, weightedAdded }
}

function unchanged(player: Player, overall: number, skipReason: CandidateAResult['skipReason'], eligible = false): CandidateAResult {
  return { player, eligible, selected: false, applied: false, baselineOverall: overall, candidateOverall: overall, weightedRemoved: 0, weightedAdded: 0, skipReason }
}
