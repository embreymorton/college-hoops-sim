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
if (!Number.isSafeInteger(seasons) || seasons < 1) {
  throw new RangeError('--seasons must be a positive integer.')
}
if (audit !== 'light' && audit !== 'full') {
  throw new RangeError('--audit must be light or full.')
}

const result = runDynastyCalibration(seed, seasons, audit as AuditLevel)
process.stdout.write(JSON.stringify(process.env.RECRUIT_MARKET_COMPACT === '1' ? {
  seed: result.seed,
  recruitingMarket: result.recruitingMarket,
  recruitingMarketOpportunities: result.recruitingMarketOpportunities,
  signedRecruits: result.signedRecruits,
} : process.env.PROGRAM_REPUTATION_COMPACT === '1' ? {
  seed: result.seed,
  programSeasonOutcomes: result.programSeasonOutcomes,
} : result))
