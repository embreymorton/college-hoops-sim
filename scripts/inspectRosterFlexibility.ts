import { runMultiSeasonDiagnostic, runPairedDiagnostic } from './rosterFlexibilityDiagnostic'

const argument = process.argv.find((value) => value.startsWith('--cycles='))
const cycles = argument ? Number(argument.split('=')[1]) : 24
if (!Number.isSafeInteger(cycles) || cycles <= 0) throw new RangeError('--cycles must be a positive integer.')

const prefixArgument = process.argv.find((value) => value.startsWith('--prefix='))
const prefix = prefixArgument ? prefixArgument.split('=')[1]! : 'roster-flex'
const result = runPairedDiagnostic(cycles, prefix)
const multiSeedsArgument = process.argv.find((value) => value.startsWith('--multi-seeds='))
const multiSeasonsArgument = process.argv.find((value) => value.startsWith('--multi-seasons='))
const multiSeeds = multiSeedsArgument ? Number(multiSeedsArgument.split('=')[1]) : 0
const multiSeasons = multiSeasonsArgument ? Number(multiSeasonsArgument.split('=')[1]) : 0
const multiSeason = multiSeeds > 0 && multiSeasons > 0
  ? runMultiSeasonDiagnostic(multiSeeds, multiSeasons)
  : null
console.log(JSON.stringify({ cycles, result, multiSeeds, multiSeasons, multiSeason }, null, 2))
