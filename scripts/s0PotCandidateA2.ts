import { createRng, MIN_PLAYER_RATING, type ClassYear } from '../src/engine'
import { candidatePotWeight } from './s0PotCandidateA'

export const S0_POT_CANDIDATE_A2 = {
  namespace: 'college-hoops-sim:s0-pot-shared-prior-compatibility:candidate-a2:v1',
  realizationLambda: { FR: .5, SO: 1.5, JR: 3, SR: 4.5 },
} as const

export function realizedFraction(overall: number, potential: number): number {
  return (overall - MIN_PLAYER_RATING) / (potential - MIN_PLAYER_RATING)
}

export function candidateA2PotWeight(overall: number, classYear: ClassYear, potential: number): number {
  const inheritedA1Weight = candidatePotWeight(overall, classYear, potential)
  if (inheritedA1Weight === 0) return 0
  const tilt = Math.exp(S0_POT_CANDIDATE_A2.realizationLambda[classYear] * realizedFraction(overall, potential))
  return inheritedA1Weight * tilt
}

export function generateS0PotCandidateA2(input: {
  overall: number
  classYear: ClassYear
  universeSeed: string
  programId: string
  playerId: string
}): number {
  const minimumPotential = Math.max(60, input.overall)
  const options = Array.from({ length: 100 - minimumPotential }, (_, index) => minimumPotential + index)
  const weights = options.map((potential) => candidateA2PotWeight(input.overall, input.classYear, potential))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (!(total > 0)) throw new RangeError('S0 POT Candidate A2 has no legal positive-weight ceiling.')

  let draw = createRng(JSON.stringify({ namespace: S0_POT_CANDIDATE_A2.namespace, ...input })).next() * total
  for (let index = 0; index < options.length; index += 1) {
    draw -= weights[index]!
    if (draw < 0) return options[index]!
  }
  return options.at(-1)!
}
