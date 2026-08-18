import { runDynastyCalibration } from './inspectDynastyLongRun'
import type { ProgramPrestigeProjectionOptions } from '../src/dynasty'

const candidates: readonly { label: string; options: ProgramPrestigeProjectionOptions }[] = [
  { label: 'A linear / cap 3', options: { targetMapping: 'linear-range', annualCap: 3 } },
  { label: 'B distribution / cap 2', options: { targetMapping: 'league-distribution', annualCap: 2 } },
  { label: 'B distribution / gap-tier cap 3', options: { targetMapping: 'league-distribution', annualCap: 3 } },
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
  const movements = run.seasons.slice(1).flatMap((season, index) => {
    const prior = new Map(run.seasons[index]!.teams.map((team) => [team.programId, team.prestige]))
    return season.teams.map((team) => team.prestige - prior.get(team.programId)!)
  })
  const final = run.seasons.at(-1)!.teams.map(({ prestige }) => prestige)
  const pine = run.seasons.map((season) => season.teams.find(({ programId }) => programId === 'pine-valley')!.prestige)
  const greatLakes = run.seasons.map((season) => season.teams.find(({ programId }) => programId === 'great-lakes')!.prestige)
  console.log(JSON.stringify({
    candidate: candidate.label,
    movement: {
      changedPercent: movements.filter(Boolean).length / movements.length,
      atCapPercent: movements.filter((value) => Math.abs(value) === candidate.options.annualCap).length / movements.length,
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
