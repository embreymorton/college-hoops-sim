import {
  POSITIONS,
  calculateOverall,
  type Player,
} from '../src/engine'
import {
  developReturningPlayer,
  generateRecruitingClass,
} from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, type SeasonState } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, percentile, summarizeDistribution } from './dynastyLongRunMetrics'

type Origin = 'original-universe' | 'recruiting'

interface Entry {
  readonly origin: Origin
  readonly player: Player
  readonly programId: string
  readonly sample: number
}

interface Career extends Entry {
  readonly startingOverall: number
  readonly annualOverall: readonly number[]
  readonly peakOverall: number
  readonly finalOverall: number
}

const SAMPLES = Number(process.env.SAMPLES ?? 100)
const SEED_ROOT = process.env.SEED ?? 'very-high-ovr-ceiling:v1'

function fixed(value: number, digits = 1): string { return value.toFixed(digits) }
function percent(numerator: number, denominator: number): string {
  return `${fixed(denominator === 0 ? 0 : numerator / denominator * 100)}%`
}
function sd(values: readonly number[]): number { return summarizeDistribution(values).standardDeviation }
function distribution(values: readonly number[]): string {
  const summary = summarizeDistribution(values)
  return `n ${summary.count} mean ${fixed(summary.average)} med ${fixed(summary.median)} SD ${fixed(summary.standardDeviation)} min ${fixed(summary.minimum, 0)} P75 ${fixed(percentile(values, .75))} P90 ${fixed(percentile(values, .90))} P95 ${fixed(percentile(values, .95))} P99 ${fixed(percentile(values, .99))} max ${fixed(summary.maximum, 0)}`
}
function entryOverall(entry: Entry): number { return calculateOverall(entry.player) }
function headroom(entry: Entry): number { return entry.player.potential - entryOverall(entry) }

function makeSeason(sample: number): SeasonState {
  const seed = `${SEED_ROOT}:sample:${sample}`
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
    seasonNumber: 1,
  })
}

export function collectEntries(): readonly Entry[] {
  const entries: Entry[] = []
  const programIds = UNIVERSE_V0.programs.map(({ id }) => id).sort()
  for (let sample = 0; sample < SAMPLES; sample += 1) {
    const season = makeSeason(sample)
    for (const [programId, state] of Object.entries(season.programStates)) {
      for (const player of state.team.roster.filter(({ classYear }) => classYear === 'FR')) {
        entries.push({ origin: 'original-universe', player, programId, sample })
      }
    }
    const recruits = generateRecruitingClass({
      dynastySeed: `${SEED_ROOT}:sample:${sample}`,
      targetSeasonNumber: 2,
      season,
    })
    recruits.forEach(({ player }, index) => entries.push({
      origin: 'recruiting',
      player,
      programId: programIds[index % programIds.length]!,
      sample,
    }))
  }
  return entries
}

export function developCareers(entries: readonly Entry[]): readonly Career[] {
  return entries.map((entry) => {
    let player = structuredClone(entry.player)
    const annualOverall = [calculateOverall(player)]
    for (let completedSeasonNumber = 1; completedSeasonNumber <= 3; completedSeasonNumber += 1) {
      player = developReturningPlayer({
        player,
        dynastySeed: `${SEED_ROOT}:sample:${entry.sample}`,
        completedSeasonNumber,
        programId: entry.programId,
      })
      annualOverall.push(calculateOverall(player))
    }
    return {
      ...entry,
      startingOverall: annualOverall[0]!,
      annualOverall,
      peakOverall: Math.max(...annualOverall),
      finalOverall: annualOverall.at(-1)!,
    }
  })
}

function printEntry(entries: readonly Entry[]): void {
  console.log(`OVR      ${distribution(entries.map(entryOverall))}`)
  console.log(`POT      ${distribution(entries.map(({ player }) => player.potential))}`)
  const gaps = entries.map(headroom)
  console.log(`HEADROOM n ${gaps.length} mean ${fixed(average(gaps))} med ${fixed(percentile(gaps, .5))} P90 ${fixed(percentile(gaps, .9))} P95 ${fixed(percentile(gaps, .95))} max ${Math.max(...gaps)} | 10+ ${entries.filter((entry) => headroom(entry) >= 10).length} (${percent(entries.filter((entry) => headroom(entry) >= 10).length, entries.length)}) | 15+ ${entries.filter((entry) => headroom(entry) >= 15).length} (${percent(entries.filter((entry) => headroom(entry) >= 15).length, entries.length)}) | 20+ ${entries.filter((entry) => headroom(entry) >= 20).length} (${percent(entries.filter((entry) => headroom(entry) >= 20).length, entries.length)})`)
  console.log(`POT bands ${[85, 90, 95, 97].map((threshold) => `${threshold}+ ${entries.filter(({ player }) => player.potential >= threshold).length} (${percent(entries.filter(({ player }) => player.potential >= threshold).length, entries.length)})`).join(' | ')} | =99 ${entries.filter(({ player }) => player.potential === 99).length} (${percent(entries.filter(({ player }) => player.potential === 99).length, entries.length)})`)
  const joint = [
    ['OVR75+/POT90+', (entry: Entry) => entryOverall(entry) >= 75 && entry.player.potential >= 90],
    ['OVR75+/POT95+', (entry: Entry) => entryOverall(entry) >= 75 && entry.player.potential >= 95],
    ['OVR80+/POT90+', (entry: Entry) => entryOverall(entry) >= 80 && entry.player.potential >= 90],
    ['OVR80+/POT95+', (entry: Entry) => entryOverall(entry) >= 80 && entry.player.potential >= 95],
    ['POT95+/HR10+', (entry: Entry) => entry.player.potential >= 95 && headroom(entry) >= 10],
    ['POT97+/HR10+', (entry: Entry) => entry.player.potential >= 97 && headroom(entry) >= 10],
  ] as const
  console.log(`JOINT    ${joint.map(([label, predicate]) => `${label} ${entries.filter(predicate).length} (${percent(entries.filter(predicate).length, entries.length)})`).join(' | ')}`)
}

function printPositions(entries: readonly Entry[]): void {
  console.log('POS  n      OVRμ  POTμ  POT90+  POT95+  POT97+  HRμ')
  for (const position of POSITIONS) {
    const rows = entries.filter(({ player }) => player.position === position)
    console.log(`${position.padEnd(4)} ${String(rows.length).padEnd(6)} ${fixed(average(rows.map(entryOverall))).padStart(5)} ${fixed(average(rows.map(({ player }) => player.potential))).padStart(5)} ${percent(rows.filter(({ player }) => player.potential >= 90).length, rows.length).padStart(7)} ${percent(rows.filter(({ player }) => player.potential >= 95).length, rows.length).padStart(7)} ${percent(rows.filter(({ player }) => player.potential >= 97).length, rows.length).padStart(7)} ${fixed(average(rows.map(headroom))).padStart(5)}`)
  }
}

function printCareers(careers: readonly Career[]): void {
  const peak = careers.map(({ peakOverall }) => peakOverall)
  console.log(`PEAK     ${distribution(peak)}`)
  console.log(`OUTCOMES ${[85, 90, 95, 97].map((threshold) => `${threshold}+ ${careers.filter(({ peakOverall }) => peakOverall >= threshold).length} (${percent(careers.filter(({ peakOverall }) => peakOverall >= threshold).length, careers.length)})`).join(' | ')} | =99 ${careers.filter(({ peakOverall }) => peakOverall === 99).length} (${percent(careers.filter(({ peakOverall }) => peakOverall === 99).length, careers.length)})`)
  console.log(`FINAL    mean ${fixed(average(careers.map(({ finalOverall }) => finalOverall)))} med ${fixed(percentile(careers.map(({ finalOverall }) => finalOverall), .5))} | unused POT mean ${fixed(average(careers.map(({ player, finalOverall }) => player.potential - finalOverall)))}`)
}

function printHighPot(careers: readonly Career[]): void {
  for (const threshold of [90, 95, 97, 99]) {
    const rows = careers.filter(({ player }) => threshold === 99 ? player.potential === 99 : player.potential >= threshold)
    console.log(`POT ${threshold === 99 ? '=99' : `${threshold}+`} n ${rows.length} | start μ ${fixed(average(rows.map(({ startingOverall }) => startingOverall)))} POT μ ${fixed(average(rows.map(({ player }) => player.potential)))} peak μ ${fixed(average(rows.map(({ peakOverall }) => peakOverall)))} | reach 90/95/97/99 ${[90, 95, 97, 99].map((ceiling) => percent(rows.filter(({ peakOverall }) => peakOverall >= ceiling).length, rows.length)).join('/')} | unused μ ${fixed(average(rows.map(({ player, finalOverall }) => player.potential - finalOverall)))} | start ${distribution(rows.map(({ startingOverall }) => startingOverall))} | peak ${distribution(rows.map(({ peakOverall }) => peakOverall))}`)
  }
}

interface Bucket { readonly label: string; readonly matches: (entry: Entry) => boolean }
const OVR_BUCKETS: readonly Bucket[] = [
  { label: '<60', matches: (entry) => entryOverall(entry) < 60 },
  ...[[60, 64], [65, 69], [70, 74], [75, 79]].map(([low, high]) => ({ label: `${low}-${high}`, matches: (entry: Entry) => entryOverall(entry) >= low! && entryOverall(entry) <= high! })),
  { label: '80+', matches: (entry) => entryOverall(entry) >= 80 },
]
const POT_BUCKETS: readonly Bucket[] = [
  { label: '<80', matches: ({ player }) => player.potential < 80 },
  ...[[80, 84], [85, 89], [90, 94], [95, 96], [97, 99]].map(([low, high]) => ({ label: `${low}-${high}`, matches: ({ player }: Entry) => player.potential >= low! && player.potential <= high! })),
]
const HR_BUCKETS: readonly Bucket[] = [
  { label: '<5', matches: (entry) => headroom(entry) < 5 },
  ...[[5, 9], [10, 14], [15, 19]].map(([low, high]) => ({ label: `${low}-${high}`, matches: (entry: Entry) => headroom(entry) >= low! && headroom(entry) <= high! })),
  { label: '20+', matches: (entry) => headroom(entry) >= 20 },
]

function printBucketRows(label: string, buckets: readonly Bucket[], careers: readonly Career[]): void {
  console.log(`\n${label} BUCKETS`)
  console.log('BUCKET    ORIGIN     n    STARTμ POTμ PEAKμ GAINμ UNUSEDμ REACH90/95/97')
  for (const bucket of buckets) {
    for (const origin of ['original-universe', 'recruiting'] as const) {
      const rows = careers.filter((row) => row.origin === origin && bucket.matches(row))
      console.log(`${bucket.label.padEnd(9)} ${origin === 'original-universe' ? 'original' : 'recruit  '} ${String(rows.length).padStart(5)} ${fixed(average(rows.map(({ startingOverall }) => startingOverall))).padStart(6)} ${fixed(average(rows.map(({ player }) => player.potential))).padStart(4)} ${fixed(average(rows.map(({ peakOverall }) => peakOverall))).padStart(5)} ${fixed(average(rows.map(({ peakOverall, startingOverall }) => peakOverall - startingOverall))).padStart(5)} ${fixed(average(rows.map(({ player, finalOverall }) => player.potential - finalOverall))).padStart(7)} ${[90, 95, 97].map((threshold) => percent(rows.filter(({ peakOverall }) => peakOverall >= threshold).length, rows.length)).join('/')}`)
    }
  }
}

function printJointMatches(careers: readonly Career[]): void {
  console.log('\nJOINT OVR/POT/HEADROOM CELLS WITH BOTH ORIGINS (n >= 10 each)')
  console.log('CELL                      ORIG n/RECR n  PEAKμ O/R  GAINμ O/R  UNUSEDμ O/R  REACH95 O/R')
  let cells = 0
  for (const ovr of OVR_BUCKETS) for (const pot of POT_BUCKETS) for (const hr of HR_BUCKETS) {
    const matches = (row: Career) => ovr.matches(row) && pot.matches(row) && hr.matches(row)
    const original = careers.filter((row) => row.origin === 'original-universe' && matches(row))
    const recruiting = careers.filter((row) => row.origin === 'recruiting' && matches(row))
    if (original.length < 10 || recruiting.length < 10) continue
    cells += 1
    const peak = (rows: readonly Career[]) => average(rows.map(({ peakOverall }) => peakOverall))
    const gain = (rows: readonly Career[]) => average(rows.map(({ peakOverall, startingOverall }) => peakOverall - startingOverall))
    const unused = (rows: readonly Career[]) => average(rows.map(({ player, finalOverall }) => player.potential - finalOverall))
    console.log(`${`${ovr.label}/${pot.label}/${hr.label}`.padEnd(25)} ${String(original.length).padStart(5)}/${String(recruiting.length).padEnd(5)} ${fixed(peak(original)).padStart(5)}/${fixed(peak(recruiting)).padEnd(5)} ${fixed(gain(original)).padStart(5)}/${fixed(gain(recruiting)).padEnd(5)} ${fixed(unused(original)).padStart(6)}/${fixed(unused(recruiting)).padEnd(6)} ${percent(original.filter(({ peakOverall }) => peakOverall >= 95).length, original.length)}/${percent(recruiting.filter(({ peakOverall }) => peakOverall >= 95).length, recruiting.length)}`)
  }
  console.log(`Comparable joint cells printed: ${cells}`)
}

export function runReport(): void {
  if (!Number.isSafeInteger(SAMPLES) || SAMPLES < 1) throw new RangeError('SAMPLES must be a positive safe integer.')
  const entries = collectEntries()
  const careers = developCareers(entries)
  console.log('COLLEGE HOOPS SIM — VERY-HIGH-OVR ENTRY CEILING DIAGNOSTIC')
  console.log(`Samples: ${SAMPLES} fresh Universes + ${SAMPLES} Recruiting classes | seed root: ${SEED_ROOT}`)
  console.log('Production APIs: initializeUniverse → generated FR; generateRecruitingClass → incoming FR; developReturningPlayer ×3')
  for (const origin of ['original-universe', 'recruiting'] as const) {
    const originEntries = entries.filter((entry) => entry.origin === origin)
    const originCareers = careers.filter((career) => career.origin === origin)
    console.log(`\n=== ${origin.toUpperCase()} ENTRY ===`)
    printEntry(originEntries)
    printPositions(originEntries)
    console.log(`\n=== ${origin.toUpperCase()} CAREERS ===`)
    printCareers(originCareers)
    printHighPot(originCareers)
  }
  printBucketRows('STARTING OVR', OVR_BUCKETS, careers)
  printBucketRows('POT', POT_BUCKETS, careers)
  printBucketRows('HEADROOM', HR_BUCKETS, careers)
  printJointMatches(careers)
  console.log(`\nSANITY original samples ${new Set(entries.filter(({ origin }) => origin === 'original-universe').map(({ sample }) => sample)).size}/${SAMPLES}; recruit samples ${new Set(entries.filter(({ origin }) => origin === 'recruiting').map(({ sample }) => sample)).size}/${SAMPLES}; career class paths invalid ${careers.filter(({ annualOverall }) => annualOverall.length !== 4).length}; OVR>POT ${careers.filter(({ peakOverall, player }) => peakOverall > player.potential).length}; finite SD ${Number.isFinite(sd(careers.map(({ peakOverall }) => peakOverall))) ? 'yes' : 'no'}`)
}

if (process.argv[1]?.endsWith('inspectVeryHighOvrCeiling.ts')) runReport()
