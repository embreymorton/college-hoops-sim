import { POSITIONS, calculateOverall, calculateTeamStrength, generateDefaultRotationV1, type Player, type Team } from '../src/engine'
import { UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile, summarizeDistribution, type SignedRecruitRecord } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type ProgramRosterTrace, type RosterPlayerTrace } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const CHECKPOINTS = [1, 2, 3, 5, 10, 15, 20, 25] as const
const START = 5
const ranked = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(ranked.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(ranked.slice(3, 6).map((p) => p.id))
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const top = (values: readonly number[], n: number) => average([...values].sort((a, b) => b - a).slice(0, n))
function playerDistribution(runs: readonly DynastyRunResult[]): void {
  console.log('\n1. ACTIVE PLAYER OVR / POT DISTRIBUTION')
  console.log('Season Mean   SD Min Max P90-10 P95 P99 Top10 Top25 Top50 70+ 75+ 80+ 85+ 90+ 95+ POTμ POTsd P85 P90 P95')
  for (const season of CHECKPOINTS) {
    const groups = runs.map((run) => run.rosterTraces.filter((r) => r.seasonNumber === season).flatMap((r) => r.players))
    const metric = (derive: (players: readonly RosterPlayerTrace[]) => number) => average(groups.map(derive))
    const count = (n: number) => metric((players) => players.filter((p) => p.overall >= n).length)
    const pcount = (n: number) => metric((players) => players.filter((p) => p.potential >= n).length)
    console.log(`${String(season).padStart(6)} ${f(metric((p) => average(p.map((x) => x.overall)))).padStart(5)} ${f(metric((p) => summarizeDistribution(p.map((x) => x.overall)).standardDeviation)).padStart(5)} ${f(metric((p) => Math.min(...p.map((x) => x.overall))), 1).padStart(3)} ${f(metric((p) => Math.max(...p.map((x) => x.overall))), 1).padStart(3)} ${f(metric((p) => { const s = summarizeDistribution(p.map((x) => x.overall)); return s.p90 - s.p10 })).padStart(6)} ${f(metric((p) => percentile(p.map((x) => x.overall), .95))).padStart(3)} ${f(metric((p) => percentile(p.map((x) => x.overall), .99))).padStart(3)} ${f(metric((p) => top(p.map((x) => x.overall), 10))).padStart(5)} ${f(metric((p) => top(p.map((x) => x.overall), 25))).padStart(5)} ${f(metric((p) => top(p.map((x) => x.overall), 50))).padStart(5)} ${f(count(70), 1).padStart(4)} ${f(count(75), 1).padStart(4)} ${f(count(80), 1).padStart(4)} ${f(count(85), 1).padStart(4)} ${f(count(90), 1).padStart(4)} ${f(count(95), 1).padStart(4)} ${f(metric((p) => average(p.map((x) => x.potential)))).padStart(4)} ${f(metric((p) => summarizeDistribution(p.map((x) => x.potential)).standardDeviation)).padStart(5)} ${f(pcount(85), 1).padStart(4)} ${f(pcount(90), 1).padStart(4)} ${f(pcount(95), 1).padStart(4)}`)
  }
  const groups = runs.flatMap((run) => Array.from({ length: 21 }, (_, i) => run.rosterTraces.filter((r) => r.seasonNumber === START + i).flatMap((r) => r.players)))
  const summary = (sets: readonly (readonly RosterPlayerTrace[])[]) => ({ sd: average(sets.map((players) => summarizeDistribution(players.map((p) => p.overall)).standardDeviation)), top25: average(sets.map((players) => top(players.map((p) => p.overall), 25))), p95: average(sets.map((players) => percentile(players.map((p) => p.overall), .95))), c85: average(sets.map((players) => rate(players.filter((p) => p.overall >= 85).length, players.length))), c90: average(sets.map((players) => rate(players.filter((p) => p.overall >= 90).length, players.length))), max: average(sets.map((players) => Math.max(...players.map((p) => p.overall)))), min: average(sets.map((players) => Math.min(...players.map((p) => p.overall)))) })
  const a = summary(runs.map((run) => run.rosterTraces.filter((r) => r.seasonNumber === 1).flatMap((r) => r.players))); const b = summary(groups)
  console.log(`Season 1 → mature pooled: OVR SD ${f(a.sd)}→${f(b.sd)}; top-25 ${f(a.top25)}→${f(b.top25)}; P95 ${f(a.p95)}→${f(b.p95)}; 85+ share ${pct(a.c85)}→${pct(b.c85)}; 90+ share ${pct(a.c90)}→${pct(b.c90)}; max ${a.max}→${b.max}; min ${a.min}→${b.min}.`)
}

function byClass(runs: readonly DynastyRunResult[]): void {
  const players = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= START).flatMap((r) => r.players))
  console.log('\n2. MATURE PLAYER OVR BY CLASS YEAR')
  console.log('Class Players Mean   SD P90 P95 80+ 85+ 90+ UnusedPOT')
  for (const year of ['FR', 'SO', 'JR', 'SR']) {
    const rows = players.filter((p) => p.classYear === year); const values = rows.map((p) => p.overall); const s = summarizeDistribution(values)
    console.log(`${year.padEnd(5)} ${String(rows.length).padStart(7)} ${f(s.average).padStart(5)} ${f(s.standardDeviation).padStart(5)} ${f(s.p90).padStart(3)} ${f(percentile(values, .95)).padStart(3)} ${String(rows.filter((p) => p.overall >= 80).length).padStart(3)} ${String(rows.filter((p) => p.overall >= 85).length).padStart(3)} ${String(rows.filter((p) => p.overall >= 90).length).padStart(3)} ${f(average(rows.map((p) => p.potential - p.overall))).padStart(9)}`)
  }
}

function lifecycle(runs: readonly DynastyRunResult[]): void {
  const cohorts = runs.flatMap((run) => run.signedRecruits.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= 22).map((recruit) => {
    const years = [0, 1, 2, 3].map((offset) => run.rosterTraces.find((row) => row.seasonNumber === recruit.targetSeasonNumber + offset && row.programId === recruit.programId)?.players.find((p) => p.playerId === recruit.playerId)?.overall)
    return { recruit, years, peak: Math.max(...years.filter((v): v is number => v !== undefined)) }
  }))
  console.log('\n3. RECRUIT-TO-PLAYER UPPER-TAIL LIFECYCLE')
  console.log('Band       N Year1 Year2 Year3 Year4 Peak Reach80 Reach85 Reach90')
  const bands: readonly [string, (r: SignedRecruitRecord) => boolean][] = [['Top 10', (r) => r.nationalRank <= 10], ['Top 25', (r) => r.nationalRank <= 25], ['Incoming80+', (r) => r.overall >= 80], ['POT85+', (r) => r.potential >= 85], ['POT90+', (r) => r.potential >= 90]]
  for (const [label, test] of bands) {
    const rows = cohorts.filter((c) => test(c.recruit)); const year = (i: number) => average(rows.map((r) => r.years[i]).filter((v): v is number => v !== undefined))
    console.log(`${label.padEnd(10)} ${String(rows.length).padStart(4)} ${[0, 1, 2, 3].map((i) => f(year(i)).padStart(5)).join(' ')} ${f(average(rows.map((r) => r.peak))).padStart(4)} ${pct(rate(rows.filter((r) => r.peak >= 80).length, rows.length)).padStart(7)} ${pct(rate(rows.filter((r) => r.peak >= 85).length, rows.length)).padStart(7)} ${pct(rate(rows.filter((r) => r.peak >= 90).length, rows.length)).padStart(7)}`)
  }
}

function supply(runs: readonly DynastyRunResult[]): void {
  const observations = runs.flatMap((run) => Array.from({ length: 21 }, (_, i) => {
    const rosters = run.rosterTraces.filter((r) => r.seasonNumber === START + i); const elite85 = rosters.filter((r) => TOP3.has(r.programId) || ELITE46.has(r.programId)).flatMap((r) => r.players).filter((p) => p.overall >= 85).length; const top385 = rosters.filter((r) => TOP3.has(r.programId)).flatMap((r) => r.players).filter((p) => p.overall >= 85).length; const fieldIds = new Set(run.tournamentBalanceCandidate.find((o) => o.seasonNumber === START + i)!.field.map((x) => x.programId)); const all85 = rosters.flatMap((r) => r.players).filter((p) => p.overall >= 85).length
    return { all85, all90: rosters.flatMap((r) => r.players).filter((p) => p.overall >= 90).length, one85: rosters.filter((r) => r.players.filter((p) => p.overall >= 85).length >= 1).length, two85: rosters.filter((r) => r.players.filter((p) => p.overall >= 85).length >= 2).length, three85: rosters.filter((r) => r.players.filter((p) => p.overall >= 85).length >= 3).length, multiTop25: rosters.filter((r) => r.players.filter((p) => p.overall >= percentile(rosters.flatMap((x) => x.players).map((p) => p.overall), 1 - 25 / 384)).length >= 2).length, eliteShare: rate(elite85, all85), top3Share: rate(top385, all85), fieldShare: rate(rosters.filter((r) => fieldIds.has(r.programId)).flatMap((r) => r.players).filter((p) => p.overall >= 85).length, all85) }
  }))
  const avg = (key: keyof typeof observations[number]) => average(observations.map((o) => o[key]))
  console.log('\n4. MATURE ELITE-PLAYER SUPPLY / CONCENTRATION — per Season')
  console.log(`85+ ${f(avg('all85'), 1)}; 90+ ${f(avg('all90'), 1)}; Programs with >=1/2/3 85+: ${f(avg('one85'), 1)}/${f(avg('two85'), 1)}/${f(avg('three85'), 1)}; Programs with multiple actual top-25 OVR Players ${f(avg('multiTop25'), 1)}.`)
  console.log(`85+ shares: six elite ${pct(avg('eliteShare'))}; Top 3 ${pct(avg('top3Share'))}; Tournament field ${pct(avg('fieldShare'))}.`)
}

function legalCeilingFor(players: readonly Player[], index: number): { strength: number; roster: Player[] } {
  const available = [...players].sort((a, b) => calculateOverall(b) - calculateOverall(a) || a.id.localeCompare(b.id))
  const selected: Player[] = []
  for (const position of POSITIONS) selected.push(available.find((p) => p.position === position)!)
  const ids = new Set(selected.map((p) => p.id)); selected.push(...available.filter((p) => !ids.has(p.id)).slice(0, 12 - selected.length))
  const team: Team = { id: `ceiling-${index}`, name: 'Ceiling', abbreviation: 'CEI', prestige: 100, roster: selected }
  return { strength: calculateTeamStrength(team, generateDefaultRotationV1(team)).overall, roster: selected }
}
function ceilingsAndRequirements(runs: readonly DynastyRunResult[]): void {
  const ceilings = runs.flatMap((run) => Array.from({ length: 21 }, (_, i) => {
    let pool = run.rosterTraces.filter((r) => r.seasonNumber === START + i).flatMap((r) => r.players.map((p) => p.playerSnapshot)); const values: number[] = []
    for (let roster = 0; roster < 6; roster += 1) { const result = legalCeilingFor(pool, roster); values.push(result.strength); const ids = new Set(result.roster.map((p) => p.id)); pool = pool.filter((p) => !ids.has(p.id)) }
    return values
  }))
  console.log('\n5. OBSERVATIONAL LEGAL CONCENTRATION CEILING')
  console.log(`Sequential strongest legal rosters: ${Array.from({ length: 6 }, (_, i) => `#${i + 1} ${f(average(ceilings.map((c) => c[i]!)))}`).join(' · ')}.`)
  const matureRosters = runs.flatMap((r) => r.rosterTraces.filter((x) => x.seasonNumber >= START))
  console.log('\n6. OBSERVED PLAYER PROFILES NEAREST TEAM-STRENGTH TARGETS')
  console.log('Target Actual Top1 Top2 Top3 Top5 Top8 85+ 80+')
  for (const target of [82, 85, 87, 90]) {
    const nearest = [...matureRosters].sort((a, b) => Math.abs(a.overall - target) - Math.abs(b.overall - target))[0]!; const values = nearest.players.map((p) => p.overall)
    console.log(`${String(target).padStart(6)} ${f(nearest.overall).padStart(6)} ${f(top(values, 1)).padStart(4)} ${f(top(values, 2)).padStart(4)} ${f(top(values, 3)).padStart(4)} ${f(top(values, 5)).padStart(4)} ${f(top(values, 8)).padStart(4)} ${String(nearest.players.filter((p) => p.overall >= 85).length).padStart(3)} ${String(nearest.players.filter((p) => p.overall >= 80).length).padStart(3)}`)
  }
}

function tiersAndTranslation(runs: readonly DynastyRunResult[]): void {
  const rosters = runs.flatMap((r) => r.rosterTraces.filter((x) => x.seasonNumber >= START))
  const tier = (r: ProgramRosterTrace) => TOP3.has(r.programId) ? 'Top 3' : ELITE46.has(r.programId) ? 'Elite #4–6' : r.prestige >= 60 ? '60–79' : r.prestige >= 40 ? '40–59' : '1–39'
  console.log('\n7. MATURE PLAYER TALENT BY PRESTIGE TIER')
  console.log('Tier         Rosters Top3 Top5 80+/r 85+/r Best RosterPlayerSD')
  for (const label of ['Top 3', 'Elite #4–6', '60–79', '40–59', '1–39']) { const rows = rosters.filter((r) => tier(r) === label); console.log(`${label.padEnd(12)} ${String(rows.length).padStart(7)} ${f(average(rows.map((r) => top(r.players.map((p) => p.overall), 3)))).padStart(4)} ${f(average(rows.map((r) => top(r.players.map((p) => p.overall), 5)))).padStart(4)} ${f(average(rows.map((r) => r.players.filter((p) => p.overall >= 80).length))).padStart(5)} ${f(average(rows.map((r) => r.players.filter((p) => p.overall >= 85).length))).padStart(5)} ${f(average(rows.map((r) => Math.max(...r.players.map((p) => p.overall))))).padStart(4)} ${f(average(rows.map((r) => summarizeDistribution(r.players.map((p) => p.overall)).standardDeviation))).padStart(14)}`) }
  const observations = rosters.map((r) => ({ strength: r.overall, c85: r.players.filter((p) => p.overall >= 85).length, c80: r.players.filter((p) => p.overall >= 80).length, top3: top(r.players.map((p) => p.overall), 3), top5: top(r.players.map((p) => p.overall), 5) }))
  console.log(`Talent→Strength correlations: 85+ count ${f(correlation(observations.map((o) => ({ first: o.c85, second: o.strength }))), 3)}; 80+ count ${f(correlation(observations.map((o) => ({ first: o.c80, second: o.strength }))), 3)}; top-3 ${f(correlation(observations.map((o) => ({ first: o.top3, second: o.strength }))), 3)}; top-5 ${f(correlation(observations.map((o) => ({ first: o.top5, second: o.strength }))), 3)}.`)
}

const result = runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' })
console.log('COLLEGE HOOPS SIM — MATURE PLAYER TALENT AMPLITUDE AUDIT')
console.log('3 deterministic seeds × 25 Seasons; mature aggregate S5–25; production baseline.')
playerDistribution(result.runs); byClass(result.runs); lifecycle(result.runs); supply(result.runs); ceilingsAndRequirements(result.runs); tiersAndTranslation(result.runs)
