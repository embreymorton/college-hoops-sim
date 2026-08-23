import { createRng, type ClassYear } from '../src/engine'
import { candidatePotWeight } from './s0PotCandidateA'
import { realizedFraction } from './s0PotCandidateA2'
import { A3_REALIZATION_LAMBDA, evaluateA3Normalizer } from './deriveS0PotCandidateA3Normalizers'

export const S0_POT_CANDIDATE_A3 = {
  namespace: 'college-hoops-sim:s0-pot-shared-prior-compatibility:candidate-a3:v1',
  realizationLambda: A3_REALIZATION_LAMBDA,
  normalizerBaseline: '500 S0 universes; s0-pot-candidate-a3-normalizer:v1; exact A1 posterior carrier mass',
  normalizerPolynomialDegree: 3,
  normalizerCoefficients: {
    FR: [0.41279182047345875, -0.12685996032426777, 0.1450673120912411, -0.11807895186883917],
    SO: [1.2910621150782702, -0.22511652953095765, 0.16408903368573846, -0.21829073631440707],
    JR: [2.6829674953058467, -0.3363849892340703, 0.2584933003184845, -0.4190248056258728],
    SR: [4.133669611057333, -0.4413148671078518, 0.4681798159609759, -0.7732867621411765],
  },
} as const

export function candidateA3RealizationTilt(overall: number, classYear: ClassYear, potential: number): number {
  const normalizer = evaluateA3Normalizer(S0_POT_CANDIDATE_A3.normalizerCoefficients[classYear], potential)
  return Math.exp(S0_POT_CANDIDATE_A3.realizationLambda[classYear] * realizedFraction(overall, potential) - normalizer)
}

export function candidateA3PotWeight(overall: number, classYear: ClassYear, potential: number): number {
  const inheritedA1Weight = candidatePotWeight(overall, classYear, potential)
  if (inheritedA1Weight === 0) return 0
  return inheritedA1Weight * candidateA3RealizationTilt(overall, classYear, potential)
}

export function generateS0PotCandidateA3(input: { overall: number; classYear: ClassYear; universeSeed: string; programId: string; playerId: string }): number {
  const minimumPotential = Math.max(60, input.overall)
  const options = Array.from({ length: 100 - minimumPotential }, (_, index) => minimumPotential + index)
  const weights = options.map((potential) => candidateA3PotWeight(input.overall, input.classYear, potential))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (!(total > 0)) throw new RangeError('S0 POT Candidate A3 has no legal positive-weight ceiling.')
  let draw = createRng(JSON.stringify({ namespace: S0_POT_CANDIDATE_A3.namespace, ...input })).next() * total
  for (let index = 0; index < options.length; index += 1) {
    draw -= weights[index]!
    if (draw < 0) return options[index]!
  }
  return options.at(-1)!
}
