import { runDynastyCalibration } from './inspectDynastyLongRun'
import type { ProgramPrestigeProjectionOptions } from '../src/dynasty'

const candidates: readonly { label: string; options: ProgramPrestigeProjectionOptions }[] = [
  { label: 'Expectation relative 4 / 10 / 16', options: { updateModel: 'expectation-relative', surpriseBands: { deadband: 4, twoPointThreshold: 10, threePointThreshold: 16 } } },
  { label: 'Expectation relative 5 / 11 / 17', options: { updateModel: 'expectation-relative', surpriseBands: { deadband: 5, twoPointThreshold: 11, threePointThreshold: 17 } } },
  { label: 'Expectation relative 4 / 11 / 18', options: { updateModel: 'expectation-relative', surpriseBands: { deadband: 4, twoPointThreshold: 11, threePointThreshold: 18 } } },
  { label: 'Expectation relative 7 / 13 / 19', options: { updateModel: 'expectation-relative', surpriseBands: { deadband: 7, twoPointThreshold: 13, threePointThreshold: 19 } } },
]

function median(values: readonly number[]): number {
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2
}

const selectedIndex = process.argv.indexOf('--candidate')
const seasonsIndex = process.argv.indexOf('--seasons')
const seasons = seasonsIndex >= 0 ? Number(process.argv[seasonsIndex + 1]) : 10
const selected = selectedIndex >= 0
  ? candidates.slice(Number(process.argv[selectedIndex + 1]), Number(process.argv[selectedIndex + 1]) + 1)
  : candidates

for (const candidate of selected) {
  const run = runDynastyCalibration('prestige-v1-candidate', seasons, 'light', candidate.options)
  const movements = run.prestigeTransitions.map(({ change }) => change)
  const final = run.seasons.at(-1)!.teams.map(({ prestige }) => prestige)
  const pine = run.seasons.map((season) => season.teams.find(({ programId }) => programId === 'pine-valley')!.prestige)
  const greatLakes = run.seasons.map((season) => season.teams.find(({ programId }) => programId === 'great-lakes')!.prestige)
  console.log(JSON.stringify({
    candidate: candidate.label,
    movement: {
      changedPercent: movements.filter(Boolean).length / movements.length,
      atCapPercent: movements.filter((value) => Math.abs(value) === (candidate.options.annualCap ?? 3)).length / movements.length,
      minimum: Math.min(...movements),
      maximum: Math.max(...movements),
    },
    final: { mean: final.reduce((sum, value) => sum + value, 0) / final.length, median: median(final), minimum: Math.min(...final), maximum: Math.max(...final) },
    pineValley: pine,
    greatLakes,
    champions: run.champions,
    lifecycleFailures: run.health.lifecycleFailures,
  }))
}
