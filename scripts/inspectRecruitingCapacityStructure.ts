import { POSITIONS } from '../src/engine'
import { UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile, summarizeDistribution, type SignedRecruitRecord } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type ProgramRecruitingCapacityTrace } from './inspectDynastyLongRun'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const END = 25
const ranked = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(ranked.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(ranked.slice(3, 6).map((p) => p.id))
const ELITE = new Set<string>(ranked.slice(0, 6).map((p) => p.id))
const f = (v: number, d = 2): string => Number.isFinite(v) ? v.toFixed(d) : '—'
const rate = (n: number, d: number): number => d ? n / d : Number.NaN
const pct = (v: number): string => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const topAvg = (values: readonly number[], n: number): number => average([...values].sort((a, b) => b - a).slice(0, n))

interface ClassRow extends ProgramRecruitingCapacityTrace {
  seed: string
  recruits: SignedRecruitRecord[]
  maxTop25: number
  max80: number
  exceptional: boolean
}

function tier(row: ClassRow): string {
  if (TOP3.has(row.programId)) return 'Top 3'
  if (ELITE46.has(row.programId)) return 'Elite #4–6'
  if (row.prestige >= 60) return '60–79'
  if (row.prestige >= 40) return '40–59'
  return '1–39'
}
function count(row: ClassRow, test: (recruit: SignedRecruitRecord) => boolean): number { return row.recruits.filter(test).length }
function rowsFor(runs: readonly DynastyRunResult[]): ClassRow[] {
  const rows = runs.flatMap((run) => run.recruitingCapacity
    .filter((row) => row.targetSeasonNumber >= START && row.targetSeasonNumber <= END)
    .map((capacity) => {
      const recruits = run.signedRecruits.filter((r) => r.targetSeasonNumber === capacity.targetSeasonNumber && r.programId === capacity.programId)
      const generated = run.generatedRecruits.filter((r) => r.targetSeasonNumber === capacity.targetSeasonNumber)
      const legalMax = (test: (r: typeof generated[number]) => boolean) => POSITIONS.reduce((sum, position) => sum + Math.min(
        capacity.projectedOpeningsByPosition[position] ?? 0,
        generated.filter((r) => r.position === position && test(r)).length,
      ), 0)
      return { ...capacity, seed: run.seed, recruits, maxTop25: legalMax((r) => r.nationalRank <= 25), max80: legalMax((r) => r.overall >= 80), exceptional: false }
    }))
  const cutoff = percentile(rows.map((row) => topAvg(row.recruits.map((r) => r.overall), 3)), .9)
  return rows.map((row) => ({ ...row, exceptional: topAvg(row.recruits.map((r) => r.overall), 3) >= cutoff }))
}

function distribution(rows: readonly ClassRow[]): void {
  console.log('\n1. CLASS SIZE / OPENING DISTRIBUTION — 2,016 mature Program-Seasons')
  console.log('Tier         N Mean Median   SD Min Max P10 P90  Size1  Size2  Size3  Size4  Size5+  Unfilled')
  for (const label of ['Top 3', 'Elite #4–6', '60–79', '40–59', '1–39']) {
    const selected = rows.filter((r) => tier(r) === label); const values = selected.map((r) => r.projectedOpenings); const s = summarizeDistribution(values)
    const freq = (test: (n: number) => boolean) => pct(rate(values.filter(test).length, values.length))
    console.log(`${label.padEnd(12)} ${String(selected.length).padStart(4)} ${f(s.average).padStart(4)} ${f(percentile(values, .5)).padStart(6)} ${f(s.standardDeviation).padStart(4)} ${String(s.minimum).padStart(3)} ${String(s.maximum).padStart(3)} ${f(s.p10).padStart(3)} ${f(s.p90).padStart(3)} ${freq((n) => n === 1).padStart(6)} ${freq((n) => n === 2).padStart(6)} ${freq((n) => n === 3).padStart(6)} ${freq((n) => n === 4).padStart(6)} ${freq((n) => n >= 5).padStart(7)} ${String(selected.reduce((sum, r) => sum + r.projectedOpenings - r.actualSignees, 0)).padStart(9)}`)
  }
  const changes = rows.flatMap((row) => rows.filter((next) => next.seed === row.seed && next.programId === row.programId && next.targetSeasonNumber === row.targetSeasonNumber + 1).map((next) => next.projectedOpenings - row.projectedOpenings))
  console.log(`Within-Program year-to-year opening change: SD ${f(summarizeDistribution(changes).standardDeviation)}; changed ${pct(rate(changes.filter((v) => v !== 0).length, changes.length))}; N→N+1 correlation ${f(correlation(rows.flatMap((row) => rows.filter((next) => next.seed === row.seed && next.programId === row.programId && next.targetSeasonNumber === row.targetSeasonNumber + 1).map((next) => ({ first: row.projectedOpenings, second: next.projectedOpenings })))), 3)}.`)
  const positionMix = POSITIONS.map((position) => {
    const openings = rows.reduce((sum, row) => sum + (row.projectedOpeningsByPosition[position] ?? 0), 0)
    return `${position} ${pct(rate(openings, 3 * rows.length))}`
  })
  console.log(`Opening-position mix: ${positionMix.join(' · ')}.`)
}

function classCeiling(rows: readonly ClassRow[]): void {
  console.log('\n2. CLASS SIZE VS PREMIUM ACCUMULATION')
  console.log('Size Classes T10 T25 T50 4★+ 5★ 80+ AvgOVR Top2 Top3 Exceptional 2+T25 3+T25 4+T25')
  for (const size of [...new Set(rows.map((r) => r.projectedOpenings))].sort()) {
    const selected = rows.filter((r) => r.projectedOpenings === size); const per = (test: (r: SignedRecruitRecord) => boolean) => average(selected.map((r) => count(r, test)))
    const frequency = (n: number) => pct(rate(selected.filter((r) => count(r, (x) => x.nationalRank <= 25) >= n).length, selected.length))
    console.log(`${String(size).padStart(4)} ${String(selected.length).padStart(7)} ${f(per((r) => r.nationalRank <= 10)).padStart(3)} ${f(per((r) => r.nationalRank <= 25)).padStart(3)} ${f(per((r) => r.nationalRank <= 50)).padStart(3)} ${f(per((r) => r.stars >= 4)).padStart(3)} ${f(per((r) => r.stars === 5)).padStart(3)} ${f(per((r) => r.overall >= 80)).padStart(3)} ${f(average(selected.map((r) => average(r.recruits.map((x) => x.overall)))), 1).padStart(6)} ${f(average(selected.map((r) => topAvg(r.recruits.map((x) => x.overall), 2))), 1).padStart(4)} ${f(average(selected.map((r) => topAvg(r.recruits.map((x) => x.overall), 3))), 1).padStart(4)} ${pct(rate(selected.filter((r) => r.exceptional).length, selected.length)).padStart(11)} ${frequency(2).padStart(6)} ${frequency(3).padStart(6)} ${frequency(4).padStart(6)}`)
  }
}

function normalized(rows: readonly ClassRow[]): void {
  console.log('\n3. CAPACITY-NORMALIZED RECRUITING')
  console.log('Tier         Slots T25/slot T50/slot 4★+/slot 80+/slot 2+T25 3+T25')
  for (const label of ['Top 3', 'Elite #4–6', '60–79', '40–59', '1–39']) {
    const selected = rows.filter((r) => tier(r) === label); const slots = selected.reduce((sum, r) => sum + r.projectedOpenings, 0); const signed = selected.flatMap((r) => r.recruits)
    console.log(`${label.padEnd(12)} ${String(slots).padStart(5)} ${pct(rate(signed.filter((r) => r.nationalRank <= 25).length, slots)).padStart(8)} ${pct(rate(signed.filter((r) => r.nationalRank <= 50).length, slots)).padStart(8)} ${pct(rate(signed.filter((r) => r.stars >= 4).length, slots)).padStart(8)} ${pct(rate(signed.filter((r) => r.overall >= 80).length, slots)).padStart(8)} ${pct(rate(selected.filter((r) => count(r, (x) => x.nationalRank <= 25) >= 2).length, selected.length)).padStart(6)} ${pct(rate(selected.filter((r) => count(r, (x) => x.nationalRank <= 25) >= 3).length, selected.length)).padStart(6)}`)
  }
}

function eliteCapacity(rows: readonly ClassRow[], runs: readonly DynastyRunResult[]): void {
  const elite = rows.filter((r) => ELITE.has(r.programId)); const pairs = elite.flatMap((r) => elite.filter((n) => n.seed === r.seed && n.programId === r.programId && n.targetSeasonNumber === r.targetSeasonNumber + 1).map((n) => [r, n] as const))
  const premium = (r: ClassRow) => count(r, (x) => x.nationalRank <= 25)
  console.log('\n4. ELITE OPPORTUNITY CEILING / STRUCTURAL UPPER BOUND')
  console.log(`Elite class sizes: ${[1, 2, 3].map((n) => `${n} ${pct(rate(elite.filter((r) => r.projectedOpenings === n).length, elite.length))}`).join(' · ')} · 4+ ${pct(rate(elite.filter((r) => r.projectedOpenings >= 4).length, elite.length))} · 5+ ${pct(rate(elite.filter((r) => r.projectedOpenings >= 5).length, elite.length))}.`)
  console.log(`Legally capable: 3+ top-25 ${pct(rate(elite.filter((r) => r.maxTop25 >= 3).length, elite.length))}; 4+ top-25 ${pct(rate(elite.filter((r) => r.maxTop25 >= 4).length, elite.length))}; 3+ incoming 80+ ${pct(rate(elite.filter((r) => r.max80 >= 3).length, elite.length))}; 4+ incoming 80+ ${pct(rate(elite.filter((r) => r.max80 >= 4).length, elite.length))}.`)
  console.log(`Actual elite top-25 occupancy ${pct(rate(elite.reduce((s, r) => s + premium(r), 0), elite.reduce((s, r) => s + r.projectedOpenings, 0)))}; 3-top-25 classes ${pct(rate(elite.filter((r) => premium(r) >= 3).length, elite.length))}; adjacent 2+ top-25 classes ${pct(rate(pairs.filter(([a, b]) => premium(a) >= 2 && premium(b) >= 2).length, pairs.length))}.`)
  const histories = runs.flatMap((run) => {
    const map = new Map<string, typeof run.recruitingOpportunities>()
    for (const observation of run.recruitingOpportunities.filter((o) => o.targetSeasonNumber >= START && o.targetSeasonNumber <= END && ELITE.has(o.programId))) {
      const key = `${observation.targetSeasonNumber}|${observation.programId}|${observation.playerId}`
      map.set(key, [...(map.get(key) ?? []), observation])
    }
    return [...map.values()]
  })
  const exact = histories.filter((h) => h[0]!.projectedOpening)
  const signed = exact.filter((h) => h.some((o) => o.signed))
  const everBoarded = exact.filter((h) => h.some((o) => o.onBoard))
  const everOffered = exact.filter((h) => h.some((o) => o.offered))
  console.log(`Elite × top-25 opportunity pairs: ${histories.length}; exact-position eligible ${pct(rate(exact.length, histories.length))}; excluded solely by no exact opening ${pct(rate(histories.length - exact.length, histories.length))}.`)
  console.log(`Of exact-eligible pairs: ever Boarded ${pct(rate(everBoarded.length, exact.length))}; ever Offered ${pct(rate(everOffered.length, exact.length))}; signed by that elite Program ${pct(rate(signed.length, exact.length))}; compatible slot ultimately filled by another commitment ${pct(rate(exact.length - signed.length, exact.length))}.`)
}

function positionalRigidity(rows: readonly ClassRow[], runs: readonly DynastyRunResult[]): void {
  const secondary: Readonly<Record<string, readonly string[]>> = { PG: ['SG'], SG: ['SF'], SF: ['PF'], PF: ['C'], C: ['PF'] }
  const cases = rows.filter((r) => ELITE.has(r.programId)).flatMap((row) => {
    const run = runs.find((r) => r.seed === row.seed)!
    const generated = run.generatedRecruits.filter((r) => r.targetSeasonNumber === row.targetSeasonNumber)
    const positionById = new Map(generated.map((r) => [r.playerId, r.position]))
    return generated.filter((r) => r.nationalRank <= 25 && (row.projectedOpeningsByPosition[r.position] ?? 0) === 0).map((blocked) => {
      const adjacent = (secondary[blocked.position] ?? []).filter((p) => (row.projectedOpeningsByPosition[p] ?? 0) > 0)
      const adjacentSignees = row.recruits.filter((r) => adjacent.includes(positionById.get(r.playerId) ?? ''))
      const weakest = [...adjacentSignees].sort((a, b) => a.overall - b.overall || b.nationalRank - a.nationalRank)[0]
      return { blocked, adjacent: adjacent.length > 0, weakest }
    })
  })
  const overlap = cases.filter((c) => c.adjacent)
  const comparisons = overlap.filter((c) => c.weakest)
  const betterOvr = comparisons.filter((c) => c.blocked.overall > c.weakest!.overall)
  const betterPot = comparisons.filter((c) => c.blocked.potential > c.weakest!.potential)
  console.log('\n5. POSITIONAL RIGIDITY / OBSERVATIONAL ROTATION-ROLE OVERLAP')
  console.log(`Blocked elite × top-25 exact-position pairs: ${cases.length}; a production Rotation-secondary floor role was open in ${pct(rate(overlap.length, cases.length))}. Recruiting itself supports none of these substitutions.`)
  console.log(`Where such a role had a signed natural-position target (${comparisons.length} cases), blocked Recruit had higher OVR ${pct(rate(betterOvr.length, comparisons.length))} (mean advantage ${f(average(betterOvr.map((c) => c.blocked.overall - c.weakest!.overall)), 1)}), higher POT ${pct(rate(betterPot.length, comparisons.length))} (mean advantage ${f(average(betterPot.map((c) => c.blocked.potential - c.weakest!.potential)), 1)}), and better rank in ${pct(rate(comparisons.filter((c) => c.blocked.nationalRank < c.weakest!.nationalRank).length, comparisons.length))}.`)
  console.log(`Exact-position exclusions by Recruit position: ${POSITIONS.map((position) => `${position} ${cases.filter((c) => c.blocked.position === position).length}`).join(' · ')}.`)
}

function lifecycle(rows: readonly ClassRow[], runs: readonly DynastyRunResult[]): void {
  const elite = rows.filter((r) => ELITE.has(r.programId))
  console.log('\n6. ELITE CLASS-SIZE TIMING / SELF-CORRECTION')
  console.log('Size Classes NextSize N+2Size Next4+ Future1Str Future2Str Future3Str Future4Str')
  for (const size of [2, 3, 4]) {
    const selected = elite.filter((r) => r.projectedOpenings === size)
    const later = (row: ClassRow, offset: number) => elite.find((n) => n.seed === row.seed && n.programId === row.programId && n.targetSeasonNumber === row.targetSeasonNumber + offset)
    const strength = (row: ClassRow, offset: number) => runs.find((r) => r.seed === row.seed)!.rosterTraces.find((r) => r.programId === row.programId && r.seasonNumber === row.targetSeasonNumber + offset)?.overall
    console.log(`${String(size).padStart(4)} ${String(selected.length).padStart(7)} ${f(average(selected.map((r) => later(r, 1)?.projectedOpenings).filter((v): v is number => v !== undefined))).padStart(8)} ${f(average(selected.map((r) => later(r, 2)?.projectedOpenings).filter((v): v is number => v !== undefined))).padStart(8)} ${pct(rate(selected.filter((r) => (later(r, 1)?.projectedOpenings ?? 0) >= 4).length, selected.filter((r) => later(r, 1)).length)).padStart(6)} ${[0, 1, 2, 3].map((o) => f(average(selected.map((r) => strength(r, o)).filter((v): v is number => v !== undefined))).padStart(10)).join(' ')}`)
  }
}

function future(rows: readonly ClassRow[], runs: readonly DynastyRunResult[]): void {
  console.log('\n7. RECRUITING OPPORTUNITY / PREMIUM VS FUTURE ROSTER PEAKS')
  console.log('Follow N Open↔Str T25↔Str Share↔Str T25=0 Str T25=1 Str T25=2 Str T25=3 Top5Δ(3-0) RotΔ(3-0)')
  for (let follow = 0; follow < 4; follow += 1) {
    const observations = rows.flatMap((row) => {
      const run = runs.find((r) => r.seed === row.seed)!; const roster = run.rosterTraces.find((r) => r.seasonNumber === row.targetSeasonNumber + follow && r.programId === row.programId)
      if (!roster) return []
      const premium = count(row, (r) => r.nationalRank <= 25); return [{ openings: row.projectedOpenings, premium, share: premium / row.projectedOpenings, strength: roster.overall, top5: topAvg(roster.players.map((p) => p.overall), 5), rotation: roster.rotationWeightedPlayerOverall }]
    })
    const mean = (n: number, key: 'strength' | 'top5' | 'rotation') => average(observations.filter((o) => o.premium === n).map((o) => o[key]))
    console.log(`${String(follow + 1).padStart(6)} ${f(correlation(observations.map((o) => ({ first: o.openings, second: o.strength }))), 3).padStart(8)} ${f(correlation(observations.map((o) => ({ first: o.premium, second: o.strength }))), 3).padStart(8)} ${f(correlation(observations.map((o) => ({ first: o.share, second: o.strength }))), 3).padStart(10)} ${f(mean(0, 'strength')).padStart(9)} ${f(mean(1, 'strength')).padStart(9)} ${f(mean(2, 'strength')).padStart(9)} ${f(mean(3, 'strength')).padStart(9)} ${f(mean(3, 'top5') - mean(0, 'top5')).padStart(11)} ${f(mean(3, 'rotation') - mean(0, 'rotation')).padStart(10)}`)
  }
}

export async function main(): Promise<void> {
  const result = process.env.CAPACITY_AUDIT_SEQUENTIAL === '1'
    ? runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' })
    : await runLongRunCalibrationParallel({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light', workers: 3 })
  const rows = rowsFor(result.runs)
  console.log('COLLEGE HOOPS SIM — ROSTER OPENING / RECRUITING CAPACITY STRUCTURAL AUDIT')
  console.log('Configuration: 3 deterministic seeds × 25 Seasons × LIGHT; mature target Seasons 5–25; production baseline.')
  distribution(rows); classCeiling(rows); normalized(rows); eliteCapacity(rows, result.runs); positionalRigidity(rows, result.runs); lifecycle(rows, result.runs); future(rows, result.runs)
}

await main()
