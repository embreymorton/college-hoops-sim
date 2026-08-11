import { pathToFileURL } from 'node:url'
import { calibrationSeeds, resolveLongRunCliConfig } from './calibration/presets'
import { runLongRunCalibration, type LongRunCalibrationResult } from './inspectDynastyLongRun'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'
import { formatPairedTournamentComparison } from './tournamentBalanceMetrics'

export async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const config = resolveLongRunCliConfig(
    args.includes('--preset') || args.includes('--seeds') || args.includes('--seasons')
      ? args
      : ['--preset', 'standard', ...args],
  )
  const seeds = calibrationSeeds(config.seeds)
  const options = { seasonsPerSeed: config.seasons, seeds, auditLevel: config.audit }
  const first = runLongRunCalibration({ seasonsPerSeed: Math.min(2, config.seasons), seeds: ['tournament-balance:determinism'], auditLevel: config.audit })
  const second = runLongRunCalibration({ seasonsPerSeed: Math.min(2, config.seasons), seeds: ['tournament-balance:determinism'], auditLevel: config.audit })
  const determinismPassed = JSON.stringify(first.runs[0]!.tournamentBalance) === JSON.stringify(second.runs[0]!.tournamentBalance)
  const result: LongRunCalibrationResult = config.workers === 1
    ? runLongRunCalibration(options)
    : await runLongRunCalibrationParallel({ ...options, workers: config.workers })
  if (config.json) {
    console.log(JSON.stringify({ config, determinismPassed, observations: result.runs.flatMap((run) => run.tournamentBalance) }))
  } else {
    console.log(formatPairedTournamentComparison(
      result.runs.flatMap((run) => run.tournamentBalance),
      result.runs.flatMap((run) => run.tournamentBalanceCandidate), {
      seeds: config.seeds,
      seasons: config.seasons,
      audit: config.audit,
    }))
    console.log(`\nDETERMINISTIC REPLAY: ${determinismPassed ? 'PASS' : 'FAIL'}`)
  }
  if (!determinismPassed) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
