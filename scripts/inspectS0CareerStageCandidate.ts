import { calculateOverall, createRng, generateTeam, type ClassYear } from '../src/engine'
import { developReturningPlayer, generateRecruitingClass } from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0, type ProgramDefinition } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'
import { S0_CAREER_STAGE_CANDIDATE } from './s0CareerStageCandidate'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
const THRESHOLDS = [80, 85, 88, 90, 92, 93, 95, 97, 98, 99] as const
type Row = { overall: number; classYear: ClassYear; programId: string; prestige: number; playerId: string; name: string; position: string; seed: string }
type TeamRow = { seed: string; programId: string; prestige: number; production: Row[]; candidate: Row[] }

const fixed = (value: number, digits = 2) => value.toFixed(digits)
const sd = (values: readonly number[]) => { const mean = average(values); return Math.sqrt(average(values.map((v) => (v - mean) ** 2))) }
const summarize = (values: readonly number[]) => ({ mean: average(values), median: percentile(values, .5), sd: sd(values), p10: percentile(values, .1), p25: percentile(values, .25), p75: percentile(values, .75), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), min: values.reduce((result, value) => Math.min(result, value), Number.POSITIVE_INFINITY), max: values.reduce((result, value) => Math.max(result, value), Number.NEGATIVE_INFINITY) })
const percent = (n: number, d: number) => `${fixed(n / d * 100)}%`
const table = (headers: string[], rows: (string | number)[][]) => { console.log(`| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`)) }

function makeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  return initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
}

function legacyProgramRoster(seed: string, program: ProgramDefinition) {
  const programSeed = JSON.stringify({
    universeId: UNIVERSE_V0.id,
    universeVersion: UNIVERSE_V0.version,
    rosterGenerationVersion: UNIVERSE_V0.rosterGenerationVersion,
    dynastySeed: { type: 'string', value: `${seed}:universe` },
    programId: program.id,
  })
  return generateTeam({
    name: program.name,
    abbreviation: program.abbreviation,
    prestige: program.basePrestige,
    rng: createRng(programSeed),
  }).roster
}

function collect(universes: number, root: string) {
  const teams: TeamRow[] = []
  const references = YEARS.map(() => [] as number[])
  for (let index = 0; index < universes; index += 1) {
    const seed = `${root}:${index}`
    const season = makeSeason(seed)
    for (const [programId, { team }] of Object.entries(season.programStates)) {
      const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)!
      const legacyRoster = legacyProgramRoster(seed, program)
      const row = (classYear: ClassYear, player: typeof team.roster[number]): Row => ({ overall: calculateOverall(player), classYear, programId, prestige: team.prestige, playerId: player.id, name: `${player.firstName} ${player.lastName}`, position: player.position, seed })
      teams.push({ seed, programId, prestige: team.prestige, production: legacyRoster.map((p) => row(p.classYear, p)), candidate: team.roster.map((p) => row(p.classYear, p)) })
    }
    const recruits = generateRecruitingClass({ dynastySeed: `${seed}:recruiting`, targetSeasonNumber: 2, season })
    const programIds = Object.keys(season.programStates).sort()
    recruits.forEach(({ player }, recruitIndex) => {
      let developed = player
      references[0]!.push(calculateOverall(developed))
      for (let stage = 1; stage < 4; stage += 1) {
        developed = developReturningPlayer({ player: developed, dynastySeed: `${seed}:recruiting`, completedSeasonNumber: stage, programId: programIds[recruitIndex % programIds.length]! })
        references[stage]!.push(calculateOverall(developed))
      }
    })
  }
  return { teams, references }
}

const flatten = (teams: TeamRow[], arm: 'production' | 'candidate') => teams.flatMap((team) => team[arm])
const byYear = (rows: Row[], year: ClassYear) => rows.filter(({ classYear }) => classYear === year)
function classSummary(rows: Row[]) {
  const values = rows.map(({ overall }) => overall); const s = summarize(values)
  return [rows.length, fixed(s.mean), s.median, s.p75, s.p90, s.p95, s.p99, s.max, ...THRESHOLDS.map((t) => `${rows.filter((r) => r.overall >= t).length} (${percent(rows.filter((r) => r.overall >= t).length, rows.length)})`)]
}
function probabilityExceeds(first: number[], second: number[]) {
  const sorted = [...second].sort((a, b) => a - b); let count = 0
  for (const value of first) { let low = 0; let high = sorted.length; while (low < high) { const mid = (low + high) >>> 1; if (sorted[mid]! < value) low = mid + 1; else high = mid } count += low }
  return count / (first.length * second.length)
}
function nationalShares(teams: TeamRow[], arm: 'production' | 'candidate', top: number) {
  const counts = Object.fromEntries(YEARS.map((y) => [y, 0])) as Record<ClassYear, number>
  const seeds = [...new Set(teams.map(({ seed }) => seed))]
  for (const seed of seeds) flatten(teams.filter((t) => t.seed === seed), arm).sort((a, b) => b.overall - a.overall || a.playerId.localeCompare(b.playerId)).slice(0, top).forEach((r) => counts[r.classYear]++)
  return YEARS.map((y) => percent(counts[y], seeds.length * top))
}
function leaderShares(teams: TeamRow[], arm: 'production' | 'candidate', rank: number) {
  const leaders = teams.map((team) => [...team[arm]].sort((a, b) => b.overall - a.overall || a.playerId.localeCompare(b.playerId))[rank]!)
  return YEARS.map((y) => percent(leaders.filter((r) => r.classYear === y).length, leaders.length))
}
function incidence(rows: Row[], universes: number, year: ClassYear, threshold: number, multiple = 1) {
  const seeds = new Map<string, number>(); rows.filter((r) => r.classYear === year && r.overall >= threshold).forEach((r) => seeds.set(r.seed, (seeds.get(r.seed) ?? 0) + 1))
  return `${[...seeds.values()].filter((n) => n >= multiple).length}/${universes} (${percent([...seeds.values()].filter((n) => n >= multiple).length, universes)})`
}
function roster(team: TeamRow, arm: 'production' | 'candidate') { return [...team[arm]].sort((a, b) => b.overall - a.overall).map((r) => `${r.position} ${r.classYear} ${r.overall}`).join(', ') }

export function runReport() {
  const universes = Number(process.env.UNIVERSES ?? 1_000); const root = process.env.SEED ?? 's0-career-stage-candidate:v1'
  const { teams, references } = collect(universes, root); const production = flatten(teams, 'production'); const candidate = flatten(teams, 'candidate')
  console.log(`# S0 Career-Stage Candidate A\n${JSON.stringify(S0_CAREER_STAGE_CANDIDATE)}\nUniverses ${universes}; Programs ${teams.length}; Players ${candidate.length}; Recruit references ${references[0]!.length}; seed ${root}`)
  const teamAverage = (team: TeamRow) => average(team.production.map((r) => r.overall)); const candidateAverage = (team: TeamRow) => average(team.candidate.map((r) => r.overall))
  const prodTeam = teams.map(teamAverage); const candTeam = teams.map(candidateAverage); const movement = teams.map((t) => Math.abs(teamAverage(t) - candidateAverage(t)))
  console.log('\n## Program preservation'); console.log({ production: summarize(prodTeam), candidate: summarize(candTeam), mae: average(movement), maxDifference: Math.max(...movement), rankCorrelation: correlation(prodTeam.map((first, i) => ({ first, second: candTeam[i]! }))), prestigeCorrelationProduction: correlation(teams.map((t, i) => ({ first: t.prestige, second: prodTeam[i]! }))), prestigeCorrelationCandidate: correlation(teams.map((t, i) => ({ first: t.prestige, second: candTeam[i]! }))), changed0: movement.filter((v) => v === 0).length, changed1: movement.filter((v) => v > 0 && v < 2).length, changed2: movement.filter((v) => v >= 2).length })
  const quartile = [...teams].sort((a, b) => a.prestige - b.prestige); const q = Math.floor(quartile.length / 4); console.log(`Bottom/top prestige candidate OVR ${fixed(average(quartile.slice(0, q).map(candidateAverage)))}/${fixed(average(quartile.slice(-q).map(candidateAverage)))}`)
  table(['Arm', 'Best', 'Top3', 'Top5', 'All12'], (['production', 'candidate'] as const).map((arm) => [arm, ...[1, 3, 5, 12].map((n) => fixed(average(teams.map((t) => average([...t[arm]].sort((a, b) => b.overall - a.overall).slice(0, n).map((r) => r.overall))))))]))
  console.log('\n## Career stages'); table(['Arm/Class', 'N', 'Mean', 'Med', 'P75', 'P90', 'P95', 'P99', 'Max', ...THRESHOLDS.map((t) => `${t}+`)], (['production', 'candidate'] as const).flatMap((arm) => YEARS.map((year) => [`${arm} ${year}`, ...classSummary(byYear(arm === 'production' ? production : candidate, year))])))
  console.log('\nOverlap candidate SO>FR / JR>SO / SR>JR', [1, 2, 3].map((i) => fixed(probabilityExceeds(byYear(candidate, YEARS[i]!).map((r) => r.overall), byYear(candidate, YEARS[i - 1]!).map((r) => r.overall)) * 100) + '%').join(' / '))
  console.log('\n## Young incidence'); for (const year of ['FR', 'SO'] as const) for (const threshold of [90, 92, 93, 95, 97, 98, 99]) console.log(`${year} any ${threshold}+ ${incidence(candidate, universes, year, threshold)}`); console.log(`FR multiple 90+ ${incidence(candidate, universes, 'FR', 90, 2)}; multiple 93+ ${incidence(candidate, universes, 'FR', 93, 2)}`)
  console.log('\n## National class shares FR/SO/JR/SR'); table(['Arm/group', ...YEARS], (['production', 'candidate'] as const).flatMap((arm) => [[`${arm} Top5`, ...nationalShares(teams, arm, 5)], [`${arm} Top10`, ...nationalShares(teams, arm, 10)], [`${arm} Top25`, ...nationalShares(teams, arm, 25)], ...[90, 93, 95].map((threshold) => { const rows = flatten(teams, arm).filter((r) => r.overall >= threshold); return [`${arm} ${threshold}+`, ...YEARS.map((y) => percent(rows.filter((r) => r.classYear === y).length, rows.length))] })]))
  table(['Arm/rank', ...YEARS], (['production', 'candidate'] as const).flatMap((arm) => [[`${arm} national #1`, ...nationalShares(teams, arm, 1)], ...[0, 1, 2].map((rank) => [`${arm} team #${rank + 1}`, ...leaderShares(teams, arm, rank)])]))
  console.log('\n## Endogenous comparison'); table(['Stage', 'N', 'Mean/Med/P90/P95/P99', '80+', '85+', '90+', '95+'], YEARS.flatMap((year, i) => { const rows = byYear(candidate, year).map((r) => r.overall); const ref = references[i]!; const format = (label: string, values: number[]) => { const s = summarize(values); return [label, values.length, `${fixed(s.mean)}/${s.median}/${s.p90}/${s.p95}/${s.p99}`, ...[80, 85, 90, 95].map((t) => percent(values.filter((v) => v >= t).length, values.length))] }; return [format(`S0 ${year}`, rows), format(`Recruit +${i}`, ref)] }))
  console.log('\n## Extreme tail'); for (const threshold of [95, 97, 98, 99]) { const rows = candidate.filter((r) => r.overall >= threshold); console.log(`${threshold}+ total ${rows.length} (${percent(rows.length, candidate.length)}), per universe ${fixed(rows.length / universes)}, incidence ${new Set(rows.map((r) => r.seed)).size}/${universes}; ` + YEARS.map((y) => `${y} ${rows.filter((r) => r.classYear === y).length} (${incidence(candidate, universes, y, threshold)})`).join(' | ')) }
  console.log('\n## Freshmen to Know'); const freshmanGroups = [...new Set(candidate.map((r) => r.seed))].map((seed) => ({ seed, rows: candidate.filter((r) => r.seed === seed && r.classYear === 'FR').sort((a, b) => b.overall - a.overall || a.playerId.localeCompare(b.playerId)) })); freshmanGroups.sort((a, b) => average(a.rows.slice(0, 3).map((r) => r.overall)) - average(b.rows.slice(0, 3).map((r) => r.overall))); for (const [label, group] of [['Weak', freshmanGroups[0]!], ['Typical', freshmanGroups[Math.floor(universes / 2)]!], ['Strong', freshmanGroups.at(-1)!]] as const) console.log(`${label} ${group.seed}: ${group.rows.slice(0, 3).map((r) => `${r.name} ${r.programId} ${r.position} ${r.overall}`).join(' | ')}`)
  for (const n of [1, 3, 10]) { const values = freshmanGroups.flatMap((g) => g.rows.slice(0, n).map((r) => r.overall)); const s = summarize(values); console.log(`Top ${n} pooled n=${values.length} mean/med/P90/P95/P99/max ${fixed(s.mean)}/${s.median}/${s.p90}/${s.p95}/${s.p99}/${s.max}`) }
  console.log('\n## Roster stories'); const sortedPrestige = [...teams].sort((a, b) => a.prestige - b.prestige); for (const [label, team] of [['Weak', sortedPrestige[0]!], ['Middle', sortedPrestige[Math.floor(sortedPrestige.length / 2)]!], ['Elite', sortedPrestige.at(-1)!]] as const) console.log(`${label} ${team.seed} ${team.programId} prestige ${team.prestige}: ${roster(team, 'candidate')}`); for (const year of YEARS) { const found = teams.find((t) => [...t.candidate].sort((a, b) => b.overall - a.overall)[0]!.classYear === year); if (found) console.log(`${year}-led ${found.seed} ${found.programId}: ${roster(found, 'candidate')}`) }
}

if (import.meta.url === `file://${process.argv[1]}`) runReport()
