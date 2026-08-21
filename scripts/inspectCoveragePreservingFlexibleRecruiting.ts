import { POSITIONS } from '../src/engine'
import { UNIVERSE_V0 } from '../src/universe'
import { average, percentile, summarizeDistribution, type SignedRecruitRecord } from './dynastyLongRunMetrics'
import { type DynastyRunResult, type ProgramRecruitingCapacityTrace, type ProgramRosterTrace } from './inspectDynastyLongRun'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const ranked = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(ranked.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(ranked.slice(3, 6).map((p) => p.id))
const ELITE = new Set<string>(ranked.slice(0, 6).map((p) => p.id))
const SECONDARY: Readonly<Record<string, string>> = { PG: 'SG', SG: 'SF', SF: 'PF', PF: 'C', C: 'PF' }
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const top = (values: readonly number[], n: number) => average([...values].sort((a, b) => b - a).slice(0, n))

interface ClassRow extends ProgramRecruitingCapacityTrace { seed: string; recruits: SignedRecruitRecord[] }
const tier = (row: ClassRow) => TOP3.has(row.programId) ? 'Top 3' : ELITE46.has(row.programId) ? 'Elite #4–6' : row.prestige >= 60 ? '60–79' : row.prestige >= 40 ? '40–59' : '1–39'
function classes(runs: readonly DynastyRunResult[]): ClassRow[] {
  return runs.flatMap((run) => run.recruitingCapacity.filter((r) => r.targetSeasonNumber >= START).map((capacity) => ({
    ...capacity, seed: run.seed,
    recruits: run.signedRecruits.filter((r) => r.targetSeasonNumber === capacity.targetSeasonNumber && r.programId === capacity.programId),
  })))
}
function spread(runs: readonly DynastyRunResult[], select: (r: ProgramRosterTrace) => number): { mean: number; sd: number; p90p10: number; range: number; top4bottom4: number; within5: number; max: number } {
  const seasons = runs.flatMap((run) => Array.from({ length: 21 }, (_, i) => run.rosterTraces.filter((r) => r.seasonNumber === START + i).map(select)))
  const summaries = seasons.map((values) => { const s = summarizeDistribution(values); const sorted = [...values].sort((a, b) => b - a); return { mean: s.average, sd: s.standardDeviation, p90p10: s.p90 - s.p10, range: s.maximum - s.minimum, top4bottom4: average(sorted.slice(0, 4)) - average(sorted.slice(-4)), within5: rate(values.filter((v) => Math.abs(v - s.average) <= 5).length, values.length), max: s.maximum } })
  const avg = (key: keyof typeof summaries[number]) => average(summaries.map((s) => s[key]))
  return { mean: avg('mean'), sd: avg('sd'), p90p10: avg('p90p10'), range: avg('range'), top4bottom4: avg('top4bottom4'), within5: avg('within5'), max: Math.max(...summaries.map((s) => s.max)) }
}
function premium(control: readonly ClassRow[], candidate: readonly ClassRow[]): void {
  console.log('\n1. PREMIUM CONVERSION PER FIXED SLOT')
  console.log('Tier         Mode T10/slot T25/slot T50/slot 4★+/slot 80+/slot P85/slot P90/slot 2+T25 3+T25 Exceptional')
  const cutoff = percentile(control.map((r) => top(r.recruits.map((x) => x.overall), 3)), .9)
  for (const label of ['Top 3', 'Elite #4–6', '60–79', '40–59', '1–39']) for (const [mode, rows] of [['Ctl', control], ['Can', candidate]] as const) {
    const selected = rows.filter((r) => tier(r) === label); const signed = selected.flatMap((r) => r.recruits); const slots = selected.reduce((s, r) => s + r.projectedOpenings, 0)
    const per = (test: (r: SignedRecruitRecord) => boolean) => pct(rate(signed.filter(test).length, slots))
    const freq = (test: (r: ClassRow) => boolean) => pct(rate(selected.filter(test).length, selected.length))
    console.log(`${label.padEnd(12)} ${mode.padEnd(4)} ${per((r) => r.nationalRank <= 10).padStart(8)} ${per((r) => r.nationalRank <= 25).padStart(8)} ${per((r) => r.nationalRank <= 50).padStart(8)} ${per((r) => r.stars >= 4).padStart(8)} ${per((r) => r.overall >= 80).padStart(8)} ${per((r) => r.potential >= 85).padStart(8)} ${per((r) => r.potential >= 90).padStart(8)} ${freq((r) => r.recruits.filter((x) => x.nationalRank <= 25).length >= 2).padStart(6)} ${freq((r) => r.recruits.filter((x) => x.nationalRank <= 25).length >= 3).padStart(6)} ${freq((r) => top(r.recruits.map((x) => x.overall), 3) >= cutoff).padStart(11)}`)
  }
}
function activation(control: readonly ClassRow[], candidate: readonly ClassRow[], candidateRuns: readonly DynastyRunResult[]): void {
  const flexible = candidate.flatMap((row) => Object.entries(row.openingAssignmentByPlayerId ?? {}).flatMap(([playerId, opening]) => {
    const recruit = row.recruits.find((r) => r.playerId === playerId)!; const generated = candidateRuns.find((r) => r.seed === row.seed)!.generatedRecruits.find((r) => r.playerId === playerId)!
    return generated.position !== opening ? [{ row, recruit, natural: generated.position, opening }] : []
  }))
  console.log('\n2. COVERAGE-PRESERVING ACTIVATION')
  console.log(`Flexible commitments ${flexible.length}/${candidate.reduce((s, r) => s + r.actualSignees, 0)} (${pct(rate(flexible.length, candidate.reduce((s, r) => s + r.actualSignees, 0)))}); top-25 ${flexible.filter((x) => x.recruit.nationalRank <= 25).length}; elite ${flexible.filter((x) => ELITE.has(x.row.programId)).length}.`)
  console.log(`Mappings: ${Object.entries(SECONDARY).map(([from, to]) => `${from}->${to} ${flexible.filter((x) => x.natural === from && x.opening === to).length}`).join(' · ')}`)
  let safe = 0; let rejected = 0
  for (const row of candidate.filter((r) => ELITE.has(r.programId))) {
    const generated = candidateRuns.find((r) => r.seed === row.seed)!.generatedRecruits.filter((r) => r.targetSeasonNumber === row.targetSeasonNumber && r.nationalRank <= 25)
    for (const recruit of generated) {
      const role = SECONDARY[recruit.position]!
      if ((row.projectedOpeningsByPosition[recruit.position] ?? 0) > 0 || (row.projectedOpeningsByPosition[role] ?? 0) === 0) continue
      if ((row.experimentalReturningPlayersByPosition?.[role] ?? 0) >= 1) safe += 1
      else rejected += 1
    }
  }
  console.log(`Elite top-25 secondary-opening opportunities: safe ${safe}; rejected by natural coverage ${rejected}; guard rejection ${pct(rate(rejected, safe + rejected))}.`)
  const deltas = flexible.flatMap((item) => {
    const ctl = control.find((r) => r.seed === item.row.seed && r.programId === item.row.programId && r.targetSeasonNumber === item.row.targetSeasonNumber)
    const ctlRun = candidateRuns.find((r) => r.seed === item.row.seed)!; const positionById = new Map(ctlRun.generatedRecruits.map((r) => [r.playerId, r.position]))
    const comparison = ctl?.recruits.filter((r) => positionById.get(r.playerId) === item.opening).sort((a, b) => a.overall - b.overall)[0]
    return comparison ? [{ ovr: item.recruit.overall - comparison.overall, pot: item.recruit.potential - comparison.potential, rank: comparison.nationalRank - item.recruit.nationalRank }] : []
  })
  console.log(`Paired natural-opening comparisons ${deltas.length}: flexible higher OVR ${pct(rate(deltas.filter((d) => d.ovr > 0).length, deltas.length))}, mean Δ ${f(average(deltas.map((d) => d.ovr)), 1)}; higher POT ${pct(rate(deltas.filter((d) => d.pot > 0).length, deltas.length))}, mean Δ ${f(average(deltas.map((d) => d.pot)), 1)}; mean rank improvement ${f(average(deltas.map((d) => d.rank)), 1)}.`)
}
function rosterHealth(control: readonly DynastyRunResult[], candidate: readonly DynastyRunResult[]): void {
  const summarize = (runs: readonly DynastyRunResult[]) => {
    const rosters = runs.flatMap((r) => r.rosterTraces.filter((x) => x.seasonNumber >= START)); const counts = rosters.map((r) => POSITIONS.map((p) => r.players.filter((x) => x.position === p).length))
    const rotation = runs.flatMap((r) => r.rotationMinutes.filter((x) => x.seasonNumber >= START)); const secondary = rotation.reduce((s, r) => s + r.secondaryMinutes, 0); const total = rotation.reduce((s, r) => s + r.assignedMinutes, 0)
    return { rosters: rosters.length, zero: counts.flat().filter((n) => n === 0).length, minimum: Math.min(...counts.flat()), one: rate(counts.filter((c) => c.some((n) => n === 1)).length, counts.length), skew: rate(counts.filter((c) => Math.max(...c) - Math.min(...c) >= 4).length, counts.length), secondary: rate(secondary, total) }
  }
  const a = summarize(control); const b = summarize(candidate)
  console.log('\n3. ROSTER HEALTH — CONTROL → CANDIDATE')
  console.log(`Rosters ${a.rosters}/${b.rosters}; zero natural groups ${a.zero}→${b.zero}; minimum natural count ${a.minimum}→${b.minimum}; rosters with 1 at any position ${pct(a.one)}→${pct(b.one)}; highly skewed (max-min >=4) ${pct(a.skew)}→${pct(b.skew)}; secondary-minute share ${pct(a.secondary)}→${pct(b.secondary)}.`)
}
function downstream(control: readonly DynastyRunResult[], candidate: readonly DynastyRunResult[]): void {
  console.log('\n4. MATURE ROSTER / TEAM STRENGTH SEPARATION')
  console.log('Metric               Control Candidate Delta')
  for (const [label, select] of [['Full roster OVR', (r: ProgramRosterTrace) => average(r.players.map((p) => p.overall))], ['Top-3 roster OVR', (r: ProgramRosterTrace) => top(r.players.map((p) => p.overall), 3)], ['Top-5 roster OVR', (r: ProgramRosterTrace) => top(r.players.map((p) => p.overall), 5)], ['Top-8 roster OVR', (r: ProgramRosterTrace) => top(r.players.map((p) => p.overall), 8)], ['Rotation-weighted', (r: ProgramRosterTrace) => r.rotationWeightedPlayerOverall], ['Team Strength', (r: ProgramRosterTrace) => r.overall]] as const) {
    const a = spread(control, select); const b = spread(candidate, select); console.log(`${label.padEnd(20)} SD ${f(a.sd)}→${f(b.sd)} (${f(b.sd - a.sd, 2)}); P90–10 ${f(a.p90p10)}→${f(b.p90p10)}; T4–B4 ${f(a.top4bottom4)}→${f(b.top4bottom4)}; max ${f(a.max)}→${f(b.max)}`)
  }
  const strengthA = spread(control, (r) => r.overall); const strengthB = spread(candidate, (r) => r.overall)
  console.log(`Team Strength within ±5: ${pct(strengthA.within5)}→${pct(strengthB.within5)}; max−min ${f(strengthA.range)}→${f(strengthB.range)}.`)
}
function tournament(control: readonly DynastyRunResult[], candidate: readonly DynastyRunResult[]): void {
  const summarize = (runs: readonly DynastyRunResult[]) => {
    const obs = runs.flatMap((r) => r.tournamentBalanceCandidate.filter((o) => o.seasonNumber >= START)); const fieldSpreads = obs.map((o) => summarizeDistribution(o.field.map((x) => x.overall))); const games = obs.flatMap((o) => o.games.filter((g) => g.round === 'round-of-16'))
    return { fieldSd: average(fieldSpreads.map((s) => s.standardDeviation)), p90p10: average(fieldSpreads.map((s) => s.p90 - s.p10)), within5: average(obs.map((o) => rate(o.field.filter((x) => Math.abs(x.overall - average(o.field.map((y) => y.overall))) <= 5).length, o.field.length))), gap: average(games.map((g) => g.overallDifference)), within2: rate(games.filter((g) => g.overallDifference <= 2).length, games.length), lowerStronger: rate(games.filter((g) => (g.homeSeed > g.awaySeed ? g.homeOverall > g.awayOverall : g.awayOverall > g.homeOverall)).length, games.length), seedUpset: rate(games.filter((g) => g.seedUpset).length, games.length), strengthUpset: rate(games.filter((g) => g.strengthUpset).length, games.length), champions: new Set(obs.map((o) => o.championProgramId)).size }
  }
  const a = summarize(control); const b = summarize(candidate)
  console.log('\n5. TOURNAMENT FIELD / VARIETY GUARDRAILS')
  console.log(`Field SD ${f(a.fieldSd)}→${f(b.fieldSd)}; P90–P10 ${f(a.p90p10)}→${f(b.p90p10)}; within ±5 ${pct(a.within5)}→${pct(b.within5)}.`)
  console.log(`Round 1 average gap ${f(a.gap)}→${f(b.gap)}; within 2 ${pct(a.within2)}→${pct(b.within2)}; lower seed stronger ${pct(a.lowerStronger)}→${pct(b.lowerStronger)}; seed upsets ${pct(a.seedUpset)}→${pct(b.seedUpset)}; Strength upsets ${pct(a.strengthUpset)}→${pct(b.strengthUpset)}; unique champions ${a.champions}→${b.champions}.`)
  for (const high of [1, 2, 3, 4, 5]) {
    const matchup = (runs: readonly DynastyRunResult[]) => runs.flatMap((r) => r.tournamentBalanceCandidate.filter((o) => o.seasonNumber >= START).flatMap((o) => o.games)).filter((g) => g.round === 'round-of-16' && [g.homeSeed, g.awaySeed].includes(high) && [g.homeSeed, g.awaySeed].includes(17 - high))
    const ga = matchup(control); const gb = matchup(candidate)
    console.log(`${high}–${17 - high}: median gap ${f(percentile(ga.map((g) => g.overallDifference), .5))}→${f(percentile(gb.map((g) => g.overallDifference), .5))}; within2 ${pct(rate(ga.filter((g) => g.overallDifference <= 2).length, ga.length))}→${pct(rate(gb.filter((g) => g.overallDifference <= 2).length, gb.length))}; seed upset ${pct(rate(ga.filter((g) => g.seedUpset).length, ga.length))}→${pct(rate(gb.filter((g) => g.seedUpset).length, gb.length))}.`)
  }
  const hierarchy = (runs: readonly DynastyRunResult[]) => {
    const observations = runs.flatMap((r) => r.tournamentBalanceCandidate.filter((o) => o.seasonNumber >= START)); let strongest = 0; let top4 = 0; let bottomHalf = 0; let deep = 0
    const numberOnes = new Set<string>()
    for (const run of runs) for (let season = START; season <= 25; season += 1) {
      const rows = run.rosterTraces.filter((r) => r.seasonNumber === season).sort((x, y) => y.overall - x.overall || x.programId.localeCompare(y.programId)); if (rows[0]) numberOnes.add(rows[0].programId)
    }
    for (const o of observations) { const byStrength = [...o.field].sort((x, y) => y.overall - x.overall); const rank = byStrength.findIndex((x) => x.programId === o.championProgramId) + 1; const seed = o.field.find((x) => x.programId === o.championProgramId)!.seed; strongest += Number(rank === 1); top4 += Number(rank <= 4); bottomHalf += Number(rank >= 9); deep += Number(seed >= 9) }
    return { strongest: rate(strongest, observations.length), top4: rate(top4, observations.length), bottomHalf: rate(bottomHalf, observations.length), deep: rate(deep, observations.length), numberOnes: numberOnes.size }
  }
  const ha = hierarchy(control); const hb = hierarchy(candidate)
  console.log(`Strongest-field champion ${pct(ha.strongest)}→${pct(hb.strongest)}; top-4 Strength champion ${pct(ha.top4)}→${pct(hb.top4)}; bottom-half Strength champion ${pct(ha.bottomHalf)}→${pct(hb.bottomHalf)}; seeds 9–16 champion ${pct(ha.deep)}→${pct(hb.deep)}; Programs reaching #1 Strength ${ha.numberOnes}→${hb.numberOnes}.`)
}

const control = await runLongRunCalibrationParallel({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light', workers: 3 })
const candidate = await runLongRunCalibrationParallel({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light', workers: 3, experimentalRotationCompatibleOpenings: true })
console.log('COLLEGE HOOPS SIM — COVERAGE-PRESERVING FLEXIBLE RECRUITING PAIRED AUDIT')
console.log('3 seeds × 25 Seasons; mature S5–25; identical deterministic seeds and Recruit generation.')
const controlClasses = classes(control.runs); const candidateClasses = classes(candidate.runs)
premium(controlClasses, candidateClasses); activation(controlClasses, candidateClasses, candidate.runs); rosterHealth(control.runs, candidate.runs); downstream(control.runs, candidate.runs); tournament(control.runs, candidate.runs)
console.log(`\n6. HEALTH: control ${JSON.stringify(control.runs.map((r) => r.health))}\ncandidate ${JSON.stringify(candidate.runs.map((r) => r.health))}`)
