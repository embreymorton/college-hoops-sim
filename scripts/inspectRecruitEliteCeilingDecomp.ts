import { calculateOverall } from '../src/engine'
import {
  generateRecruitingClassWithTalentTrace,
  type RecruitTalentTrace,
} from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'

const CLASSES = Number(process.env.CLASSES ?? 500)
const SEED_ROOT = process.env.SEED ?? 'recruit-elite-ceiling-decomp:v1'

interface Profile extends RecruitTalentTrace {
  readonly finalizedHeadroom: number
  readonly rawHeadroom: number
  readonly candidateBaseline: number
  readonly candidateDelta: number
  readonly branch: 'natural-raw-ceiling' | 'natural-low-ovr' | 'candidate-zero' | 'candidate-runway' | 'candidate-capped-99'
}

interface Bucket { readonly label: string; readonly matches: (profile: Profile) => boolean }
const OVR_BUCKETS: readonly Bucket[] = [
  { label: '<60', matches: ({ startingOverall }) => startingOverall < 60 },
  ...[[60, 64], [65, 69], [70, 74], [75, 79], [80, 84]].map(([low, high]) => ({ label: `${low}-${high}`, matches: ({ startingOverall }: Profile) => startingOverall >= low! && startingOverall <= high! })),
  { label: '85+', matches: ({ startingOverall }) => startingOverall >= 85 },
]

function fixed(value: number, digits = 1): string { return value.toFixed(digits) }
function pct(count: number, total: number): string { return `${fixed(total ? count / total * 100 : 0)}%` }
function describe(values: readonly number[]): string {
  return `n ${values.length} mean ${fixed(average(values))} min ${Math.min(...values)} P10 ${fixed(percentile(values, .1))} P25 ${fixed(percentile(values, .25))} P50 ${fixed(percentile(values, .5))} P75 ${fixed(percentile(values, .75))} P90 ${fixed(percentile(values, .9))} P95 ${fixed(percentile(values, .95))} P99 ${fixed(percentile(values, .99))} max ${Math.max(...values)}`
}
function count(profiles: readonly Profile[], test: (profile: Profile) => boolean): number { return profiles.filter(test).length }
function branch(trace: RecruitTalentTrace): Profile['branch'] {
  if (!trace.eligible) return trace.rawCeiling > trace.startingOverall ? 'natural-raw-ceiling' : 'natural-low-ovr'
  if (trace.preservedZero) return 'candidate-zero'
  if (trace.cappedAt99) return 'candidate-capped-99'
  return 'candidate-runway'
}

export function collectProfiles(): readonly Profile[] {
  const profiles: Profile[] = []
  for (let sample = 0; sample < CLASSES; sample += 1) {
    const seed = `${SEED_ROOT}:class:${sample}`
    const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
    const season = initializeSeason({
      universe: UNIVERSE_V0,
      initializedUniverse,
      schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
      seasonNumber: 1,
    })
    const result = generateRecruitingClassWithTalentTrace({ dynastySeed: seed, targetSeasonNumber: 2, season })
    const recruits = new Map(result.recruits.map(({ player }) => [player.id, player]))
    for (const trace of result.traces) {
      const player = recruits.get(trace.playerId)
      if (!player || calculateOverall(player) !== trace.startingOverall || player.potential !== trace.finalPotential) {
        throw new Error(`Talent trace does not match generated Recruit ${trace.playerId}.`)
      }
      const candidateBaseline = Math.max(trace.startingOverall, trace.rawCeiling)
      profiles.push({
        ...trace,
        rawHeadroom: trace.rawCeiling - trace.startingOverall,
        finalizedHeadroom: trace.finalPotential - trace.startingOverall,
        candidateBaseline,
        candidateDelta: trace.finalPotential - candidateBaseline,
        branch: branch(trace),
      })
    }
  }
  return profiles
}

function printRawCeiling(profiles: readonly Profile[]): void {
  const values = profiles.map(({ rawCeiling }) => rawCeiling)
  console.log(`RAW CEILING ${describe(values)}`)
  console.log([85, 90, 95, 97].map((threshold) => `raw ${threshold}+ ${count(profiles, ({ rawCeiling }) => rawCeiling >= threshold)} (${pct(count(profiles, ({ rawCeiling }) => rawCeiling >= threshold), profiles.length)})`).join(' | ') + ` | raw =99 ${count(profiles, ({ rawCeiling }) => rawCeiling === 99)} (${pct(count(profiles, ({ rawCeiling }) => rawCeiling === 99), profiles.length)})`)
}

function eliteRawCohort(profiles: readonly Profile[], threshold: number): readonly Profile[] {
  return profiles.filter(({ rawCeiling }) => threshold === 99 ? rawCeiling === 99 : rawCeiling >= threshold)
}
function printEliteReadiness(profiles: readonly Profile[]): void {
  for (const threshold of [90, 95, 97, 99]) {
    const rows = eliteRawCohort(profiles, threshold)
    console.log(`RAW ${threshold === 99 ? '=99' : `${threshold}+`} START OVR: ${describe(rows.map(({ startingOverall }) => startingOverall))}`)
    console.log(`  ${OVR_BUCKETS.map((bucket) => `${bucket.label} ${count(rows, bucket.matches)} (${pct(count(rows, bucket.matches), rows.length)})`).join(' | ')}`)
  }
}

function printRelationship(profiles: readonly Profile[]): void {
  console.log(`OVR ↔ raw-ceiling correlation: ${fixed(correlation(profiles.map(({ startingOverall, rawCeiling }) => ({ first: startingOverall, second: rawCeiling }))), 3)}`)
  console.log('START OVR  n       RAWμ  RAW90+  RAW95+  RAW97+  RAW=99')
  for (const bucket of OVR_BUCKETS) {
    const rows = profiles.filter(bucket.matches)
    console.log(`${bucket.label.padEnd(10)} ${String(rows.length).padEnd(7)} ${fixed(average(rows.map(({ rawCeiling }) => rawCeiling))).padStart(5)} ${pct(count(rows, ({ rawCeiling }) => rawCeiling >= 90), rows.length).padStart(7)} ${pct(count(rows, ({ rawCeiling }) => rawCeiling >= 95), rows.length).padStart(7)} ${pct(count(rows, ({ rawCeiling }) => rawCeiling >= 97), rows.length).padStart(7)} ${pct(count(rows, ({ rawCeiling }) => rawCeiling === 99), rows.length).padStart(7)}`)
  }
  console.log('RAW BAND  n       OVR mean/med/P10/P90')
  for (const [label, low, high] of [['<85', 0, 84], ['85-89', 85, 89], ['90-94', 90, 94], ['95-96', 95, 96], ['97-99', 97, 99]] as const) {
    const rows = profiles.filter(({ rawCeiling }) => rawCeiling >= low && rawCeiling <= high)
    const values = rows.map(({ startingOverall }) => startingOverall)
    console.log(`${label.padEnd(9)} ${String(rows.length).padEnd(7)} ${fixed(average(values))}/${fixed(percentile(values, .5))}/${fixed(percentile(values, .1))}/${fixed(percentile(values, .9))}`)
  }
}

function printBranches(rows: readonly Profile[]): string {
  const branches: readonly Profile['branch'][] = ['natural-raw-ceiling', 'natural-low-ovr', 'candidate-zero', 'candidate-runway', 'candidate-capped-99']
  return branches.map((name) => `${name} ${count(rows, ({ branch: value }) => value === name)} (${pct(count(rows, ({ branch: value }) => value === name), rows.length)})`).join(' | ')
}
function printCandidateB(profiles: readonly Profile[]): void {
  const deltas = profiles.map(({ candidateDelta }) => candidateDelta)
  console.log(`All Recruits: changed vs max(OVR, raw) ${count(profiles, ({ candidateDelta }) => candidateDelta !== 0)} (${pct(count(profiles, ({ candidateDelta }) => candidateDelta !== 0), profiles.length)}) | raw μ ${fixed(average(profiles.map(({ rawCeiling }) => rawCeiling)))} | final POT μ ${fixed(average(profiles.map(({ finalPotential }) => finalPotential)))} | delta μ ${fixed(average(deltas))}`)
  console.log(`Delta: min ${Math.min(...deltas)} P50 ${fixed(percentile(deltas, .5))} P90 ${fixed(percentile(deltas, .9))} P95 ${fixed(percentile(deltas, .95))} P99 ${fixed(percentile(deltas, .99))} max ${Math.max(...deltas)} | increases ${count(profiles, ({ candidateDelta }) => candidateDelta > 0)} unchanged ${count(profiles, ({ candidateDelta }) => candidateDelta === 0)} decreases ${count(profiles, ({ candidateDelta }) => candidateDelta < 0)}`)
  for (const threshold of [95, 97, 99]) {
    const rows = eliteRawCohort(profiles, threshold)
    console.log(`RAW ${threshold === 99 ? '=99' : `${threshold}+`} n ${rows.length} | start μ ${fixed(average(rows.map(({ startingOverall }) => startingOverall)))} raw μ ${fixed(average(rows.map(({ rawCeiling }) => rawCeiling)))} final μ ${fixed(average(rows.map(({ finalPotential }) => finalPotential)))} | final 95+/97+/=99 ${pct(count(rows, ({ finalPotential }) => finalPotential >= 95), rows.length)}/${pct(count(rows, ({ finalPotential }) => finalPotential >= 97), rows.length)}/${pct(count(rows, ({ finalPotential }) => finalPotential === 99), rows.length)}`)
    console.log(`  ${printBranches(rows)}`)
  }
  for (const threshold of [95, 97]) {
    const rows = profiles.filter(({ finalPotential }) => finalPotential >= threshold)
    console.log(`FINAL POT ${threshold}+ raw origins: n ${rows.length} | raw μ ${fixed(average(rows.map(({ rawCeiling }) => rawCeiling)))} | raw ${threshold}+ ${count(rows, ({ rawCeiling }) => rawCeiling >= threshold)} (${pct(count(rows, ({ rawCeiling }) => rawCeiling >= threshold), rows.length)}) | raw below ${threshold} ${count(rows, ({ rawCeiling }) => rawCeiling < threshold)} (${pct(count(rows, ({ rawCeiling }) => rawCeiling < threshold), rows.length)})`)
  }
}

function practicalBuckets(rows: readonly Profile[]): string {
  const ovr = [
    ['<65', (p: Profile) => p.startingOverall < 65], ['65-69', (p: Profile) => p.startingOverall >= 65 && p.startingOverall <= 69],
    ['70-74', (p: Profile) => p.startingOverall >= 70 && p.startingOverall <= 74], ['75-79', (p: Profile) => p.startingOverall >= 75 && p.startingOverall <= 79], ['80+', (p: Profile) => p.startingOverall >= 80],
  ] as const
  const hr = [
    ['<10', (p: Profile) => p.finalizedHeadroom < 10], ['10-14', (p: Profile) => p.finalizedHeadroom >= 10 && p.finalizedHeadroom <= 14],
    ['15-19', (p: Profile) => p.finalizedHeadroom >= 15 && p.finalizedHeadroom <= 19], ['20+', (p: Profile) => p.finalizedHeadroom >= 20],
  ] as const
  return `OVR ${ovr.map(([label, test]) => `${label} ${count(rows, test)} (${pct(count(rows, test), rows.length)})`).join(' | ')}\n  HR ${hr.map(([label, test]) => `${label} ${count(rows, test)} (${pct(count(rows, test), rows.length)})`).join(' | ')}`
}
function printFunnel(profiles: readonly Profile[]): void {
  for (const threshold of [95, 97]) {
    const raw = profiles.filter(({ rawCeiling }) => rawCeiling >= threshold)
    const final = profiles.filter(({ finalPotential }) => finalPotential >= threshold)
    console.log(`FINAL POT ${threshold}+ PRACTICAL PROFILE\n  ${practicalBuckets(final)}`)
    console.log(`FUNNEL ${threshold}+: all ${profiles.length} → raw ceiling ${threshold}+ ${raw.length} (${pct(raw.length, profiles.length)}) → final POT ${threshold}+ ${final.length} (${pct(final.length, profiles.length)}; ${pct(final.length, raw.length)} of raw count) → OVR75+ ${count(final, ({ startingOverall }) => startingOverall >= 75)} (${pct(count(final, ({ startingOverall }) => startingOverall >= 75), profiles.length)} all; ${pct(count(final, ({ startingOverall }) => startingOverall >= 75), final.length)} final) → OVR80+ ${count(final, ({ startingOverall }) => startingOverall >= 80)} (${pct(count(final, ({ startingOverall }) => startingOverall >= 80), profiles.length)} all; ${pct(count(final, ({ startingOverall }) => startingOverall >= 80), final.length)} final)`)
  }
  console.log(`COMBINATIONS OVR75+/POT95+ ${count(profiles, (p) => p.startingOverall >= 75 && p.finalPotential >= 95)} (${pct(count(profiles, (p) => p.startingOverall >= 75 && p.finalPotential >= 95), profiles.length)}) | OVR80+/POT95+ ${count(profiles, (p) => p.startingOverall >= 80 && p.finalPotential >= 95)} (${pct(count(profiles, (p) => p.startingOverall >= 80 && p.finalPotential >= 95), profiles.length)}) | OVR75+/POT97+ ${count(profiles, (p) => p.startingOverall >= 75 && p.finalPotential >= 97)} (${pct(count(profiles, (p) => p.startingOverall >= 75 && p.finalPotential >= 97), profiles.length)}) | OVR80+/POT97+ ${count(profiles, (p) => p.startingOverall >= 80 && p.finalPotential >= 97)} (${pct(count(profiles, (p) => p.startingOverall >= 80 && p.finalPotential >= 97), profiles.length)})`)
}

export function runReport(): void {
  if (!Number.isSafeInteger(CLASSES) || CLASSES < 1) throw new RangeError('CLASSES must be a positive safe integer.')
  const profiles = collectProfiles()
  console.log('COLLEGE HOOPS SIM — RECRUIT ELITE-CEILING PIPELINE DECOMPOSITION')
  console.log(`Classes ${CLASSES} | Recruits ${profiles.length} | seed root ${SEED_ROOT}`)
  console.log('Production order: readiness input → generatePlayer attributes → calculateOverall → raw ceiling → finalizeRecruitPotential')
  console.log('\nRAW CEILING RESULTS')
  printRawCeiling(profiles)
  console.log('\nELITE RAW-CEILING READINESS')
  printEliteReadiness(profiles)
  console.log('\nREADINESS / CEILING RELATIONSHIP')
  printRelationship(profiles)
  console.log('\nCANDIDATE B EFFECT')
  printCandidateB(profiles)
  console.log('\nELITE-PROFILE FUNNEL')
  printFunnel(profiles)
  const rawCeilings = profiles.map(({ rawCeiling }) => rawCeiling)
  const readiness = profiles.map(({ readiness: value }) => value)
  console.log(`\nSANITY classes ${CLASSES}; traces ${profiles.length}; unique players ${new Set(profiles.map(({ playerId }) => playerId)).size}; invalid POT ${count(profiles, ({ finalPotential, startingOverall }) => finalPotential < startingOverall || finalPotential > 99)}; raw range ${Math.min(...rawCeilings)}-${Math.max(...rawCeilings)}; readiness range ${Math.min(...readiness)}-${Math.max(...readiness)}`)
}

if (process.argv[1]?.endsWith('inspectRecruitEliteCeilingDecomp.ts')) runReport()
