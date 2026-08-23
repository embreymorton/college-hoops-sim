import { generateRecruitingClassWithTalentTrace } from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'
import { runDynastyCalibration } from './inspectDynastyLongRun'

const CLASSES = Number(process.env.CLASSES ?? 500)
const SEEDS = Number(process.env.SEEDS ?? 5)
const SEASONS = Number(process.env.SEASONS ?? 10)
const SEED_ROOT = process.env.SEED ?? 'recruit-talent-v2-activation:v1'

interface Entry {
  readonly readiness: number; readonly overall: number; readonly raw: number; readonly potential: number
  readonly rank: number; readonly stars: number; readonly position: string; readonly branch: string
}
function fixed(value: number, digits = 2): string { return value.toFixed(digits) }
function rate<T>(rows: readonly T[], test: (row: T) => boolean): string { const count = rows.filter(test).length; return `${count} (${fixed(count / rows.length * 100)}%)` }
function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): void {
  console.log(`| ${headers.join(' | ')} |`); console.log(`| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`))
}
function makeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  return initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
}
function branch(row: ReturnType<typeof generateRecruitingClassWithTalentTrace>['traces'][number]): string {
  if (!row.eligible) return row.rawCeiling > row.startingOverall ? 'natural-raw-ceiling' : 'natural-low-ovr'
  if (row.preservedZero) return 'candidate-zero'
  return row.cappedAt99 ? 'candidate-capped-99' : 'candidate-runway'
}
function collectEntries(): Entry[] {
  const rows: Entry[] = []
  for (let sample = 0; sample < CLASSES; sample += 1) {
    const dynastySeed = `${SEED_ROOT}:class:${sample}`
    const result = generateRecruitingClassWithTalentTrace({ dynastySeed, targetSeasonNumber: 2, season: makeSeason(`${SEED_ROOT}:sample:${sample}`) })
    const recruitById = new Map(result.recruits.map((recruit) => [recruit.player.id, recruit]))
    result.traces.forEach((trace) => {
      const recruit = recruitById.get(trace.playerId)!
      rows.push({ readiness: trace.readiness, overall: trace.startingOverall, raw: trace.rawCeiling, potential: trace.finalPotential, rank: recruit.nationalRank, stars: recruit.stars, position: trace.position, branch: branch(trace) })
    })
  }
  return rows
}
function premium(entries: readonly Entry[], kind: 'top25' | 'five' | 'premium') {
  return entries.filter((row) => kind === 'top25' ? row.rank <= 25 : kind === 'five' ? row.stars === 5 : row.stars >= 4)
}

export function runReport(): void {
  if (CLASSES < 1 || SEEDS < 2 || SEASONS < 5) throw new RangeError('Use positive classes, at least 2 seeds, and at least 5 seasons.')
  const entries = collectEntries()
  console.log('# Recruit Talent Profile V2 — production activation audit')
  console.log(`Entry classes: ${CLASSES}; Recruits: ${entries.length}; Dynasty seeds: ${SEEDS}; seasons/seed: ${SEASONS}; seed root: ${SEED_ROOT}`)
  const overalls = entries.map((row) => row.overall)
  console.log('\n## Production entry invariants')
  table(['Mean', 'Median', 'P10/P25/P75/P90/P95/P99', 'OVR80+', 'Readiness↔raw'], [[fixed(average(overalls)), fixed(percentile(overalls, .5), 0), [.1, .25, .75, .9, .95, .99].map((p) => fixed(percentile(overalls, p), 0)).join('/'), rate(entries, (row) => row.overall >= 80), fixed(correlation(entries.map((row) => ({ first: row.readiness, second: row.raw }))), 3)]])
  table(['Metric', 'Count/rate'], [
    ['Raw 90+', rate(entries, (r) => r.raw >= 90)], ['Raw 95+', rate(entries, (r) => r.raw >= 95)], ['Raw 97+', rate(entries, (r) => r.raw >= 97)], ['Raw 99', rate(entries, (r) => r.raw === 99)],
    ['POT 90+', rate(entries, (r) => r.potential >= 90)], ['POT 95+', rate(entries, (r) => r.potential >= 95)], ['POT 97+', rate(entries, (r) => r.potential >= 97)], ['POT 99', rate(entries, (r) => r.potential === 99)],
    ...[['HR 0–3', 0, 3], ['HR 4–7', 4, 7], ['HR 8–12', 8, 12], ['HR 13–19', 13, 19], ['HR 20+', 20, 99]].map(([label, low, high]) => [label, rate(entries, (r) => r.potential - r.overall >= Number(low) && r.potential - r.overall <= Number(high))]),
  ])
  console.log('\n## Premium composition')
  table(['Cohort', 'n', 'POT95+', 'OVR80+/POT95+', 'Projects OVR<65/POT85+', 'Ready OVR75+/HR≤7', 'HR20+'], ([['Top 25', 'top25'], ['5-star', 'five'], ['4–5 star', 'premium']] as const).map(([label, kind]) => {
    const rows = premium(entries, kind)
    return [label, rows.length, rate(rows, (r) => r.potential >= 95), rate(rows, (r) => r.overall >= 80 && r.potential >= 95), rate(rows, (r) => r.overall < 65 && r.potential >= 85), rate(rows, (r) => r.overall >= 75 && r.potential - r.overall <= 7), rate(rows, (r) => r.potential - r.overall >= 20)]
  }))
  console.log('\n## Candidate B branches')
  table(['Branch', 'Count/rate'], ['natural-raw-ceiling', 'natural-low-ovr', 'candidate-zero', 'candidate-runway', 'candidate-capped-99'].map((name) => [name, rate(entries, (row) => row.branch === name)]))

  const seeds = Array.from({ length: SEEDS }, (_, index) => `${SEED_ROOT}:dynasty:${index}`)
  const runs = seeds.map((seed) => runDynastyCalibration(seed, SEASONS, 'light'))
  const signed = runs.flatMap((run) => run.signedRecruits)
  const mature = runs.flatMap((run) => run.seasons.filter((season) => season.seasonNumber >= 5))
  console.log('\n## Live Recruiting assignments')
  table(['Prestige band', 'Signed', 'POT95+', 'Projects', 'Top-25'], ['80–100', '60–79', '40–59', '1–39'].map((band) => {
    const rows = signed.filter((row) => row.prestigeBand === band)
    return [band, rows.length, rate(rows, (row) => row.potential >= 95), rate(rows, (row) => row.overall < 65 && row.potential >= 85), rate(rows, (row) => row.nationalRank <= 25)]
  }))
  const concentration = new Map<string, number>()
  runs.forEach((run) => run.signedRecruits.filter((row) => row.nationalRank <= 25).forEach((row) => {
    const key = `${run.seed}:${row.targetSeasonNumber}:${row.programId}`
    concentration.set(key, (concentration.get(key) ?? 0) + 1)
  }))
  const cycles = runs.flatMap((run) => run.recruitingCycles)
  const concentrated = [...concentration.entries()].sort((a, b) => b[1] - a[1])
  const maxClassSize = Math.max(...cycles.flatMap((cycle) => cycle.programClassSizes))
  console.log(`Top-25 maximum single Program haul in one class: ${concentrated[0]?.[1] ?? 0}; Program/classes with 5+ Top-25: ${concentrated.filter(([, count]) => count >= 5).length}/${concentration.size}; largest total class: ${maxClassSize}`)
  console.log(`Largest Top-25 hauls: ${concentrated.slice(0, 5).map(([key, count]) => `${key}=${count}`).join(', ')}`)
  console.log(`Commitment shortfall: ${cycles.reduce((sum, cycle) => sum + Math.max(0, cycle.projectedOpenings - cycle.commitments), 0)}; unsigned compatible 5★/4★: ${runs.reduce((sum, run) => sum + run.health.unsignedFiveStarsWithCompatibleCapacity, 0)}/${runs.reduce((sum, run) => sum + run.health.unsignedFourStarsWithCompatibleCapacity, 0)}; lifecycle failures: ${runs.reduce((sum, run) => sum + run.health.lifecycleFailures, 0)}`)

  console.log('\n## Production lifecycle confirmation')
  table(['Season', 'S0 share', 'Team OVR μ', 'Team SD', '85+ teams', '90+ teams', '85+ players', '90+ players', '95+ players'], Array.from({ length: SEASONS }, (_, index) => index + 1).map((seasonNumber) => {
    const rows = runs.map((run) => run.seasons.find((season) => season.seasonNumber === seasonNumber)!)
    const players = rows.flatMap((season) => season.players)
    const s0 = players.filter((player) => !player.playerId.startsWith('recruit-')).length / players.length
    return [seasonNumber, `${fixed(s0 * 100, 1)}%`, fixed(average(rows.map((season) => season.teamOverall.average))), fixed(average(rows.map((season) => season.teamOverall.standardDeviation))), fixed(average(rows.map((season) => season.teams.filter((team) => team.overall >= 85).length)), 1), fixed(average(rows.map((season) => season.teams.filter((team) => team.overall >= 90).length)), 1), fixed(average(rows.map((season) => season.players.filter((player) => player.overall >= 85).length)), 1), fixed(average(rows.map((season) => season.players.filter((player) => player.overall >= 90).length)), 1), fixed(average(rows.map((season) => season.players.filter((player) => player.overall >= 95).length)), 1)]
  }))
  const teamMeans = mature.map((season) => season.teamOverall.average)
  const playerCounts = (threshold: number) => average(mature.map((season) => season.players.filter((player) => player.overall >= threshold).length))
  console.log(`Mature S5–S${SEASONS}: Team OVR ${fixed(average(teamMeans))}; Team SD ${fixed(average(mature.map((season) => season.teamOverall.standardDeviation)))}; 90+ teams ${fixed(average(mature.map((season) => season.teams.filter((team) => team.overall >= 90).length)))}; players 85+/90+/95+ ${fixed(playerCounts(85))}/${fixed(playerCounts(90))}/${fixed(playerCounts(95))}; invalid POT ${mature.flatMap((season) => season.players).filter((player) => player.potential < player.overall || player.potential > 99).length}`)
}

if (process.argv[1]?.endsWith('inspectRecruitTalentV2Activation.ts')) runReport()
