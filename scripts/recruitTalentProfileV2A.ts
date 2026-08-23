import { POSITIONS, calculateOverall, createRng, type Position } from '../src/engine'
import { developReturningPlayer, generateRecruitingClassWithTalentTrace } from '../src/dynasty'
import { finalizeRecruitPotential, type RecruitPotentialResult } from '../src/dynasty/recruiting/potential'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'

export type V2AReadinessTier = 'raw/depth' | 'developmental' | 'good' | 'ready-now' | 'exceptional'
export type V2ACeilingTier = 'limited' | 'normal' | 'high' | 'elite' | 'exceptional'
export type CalibrationName = 'V2A' | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'Refined' | 'Final'
type Weights = Readonly<Record<V2AReadinessTier, readonly number[]>>

const READINESS_TIERS = ['raw/depth', 'developmental', 'good', 'ready-now', 'exceptional'] as const
const CEILING_TIERS = [
  { tier: 'limited', low: 60, high: 74 },
  { tier: 'normal', low: 75, high: 84 },
  { tier: 'high', low: 85, high: 94 },
  { tier: 'elite', low: 95, high: 96 },
  { tier: 'exceptional', low: 97, high: 99 },
] as const

/** Historical investigation candidates only. Production never imports this module. */
export const V2A_CONDITIONAL_WEIGHTS: Weights = {
  'raw/depth': [0.400, 0.430, 0.160, 0.008, 0.002], developmental: [0.280, 0.430, 0.268, 0.018, 0.004],
  good: [0.200, 0.400, 0.345, 0.045, 0.010], 'ready-now': [0.160, 0.340, 0.385, 0.090, 0.025], exceptional: [0.100, 0.270, 0.460, 0.120, 0.050],
}

/** Five deliberate hypotheses. Values are limited/normal/high/elite/exceptional and every row sums to one. */
export const CALIBRATION_WEIGHTS: Readonly<Record<CalibrationName, Weights>> = {
  V2A: V2A_CONDITIONAL_WEIGHTS,
  B1: {
    'raw/depth': [0.420, 0.520, 0.050, 0.008, 0.002], developmental: [0.360, 0.555, 0.070, 0.012, 0.003],
    good: [0.300, 0.575, 0.100, 0.020, 0.005], 'ready-now': [0.240, 0.575, 0.140, 0.035, 0.010], exceptional: [0.180, 0.550, 0.200, 0.050, 0.020],
  },
  B2: {
    'raw/depth': [0.420, 0.497, 0.070, 0.010, 0.003], developmental: [0.340, 0.537, 0.100, 0.018, 0.005],
    good: [0.270, 0.535, 0.150, 0.035, 0.010], 'ready-now': [0.210, 0.522, 0.190, 0.060, 0.018], exceptional: [0.150, 0.500, 0.240, 0.080, 0.030],
  },
  B3: {
    'raw/depth': [0.430, 0.501, 0.050, 0.015, 0.004], developmental: [0.360, 0.527, 0.080, 0.025, 0.008],
    good: [0.290, 0.550, 0.100, 0.045, 0.015], 'ready-now': [0.230, 0.550, 0.120, 0.075, 0.025], exceptional: [0.160, 0.530, 0.160, 0.100, 0.050],
  },
  B4: {
    'raw/depth': [0.370, 0.506, 0.100, 0.018, 0.006], developmental: [0.340, 0.524, 0.110, 0.020, 0.006],
    good: [0.310, 0.547, 0.110, 0.025, 0.008], 'ready-now': [0.270, 0.553, 0.130, 0.035, 0.012], exceptional: [0.200, 0.555, 0.160, 0.060, 0.025],
  },
  B5: {
    'raw/depth': [0.380, 0.487, 0.120, 0.010, 0.003], developmental: [0.300, 0.515, 0.160, 0.020, 0.005],
    good: [0.240, 0.515, 0.200, 0.035, 0.010], 'ready-now': [0.200, 0.535, 0.200, 0.050, 0.015], exceptional: [0.160, 0.525, 0.220, 0.070, 0.025],
  },
  // Accepted refined candidate; now implemented canonically in recruiting/generation.ts.
  Refined: {
    'raw/depth': [0.370, 0.506, 0.100, 0.018, 0.006], developmental: [0.340, 0.524, 0.110, 0.020, 0.006],
    good: [0.300, 0.560, 0.110, 0.025, 0.005], 'ready-now': [0.240, 0.575, 0.140, 0.035, 0.010], exceptional: [0.190, 0.550, 0.190, 0.050, 0.020],
  },
  // Rejected lifecycle micro-adjustment retained only for reproducible historical comparison.
  Final: {
    'raw/depth': [0.370, 0.526, 0.080, 0.018, 0.006], developmental: [0.340, 0.544, 0.090, 0.020, 0.006],
    good: [0.300, 0.560, 0.110, 0.025, 0.005], 'ready-now': [0.240, 0.575, 0.140, 0.035, 0.010], exceptional: [0.190, 0.550, 0.190, 0.050, 0.020],
  },
}

export function classifyV2AReadiness(readiness: number): V2AReadinessTier {
  if (readiness >= 86) return 'exceptional'
  if (readiness >= 78) return 'ready-now'
  if (readiness >= 71) return 'good'
  if (readiness >= 60) return 'developmental'
  return 'raw/depth'
}

export function generateV2ARawCeiling(readiness: number, seed: string, weights: Weights = V2A_CONDITIONAL_WEIGHTS): { readonly ceiling: number; readonly tier: V2ACeilingTier } {
  const rng = createRng(JSON.stringify({ namespace: 'diagnostic-recruit-talent-profile-v2-sweep:v1', seed }))
  const row = weights[classifyV2AReadiness(readiness)]
  const roll = rng.next()
  let cumulative = 0
  const selected = CEILING_TIERS.find((_, index) => {
    cumulative += row[index]!
    return roll < cumulative
  }) ?? CEILING_TIERS.at(-1)!
  return { ceiling: rng.int(selected.low, selected.high), tier: selected.tier }
}

type ArmName = 'V1' | CalibrationName
type Branch = 'natural-raw-ceiling' | 'natural-low-ovr' | 'candidate-zero' | 'candidate-runway' | 'candidate-capped-99'
interface Profile {
  readonly arm: ArmName
  readonly playerId: string
  readonly position: Position
  readonly readiness: number
  readonly readinessTier: V2AReadinessTier
  readonly startingOverall: number
  readonly rawCeiling: number
  readonly finalPotential: number
  readonly branch: Branch
  readonly nationalRank: number
  readonly stars: 2 | 3 | 4 | 5
  readonly sample: number
}
interface FreshmanProfile { readonly startingOverall: number; readonly finalPotential: number }
interface LifecycleComparison { readonly seasonZero: Readonly<Record<'FR' | 'SO' | 'JR' | 'SR', readonly FreshmanProfile[]>>; readonly recruited: Readonly<Record<'V1' | 'Refined' | 'Final', readonly (readonly FreshmanProfile[])[]>> }

function deriveBranch(result: RecruitPotentialResult, overall: number, raw: number): Branch {
  if (!result.eligible) return raw > overall ? 'natural-raw-ceiling' : 'natural-low-ovr'
  if (result.preservedZero) return 'candidate-zero'
  return result.cappedAt99 ? 'candidate-capped-99' : 'candidate-runway'
}
function rankProfiles(rows: readonly Omit<Profile, 'nationalRank' | 'stars'>[]): Profile[] {
  const ranked = [...rows].sort((a, b) =>
    (b.startingOverall * .56 + b.finalPotential * .44) - (a.startingOverall * .56 + a.finalPotential * .44) ||
    b.startingOverall - a.startingOverall || b.finalPotential - a.finalPotential || a.playerId.localeCompare(b.playerId))
  return ranked.map((row, index) => ({
    ...row, nationalRank: index + 1,
    stars: index + 1 <= Math.ceil(ranked.length * .06) ? 5 : index + 1 <= Math.ceil(ranked.length * .26) ? 4 : index + 1 <= Math.ceil(ranked.length * .72) ? 3 : 2,
  }))
}
function makeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const season = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
  return { initializedUniverse, season }
}

export function collectPairedProfiles(classes: number, seedRoot: string, includeLifecycle = false): { readonly arms: Readonly<Record<ArmName, readonly Profile[]>>; readonly seasonZero: readonly FreshmanProfile[]; readonly lifecycle?: LifecycleComparison } {
  const names: readonly ArmName[] = ['V1', 'Refined', 'Final']
  const mutable = Object.fromEntries(names.map((name) => [name, [] as Profile[]])) as Record<ArmName, Profile[]>
  const seasonZero: FreshmanProfile[] = []
  const s0Stages = { FR: [] as FreshmanProfile[], SO: [] as FreshmanProfile[], JR: [] as FreshmanProfile[], SR: [] as FreshmanProfile[] }
  const recruitedStages = { V1: [[], [], [], []] as FreshmanProfile[][], Refined: [[], [], [], []] as FreshmanProfile[][], Final: [[], [], [], []] as FreshmanProfile[][] }
  for (let sample = 0; sample < classes; sample += 1) {
    const dynastySeed = `${seedRoot}:class:${sample}`
    const { season } = makeSeason(`${seedRoot}:sample:${sample}`)
    Object.values(season.programStates).forEach(({ team }) => team.roster.forEach((player) => {
      const row = { startingOverall: calculateOverall(player), finalPotential: player.potential }
      s0Stages[player.classYear].push(row)
      if (player.classYear === 'FR') seasonZero.push(row)
    }))
    const result = generateRecruitingClassWithTalentTrace({ dynastySeed, targetSeasonNumber: 2, season })
    const productionPlayers = new Map(result.recruits.map((recruit) => [recruit.player.id, recruit.player]))
    const unranked = Object.fromEntries(names.map((name) => [name, [] as Omit<Profile, 'nationalRank' | 'stars'>[]])) as Record<ArmName, Omit<Profile, 'nationalRank' | 'stars'>[]>
    for (const trace of result.traces) {
      const common = { playerId: trace.playerId, position: trace.position, readiness: trace.readiness, readinessTier: classifyV2AReadiness(trace.readiness), startingOverall: trace.startingOverall, sample }
      const v1Result: RecruitPotentialResult = { potential: trace.finalPotential, eligible: trace.eligible, preservedZero: trace.preservedZero, grantedRunway: trace.grantedRunway, cappedAt99: trace.cappedAt99 }
      unranked.V1.push({ ...common, arm: 'V1', rawCeiling: trace.rawCeiling, finalPotential: trace.finalPotential, branch: deriveBranch(v1Result, trace.startingOverall, trace.rawCeiling) })
      for (const name of names.slice(1) as readonly CalibrationName[]) {
        const raw = generateV2ARawCeiling(trace.readiness, `${dynastySeed}:${trace.playerId}`, CALIBRATION_WEIGHTS[name])
        const finalized = finalizeRecruitPotential({ overall: trace.startingOverall, rawCeiling: raw.ceiling, dynastySeed, targetSeasonNumber: 2, playerId: trace.playerId })
        unranked[name].push({ ...common, arm: name, rawCeiling: raw.ceiling, finalPotential: finalized.potential, branch: deriveBranch(finalized, trace.startingOverall, raw.ceiling) })
      }
      if (calculateOverall(productionPlayers.get(trace.playerId)!) !== trace.startingOverall) throw new Error(`Trace mismatch: ${trace.playerId}`)
    }
    if (includeLifecycle) {
      const candidateByName = { Refined: new Map(unranked.Refined.map((row) => [row.playerId, row])), Final: new Map(unranked.Final.map((row) => [row.playerId, row])) }
      const programIds = Object.keys(season.programStates).sort()
      result.recruits.forEach((recruit, index) => {
        const potentials = { V1: recruit.player.potential, Refined: candidateByName.Refined.get(recruit.player.id)!.finalPotential, Final: candidateByName.Final.get(recruit.player.id)!.finalPotential }
        for (const name of ['V1', 'Refined', 'Final'] as const) {
          let player = { ...recruit.player, potential: potentials[name] }
          recruitedStages[name][0]!.push({ startingOverall: calculateOverall(player), finalPotential: player.potential })
          for (let year = 1; year <= 3; year += 1) {
            player = developReturningPlayer({ player, dynastySeed, completedSeasonNumber: year, programId: programIds[index % programIds.length]! })
            recruitedStages[name][year]!.push({ startingOverall: calculateOverall(player), finalPotential: player.potential })
          }
        }
      })
    }
    names.forEach((name) => mutable[name].push(...rankProfiles(unranked[name])))
  }
  return { arms: mutable, seasonZero, lifecycle: includeLifecycle ? { seasonZero: s0Stages, recruited: recruitedStages } : undefined }
}

const ARM_NAMES: readonly ArmName[] = ['V1', 'Refined', 'Final']
const JOINT = [
  ['OVR <65 / POT 85+', (r: Profile) => r.startingOverall < 65 && r.finalPotential >= 85], ['OVR <65 / POT 95+', (r: Profile) => r.startingOverall < 65 && r.finalPotential >= 95],
  ['OVR 65–74 / POT 90+', (r: Profile) => r.startingOverall >= 65 && r.startingOverall <= 74 && r.finalPotential >= 90], ['OVR 65–74 / POT 95+', (r: Profile) => r.startingOverall >= 65 && r.startingOverall <= 74 && r.finalPotential >= 95],
  ['OVR 75+ / POT 90+', (r: Profile) => r.startingOverall >= 75 && r.finalPotential >= 90], ['OVR 75+ / POT 95+', (r: Profile) => r.startingOverall >= 75 && r.finalPotential >= 95],
  ['OVR 80+ / POT 95+', (r: Profile) => r.startingOverall >= 80 && r.finalPotential >= 95], ['OVR 80+ / POT 97+', (r: Profile) => r.startingOverall >= 80 && r.finalPotential >= 97],
] as const
function fixed(value: number, digits = 2): string { return value.toFixed(digits) }
function pct<T>(rows: readonly T[], test: (row: T) => boolean): string { return `${fixed(rows.filter(test).length / rows.length * 100)}%` }
function countRate<T>(rows: readonly T[], test: (row: T) => boolean): string { const count = rows.filter(test).length; return `${count} (${fixed(count / rows.length * 100)}%)` }
function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): void {
  console.log(`| ${headers.join(' | ')} |`); console.log(`| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`))
}
function metricTable(arms: Readonly<Record<ArmName, readonly Profile[]>>, metrics: readonly (readonly [string, (row: Profile) => boolean])[], counts = false): void {
  table(['Metric', ...ARM_NAMES], metrics.map(([label, test]) => [label, ...ARM_NAMES.map((name) => counts ? countRate(arms[name], test) : pct(arms[name], test))]))
}
function premiumRows(rows: readonly Profile[], kind: 'top25' | 'five' | 'premium'): readonly Profile[] {
  return rows.filter((row) => kind === 'top25' ? row.nationalRank <= 25 : kind === 'five' ? row.stars === 5 : row.stars >= 4)
}
function diagnosticLabel(row: Profile): string {
  const headroom = row.finalPotential - row.startingOverall
  if (row.finalPotential === 99) return 'generational'
  if (row.startingOverall < 75 && row.finalPotential >= 90) return 'project'
  if (row.finalPotential >= 95) return 'elite upside'
  if (row.startingOverall >= 82 && headroom <= 5) return 'polished'
  if (row.startingOverall >= 78 && headroom >= 8) return 'balanced'
  return headroom <= 7 ? 'limited runway' : 'developmental'
}
function printTop25Samples(rows: readonly Profile[]): void {
  const grouped = new Map<number, Profile[]>()
  rows.filter((row) => row.nationalRank <= 25).forEach((row) => grouped.set(row.sample, [...(grouped.get(row.sample) ?? []), row]))
  const classes = [...grouped.entries()]
  const tail = (classRows: readonly Profile[]) => classRows.filter((row) => row.finalPotential >= 95).length
  const tailCounts = classes.map(([, classRows]) => tail(classRows))
  const medianTail = percentile(tailCounts, .5)
  const typical = classes.reduce((best, current) => Math.abs(tail(current[1]) - medianTail) < Math.abs(tail(best[1]) - medianTail) ? current : best)
  const strong = classes.reduce((best, current) => {
    const score = (entry: [number, Profile[]]) => tail(entry[1]) * 10 + entry[1].filter((row) => row.finalPotential === 99).length
    return score(current) > score(best) ? current : best
  })
  const ordinary = classes.reduce((best, current) => tail(current[1]) < tail(best[1]) ? current : best)
  for (const [label, entry] of [['Typical', typical], ['Strong-tail', strong], ['Ordinary', ordinary]] as const) {
    console.log(`\n### ${label} class — sample ${entry[0]} (${tail(entry[1])} POT95+, ${entry[1].filter((row) => row.finalPotential === 99).length} POT99)`)
    table(['Rank', 'Pos', 'OVR', 'POT', 'HR', 'Stars', 'Diagnostic'], [...entry[1]].sort((a, b) => a.nationalRank - b.nationalRank).map((row) => [row.nationalRank, row.position, row.startingOverall, row.finalPotential, row.finalPotential - row.startingOverall, row.stars, diagnosticLabel(row)]))
  }
}

export function runReport(): void {
  const classes = Number(process.env.CLASSES ?? 500)
  const seedRoot = process.env.SEED ?? 'recruit-talent-profile-v2-sweep:v1'
  if (!Number.isSafeInteger(classes) || classes < 1) throw new RangeError('CLASSES must be a positive safe integer.')
  const includeLifecycle = process.env.LIFECYCLE === '1'
  const { arms, seasonZero, lifecycle } = collectPairedProfiles(classes, seedRoot, includeLifecycle)
  console.log('# Recruit Talent Profile V2 — calibration sweep')
  console.log(`Classes: ${classes}; Recruits per arm: ${arms.V1.length}; S0 freshmen: ${seasonZero.length}; seed root: ${seedRoot}`)
  console.log('\n## Candidate weights (limited / normal / high / elite 95–96 / exceptional 97–99)')
  for (const name of ARM_NAMES.slice(1) as readonly CalibrationName[]) {
    table([name, ...READINESS_TIERS], [['Weights', ...READINESS_TIERS.map((tier) => CALIBRATION_WEIGHTS[name][tier].map((weight) => fixed(weight * 100, 1)).join('/'))]])
  }
  console.log('\n## Freshman ability invariants')
  table(['Arm', 'Mean', 'Median', 'P10/P25/P75/P90/P95/P99', '80+'], ARM_NAMES.map((name) => {
    const rows = arms[name]; const values = rows.map((r) => r.startingOverall)
    return [name, fixed(average(values)), fixed(percentile(values, .5), 0), [.1, .25, .75, .9, .95, .99].map((p) => fixed(percentile(values, p), 0)).join('/'), pct(rows, (r) => r.startingOverall >= 80)]
  }))
  metricTable(arms, [['OVR <60', (r) => r.startingOverall < 60], ['OVR 60–64', (r) => r.startingOverall >= 60 && r.startingOverall <= 64], ['OVR 65–74', (r) => r.startingOverall >= 65 && r.startingOverall <= 74], ['OVR 75–79', (r) => r.startingOverall >= 75 && r.startingOverall <= 79], ['OVR 80+', (r) => r.startingOverall >= 80]])
  metricTable(arms, [...READINESS_TIERS.map((tier) => [`Readiness ${tier}`, (r: Profile) => r.readinessTier === tier] as const), ...POSITIONS.map((position) => [`Position ${position}`, (r: Profile) => r.position === position] as const)])
  console.log('\n## Raw ceiling supply')
  metricTable(arms, [['85–89', (r) => r.rawCeiling >= 85 && r.rawCeiling <= 89], ['90–94', (r) => r.rawCeiling >= 90 && r.rawCeiling <= 94], ['95–96', (r) => r.rawCeiling >= 95 && r.rawCeiling <= 96], ['97–99', (r) => r.rawCeiling >= 97], ['Raw 90+', (r) => r.rawCeiling >= 90], ['Raw 95+', (r) => r.rawCeiling >= 95], ['Raw 97+', (r) => r.rawCeiling >= 97], ['Raw 99', (r) => r.rawCeiling === 99]], true)
  console.log('\n## Final POT and headroom')
  metricTable(arms, [['POT 90+', (r) => r.finalPotential >= 90], ['POT 95+', (r) => r.finalPotential >= 95], ['POT 97+', (r) => r.finalPotential >= 97], ['POT 99', (r) => r.finalPotential === 99], ['HR 0–3', (r) => r.finalPotential - r.startingOverall <= 3], ['HR 4–7', (r) => r.finalPotential - r.startingOverall >= 4 && r.finalPotential - r.startingOverall <= 7], ['HR 8–12', (r) => r.finalPotential - r.startingOverall >= 8 && r.finalPotential - r.startingOverall <= 12], ['HR 13–19', (r) => r.finalPotential - r.startingOverall >= 13 && r.finalPotential - r.startingOverall <= 19], ['HR 20+', (r) => r.finalPotential - r.startingOverall >= 20]], true)
  console.log('\n## Joint profiles')
  metricTable(arms, JOINT, true)
  console.log('\n## Relationship strength')
  table(['Arm', 'Readiness↔raw correlation'], ARM_NAMES.map((name) => [name, fixed(correlation(arms[name].map((r) => ({ first: r.readiness, second: r.rawCeiling }))), 3)]))
  console.log('\n## Premium composition')
  for (const [label, kind] of [['Top 25', 'top25'], ['5-star', 'five'], ['4–5 star', 'premium']] as const) {
    console.log(`\n### ${label}`)
    const selected = Object.fromEntries(ARM_NAMES.map((name) => [name, premiumRows(arms[name], kind)])) as Record<ArmName, readonly Profile[]>
    metricTable(selected, [['OVR 80+', (r) => r.startingOverall >= 80], ['POT 90+', (r) => r.finalPotential >= 90], ['POT 95+', (r) => r.finalPotential >= 95], ['OVR80+/POT95+', (r) => r.startingOverall >= 80 && r.finalPotential >= 95], ['Raw project OVR<65/POT85+', (r) => r.startingOverall < 65 && r.finalPotential >= 85], ['Ready limited OVR75+/HR≤7', (r) => r.startingOverall >= 75 && r.finalPotential - r.startingOverall <= 7], ['HR 20+', (r) => r.finalPotential - r.startingOverall >= 20]])
  }
  console.log('\n## Refined example Top-25 classes')
  printTop25Samples(arms.Final)
  console.log('\n## Candidate B interaction')
  metricTable(arms, [['Natural raw ceiling', (r) => r.branch === 'natural-raw-ceiling'], ['Natural low-OVR floor', (r) => r.branch === 'natural-low-ovr'], ['Zero-gap preservation', (r) => r.branch === 'candidate-zero'], ['Runway handling', (r) => r.branch === 'candidate-runway'], ['99 cap', (r) => r.branch === 'candidate-capped-99']], true)
  console.log('\n## Season 0 freshman continuity')
  const freshStats = (rows: readonly FreshmanProfile[]) => {
    const ovr = rows.map((r) => r.startingOverall); const pot = rows.map((r) => r.finalPotential)
    return [fixed(average(ovr)), fixed(percentile(ovr, .5), 0), fixed(average(pot)), fixed(percentile(pot, .5), 0), pct(rows, (r) => r.finalPotential >= 90), pct(rows, (r) => r.finalPotential >= 95), pct(rows, (r) => r.finalPotential >= 97), pct(rows, (r) => r.finalPotential === 99), pct(rows, (r) => r.finalPotential - r.startingOverall >= 20), pct(rows, (r) => r.startingOverall < 65 && r.finalPotential >= 85), pct(rows, (r) => r.startingOverall >= 75 && r.finalPotential >= 95)]
  }
  table(['Population', 'OVR μ', 'OVR med', 'POT μ', 'POT med', 'POT90+', 'POT95+', 'POT97+', 'POT99', 'HR20+', '<65/85+', '75+/95+'], [
    ['S0 FR', ...freshStats(seasonZero)], ...ARM_NAMES.map((name) => [name, ...freshStats(arms[name])]),
  ])
  if (lifecycle) {
    console.log('\n## Career-stage continuity through unchanged Development')
    const stageStats = (rows: readonly FreshmanProfile[]) => {
      const ovr = rows.map((row) => row.startingOverall)
      return [rows.length, fixed(average(ovr)), fixed(percentile(ovr, .5), 0), fixed(percentile(ovr, .9), 0), fixed(percentile(ovr, .95), 0), pct(rows, (row) => row.startingOverall >= 80), pct(rows, (row) => row.startingOverall >= 85), pct(rows, (row) => row.startingOverall >= 90), fixed(average(rows.map((row) => row.finalPotential))), pct(rows, (row) => row.finalPotential - row.startingOverall >= 10)]
    }
    table(['Stage/population', 'n', 'OVR μ', 'med', 'P90', 'P95', 'OVR80+', 'OVR85+', 'OVR90+', 'POT μ', 'HR10+'], (['FR', 'SO', 'JR', 'SR'] as const).flatMap((stage, index) => [
      [`S0 ${stage}`, ...stageStats(lifecycle.seasonZero[stage])],
      [`V1 Recruit ${stage}`, ...stageStats(lifecycle.recruited.V1[index]!)],
      [`Refined Recruit ${stage}`, ...stageStats(lifecycle.recruited.Refined[index]!)],
      [`Final Recruit ${stage}`, ...stageStats(lifecycle.recruited.Final[index]!)],
    ]))
  }
  const baseline = arms.V1
  const invariants = ARM_NAMES.every((name) => {
    const byId = new Map(arms[name].map((row) => [row.playerId, row]))
    return baseline.every((row) => { const other = byId.get(row.playerId); return other?.position === row.position && other.readiness === row.readiness && other.startingOverall === row.startingOverall })
  })
  console.log(`\nSanity: paired entry invariants=${invariants}; invalid POT=${ARM_NAMES.map((name) => `${name}:${arms[name].filter((r) => r.finalPotential < r.startingOverall || r.finalPotential > 99).length}`).join(', ')}`)
}

if (process.argv[1]?.endsWith('recruitTalentProfileV2A.ts')) runReport()
