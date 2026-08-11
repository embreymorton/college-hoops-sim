import { pathToFileURL } from 'node:url'
import { calibrationSeeds, resolveLongRunCliConfig } from './calibration/presets'
import { runLongRunCalibration } from './inspectDynastyLongRun'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'
import {
  MINUTE_BANDS,
  partitionRotationMinuteObservations,
  summarizeRotationMinutes,
  type CountRate,
  type RotationMinutesSummary,
} from './rotationMinutesRealismMetrics'

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function ratio(value: CountRate): string {
  return `${value.count}/${value.total} (${percent(value.rate)})`
}

function printSummary(label: string, summary: RotationMinutesSummary): void {
  console.log(`\n${label}`)
  console.log(`Players / rotation Players: ${summary.observations} / ${summary.rotationPlayers}`)
  console.log(`Minute bands: ${MINUTE_BANDS.map((band) => `${band}: ${ratio(summary.minuteBands[band])}`).join(' | ')}`)
  console.log(`Teams with 1+ / 2+ / 3+ exact-40: ${ratio(summary.teams.atLeastOne)} | ${ratio(summary.teams.atLeastTwo)} | ${ratio(summary.teams.atLeastThree)}`)
  console.log(`Origins: natural 40 ${ratio(summary.exact40Origins.naturalAlready40)} | natural 36→40 ${ratio(summary.exact40Origins.natural36ToFlexible40)} | natural <36→40 ${ratio(summary.exact40Origins.naturalBelow36ToFlexible40)} | other ${ratio(summary.exact40Origins.other)}`)
  console.log(`Elite: all ${ratio(summary.eliteRates.allRotationPlayers)} | team #1 OVR ${ratio(summary.eliteRates.teamHighestOverall)} | team top 3 OVR ${ratio(summary.eliteRates.teamTopThreeOverall)}`)
  console.log(`Leaders: PPG ${ratio(summary.eliteRates.topTenPpg)} | APG ${ratio(summary.eliteRates.topTenApg)} | RPG ${ratio(summary.eliteRates.topTenRpg)}`)
  console.log(`Position exact-40: ${Object.entries(summary.exact40ByPosition).map(([position, value]) => `${position} ${ratio(value)}`).join(' | ')}`)
  console.log(`OVR exact-40: ${Object.entries(summary.exact40ByOverallBand).map(([band, value]) => `${band} ${ratio(value)}`).join(' | ')}`)
  console.log(`Exact-40 natural / secondary minute totals: ${summary.exact40NaturalMinutes} / ${summary.exact40SecondaryMinutes}`)
  console.log(`Exact-40 secondary paths: ${Object.entries(summary.exact40SecondaryPaths).sort(([, first], [, second]) => second.minutes - first.minutes).map(([path, value]) => `${path} ${value.players} Players/${value.minutes} min`).join(' | ') || 'none'}`)
  const mpg = summary.assigned40ActualMpg
  console.log(`Assigned-40 actual MPG: avg ${mpg.average.toFixed(3)}, range ${mpg.minimum.toFixed(3)}–${mpg.maximum.toFixed(3)}, ~40.0 ${mpg.approximately40}/${mpg.players}`)
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const config = resolveLongRunCliConfig(args)
  const seeds = calibrationSeeds(config.seeds)
  const started = performance.now()
  const result = await runLongRunCalibrationParallel({
    seeds,
    seasonsPerSeed: config.seasons,
    auditLevel: config.audit,
    workers: config.workers,
  })
  const replay = runLongRunCalibration({
    seeds: [seeds[0]!],
    seasonsPerSeed: config.seasons,
    auditLevel: config.audit,
  }).runs[0]!.rotationMinutes
  const deterministicReplay = JSON.stringify(replay) === JSON.stringify(result.runs[0]!.rotationMinutes)
  if (!deterministicReplay) throw new Error('Rotation-minute diagnostic replay diverged.')

  const observations = result.runs.flatMap(({ rotationMinutes }) => rotationMinutes)
  const partitions = partitionRotationMinuteObservations(observations)
  const summaries = {
    all: summarizeRotationMinutes(partitions.all),
    season1: summarizeRotationMinutes(partitions.season1),
    season5plus: summarizeRotationMinutes(partitions.season5plus),
  }

  console.log('COLLEGE HOOPS SIM — ROTATION MINUTES REALISM DIAGNOSTIC')
  console.log(`\nConfiguration: ${config.preset ?? 'custom'}, ${config.seeds} seed(s) × ${config.seasons} Season(s), ${config.audit.toUpperCase()}, ${config.workers} worker(s)`)
  console.log(`Deterministic replay: PASS`)
  console.log(`Runtime: ${((performance.now() - started) / 1000).toFixed(1)} seconds`)
  printSummary('ALL SEASONS', summaries.all)
  printSummary('SEASON 1', summaries.season1)
  printSummary('SEASON 5+', summaries.season5plus)

  if (config.json) {
    console.log(`\nJSON\n${JSON.stringify({ config, deterministicReplay, summaries }, null, 2)}`)
  }
}

const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) void main()
