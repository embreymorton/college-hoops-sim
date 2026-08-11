import { availableParallelism } from 'node:os'

export type AuditLevel = 'light' | 'full'
export type CalibrationPresetName = 'quick' | 'standard' | 'acceptance' | 'equilibrium'

export interface CalibrationPreset {
  readonly seeds: number
  readonly seasons: number
  readonly audit: AuditLevel
}

export interface LongRunCliConfig {
  readonly preset: CalibrationPresetName | undefined
  readonly seeds: number
  readonly seasons: number
  readonly audit: AuditLevel
  readonly workers: number
  readonly json: boolean
}

export const CALIBRATION_PRESETS: Readonly<Record<CalibrationPresetName, CalibrationPreset>> = {
  quick: { seeds: 1, seasons: 3, audit: 'light' },
  standard: { seeds: 3, seasons: 10, audit: 'light' },
  acceptance: { seeds: 5, seasons: 10, audit: 'full' },
  equilibrium: { seeds: 5, seasons: 50, audit: 'full' },
}

const DEFAULT_CONFIG: CalibrationPreset = CALIBRATION_PRESETS.equilibrium

function optionValue(args: readonly string[], name: string): string | undefined {
  const index = args.indexOf(`--${name}`)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new RangeError(`--${name} requires a value.`)
  return value
}

function positiveInteger(value: string, name: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new RangeError(`--${name} must be a positive integer.`)
  }
  return parsed
}

export function resolveWorkerCount(seedCount: number, requested?: number): number {
  const cpuLimit = Math.max(1, Math.min(availableParallelism(), 4))
  return Math.min(seedCount, requested ?? cpuLimit)
}

export function resolveLongRunCliConfig(args: readonly string[]): LongRunCliConfig {
  const presetValue = optionValue(args, 'preset')
  if (presetValue && !(presetValue in CALIBRATION_PRESETS)) {
    throw new RangeError(`Unknown preset "${presetValue}". Use quick, standard, acceptance, or equilibrium.`)
  }
  const preset = presetValue as CalibrationPresetName | undefined
  const defaults = preset ? CALIBRATION_PRESETS[preset] : DEFAULT_CONFIG
  const seedsValue = optionValue(args, 'seeds')
  const seasonsValue = optionValue(args, 'seasons')
  const workersValue = optionValue(args, 'workers')
  const auditValue = optionValue(args, 'audit')
  if (auditValue && auditValue !== 'light' && auditValue !== 'full') {
    throw new RangeError('--audit must be light or full.')
  }
  const seeds = seedsValue ? positiveInteger(seedsValue, 'seeds') : defaults.seeds
  const workers = resolveWorkerCount(
    seeds,
    workersValue ? positiveInteger(workersValue, 'workers') : undefined,
  )
  return {
    preset,
    seeds,
    seasons: seasonsValue ? positiveInteger(seasonsValue, 'seasons') : defaults.seasons,
    audit: (auditValue as AuditLevel | undefined) ?? defaults.audit,
    workers,
    json: args.includes('--json'),
  }
}

export function calibrationSeeds(count: number): readonly string[] {
  return Array.from(
    { length: count },
    (_, index) => `dynasty-long-run-v0:seed-${index + 1}`,
  )
}
