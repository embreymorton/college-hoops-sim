import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { runOrderedParallel } from './calibration/parallel'
import type { AuditLevel } from './calibration/presets'
import type { DynastyRunResult, LongRunCalibrationResult } from './inspectDynastyLongRun'

function runSeedInChild(
  seed: string,
  seasonsPerSeed: number,
  auditLevel: AuditLevel,
  experimentalRotationCompatibleOpenings = false,
): Promise<DynastyRunResult> {
  return new Promise((complete, reject) => {
    const child = spawn(process.execPath, [
      '--import', 'tsx', resolve(process.cwd(), 'scripts/dynastyLongRunWorker.ts'),
      '--seed', seed,
      '--seasons', String(seasonsPerSeed),
      '--audit', auditLevel,
      ...(experimentalRotationCompatibleOpenings ? ['--rotation-compatible'] : []),
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    const output: Buffer[] = []
    const error: Buffer[] = []
    child.stdout.on('data', (chunk: Buffer) => { output.push(chunk) })
    child.stderr.on('data', (chunk: Buffer) => { error.push(chunk) })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Seed worker failed for ${seed}: ${Buffer.concat(error).toString() || `exit ${code}`}`))
        return
      }
      try {
        complete(JSON.parse(Buffer.concat(output).toString()) as DynastyRunResult)
      } catch (parseError) {
        reject(new Error(`Seed worker returned invalid JSON for ${seed}: ${String(parseError)}`))
      }
    })
  })
}

export async function runLongRunCalibrationParallel(options: {
  readonly seasonsPerSeed: number
  readonly seeds: readonly string[]
  readonly auditLevel: AuditLevel
  readonly workers: number
  readonly experimentalRotationCompatibleOpenings?: boolean
}): Promise<LongRunCalibrationResult> {
  return {
    seeds: options.seeds,
    seasonsPerSeed: options.seasonsPerSeed,
    runs: await runOrderedParallel(options.seeds, options.workers, (seed) =>
      runSeedInChild(seed, options.seasonsPerSeed, options.auditLevel, options.experimentalRotationCompatibleOpenings),
    ),
  }
}
