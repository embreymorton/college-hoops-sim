import { pathToFileURL } from 'node:url'
import { average, percentile, prestigeBand, PRESTIGE_BANDS, summarizeDistribution, type SignedRecruitRecord } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const END = 25
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const topAvg = (values: readonly number[], n: number) => average([...values].sort((a, b) => b - a).slice(0, n))
const median = (values: readonly number[]) => percentile(values, .5)

interface RecruitingClass {
  seed: string; season: number; programId: string; prestige: number; recruits: SignedRecruitRecord[]
  best: number; top2: number; top3: number; top5: number; avg: number; pot: number
}
function classes(runs: readonly DynastyRunResult[]): RecruitingClass[] {
  return runs.flatMap((run) => {
    const rows = run.signedRecruits.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END)
    const keys = new Set(rows.map((r) => `${r.targetSeasonNumber}:${r.programId}`))
    return [...keys].map((key) => {
      const [season, programId] = key.split(':')
      const recruits = rows.filter((r) => r.targetSeasonNumber === Number(season) && r.programId === programId)
      const ovr = recruits.map((r) => r.overall)
      return { seed: run.seed, season: Number(season), programId: programId!, prestige: recruits[0]!.prestige, recruits, best: Math.max(...ovr), top2: topAvg(ovr, 2), top3: topAvg(ovr, 3), top5: topAvg(ovr, 5), avg: average(ovr), pot: average(recruits.map((r) => r.potential)) }
    })
  })
}

function supply(runs: readonly DynastyRunResult[]): void {
  const seasons = runs.flatMap((run) => Array.from({ length: END - START + 1 }, (_, i) => {
    const rows = run.generatedRecruits.filter((r) => r.targetSeasonNumber === START + i)
    return { seed: run.seed, season: START + i, rows }
  }))
  const all = seasons.flatMap((s) => s.rows)
  console.log('\nA. PREMIUM TALENT SUPPLY — generated classes, mature targets S5–25')
  console.log(`Classes: ${seasons.length}; recruits/class ${f(average(seasons.map((s) => s.rows.length)))} (range ${Math.min(...seasons.map((s) => s.rows.length))}–${Math.max(...seasons.map((s) => s.rows.length))}).`)
  const dist = (label: string, values: number[]) => { const s = summarizeDistribution(values); console.log(`${label.padEnd(5)} mean ${f(s.average)} · SD ${f(s.standardDeviation)} · P10/P50/P90 ${f(s.p10)}/${f(s.median)}/${f(s.p90)} · range ${f(s.minimum)}–${f(s.maximum)}`) }
  dist('OVR', all.map((r) => r.overall)); dist('POT', all.map((r) => r.potential)); dist('Rank', all.map((r) => r.nationalRank))
  const countLine = (label: string, test: (r: typeof all[number]) => boolean) => {
    const counts = seasons.map((s) => s.rows.filter(test).length)
    console.log(`${label.padEnd(10)} ${f(average(counts)).padStart(6)}/class · SD ${f(summarizeDistribution(counts).standardDeviation)} · range ${Math.min(...counts)}–${Math.max(...counts)}`)
  }
  for (const n of [75, 80, 85, 90]) countLine(`OVR ${n}+`, (r) => r.overall >= n)
  for (const n of [80, 85, 90]) countLine(`POT ${n}+`, (r) => r.potential >= n)
  for (const n of [10, 25, 50]) countLine(`Top ${n}`, (r) => r.nationalRank <= n)
  for (const stars of [2, 3, 4, 5]) countLine(`${stars} star`, (r) => r.stars === stars)
  const positions = [...new Set(all.map((r) => r.position))].sort()
  console.log(`Positions/class: ${positions.map((p) => `${p} ${f(average(seasons.map((s) => s.rows.filter((r) => r.position === p).length)), 1)}`).join(' · ')}`)
}

function concentration(allClasses: readonly RecruitingClass[]): void {
  console.log('\nB. SIGNING CONCENTRATION BY PRESTIGE')
  console.log('Band    Classes Size Best Top2 Top3 Top5 Avg  POT Top10 Top25 Top50 4★+ OVR80+ POT85+ POT90+')
  for (const band of PRESTIGE_BANDS) {
    const rows = allClasses.filter((c) => prestigeBand(c.prestige) === band)
    const per = (test: (r: SignedRecruitRecord) => boolean) => average(rows.map((c) => c.recruits.filter(test).length))
    console.log(`${band.padEnd(8)}${String(rows.length).padStart(7)} ${f(average(rows.map((c) => c.recruits.length)), 1).padStart(4)} ${f(average(rows.map((c) => c.best)), 1).padStart(4)} ${f(average(rows.map((c) => c.top2)), 1).padStart(4)} ${f(average(rows.map((c) => c.top3)), 1).padStart(4)} ${f(average(rows.map((c) => c.top5)), 1).padStart(4)} ${f(average(rows.map((c) => c.avg)), 1).padStart(4)} ${f(average(rows.map((c) => c.pot)), 1).padStart(4)} ${f(per((r) => r.nationalRank <= 10)).padStart(5)} ${f(per((r) => r.nationalRank <= 25)).padStart(5)} ${f(per((r) => r.nationalRank <= 50)).padStart(5)} ${f(per((r) => r.stars >= 4)).padStart(3)} ${f(per((r) => r.overall >= 80)).padStart(6)} ${f(per((r) => r.potential >= 85)).padStart(6)} ${f(per((r) => r.potential >= 90)).padStart(6)}`)
  }
  console.log('\nPremium destination shares and annual concentration')
  for (const [label, test] of [['Top10', (r: SignedRecruitRecord) => r.nationalRank <= 10], ['Top25', (r: SignedRecruitRecord) => r.nationalRank <= 25], ['Top50', (r: SignedRecruitRecord) => r.nationalRank <= 50], ['4★+', (r: SignedRecruitRecord) => r.stars >= 4]] as const) {
    const rows = allClasses.flatMap((c) => c.recruits.filter(test))
    const years = [...new Set(allClasses.map((c) => `${c.seed}|${c.season}`))]
    const annual = years.map((key) => {
      const [seed, season] = key.split('|')
      const cs = allClasses.filter((c) => c.seed === seed && c.season === Number(season))
      const counts = cs.map((c) => c.recruits.filter(test).length).sort((a, b) => b - a)
      const total = counts.reduce((a, b) => a + b, 0)
      return { one: rate(counts[0]!, total), three: rate(counts.slice(0, 3).reduce((a, b) => a + b, 0), total), hhi: total ? counts.reduce((s, n) => s + (n / total) ** 2, 0) : 0 }
    })
    console.log(`${label.padEnd(6)} 80+ Prestige share ${pct(rate(rows.filter((r) => r.prestige >= 80).length, rows.length))} · yearly best Program ${pct(average(annual.map((r) => r.one)))} · top 3 ${pct(average(annual.map((r) => r.three)))} · HHI ${f(average(annual.map((r) => r.hhi)), 3)}`)
  }
  for (const n of [2, 3, 4]) {
    console.log(`Classes with ${n}+ top-25 signees: all ${pct(rate(allClasses.filter((c) => c.recruits.filter((r) => r.nationalRank <= 25).length >= n).length, allClasses.length))}; 80+ Prestige ${pct(rate(allClasses.filter((c) => c.prestige >= 80 && c.recruits.filter((r) => r.nationalRank <= 25).length >= n).length, allClasses.filter((c) => c.prestige >= 80).length))}.`)
  }
}

function classShape(allClasses: readonly RecruitingClass[]): void {
  console.log('\nC. CROSS-PROGRAM CLASS-SHAPE DISPERSION — mean SD/range per seed-year')
  console.log('Metric   SD  Range  Elite-minus-middle')
  for (const key of ['best', 'top2', 'top3', 'top5', 'avg'] as const) {
    const groups = [...new Set(allClasses.map((c) => `${c.seed}|${c.season}`))].map((id) => allClasses.filter((c) => `${c.seed}|${c.season}` === id))
    const sd = average(groups.map((g) => summarizeDistribution(g.map((c) => c[key])).standardDeviation))
    const range = average(groups.map((g) => { const v = g.map((c) => c[key]); return Math.max(...v) - Math.min(...v) }))
    const elite = allClasses.filter((c) => c.prestige >= 80).map((c) => c[key])
    const middle = allClasses.filter((c) => c.prestige >= 40 && c.prestige < 80).map((c) => c[key])
    console.log(`${key.padEnd(7)} ${f(sd).padStart(5)} ${f(range).padStart(6)} ${f(average(elite) - average(middle)).padStart(19)}`)
  }
}

function overlaps(runs: readonly DynastyRunResult[]): void {
  const rows = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= START).map((roster) => {
    const signed = new Map(run.signedRecruits.map((r) => [r.playerId, r]))
    const premium = roster.players.flatMap((p) => { const recruit = signed.get(p.playerId); return recruit && recruit.nationalRank <= 25 ? [{ ...p, recruit }] : [] })
    const cohorts = new Set(premium.map((p) => p.recruit.targetSeasonNumber)).size
    return { roster, cohorts, top10: premium.filter((p) => p.recruit.nationalRank <= 10).length, top25: premium.length, top50: roster.players.filter((p) => (signed.get(p.playerId)?.nationalRank ?? 999) <= 50).length, ovr80: roster.players.filter((p) => p.overall >= 80).length, ovr85: roster.players.filter((p) => p.overall >= 85).length, pot85: roster.players.filter((p) => p.potential >= 85).length }
  }))
  console.log('\nD. MULTI-CLASS COHORT OVERLAP — former top-25 recruits')
  console.log('Band    Team-seasons Top10 Top25 Top50 OVR80 OVR85 POT85 2+ cohorts 3+ cohorts 4 cohorts')
  for (const band of PRESTIGE_BANDS) {
    const selected = rows.filter((r) => prestigeBand(r.roster.prestige) === band)
    console.log(`${band.padEnd(8)}${String(selected.length).padStart(12)} ${f(average(selected.map((r) => r.top10))).padStart(5)} ${f(average(selected.map((r) => r.top25))).padStart(5)} ${f(average(selected.map((r) => r.top50))).padStart(5)} ${f(average(selected.map((r) => r.ovr80))).padStart(5)} ${f(average(selected.map((r) => r.ovr85))).padStart(5)} ${f(average(selected.map((r) => r.pot85))).padStart(5)} ${pct(rate(selected.filter((r) => r.cohorts >= 2).length, selected.length)).padStart(10)} ${pct(rate(selected.filter((r) => r.cohorts >= 3).length, selected.length)).padStart(10)} ${pct(rate(selected.filter((r) => r.cohorts >= 4).length, selected.length)).padStart(9)}`)
  }
}

function lifecycle(runs: readonly DynastyRunResult[], allClasses: readonly RecruitingClass[]): void {
  const eligible = allClasses.filter((c) => c.recruits.length >= 3 && c.season <= END - 3)
  const cutoff = percentile(eligible.map((c) => c.top3), .9)
  const exceptional = eligible.filter((c) => c.top3 >= cutoff)
  const medianCut = median(eligible.map((c) => c.top3))
  const reference = eligible.filter((c) => Math.abs(c.top3 - medianCut) <= .5)
  console.log(`\nE/F. EXCEPTIONAL-CLASS LIFECYCLE AND ADVANTAGE SURVIVAL`)
  console.log(`Exceptional = top decile of eligible classes by top-3 signing OVR (cutoff ${f(cutoff)}); N=${exceptional.length}. Median reference within ±0.5 of ${f(medianCut)}; N=${reference.length}.`)
  console.log('Age Members Cohort OVR Prog top5 Rot-wtd Strength Str rank Follow-up exceptional | gaps vs median: cohort/top5/rot/strength')
  for (let age = 0; age <= 3; age += 1) {
    const observe = (cs: readonly RecruitingClass[]) => cs.flatMap((c) => {
      const run = runs.find((r) => r.seed === c.seed)!
      const roster = run.rosterTraces.find((r) => r.seasonNumber === c.season + age && r.programId === c.programId)
      if (!roster) return []
      const ids = new Set(c.recruits.map((r) => r.playerId)); const members = roster.players.filter((p) => ids.has(p.playerId))
      const seasonRows = run.rosterTraces.filter((r) => r.seasonNumber === c.season + age)
      const rank = [...seasonRows].sort((a, b) => b.overall - a.overall).findIndex((r) => r.programId === c.programId) + 1
      const follow = allClasses.some((x) => x.seed === c.seed && x.programId === c.programId && x.season > c.season && x.season <= c.season + age && x.top3 >= cutoff)
      return [{ members: members.length, cohort: average(members.map((p) => p.overall)), top5: topAvg(roster.players.map((p) => p.overall), 5), rot: roster.rotationWeightedPlayerOverall, strength: roster.overall, rank, follow }]
    })
    const ex = observe(exceptional), med = observe(reference)
    const gap = (key: 'cohort' | 'top5' | 'rot' | 'strength') => average(ex.map((r) => r[key])) - average(med.map((r) => r[key]))
    console.log(`${String(age + 1).padStart(3)} ${f(average(ex.map((r) => r.members)), 1).padStart(7)} ${f(average(ex.map((r) => r.cohort))).padStart(10)} ${f(average(ex.map((r) => r.top5))).padStart(9)} ${f(average(ex.map((r) => r.rot))).padStart(7)} ${f(average(ex.map((r) => r.strength))).padStart(8)} ${f(average(ex.map((r) => r.rank)), 1).padStart(8)} ${pct(rate(ex.filter((r) => r.follow).length, ex.length)).padStart(21)} | ${f(gap('cohort'))}/${f(gap('top5'))}/${f(gap('rot'))}/${f(gap('strength'))}`)
  }
}

function graduation(runs: readonly DynastyRunResult[]): void {
  const rows = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= START && r.seasonNumber < END).flatMap((roster) => {
    const next = run.rosterTraces.find((r) => r.seasonNumber === roster.seasonNumber + 1 && r.programId === roster.programId)
    if (!next) return []
    const signed = new Map(run.signedRecruits.map((r) => [r.playerId, r])); const seniors = roster.players.filter((p) => p.classYear === 'SR')
    return [{ prestige: roster.prestige, seniorMinutes: seniors.reduce((s, p) => s + p.minutes, 0), premiumSeniors: seniors.filter((p) => (signed.get(p.playerId)?.nationalRank ?? 999) <= 25).length, strengthChange: next.overall - roster.overall, top5Change: topAvg(next.players.map((p) => p.overall), 5) - topAvg(roster.players.map((p) => p.overall), 5), strongIncoming: run.signedRecruits.filter((r) => r.programId === roster.programId && r.targetSeasonNumber === next.seasonNumber && r.nationalRank <= 25).length }]
  }))
  console.log('\nG. GRADUATION / REPLACEMENT')
  console.log('Group                 N Senior MPG Premium SR ΔStrength ΔTop5 Incoming top25')
  for (const [label, test] of [['80+ Prestige', (r: typeof rows[number]) => r.prestige >= 80], ['40–79 Prestige', (r: typeof rows[number]) => r.prestige >= 40 && r.prestige < 80], ['<40 Prestige', (r: typeof rows[number]) => r.prestige < 40], ['80+ senior MPG', (r: typeof rows[number]) => r.seniorMinutes >= 80], ['Premium senior dep.', (r: typeof rows[number]) => r.premiumSeniors > 0]] as const) {
    const s = rows.filter(test)
    console.log(`${label.padEnd(21)} ${String(s.length).padStart(4)} ${f(average(s.map((r) => r.seniorMinutes)), 1).padStart(10)} ${f(average(s.map((r) => r.premiumSeniors))).padStart(10)} ${f(average(s.map((r) => r.strengthChange))).padStart(9)} ${f(average(s.map((r) => r.top5Change))).padStart(6)} ${f(average(s.map((r) => r.strongIncoming))).padStart(14)}`)
  }
  const heavy = rows.filter((r) => r.seniorMinutes >= 80)
  console.log(`After 80+ senior MPG, Strength decline rate ${pct(rate(heavy.filter((r) => r.strengthChange < 0).length, heavy.length))}; with 2+ incoming top-25 ${f(average(heavy.filter((r) => r.strongIncoming >= 2).map((r) => r.strengthChange)))} average change vs ${f(average(heavy.filter((r) => r.strongIncoming < 2).map((r) => r.strengthChange)))} otherwise.`)
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' })
  const allClasses = classes(result.runs)
  console.log('COLLEGE HOOPS SIM — RECRUITING AMPLITUDE / COHORT SURVIVAL AUDIT')
  console.log('Configuration: 3 deterministic seeds × 25 Seasons × LIGHT; mature targets/team-seasons S5–25; production long-run lifecycle reused.')
  supply(result.runs); concentration(allClasses); classShape(allClasses); overlaps(result.runs); lifecycle(result.runs, allClasses); graduation(result.runs)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
