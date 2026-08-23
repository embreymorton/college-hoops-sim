import { calculateOverall, type ClassYear, type Player } from '../src/engine'
import { developReturningPlayer, generateRecruitingClass } from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'

type Observation = { readonly overall: number; readonly potential: number }
type UniverseFreshmen = { readonly seed: string; readonly rows: readonly Observation[] }
const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
const OVR_THRESHOLDS = [80, 85, 88, 90, 92, 93, 95] as const
const POT_THRESHOLDS = [90, 95, 97] as const

function makeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
    seasonNumber: 1,
  })
}

function observation(player: Player): Observation {
  return { overall: calculateOverall(player), potential: player.potential }
}

export function collectS0TalentContinuity(universes: number, seedRoot: string) {
  const s0 = Object.fromEntries(YEARS.map((year) => [year, [] as Observation[]])) as Record<ClassYear, Observation[]>
  const recruitStages = [[], [], [], []] as Observation[][]
  const recruitClasses: Observation[][] = []
  const freshmanUniverses: UniverseFreshmen[] = []

  for (let index = 0; index < universes; index += 1) {
    const seed = `${seedRoot}:${index}`
    const season = makeSeason(seed)
    const freshmen: Observation[] = []
    Object.values(season.programStates).forEach(({ team }) => team.roster.forEach((player) => {
      const row = observation(player)
      s0[player.classYear].push(row)
      if (player.classYear === 'FR') freshmen.push(row)
    }))
    freshmanUniverses.push({ seed, rows: freshmen.sort((a, b) => b.overall - a.overall || b.potential - a.potential) })

    const recruits = generateRecruitingClass({ dynastySeed: `${seed}:recruiting`, targetSeasonNumber: 2, season })
    const recruitClass = recruits.map(({ player }) => observation(player))
    recruitClasses.push(recruitClass)
    const programIds = Object.keys(season.programStates).sort()
    recruits.forEach((recruit, recruitIndex) => {
      let player = recruit.player
      recruitStages[0]!.push(observation(player))
      for (let stage = 1; stage <= 3; stage += 1) {
        player = developReturningPlayer({
          player,
          dynastySeed: `${seed}:recruiting`,
          completedSeasonNumber: stage,
          programId: programIds[recruitIndex % programIds.length]!,
        })
        recruitStages[stage]!.push(observation(player))
      }
    })
  }
  return { s0, recruitStages, recruitClasses, freshmanUniverses }
}

function fixed(value: number, digits = 2): string { return value.toFixed(digits) }
function rate(rows: readonly Observation[], test: (row: Observation) => boolean): string {
  const count = rows.filter(test).length
  return `${count} (${fixed(count / rows.length * 100)}%)`
}
function table(headers: readonly string[], rows: readonly (readonly (string | number)[])[]): void {
  console.log(`| ${headers.join(' | ')} |`)
  console.log(`| ${headers.map(() => '---').join(' | ')} |`)
  rows.forEach((row) => console.log(`| ${row.join(' | ')} |`))
}
function summary(rows: readonly Observation[]) {
  const values = rows.map(({ overall }) => overall)
  return { mean: average(values), median: percentile(values, .5), p75: percentile(values, .75), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), max: Math.max(...values) }
}
function headroomBand(row: Observation): string {
  const gap = row.potential - row.overall
  return gap <= 3 ? '0–3' : gap <= 7 ? '4–7' : gap <= 12 ? '8–12' : gap <= 19 ? '13–19' : '20+'
}
function printPopulation(label: string, rows: readonly Observation[]): void {
  const s = summary(rows)
  console.log(`\n### ${label} (n=${rows.length})`)
  console.log(`OVR mean/median/P75/P90/P95/P99/max: ${fixed(s.mean)}/${s.median}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`)
  table(['OVR threshold', 'Count (rate)'], OVR_THRESHOLDS.map((threshold) => [`${threshold}+`, rate(rows, (row) => row.overall >= threshold)]))
  console.log(`POT mean/median: ${fixed(average(rows.map((row) => row.potential)))}/${percentile(rows.map((row) => row.potential), .5)}`)
  console.log(`POT ${POT_THRESHOLDS.map((threshold) => `${threshold}+ ${rate(rows, (row) => row.potential >= threshold)}`).join(' | ')} | 99 ${rate(rows, (row) => row.potential === 99)}`)
  console.log(`Headroom ${['0–3', '4–7', '8–12', '13–19', '20+'].map((band) => `${band} ${rate(rows, (row) => headroomBand(row) === band)}`).join(' | ')}`)
}

function printJoint(label: string, rows: readonly Observation[]): void {
  const metrics: readonly [string, (row: Observation) => boolean][] = [
    ['OVR80+/POT95+', (r) => r.overall >= 80 && r.potential >= 95],
    ['OVR85+/POT95+', (r) => r.overall >= 85 && r.potential >= 95],
    ['OVR88+/POT95+', (r) => r.overall >= 88 && r.potential >= 95],
    ['OVR90+/POT95+', (r) => r.overall >= 90 && r.potential >= 95],
    ['OVR90+/POT99', (r) => r.overall >= 90 && r.potential === 99],
    ['OVR93+/POT99', (r) => r.overall >= 93 && r.potential === 99],
  ]
  console.log(`\n${label}: ${metrics.map(([name, test]) => `${name} ${rate(rows, test)}`).join(' | ')}`)
  console.log(`OVR↔POT correlation ${fixed(correlation(rows.map((r) => ({ first: r.overall, second: r.potential }))), 3)} | OVR↔headroom ${fixed(correlation(rows.map((r) => ({ first: r.overall, second: r.potential - r.overall }))), 3)}`)
}

function universeRate(universes: readonly UniverseFreshmen[], test: (rows: readonly Observation[]) => boolean): string {
  const count = universes.filter(({ rows }) => test(rows)).length
  return `${count}/${universes.length} (${fixed(count / universes.length * 100)}%)`
}

function printClassIncidence(label: string, groups: readonly (readonly Observation[])[]): void {
  const wrapped = groups.map((rows, index) => ({ seed: `${label}:${index}`, rows }))
  console.log(`\n${label} class incidence`)
  for (const threshold of [90, 92, 93] as const) {
    console.log(`At least one ${threshold}+: ${universeRate(wrapped, (rows) => rows.some((r) => r.overall >= threshold))}`)
  }
  console.log(`Multiple 90+: ${universeRate(wrapped, (rows) => rows.filter((r) => r.overall >= 90).length >= 2)}`)
  console.log(`Multiple 93+: ${universeRate(wrapped, (rows) => rows.filter((r) => r.overall >= 93).length >= 2)}`)
}

function printFreshmenToKnow(universes: readonly UniverseFreshmen[], recruitClasses: readonly (readonly Observation[])[]): void {
  console.log('\n## Freshmen to Know / universe incidence')
  for (const threshold of [90, 92, 93] as const) {
    console.log(`At least one ${threshold}+: ${universeRate(universes, (rows) => rows.some((r) => r.overall >= threshold))}`)
  }
  console.log(`Multiple 90+: ${universeRate(universes, (rows) => rows.filter((r) => r.overall >= 90).length >= 2)}`)
  console.log(`Multiple 93+: ${universeRate(universes, (rows) => rows.filter((r) => r.overall >= 93).length >= 2)}`)
  console.log(`Top 3 one/two/three 90+: ${[1, 2, 3].map((n) => universeRate(universes, (rows) => rows.slice(0, 3).filter((r) => r.overall >= 90).length === n)).join(' | ')}`)
  console.log(`Top 3 any 93+: ${universeRate(universes, (rows) => rows.slice(0, 3).some((r) => r.overall >= 93))}`)
  console.log(`Top 3 multiple/three POT99: ${universeRate(universes, (rows) => rows.slice(0, 3).filter((r) => r.potential === 99).length >= 2)} | ${universeRate(universes, (rows) => rows.slice(0, 3).every((r) => r.potential === 99))}`)
  printClassIncidence('Recruit V2', recruitClasses)
  const score = ({ rows }: UniverseFreshmen) => average(rows.slice(0, 3).map((r) => r.overall))
  const ordered = [...universes].sort((a, b) => score(a) - score(b))
  const examples = [['Weak/ordinary', ordered[0]!], ['Typical', ordered[Math.floor(ordered.length / 2)]!], ['Strong', ordered.at(-1)!]] as const
  for (const [label, universe] of examples) {
    console.log(`\n${label} ${universe.seed}`)
    table(['Rank', 'OVR', 'POT', 'Headroom'], universe.rows.slice(0, 10).map((r, i) => [i + 1, r.overall, r.potential, r.potential - r.overall]))
  }
}

function printPot99(label: string, rows: readonly Observation[], groups: readonly (readonly Observation[])[]): void {
  const counts = groups.map((group) => group.filter((r) => r.potential === 99).length)
  const pot99 = rows.filter((r) => r.potential === 99)
  console.log(`\n${label} POT99 per class/universe mean ${fixed(average(counts))}; zero/one/two/3+ ${[0, 1, 2].map((n) => `${n}: ${fixed(counts.filter((c) => c === n).length / counts.length * 100)}%`).join(' | ')} | 3+: ${fixed(counts.filter((c) => c >= 3).length / counts.length * 100)}%`)
  console.log(`POT99 OVR mean/median/P10/P90/range ${fixed(average(pot99.map((r) => r.overall)))}/${percentile(pot99.map((r) => r.overall), .5)}/${percentile(pot99.map((r) => r.overall), .1)}/${percentile(pot99.map((r) => r.overall), .9)}/${Math.min(...pot99.map((r) => r.overall))}–${Math.max(...pot99.map((r) => r.overall))}`)
}

function profileRates(rows: readonly Observation[]): string {
  const profiles: readonly [string, (r: Observation) => boolean][] = [
    ['polished FR 85+/HR≤3', (r) => r.overall >= 85 && r.potential - r.overall <= 3],
    ['elite+runway 85+/POT94+/HR4+', (r) => r.overall >= 85 && r.potential >= 94 && r.potential - r.overall >= 4],
    ['project <75/POT95+', (r) => r.overall < 75 && r.potential >= 95],
  ]
  return profiles.map(([name, test]) => `${name}: ${rate(rows, test)}`).join(' | ')
}

export function runReport(): void {
  const universes = Number(process.env.UNIVERSES ?? 500)
  const seedRoot = process.env.SEED ?? 's0-talent-continuity:v1'
  const data = collectS0TalentContinuity(universes, seedRoot)
  const recruits = data.recruitStages[0]!
  console.log(`# S0 Player Talent Profile Continuity\nUniverses/classes: ${universes}/${universes}; S0 Players ${YEARS.reduce((n, y) => n + data.s0[y].length, 0)}; S0 FR ${data.s0.FR.length}; Recruit V2 entrants ${recruits.length}; deterministic seed ${seedRoot}`)
  printPopulation('S0 freshmen', data.s0.FR)
  printPopulation('Recruit V2 entrants', recruits)
  printFreshmenToKnow(data.freshmanUniverses, data.recruitClasses)
  printJoint('S0 freshmen', data.s0.FR)
  printJoint('Recruit V2 entrants', recruits)
  printPot99('S0 freshmen', data.s0.FR, data.freshmanUniverses.map((u) => u.rows))
  printPot99('Recruit V2 entrants', recruits, data.recruitClasses)
  console.log('\n## Whole S0 and equivalent endogenous stages')
  table(['Stage', 'N', 'OVR mean/med/P90/P95/P99', '80+', '85+', '90+', '95+', 'POT mean/med', 'POT90+/95+/97+/99'], YEARS.flatMap((year, stage) => {
    const format = (label: string, rows: readonly Observation[]) => {
      const s = summary(rows)
      return [label, rows.length, `${fixed(s.mean)}/${s.median}/${s.p90}/${s.p95}/${s.p99}`, ...[80, 85, 90, 95].map((t) => fixed(rows.filter((r) => r.overall >= t).length / rows.length * 100) + '%'), `${fixed(average(rows.map((r) => r.potential)))}/${percentile(rows.map((r) => r.potential), .5)}`, `${[90, 95, 97].map((t) => fixed(rows.filter((r) => r.potential >= t).length / rows.length * 100)).join('/')}/${fixed(rows.filter((r) => r.potential === 99).length / rows.length * 100)}%`]
    }
    return [format(`S0 ${year}`, data.s0[year]), format(`Recruit +${stage}`, data.recruitStages[stage]!)]
  }))
  console.log('\n## Headroom by stage')
  for (const [label, rows] of YEARS.flatMap((year, stage) => [[`S0 ${year}`, data.s0[year]] as const, [`Recruit +${stage}`, data.recruitStages[stage]!] as const])) {
    console.log(`${label}: ${['0–3', '4–7', '8–12', '13–19', '20+'].map((band) => `${band} ${fixed(rows.filter((r) => headroomBand(r) === band).length / rows.length * 100)}%`).join(' | ')}`)
  }
  console.log(`\n## Profile semantics\nS0 FR: ${profileRates(data.s0.FR)}\nRecruit entry: ${profileRates(recruits)}`)
}

if (import.meta.url === `file://${process.argv[1]}`) runReport()
