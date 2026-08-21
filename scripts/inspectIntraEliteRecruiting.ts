import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile, type SignedRecruitRecord } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type RecruitingBattleTrace } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const END = 25
const programs = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(programs.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(programs.slice(3, 6).map((p) => p.id))
const ELITE = new Set<string>(programs.slice(0, 6).map((p) => p.id))
const UPPER = new Set<string>(programs.slice(6, 10).map((p) => p.id))
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const topAvg = (values: readonly number[], n: number) => average([...values].sort((a, b) => b - a).slice(0, n))

interface ClassRow {
  seed: string; season: number; programId: string; prestige: number; recruits: SignedRecruitRecord[]
  avg: number; best: number; top2: number; top3: number; avgRank: number; exceptional: boolean
}
function classRows(runs: readonly DynastyRunResult[]): ClassRow[] {
  const base = runs.flatMap((run) => {
    const recruits = run.signedRecruits.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END)
    const keys = new Set(recruits.map((r) => `${r.targetSeasonNumber}|${r.programId}`))
    return [...keys].map((key) => {
      const [season, programId] = key.split('|'); const rows = recruits.filter((r) => r.targetSeasonNumber === Number(season) && r.programId === programId)
      const ovr = rows.map((r) => r.overall)
      return { seed: run.seed, season: Number(season), programId: programId!, prestige: rows[0]!.prestige, recruits: rows, avg: average(ovr), best: Math.max(...ovr), top2: topAvg(ovr, 2), top3: topAvg(ovr, 3), avgRank: average(rows.map((r) => r.nationalRank)), exceptional: false }
    })
  })
  const cutoff = percentile(base.map((r) => r.top3), .9)
  return base.map((row) => ({ ...row, exceptional: row.top3 >= cutoff }))
}
function count(row: ClassRow, test: (r: SignedRecruitRecord) => boolean): number { return row.recruits.filter(test).length }

function hierarchy(): void {
  console.log('\n1. STATIC PRESTIGE HIERARCHY')
  console.log('Rank Program                    Prestige Group')
  programs.forEach((p, i) => console.log(`${String(i + 1).padStart(4)} ${p.name.padEnd(26)} ${String(p.basePrestige).padStart(8)} ${TOP3.has(p.id) ? 'Top 3' : ELITE46.has(p.id) ? 'Elite #4–6' : UPPER.has(p.id) ? 'Upper comparison' : ''}`))
}

function programOutcomes(rows: readonly ClassRow[]): void {
  console.log('\n2. EXACT-PROGRAM RECRUITING OUTCOMES — 63 classes each')
  console.log('Rank Program                 Prest OVR Best Top2 Top3 AvgRank T10 T25 T50 4★ 5★ 80+ P85 P90 2+T25 3+T25 4+T25 Exceptional')
  programs.forEach((p, i) => {
    const cs = rows.filter((r) => r.programId === p.id); const per = (test: (r: SignedRecruitRecord) => boolean) => average(cs.map((r) => count(r, test)))
    const freq = (n: number) => rate(cs.filter((r) => count(r, (x) => x.nationalRank <= 25) >= n).length, cs.length)
    console.log(`${String(i + 1).padStart(4)} ${p.name.padEnd(23)} ${String(p.basePrestige).padStart(5)} ${f(average(cs.map((r) => r.avg)), 1).padStart(4)} ${f(average(cs.map((r) => r.best)), 1).padStart(4)} ${f(average(cs.map((r) => r.top2)), 1).padStart(4)} ${f(average(cs.map((r) => r.top3)), 1).padStart(4)} ${f(average(cs.map((r) => r.avgRank)), 1).padStart(7)} ${f(per((r) => r.nationalRank <= 10)).padStart(3)} ${f(per((r) => r.nationalRank <= 25)).padStart(3)} ${f(per((r) => r.nationalRank <= 50)).padStart(3)} ${f(per((r) => r.stars === 4)).padStart(3)} ${f(per((r) => r.stars === 5)).padStart(3)} ${f(per((r) => r.overall >= 80)).padStart(3)} ${f(per((r) => r.potential >= 85)).padStart(3)} ${f(per((r) => r.potential >= 90)).padStart(3)} ${pct(freq(2)).padStart(6)} ${pct(freq(3)).padStart(6)} ${pct(freq(4)).padStart(6)} ${pct(rate(cs.filter((r) => r.exceptional).length, cs.length)).padStart(11)}`)
  })
  for (const [label, select] of [['All', () => true], ['Elite only', (r: ClassRow) => ELITE.has(r.programId)]] as const) {
    const selected = rows.filter(select)
    console.log(`${label} Prestige correlations: class OVR ${f(correlation(selected.map((r) => ({ first: r.prestige, second: r.avg }))), 3)}; top-3 ${f(correlation(selected.map((r) => ({ first: r.prestige, second: r.top3 }))), 3)}; better avg rank ${f(correlation(selected.map((r) => ({ first: r.prestige, second: -r.avgRank }))), 3)}; top-25 ${f(correlation(selected.map((r) => ({ first: r.prestige, second: count(r, (x) => x.nationalRank <= 25) }))), 3)}.`)
  }
}

function groupComparison(rows: readonly ClassRow[]): void {
  console.log('\n3. CORE GROUP COMPARISON')
  console.log('Group              Programs Prest OVR Top3 AvgRank T10 T25 4★+ 80+ 2+T25 3+T25 Exceptional Premium share')
  for (const [label, ids] of [['Top 3', TOP3], ['Elite #4–6', ELITE46], ['Upper #7–10', UPPER]] as const) {
    const cs = rows.filter((r) => ids.has(r.programId)); const signed = cs.flatMap((r) => r.recruits); const premium = signed.filter((r) => r.nationalRank <= 25)
    const per = (test: (r: SignedRecruitRecord) => boolean) => average(cs.map((r) => count(r, test)))
    console.log(`${label.padEnd(18)} ${String(ids.size).padStart(8)} ${f(average(cs.map((r) => r.prestige)), 1).padStart(5)} ${f(average(cs.map((r) => r.avg)), 1).padStart(4)} ${f(average(cs.map((r) => r.top3)), 1).padStart(4)} ${f(average(cs.map((r) => r.avgRank)), 1).padStart(7)} ${f(per((r) => r.nationalRank <= 10)).padStart(3)} ${f(per((r) => r.nationalRank <= 25)).padStart(3)} ${f(per((r) => r.stars >= 4)).padStart(3)} ${f(per((r) => r.overall >= 80)).padStart(3)} ${pct(rate(cs.filter((r) => count(r, (x) => x.nationalRank <= 25) >= 2).length, cs.length)).padStart(6)} ${pct(rate(cs.filter((r) => count(r, (x) => x.nationalRank <= 25) >= 3).length, cs.length)).padStart(6)} ${pct(rate(cs.filter((r) => r.exceptional).length, cs.length)).padStart(11)} ${pct(rate(premium.length, rows.flatMap((r) => r.recruits).filter((r) => r.nationalRank <= 25).length)).padStart(13)}`)
  }
}

function premiumBattles(runs: readonly DynastyRunResult[]): void {
  const all = runs.flatMap((r) => r.recruitingBattles).filter((b) => b.targetSeasonNumber >= START && b.targetSeasonNumber <= END)
  console.log('\n4/5. PREMIUM BATTLE PARTICIPATION AND HIGHER-PRESTIGE ADVANTAGE')
  console.log('Cohort Battles Period% Participants Elite serious/eligible Multi-elite Highest-P winner Winner in serious set')
  for (const [label, test] of [['Top10', (b: RecruitingBattleTrace) => b.nationalRank <= 10], ['Top25', (b: RecruitingBattleTrace) => b.nationalRank <= 25], ['5★', (b: RecruitingBattleTrace) => b.stars === 5], ['OVR80+', (b: RecruitingBattleTrace) => b.overall >= 80]] as const) {
    const bs = all.filter(test); const observed = bs.filter((b) => b.participants.length > 0)
    const highestWon = observed.filter((b) => { const max = Math.max(...b.participants.map((p) => p.prestige)); return b.participants.some((p) => p.programId === b.winnerProgramId && p.prestige === max) }).length
    const eliteSerious = bs.reduce((sum, b) => sum + b.participants.filter((p) => ELITE.has(p.programId)).length, 0)
    const eliteEligible = bs.reduce((sum, b) => sum + b.eligibleProgramIds.filter((id) => ELITE.has(id)).length, 0)
    console.log(`${label.padEnd(6)} ${String(bs.length).padStart(7)} ${pct(rate(bs.filter((b) => b.resolution === 'period').length, bs.length)).padStart(7)} ${f(average(bs.map((b) => b.participants.length))).padStart(12)} ${`${f(average(bs.map((b) => b.participants.filter((p) => ELITE.has(p.programId)).length)))}/${f(average(bs.map((b) => b.eligibleProgramIds.filter((id) => ELITE.has(id)).length)))}`.padStart(22)} ${pct(rate(bs.filter((b) => b.participants.filter((p) => ELITE.has(p.programId)).length >= 2).length, bs.length)).padStart(11)} ${pct(rate(highestWon, observed.length)).padStart(16)} ${pct(rate(observed.filter((b) => b.participants.some((p) => p.programId === b.winnerProgramId)).length, observed.length)).padStart(21)} (elite pursuit ${pct(rate(eliteSerious, eliteEligible))})`)
  }
  const top25 = all.filter((b) => b.nationalRank <= 25 && b.participants.some((p) => p.programId === b.winnerProgramId))
  const compare = (label: string, eligible: (b: RecruitingBattleTrace) => boolean, higher: (p: RecruitingBattleTrace['participants'][number]) => boolean, lower: (p: RecruitingBattleTrace['participants'][number]) => boolean) => {
    const bs = top25.filter((b) => eligible(b) && b.participants.some(higher) && b.participants.some(lower))
    const highWon = bs.filter((b) => higher(b.participants.find((p) => p.programId === b.winnerProgramId)!)).length
    const lowWon = bs.filter((b) => lower(b.participants.find((p) => p.programId === b.winnerProgramId)!)).length
    const gap = average(bs.map((b) => Math.max(...b.participants.filter(higher).map((p) => p.prestige)) - Math.max(...b.participants.filter(lower).map((p) => p.prestige))))
    console.log(`${label}: ${bs.length} matched top-25 battles; higher ${pct(rate(highWon, bs.length))}, lower ${pct(rate(lowWon, bs.length))}, other ${pct(rate(bs.length - highWon - lowWon, bs.length))}; higher share when either group won ${pct(rate(highWon, highWon + lowWon))}; average best-participant Prestige gap ${f(gap, 1)}.`)
  }
  compare('Top 3 vs elite #4–6', () => true, (p) => TOP3.has(p.programId), (p) => ELITE46.has(p.programId))
  compare('Elite #4–6 vs upper #7–10', () => true, (p) => ELITE46.has(p.programId), (p) => UPPER.has(p.programId))
  const multiElite = top25.filter((b) => b.participants.filter((p) => ELITE.has(p.programId)).length >= 2)
  for (const [label, test] of [['Prestige gap 0–3', (g: number) => g <= 3], ['Prestige gap 4–7', (g: number) => g >= 4 && g <= 7], ['Prestige gap 8+', (g: number) => g >= 8]] as const) {
    const bs = multiElite.filter((b) => { const ps = b.participants.filter((p) => ELITE.has(p.programId)).map((p) => p.prestige).sort((a, z) => z - a); return test(ps[0]! - ps[1]!) })
    const wins = bs.filter((b) => { const elite = b.participants.filter((p) => ELITE.has(p.programId)); const max = Math.max(...elite.map((p) => p.prestige)); return elite.some((p) => p.programId === b.winnerProgramId && p.prestige === max) }).length
    console.log(`${label}: ${bs.length}; highest elite Prestige won ${pct(rate(wins, bs.length))}.`)
  }
}

function concentrationByYear(rows: readonly ClassRow[]): void {
  const years = [...new Set(rows.map((r) => `${r.seed}|${r.season}`))]
  const patterns = years.map((id) => {
    const cs = rows.filter((r) => `${r.seed}|${r.season}` === id && ELITE.has(r.programId))
    const counts = cs.map((c) => ({ programId: c.programId, count: count(c, (r) => r.nationalRank <= 25) })).sort((a, b) => b.count - a.count || a.programId.localeCompare(b.programId))
    return counts.map((r) => r.count)
  })
  console.log('\n6. TOP-25 CONCENTRATION AMONG SIX ELITE PROGRAMS')
  console.log(`Per year: elite total ${f(average(patterns.map((p) => p.reduce((a, b) => a + b, 0))))}; best ${f(average(patterns.map((p) => p[0]!)))}; best two ${f(average(patterns.map((p) => p[0]! + p[1]!)))}; best three ${f(average(patterns.map((p) => p.slice(0, 3).reduce((a, b) => a + b, 0))))}.`)
  console.log(`Annual max by one elite Program: ${[0, 1, 2, 3, 4].map((n) => `${n}${n === 4 ? '+' : ''} ${pct(rate(patterns.filter((p) => (n === 4 ? p[0]! >= n : p[0] === n)).length, patterns.length))}`).join(' · ')}.`)
  const unique = new Map<string, number>(); for (const p of patterns) { const key = p.join(','); unique.set(key, (unique.get(key) ?? 0) + 1) }
  console.log(`Most common sorted elite distributions: ${[...unique].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([p, n]) => `${p} (${n})`).join(' · ')}`)
}

function responseCurve(rows: readonly ClassRow[]): void {
  const bins = [[1, 49], [50, 59], [60, 69], [70, 79], [80, 84], [85, 100]] as const
  console.log('\n7. PRESTIGE RESPONSE CURVE')
  console.log('Prestige Programs Classes OVR Top3 AvgRank Top10 Top25 4★+ 80+ Exceptional')
  for (const [lo, hi] of bins) {
    const cs = rows.filter((r) => r.prestige >= lo && r.prestige <= hi); const ids = new Set(cs.map((r) => r.programId)); const per = (test: (r: SignedRecruitRecord) => boolean) => average(cs.map((r) => count(r, test)))
    console.log(`${`${lo}–${hi}`.padEnd(8)} ${String(ids.size).padStart(8)} ${String(cs.length).padStart(7)} ${f(average(cs.map((r) => r.avg)), 1).padStart(4)} ${f(average(cs.map((r) => r.top3)), 1).padStart(4)} ${f(average(cs.map((r) => r.avgRank)), 1).padStart(7)} ${f(per((r) => r.nationalRank <= 10)).padStart(5)} ${f(per((r) => r.nationalRank <= 25)).padStart(5)} ${f(per((r) => r.stars >= 4)).padStart(3)} ${f(per((r) => r.overall >= 80)).padStart(3)} ${pct(rate(cs.filter((r) => r.exceptional).length, cs.length)).padStart(11)}`)
  }
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' }); const rows = classRows(result.runs)
  console.log('COLLEGE HOOPS SIM — INTRA-ELITE PRESTIGE / RECRUITING AUDIT')
  console.log('Configuration: 3 deterministic seeds × 25 Seasons × LIGHT; mature S5–25; serious battle participant = active Offer plus production minimum meaningful relationship immediately before commitment.')
  hierarchy(); programOutcomes(rows); groupComparison(rows); premiumBattles(result.runs); concentrationByYear(rows); responseCurve(rows)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
