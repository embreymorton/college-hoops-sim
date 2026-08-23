import { calculateOverall, type ClassYear } from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { collectEndogenousPotReference } from './inspectEndogenousPotReference'
import { candidateA2PotWeight } from './s0PotCandidateA2'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
const POTS = Array.from({ length: 40 }, (_, index) => index + 60)
export const A4_CALIBRATION = {
  targetClasses: 1000,
  targetSeed: 's0-pot-candidate-a4-target:v1',
  targetPseudoCount: .5,
  universes: 1000,
  primarySeed: 's0-pot-candidate-a4-calibration:v1',
  robustnessSeed: 's0-pot-candidate-a4-calibration-robustness:v1',
  damping: .5,
  maximumIterations: 20000,
  absoluteTolerance: 1e-10,
  relativeTolerance: 1e-7,
  relativeSupport: 1e-5,
} as const

export type OvrHistograms = Record<ClassYear, number[]>
export type FactorSolution = { theta: number[]; marginal: number[]; iterations: number; maxAbsoluteError: number; maxRelativeError: number }

export function collectS0OvrHistograms(universes: number, root: string): OvrHistograms {
  const histograms = Object.fromEntries(YEARS.map((year) => [year, Array<number>(100).fill(0)])) as OvrHistograms
  for (let index = 0; index < universes; index += 1) {
    const universe = initializeUniverse(UNIVERSE_V0, `${root}:${index}`)
    for (const { team } of universe.programs) for (const player of team.roster) histograms[player.classYear]![calculateOverall(player)]! += 1
  }
  return histograms
}

export function deriveA4Target(classes = A4_CALIBRATION.targetClasses, root = A4_CALIBRATION.targetSeed): { target: number[]; recruits: number } {
  const rows = collectEndogenousPotReference(classes, root).stages[0]!
  const counts = POTS.map((potential) => rows.filter((row) => row.potential === potential).length + A4_CALIBRATION.targetPseudoCount)
  const total = counts.reduce((sum, count) => sum + count, 0)
  return { target: counts.map((count) => count / total), recruits: rows.length }
}

export function a4RowProbabilities(overall: number, year: ClassYear, theta: readonly number[]): number[] {
  const logWeights = POTS.map((potential, index) => potential < overall ? -Infinity : Math.log(candidateA2PotWeight(overall, year, potential)) + theta[index]!)
  const maximum = Math.max(...logWeights); const weights = logWeights.map((value) => value === -Infinity ? 0 : Math.exp(value - maximum)); const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((value) => value / total)
}

export function expectedA4Marginal(histogram: readonly number[], year: ClassYear, theta: readonly number[]): number[] {
  const marginal = Array<number>(POTS.length).fill(0); const totalPlayers = histogram.reduce((sum, count) => sum + count, 0)
  histogram.forEach((count, overall) => { if (!count) return; a4RowProbabilities(overall, year, theta).forEach((probability, index) => { marginal[index]! += count * probability / totalPlayers }) })
  return marginal
}

export function solveA4Factors(histogram: readonly number[], year: ClassYear, target: readonly number[]): FactorSolution {
  const theta = Array<number>(POTS.length).fill(0)
  for (let iteration = 1; iteration <= A4_CALIBRATION.maximumIterations; iteration += 1) {
    const marginal = expectedA4Marginal(histogram, year, theta)
    const absoluteErrors = marginal.map((value, index) => Math.abs(value - target[index]!))
    const relativeErrors = marginal.map((value, index) => target[index]! >= A4_CALIBRATION.relativeSupport ? Math.abs(value / target[index]! - 1) : 0)
    const maxAbsoluteError = Math.max(...absoluteErrors); const maxRelativeError = Math.max(...relativeErrors)
    if (maxAbsoluteError < A4_CALIBRATION.absoluteTolerance && maxRelativeError < A4_CALIBRATION.relativeTolerance) return { theta, marginal, iterations: iteration, maxAbsoluteError, maxRelativeError }
    theta.forEach((value, index) => { theta[index] = value + A4_CALIBRATION.damping * Math.log(target[index]! / marginal[index]!) })
    const center = theta.reduce((sum, value, index) => sum + value * target[index]!, 0)
    theta.forEach((value, index) => { theta[index] = value - center })
  }
  const marginal = expectedA4Marginal(histogram, year, theta); const maxAbsoluteError = Math.max(...marginal.map((value, index) => Math.abs(value - target[index]!))); const maxRelativeError = Math.max(...marginal.map((value, index) => target[index]! >= A4_CALIBRATION.relativeSupport ? Math.abs(value / target[index]! - 1) : 0))
  throw new Error(`A4 ${year} factor solve failed after ${A4_CALIBRATION.maximumIterations} iterations: absolute ${maxAbsoluteError}, relative ${maxRelativeError}`)
}

export function checkA4Feasibility(histogram: readonly number[], target: readonly number[]) {
  const total = histogram.reduce((sum, count) => sum + count, 0); let minimumSlack = Infinity; let threshold = 60
  for (let value = 60; value <= 99; value += 1) {
    const targetTail = target.slice(value - 60).reduce((sum, probability) => sum + probability, 0)
    const overallTail = histogram.slice(value).reduce((sum, count) => sum + count, 0) / total
    const slack = targetTail - overallTail
    if (slack < minimumSlack) { minimumSlack = slack; threshold = value }
  }
  return { feasible: minimumSlack >= -1e-12, minimumSlack, threshold }
}

export function deriveA4FactorSet(universes: number, seed: string, target: readonly number[]) {
  const histograms = collectS0OvrHistograms(universes, seed)
  const solutions = Object.fromEntries(YEARS.map((year) => [year, solveA4Factors(histograms[year], year, target)])) as Record<ClassYear, FactorSolution>
  return { histograms, solutions }
}

export function printA4FactorDerivation() {
  const { target, recruits } = deriveA4Target(); const primary = deriveA4FactorSet(A4_CALIBRATION.universes, A4_CALIBRATION.primarySeed, target); const robust = deriveA4FactorSet(A4_CALIBRATION.universes, A4_CALIBRATION.robustnessSeed, target)
  console.log(`# Candidate A4 factor derivation\n${JSON.stringify(A4_CALIBRATION)}\nTarget recruits ${recruits}; vector ${JSON.stringify(target)}`)
  console.log(`Target mean ${POTS.reduce((sum, potential, index) => sum + potential * target[index]!, 0).toFixed(4)} thresholds ${[80, 85, 90, 95, 97, 99].map((threshold) => `${threshold}:${(target.slice(threshold - 60).reduce((sum, value) => sum + value, 0) * 100).toFixed(4)}%`).join(' ')}`)
  for (const year of YEARS) {
    const solution = primary.solutions[year]; const other = robust.solutions[year]; const factors = solution.theta.map(Math.exp); const differences = solution.theta.map((value, index) => Math.abs(value - other.theta[index]!)); const feasibility = checkA4Feasibility(primary.histograms[year], target); const counts = primary.histograms[year]; const values = counts.flatMap((count, overall) => Array<number>(count).fill(overall))
    const adjacent = solution.theta.slice(1).map((value, index) => Math.abs(value - solution.theta[index]!)); const worst = differences.indexOf(Math.max(...differences))
    console.log(`${year} N ${counts.reduce((sum, count) => sum + count, 0)} OVR mean/med/p90/max ${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)}/${values.sort((a,b)=>a-b)[Math.floor(values.length*.5)]}/${values[Math.floor(values.length*.9)]}/${values.at(-1)} feasible ${feasibility.feasible} slack ${feasibility.minimumSlack.toFixed(8)} at ${feasibility.threshold}`)
    const sortedTheta = [...solution.theta].sort((a, b) => a - b); const sortedFactors = [...factors].sort((a, b) => a - b)
    console.log(`${year} iterations ${solution.iterations} abs ${solution.maxAbsoluteError.toExponential(3)} rel ${solution.maxRelativeError.toExponential(3)} theta ${Math.min(...solution.theta).toFixed(4)}/${sortedTheta[20]!.toFixed(4)}/${Math.max(...solution.theta).toFixed(4)} factor ${Math.min(...factors).toFixed(4)}/${sortedFactors[20]!.toFixed(4)}/${Math.max(...factors).toFixed(4)} maxAdjacent ${Math.max(...adjacent).toFixed(4)}`)
    console.log(`${year} factors ${[75,80,85,90,95,97,98,99].map((potential)=>`${potential}:${Math.exp(solution.theta[potential-60]!).toFixed(4)}`).join(' ')} robust MAE ${average(differences).toFixed(6)} max ${differences[worst]!.toFixed(6)} at ${worst+60} tails ${[95,97,99].map((potential)=>`${potential}:${differences[potential-60]!.toFixed(6)}`).join(' ')}`)
    console.log(`${year} theta ${JSON.stringify(solution.theta)}`)
  }
}

const average = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
if (import.meta.url === `file://${process.argv[1]}`) printA4FactorDerivation()
