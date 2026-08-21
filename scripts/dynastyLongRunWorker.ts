import { runDynastyCalibration } from './inspectDynastyLongRun'
import type { AuditLevel } from './calibration/presets'

function argument(name: string): string {
  const index = process.argv.indexOf(`--${name}`)
  const value = process.argv[index + 1]
  if (index < 0 || !value) throw new RangeError(`--${name} requires a value.`)
  return value
}

const seed = argument('seed')
const seasons = Number(argument('seasons'))
const audit = argument('audit')
const rotationCompatible = process.argv.includes('--rotation-compatible')
if (!Number.isSafeInteger(seasons) || seasons < 1) {
  throw new RangeError('--seasons must be a positive integer.')
}
if (audit !== 'light' && audit !== 'full') {
  throw new RangeError('--audit must be light or full.')
}

process.stdout.write(JSON.stringify(runDynastyCalibration(seed, seasons, audit as AuditLevel, false, rotationCompatible)))
