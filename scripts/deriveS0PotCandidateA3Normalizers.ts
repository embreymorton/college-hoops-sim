import { calculateOverall, type ClassYear } from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { candidatePotWeight } from './s0PotCandidateA'
import { realizedFraction } from './s0PotCandidateA2'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
export const A3_REALIZATION_LAMBDA = { FR: .5, SO: 1.5, JR: 3, SR: 4.5 } as const
export const A3_NORMALIZER_BASELINE = { universes: 500, seed: 's0-pot-candidate-a3-normalizer:v1', polynomialDegree: 3 } as const

export type A3NormalizerDerivation = {
  exact: Record<ClassYear, number[]>
  coefficients: Record<ClassYear, number[]>
  carrierMass: Record<ClassYear, number[]>
}

function solve(matrix: number[][], values: number[]): number[] {
  const rows = matrix.map((row, index) => [...row, values[index]!])
  for (let pivot = 0; pivot < rows.length; pivot += 1) {
    let best = pivot
    for (let row = pivot + 1; row < rows.length; row += 1) if (Math.abs(rows[row]![pivot]!) > Math.abs(rows[best]![pivot]!)) best = row
    ;[rows[pivot], rows[best]] = [rows[best]!, rows[pivot]!]
    const divisor = rows[pivot]![pivot]!
    for (let column = pivot; column <= rows.length; column += 1) rows[pivot]![column]! /= divisor
    for (let row = 0; row < rows.length; row += 1) if (row !== pivot) {
      const factor = rows[row]![pivot]!
      for (let column = pivot; column <= rows.length; column += 1) rows[row]![column]! -= factor * rows[pivot]![column]!
    }
  }
  return rows.map((row) => row.at(-1)!)
}

function fitPolynomial(values: number[], degree: number): number[] {
  const powers = Array.from({ length: degree * 2 + 1 }, (_, power) => values.reduce((sum, _, index) => sum + ((index / 39) ** power), 0))
  const matrix = Array.from({ length: degree + 1 }, (_, row) => Array.from({ length: degree + 1 }, (_, column) => powers[row + column]!))
  const targets = Array.from({ length: degree + 1 }, (_, power) => values.reduce((sum, value, index) => sum + value * ((index / 39) ** power), 0))
  return solve(matrix, targets)
}

export function evaluateA3Normalizer(coefficients: readonly number[], potential: number): number {
  const x = (potential - 60) / 39
  return coefficients.reduce((sum, coefficient, power) => sum + coefficient * (x ** power), 0)
}

export function deriveA3Normalizers(universes: number = A3_NORMALIZER_BASELINE.universes, root: string = A3_NORMALIZER_BASELINE.seed): A3NormalizerDerivation {
  const histograms = Object.fromEntries(YEARS.map((year) => [year, Array<number>(100).fill(0)])) as Record<ClassYear, number[]>
  for (let index = 0; index < universes; index += 1) {
    const universe = initializeUniverse(UNIVERSE_V0, `${root}:${index}`)
    for (const { team } of universe.programs) for (const player of team.roster) histograms[player.classYear]![calculateOverall(player)]! += 1
  }

  const exact = {} as Record<ClassYear, number[]>; const carrierMass = {} as Record<ClassYear, number[]>; const coefficients = {} as Record<ClassYear, number[]>
  for (const year of YEARS) {
    const denominator = Array<number>(40).fill(0); const numerator = Array<number>(40).fill(0)
    for (let overall = 40; overall <= 99; overall += 1) {
      const count = histograms[year]![overall]!
      if (count === 0) continue
      const weights = Array.from({ length: 100 - Math.max(60, overall) }, (_, index) => candidatePotWeight(overall, year, Math.max(60, overall) + index))
      const total = weights.reduce((sum, weight) => sum + weight, 0)
      weights.forEach((weight, index) => {
        const potential = Math.max(60, overall) + index; const jointMass = count * weight / total; const cell = potential - 60
        denominator[cell]! += jointMass
        numerator[cell]! += jointMass * Math.exp(A3_REALIZATION_LAMBDA[year] * realizedFraction(overall, potential))
      })
    }
    carrierMass[year] = denominator
    exact[year] = denominator.map((mass, index) => Math.log(numerator[index]! / mass))
    coefficients[year] = fitPolynomial(exact[year], A3_NORMALIZER_BASELINE.polynomialDegree)
  }
  return { exact, coefficients, carrierMass }
}

export function printA3NormalizerDerivation() {
  const result = deriveA3Normalizers()
  console.log(`# Candidate A3 normalizer derivation\n${JSON.stringify(A3_NORMALIZER_BASELINE)}\nLambda ${JSON.stringify(A3_REALIZATION_LAMBDA)}`)
  for (const year of YEARS) {
    const errors = result.exact[year].map((value, index) => Math.abs(value - evaluateA3Normalizer(result.coefficients[year], index + 60)))
    const worst = errors.indexOf(Math.max(...errors)); const exact = result.exact[year]; const smooth = exact.map((_, index) => evaluateA3Normalizer(result.coefficients[year], index + 60))
    console.log(`${year} coefficients ${JSON.stringify(result.coefficients[year])}`)
    console.log(`${year} exact range ${Math.min(...exact).toFixed(8)}..${Math.max(...exact).toFixed(8)} smooth range ${Math.min(...smooth).toFixed(8)}..${Math.max(...smooth).toFixed(8)} MAE ${(errors.reduce((sum, value) => sum + value, 0) / errors.length).toFixed(8)} max ${errors[worst]!.toFixed(8)} at POT ${worst + 60} carrier mass range ${Math.min(...result.carrierMass[year]).toFixed(2)}..${Math.max(...result.carrierMass[year]).toFixed(2)}`)
    console.log(`${year} representative ${[60, 65, 70, 75, 80, 85, 90, 95, 97, 99].map((potential) => `${potential}:${exact[potential - 60]!.toFixed(6)}/${smooth[potential - 60]!.toFixed(6)}`).join(' ')}`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) printA3NormalizerDerivation()
