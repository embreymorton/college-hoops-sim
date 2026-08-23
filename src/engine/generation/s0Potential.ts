import { calculateOverall, type ClassYear, type Player } from '../domain'
import { createRng, type RngSeed } from '../random'

export const S0_CEILING_TIERS = [
  { name: 'Limited', minimum: 60, maximum: 74 },
  { name: 'Normal', minimum: 75, maximum: 84 },
  { name: 'High', minimum: 85, maximum: 89 },
  { name: 'Very High', minimum: 90, maximum: 94 },
  { name: 'Elite', minimum: 95, maximum: 96 },
  { name: 'Exceptional', minimum: 97, maximum: 99 },
] as const

export type S0CeilingTierName = typeof S0_CEILING_TIERS[number]['name']

export const S0_POTENTIAL_MODEL = {
  namespace: 'college-hoops-sim:s0-pot-direct-conditional-tiers:candidate-b1:v1',
  overallMean: 70.55545806532193,
  overallScale: 9.092821578756068,
  coefficients: [
    [1.9021857650255567, -0.6715607035687718, -0.19155350455171521, 0.5375629667016479, -0.1838011937608783],
    [2.3336808973728322, -0.20126879872912304, -0.08779302855238788, 0.2741529360943029, -0.06704475614178608],
    [0.007639885871567233, 0.34173339134002234, 0.2100142869867048, -0.08773246860216023, -0.10374346792250706],
    [-0.31427475366855695, 0.20759113279017669, 0.06976013514097898, -0.21889005424097727, 0.060371978439063105],
    [-1.3924081767867513, 0.2170561895491594, -0.006829932101047707, -0.30019161685695894, 0.18768290891635733],
    [-2.5368236178146484, 0.10644878861853654, 0.0064020430774669925, -0.20490176309585437, 0.10653453046975103],
  ],
  withinTierWeights: [
    [0.025458946943715956, 0.031407245165566734, 0.03611055073633246, 0.04348828496498458, 0.04902158563647367, 0.05307933946223234, 0.05902763768408312, 0.06612870687916078, 0.07622698060462837, 0.08005418023574166, 0.08807746620940085, 0.0952246462434076, 0.09803740741808122, 0.100342949364535, 0.09831407245165567],
    [0.09655009907961004, 0.09857143668273516, 0.09943447970429421, 0.08935050334713067, 0.09271182879951852, 0.09893482321812845, 0.10213716706128173, 0.10354528988593069, 0.1087689713322091, 0.10999540088916143],
    [0.2219138321995465, 0.2145124716553288, 0.20522448979591837, 0.1843265306122449, 0.17402267573696145],
    [0.23333576163764844, 0.20827566110584977, 0.19215172045360723, 0.18166144581238922, 0.18457541099050534],
    [0.5130609976379047, 0.4869390023620953],
    [0.3436817851079311, 0.3242784380305603, 0.3320397768615086],
  ],
} as const

export function classifyS0CeilingTier(potential: number): S0CeilingTierName {
  const tier = S0_CEILING_TIERS.find(({ minimum, maximum }) => potential >= minimum && potential <= maximum)
  if (!tier) throw new RangeError(`Potential ${potential} is outside the S0 ceiling tiers.`)
  return tier.name
}

export function deriveS0PotentialFeatures(overall: number, classYear: ClassYear): readonly [number, number, number, number, number] {
  const x = (overall - S0_POTENTIAL_MODEL.overallMean) / S0_POTENTIAL_MODEL.overallScale
  const stage = (['FR', 'SO', 'JR', 'SR'].indexOf(classYear) - 1.5) / 1.5
  return [1, x, x * x - 1, stage, x * stage]
}

export function deriveS0TierProbabilities(overall: number, classYear: ClassYear): number[] {
  const features = deriveS0PotentialFeatures(overall, classYear)
  const scores = S0_CEILING_TIERS.map((tier, tierIndex) => tier.maximum < overall
    ? -Infinity
    : S0_POTENTIAL_MODEL.coefficients[tierIndex]!.reduce((sum, coefficient, featureIndex) => sum + coefficient * features[featureIndex]!, 0))
  const maximum = Math.max(...scores)
  const weights = scores.map((score) => score === -Infinity ? 0 : Math.exp(score - maximum))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => weight / total)
}

export function deriveLegalWithinTierProbabilities(overall: number, tierIndex: number): { potentials: number[]; probabilities: number[] } {
  const tier = S0_CEILING_TIERS[tierIndex]
  if (!tier || tier.maximum < overall) throw new RangeError(`Tier ${tierIndex} has no legal POT for OVR ${overall}.`)
  const minimum = Math.max(overall, tier.minimum)
  const potentials = Array.from({ length: tier.maximum - minimum + 1 }, (_, index) => minimum + index)
  const weights = S0_POTENTIAL_MODEL.withinTierWeights[tierIndex]!.slice(minimum - tier.minimum)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return { potentials, probabilities: weights.map((weight) => weight / total) }
}

function drawIndex(probabilities: readonly number[], draw: number): number {
  let remaining = draw
  for (let index = 0; index < probabilities.length; index += 1) {
    remaining -= probabilities[index]!
    if (remaining < 0) return index
  }
  return probabilities.length - 1
}

export function generateS0Potential(input: { overall: number; classYear: ClassYear; universeSeed: RngSeed; programId: string; playerId: string }): number {
  const rng = createRng(JSON.stringify({ namespace: S0_POTENTIAL_MODEL.namespace, ...input }))
  const tierIndex = drawIndex(deriveS0TierProbabilities(input.overall, input.classYear), rng.next())
  const legal = deriveLegalWithinTierProbabilities(input.overall, tierIndex)
  return legal.potentials[drawIndex(legal.probabilities, rng.next())]!
}

export function applyS0Potential(player: Player, universeSeed: RngSeed, programId: string): Player {
  const overall = calculateOverall(player)
  return { ...player, potential: generateS0Potential({ overall, classYear: player.classYear, universeSeed, programId, playerId: player.id }) }
}
