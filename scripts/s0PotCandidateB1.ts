import { createRng, S0_CEILING_TIERS, type ClassYear } from '../src/engine'

export const B1_TIERS = S0_CEILING_TIERS

export type B1TierName = typeof B1_TIERS[number]['name']
export type B1Observation = { overall: number; stage: number; potential: number }
export type B1Model = {
  overallMean: number
  overallScale: number
  coefficients: number[][]
  withinTierWeights: number[][]
  iterations: number
  finalLoss: number
}

export const S0_POT_CANDIDATE_B1 = {
  namespace: 'college-hoops-sim:s0-pot-direct-conditional-tiers:candidate-b1:v1',
  features: ['intercept', 'centered OVR', 'centered OVR squared', 'ordered stage', 'OVR × stage'],
  stage: '(stage - 1.5) / 1.5',
  fitIterations: 5_000,
  learningRate: .025,
  l2: 1e-4,
  pseudoCount: .5,
} as const

export function b1TierIndex(potential: number): number {
  const index = B1_TIERS.findIndex(({ minimum, maximum }) => potential >= minimum && potential <= maximum)
  if (index < 0) throw new RangeError(`Potential ${potential} is outside the B1 semantic tiers.`)
  return index
}

export function b1Features(overall: number, stage: number, model: Pick<B1Model, 'overallMean' | 'overallScale'>): number[] {
  const x = (overall - model.overallMean) / model.overallScale
  const s = (stage - 1.5) / 1.5
  return [1, x, x * x - 1, s, x * s]
}

function legalTier(tierIndex: number, overall: number): boolean {
  return B1_TIERS[tierIndex]!.maximum >= overall
}

export function b1TierProbabilities(overall: number, stage: number, model: B1Model): number[] {
  const features = b1Features(overall, stage, model)
  const scores = B1_TIERS.map((_, tierIndex) => legalTier(tierIndex, overall)
    ? model.coefficients[tierIndex]!.reduce((sum, coefficient, featureIndex) => sum + coefficient * features[featureIndex]!, 0)
    : -Infinity)
  const maximum = Math.max(...scores)
  const weights = scores.map((score) => score === -Infinity ? 0 : Math.exp(score - maximum))
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return weights.map((weight) => weight / total)
}

type Cell = { overall: number; stage: number; counts: number[]; total: number }

function aggregate(observations: readonly B1Observation[]): Cell[] {
  const cells = new Map<string, Cell>()
  for (const observation of observations) {
    const key = `${observation.stage}:${observation.overall}`
    const cell = cells.get(key) ?? { overall: observation.overall, stage: observation.stage, counts: Array<number>(B1_TIERS.length).fill(0), total: 0 }
    cell.counts[b1TierIndex(observation.potential)]! += 1
    cell.total += 1
    cells.set(key, cell)
  }
  return [...cells.values()].sort((a, b) => a.stage - b.stage || a.overall - b.overall)
}

function lossAndGradient(cells: readonly Cell[], model: B1Model): { loss: number; gradient: number[][] } {
  const gradient = B1_TIERS.map(() => Array<number>(S0_POT_CANDIDATE_B1.features.length).fill(0))
  const observations = cells.reduce((sum, cell) => sum + cell.total, 0)
  let loss = 0
  for (const cell of cells) {
    const probabilities = b1TierProbabilities(cell.overall, cell.stage, model)
    const features = b1Features(cell.overall, cell.stage, model)
    for (let tierIndex = 0; tierIndex < B1_TIERS.length; tierIndex += 1) {
      const count = cell.counts[tierIndex]!
      if (count) loss -= count * Math.log(Math.max(probabilities[tierIndex]!, 1e-300))
      const error = probabilities[tierIndex]! * cell.total - count
      for (let featureIndex = 0; featureIndex < features.length; featureIndex += 1) gradient[tierIndex]![featureIndex]! += error * features[featureIndex]! / observations
    }
  }
  loss /= observations
  for (let tierIndex = 0; tierIndex < B1_TIERS.length; tierIndex += 1) for (let featureIndex = 0; featureIndex < S0_POT_CANDIDATE_B1.features.length; featureIndex += 1) {
    const coefficient = model.coefficients[tierIndex]![featureIndex]!
    loss += .5 * S0_POT_CANDIDATE_B1.l2 * coefficient * coefficient
    gradient[tierIndex]![featureIndex]! += S0_POT_CANDIDATE_B1.l2 * coefficient
  }
  return { loss, gradient }
}

export function fitS0PotCandidateB1(observations: readonly B1Observation[], iterations: number = S0_POT_CANDIDATE_B1.fitIterations): B1Model {
  if (!observations.length) throw new RangeError('B1 requires fit observations.')
  const overallMean = observations.reduce((sum, row) => sum + row.overall, 0) / observations.length
  const overallScale = Math.sqrt(observations.reduce((sum, row) => sum + (row.overall - overallMean) ** 2, 0) / observations.length)
  const withinCounts = B1_TIERS.map(({ maximum, minimum }) => Array<number>(maximum - minimum + 1).fill(S0_POT_CANDIDATE_B1.pseudoCount))
  for (const row of observations) { const tier = b1TierIndex(row.potential); withinCounts[tier]![row.potential - B1_TIERS[tier]!.minimum]! += 1 }
  const withinTierWeights = withinCounts.map((counts) => { const total = counts.reduce((sum, count) => sum + count, 0); return counts.map((count) => count / total) })
  const model: B1Model = { overallMean, overallScale, coefficients: B1_TIERS.map(() => Array<number>(S0_POT_CANDIDATE_B1.features.length).fill(0)), withinTierWeights, iterations, finalLoss: Infinity }
  const firstMoment = model.coefficients.map((row) => row.map(() => 0)); const secondMoment = model.coefficients.map((row) => row.map(() => 0))
  const cells = aggregate(observations); const beta1 = .9; const beta2 = .999
  for (let iteration = 1; iteration <= iterations; iteration += 1) {
    const result = lossAndGradient(cells, model); model.finalLoss = result.loss
    for (let tier = 0; tier < B1_TIERS.length; tier += 1) for (let feature = 0; feature < S0_POT_CANDIDATE_B1.features.length; feature += 1) {
      const gradient = result.gradient[tier]![feature]!
      firstMoment[tier]![feature] = beta1 * firstMoment[tier]![feature]! + (1 - beta1) * gradient
      secondMoment[tier]![feature] = beta2 * secondMoment[tier]![feature]! + (1 - beta2) * gradient * gradient
      const m = firstMoment[tier]![feature]! / (1 - beta1 ** iteration); const v = secondMoment[tier]![feature]! / (1 - beta2 ** iteration)
      model.coefficients[tier]![feature]! -= S0_POT_CANDIDATE_B1.learningRate * m / (Math.sqrt(v) + 1e-8)
    }
    for (let feature = 0; feature < S0_POT_CANDIDATE_B1.features.length; feature += 1) {
      const center = model.coefficients.reduce((sum, row) => sum + row[feature]!, 0) / B1_TIERS.length
      model.coefficients.forEach((row) => { row[feature]! -= center })
    }
  }
  model.finalLoss = lossAndGradient(cells, model).loss
  return model
}

function drawIndex(probabilities: readonly number[], draw: number): number {
  let remaining = draw
  for (let index = 0; index < probabilities.length; index += 1) { remaining -= probabilities[index]!; if (remaining < 0) return index }
  return probabilities.length - 1
}

export function generateS0PotCandidateB1(input: { overall: number; classYear: ClassYear; universeSeed: string; programId: string; playerId: string }, model: B1Model): number {
  const stage = ['FR', 'SO', 'JR', 'SR'].indexOf(input.classYear)
  const rng = createRng(JSON.stringify({ namespace: S0_POT_CANDIDATE_B1.namespace, ...input }))
  const tierIndex = drawIndex(b1TierProbabilities(input.overall, stage, model), rng.next())
  const tier = B1_TIERS[tierIndex]!; const legalMinimum = Math.max(input.overall, tier.minimum)
  const weights = model.withinTierWeights[tierIndex]!.slice(legalMinimum - tier.minimum)
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  return legalMinimum + drawIndex(weights.map((weight) => weight / total), rng.next())
}
