import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import { average, percentile } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type RecruitingOpportunityTrace } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const END = 15
const programs = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(programs.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(programs.slice(3, 6).map((p) => p.id))
const ELITE = new Set<string>(programs.slice(0, 6).map((p) => p.id))
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'
const switchThreshold = (period: number) => Math.max(3, 10 - (period + 1) * .3)

interface Snapshot { seed: string; season: number; programId: string; position: string; period: number; rows: RecruitingOpportunityTrace[] }
interface Decision { snapshot: Snapshot; offered: RecruitingOpportunityTrace; alternative: RecruitingOpportunityTrace; margin: number; relative: number; threshold: number }
function snapshots(runs: readonly DynastyRunResult[]): Snapshot[] {
  return runs.flatMap((run) => {
    const rows = run.recruitingOpportunities.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END && ELITE.has(r.programId))
    const keys = new Set(rows.map((r) => `${r.targetSeasonNumber}|${r.programId}|${r.position}|${r.period}`))
    return [...keys].map((key) => { const [season, programId, position, period] = key.split('|'); return { seed: run.seed, season: Number(season), programId: programId!, position: position!, period: Number(period), rows: rows.filter((r) => r.targetSeasonNumber === Number(season) && r.programId === programId && r.position === position && r.period === Number(period)) } })
  })
}
function decisions(all: readonly Snapshot[]): Decision[] {
  return all.flatMap((snapshot) => {
    const alternatives = snapshot.rows.filter((r) => r.onBoard && !r.offered && !r.committedElsewhere && r.offerUtility !== null)
    if (!alternatives.length) return []
    const alternative = [...alternatives].sort((a, b) => b.offerUtility! - a.offerUtility! || a.nationalRank - b.nationalRank)[0]!
    return snapshot.rows.filter((r) => r.offered && r.offerUtility !== null).map((offered) => {
      const margin = offered.offerUtility! - alternative.offerUtility!
      return { snapshot, offered, alternative, margin, relative: offered.offerUtility === 0 ? 0 : margin / Math.abs(offered.offerUtility!), threshold: switchThreshold(snapshot.period) }
    })
  })
}

function rules(): void {
  console.log('\n1. PRODUCTION OFFER-SELECTION RULES')
  console.log('Offer utility = qualityScore × (0.5 + Prestige × 0.033) + (standing − commitment threshold) × (0.65 + planningPeriod × 0.02) + (25 − decision-ready period) × 1.5 + relationship × 0.3 − competing Offers × (3 + planningPeriod × 0.35) + uncovered-premium urgency − 5★ elite-reach penalty.')
  console.log('Standing is base attraction plus relationship. Offers are selected within each position up to remaining positional openings. Existing Offers enter the selected set first; after filling vacancies, the best backup replaces the worst selected target only when its utility exceeds the current target by max(3, 10 − 0.3 × planningPeriod). Premium Focus+Offer targets receive additional retention protection against unrelated replacements. Cleanup removes Offers after commitment, position fill, or other invalid status; the next refresh may then assign the freed slot.')
}

function margins(rows: readonly Decision[]): void {
  const gaps = rows.map((r) => r.margin)
  console.log('\n2. SAME-POSITION OFFER MARGINS — qualifying decision snapshots')
  console.log(`N=${rows.length}; utility margin Offered − best blocked: mean ${f(average(gaps))}, median ${f(percentile(gaps, .5))}, P10/P25/P75/P90 ${f(percentile(gaps, .1))}/${f(percentile(gaps, .25))}/${f(percentile(gaps, .75))}/${f(percentile(gaps, .9))}; relative median ${pct(percentile(rows.map((r) => r.relative), .5))}.`)
  const buckets = [['Alternative ahead enough to switch', (r: Decision) => r.margin < -r.threshold], ['Alternative ahead, below switch threshold', (r: Decision) => r.margin < 0 && r.margin >= -r.threshold], ['Offered ahead 0–3', (r: Decision) => r.margin >= 0 && r.margin <= 3], ['Offered ahead 3–10', (r: Decision) => r.margin > 3 && r.margin <= 10], ['Offered ahead 10+', (r: Decision) => r.margin > 10]] as const
  for (const [label, test] of buckets) console.log(`${label.padEnd(43)} ${String(rows.filter(test).length).padStart(6)} ${pct(rate(rows.filter(test).length, rows.length)).padStart(7)}`)
}

function quality(rows: readonly Decision[]): void {
  console.log('\n3. RAW QUALITY OF BLOCKED ALTERNATIVES')
  const altBetter = (key: 'overall' | 'potential') => rows.filter((r) => r.alternative[key] > r.offered[key]).length
  console.log(`Blocked alternative has better National Rank ${pct(rate(rows.filter((r) => r.alternative.nationalRank < r.offered.nationalRank).length, rows.length))}; higher OVR ${pct(rate(altBetter('overall'), rows.length))}; higher POT ${pct(rate(altBetter('potential'), rows.length))}; same stars ${pct(rate(rows.filter((r) => r.alternative.stars === r.offered.stars).length, rows.length))}.`)
  console.log(`Mean Offered vs blocked: rank ${f(average(rows.map((r) => r.offered.nationalRank)), 1)} vs ${f(average(rows.map((r) => r.alternative.nationalRank)), 1)}; OVR ${f(average(rows.map((r) => r.offered.overall)), 1)} vs ${f(average(rows.map((r) => r.alternative.overall)), 1)}; POT ${f(average(rows.map((r) => r.offered.potential)), 1)} vs ${f(average(rows.map((r) => r.alternative.potential)), 1)}.`)
  console.log(`Mean relationship advantage ${f(average(rows.map((r) => r.offered.relationshipProgress - r.alternative.relationshipProgress)))}; base-attraction advantage ${f(average(rows.map((r) => r.offered.baseAttraction - r.alternative.baseAttraction)))}; competing-Offer difference ${f(average(rows.map((r) => r.offered.competingOffers - r.alternative.competingOffers)))}.`)
}

function credibleAlternatives(all: readonly Snapshot[]): void {
  const openings = all.filter((s) => s.rows.some((r) => r.offered)).map((snapshot) => {
    const offered = [...snapshot.rows].filter((r) => r.offered && r.offerUtility !== null).sort((a, b) => b.offerUtility! - a.offerUtility!)[0]!
    const credible = snapshot.rows.filter((r) => r.onBoard && !r.offered && !r.committedElsewhere && r.offerUtility !== null && offered.offerUtility! - r.offerUtility! <= switchThreshold(snapshot.period)).length
    return { snapshot, credible }
  })
  console.log('\n4. CREDIBLE BLOCKED PREMIUM ALTERNATIVES')
  for (const n of [0, 1, 2]) console.log(`${n} credible alternatives: ${pct(rate(openings.filter((r) => r.credible === n).length, openings.length))}`)
  console.log(`3+ credible alternatives: ${pct(rate(openings.filter((r) => r.credible >= 3).length, openings.length))}; at least one: ${pct(rate(openings.filter((r) => r.credible >= 1).length, openings.length))}. Credible means within the production switching-margin scale, not an invented talent cutoff.`)
}

interface Episode { seed: string; season: number; programId: string; position: string; playerId: string; rows: RecruitingOpportunityTrace[]; snapshots: Snapshot[] }
function episodes(all: readonly Snapshot[]): Episode[] {
  const offeredRows = all.flatMap((s) => s.rows.filter((r) => r.offered).map((r) => ({ s, r })))
  const keys = new Set(offeredRows.map(({ s, r }) => `${s.seed}|${s.season}|${s.programId}|${s.position}|${r.playerId}`))
  return [...keys].map((key) => {
    const [seed, season, programId, position, playerId] = key.split('|'); const ss = all.filter((s) => s.seed === seed && s.season === Number(season) && s.programId === programId && s.position === position).sort((a, b) => a.period - b.period)
    return { seed: seed!, season: Number(season), programId: programId!, position: position!, playerId: playerId!, rows: ss.flatMap((s) => s.rows.filter((r) => r.playerId === playerId)), snapshots: ss }
  })
}
function episodeComparisons(ep: Episode) {
  return ep.snapshots.flatMap((s) => {
    const current = s.rows.find((r) => r.playerId === ep.playerId && r.offered && r.offerUtility !== null)
    if (!current) return []
    const alt = s.rows.filter((r) => r.onBoard && !r.offered && !r.committedElsewhere && r.offerUtility !== null).sort((a, b) => b.offerUtility! - a.offerUtility!)[0]
    return alt ? [{ s, current, alt, margin: current.offerUtility! - alt.offerUtility! }] : []
  })
}
function episodeMetrics(all: readonly Snapshot[], eps: readonly Episode[]): void {
  let overtaken = 0, switched = 0, switchableOvertakes = 0, switchableSwitched = 0
  const ages: number[] = [], firstMargins: number[] = [], lastMargins: number[] = [], firstRel: number[] = [], lastRel: number[] = []
  for (const ep of eps) {
    const offeredPeriods = ep.rows.filter((r) => r.offered).map((r) => r.period); const first = Math.min(...offeredPeriods); const last = Math.max(...offeredPeriods); ages.push(last - first + 1)
    const comparisons = episodeComparisons(ep)
    if (comparisons.length) { firstMargins.push(comparisons[0]!.margin); lastMargins.push(comparisons.at(-1)!.margin); firstRel.push(comparisons[0]!.current.relationshipProgress - comparisons[0]!.alt.relationshipProgress); lastRel.push(comparisons.at(-1)!.current.relationshipProgress - comparisons.at(-1)!.alt.relationshipProgress) }
    const over = comparisons.find((c) => c.margin < 0); if (over) overtaken += 1
    const switchable = comparisons.find((c) => c.margin < -switchThreshold(c.s.period)); if (switchable) switchableOvertakes += 1
    const laterSwitch = (from: typeof comparisons[number] | undefined) => from ? ep.snapshots.some((s) => s.period > from.s.period && s.rows.some((r) => r.playerId !== ep.playerId && r.offered && r.nationalRank <= 25)) : false
    if (laterSwitch(over)) switched += 1
    if (laterSwitch(switchable)) switchableSwitched += 1
  }
  console.log('\n5/6. OFFER STICKINESS AND EARLY PATH DEPENDENCE')
  console.log(`Offer episodes: ${eps.length}; mean observed duration ${f(average(ages), 1)} periods. Ever overtaken by a blocked premium alternative: ${overtaken} (${pct(rate(overtaken, eps.length))}); later switched to a premium alternative: ${switched} (${pct(rate(switched, overtaken))} of overtaken).`)
  console.log(`Overtaken beyond production switching threshold: ${switchableOvertakes} (${pct(rate(switchableOvertakes, eps.length))}); later switched ${switchableSwitched} (${pct(rate(switchableSwitched, switchableOvertakes))}).`)
  console.log(`Initial margin mean/median ${f(average(firstMargins))}/${f(percentile(firstMargins, .5))}; within production switching scale ${pct(rate(eps.filter((ep) => { const c = episodeComparisons(ep)[0]; return c && c.margin <= switchThreshold(c.s.period) }).length, eps.length))}; within ±3 ${pct(rate(firstMargins.filter((v) => Math.abs(v) <= 3).length, firstMargins.length))}.`)
  console.log(`Mean current-minus-alternative utility margin: first ${f(average(firstMargins))}, last ${f(average(lastMargins))}; relationship gap first ${f(average(firstRel))}, last ${f(average(lastRel))}. Offered targets Focused in ${pct(rate(all.flatMap((s) => s.rows).filter((r) => r.offered && r.focused).length, all.flatMap((s) => s.rows).filter((r) => r.offered).length))} of snapshots.`)
}

function commitmentsAndRecovery(all: readonly Snapshot[], eps: readonly Episode[]): void {
  const signingEpisodes = eps.filter((ep) => ep.rows.some((r) => r.signed))
  const blockedPeriods = signingEpisodes.map((ep) => ep.snapshots.filter((s) => s.rows.some((r) => r.playerId === ep.playerId && r.offered) && s.rows.some((r) => r.playerId !== ep.playerId && r.onBoard && !r.offered && !r.committedElsewhere)).length)
  const firstOffer = signingEpisodes.map((ep) => Math.min(...ep.rows.filter((r) => r.offered).map((r) => r.period)))
  const firstSerious = signingEpisodes.map((ep) => Math.min(...ep.rows.filter((r) => r.serious).map((r) => r.period)))
  const commitPeriod = signingEpisodes.map((ep) => Math.min(...ep.rows.filter((r) => r.signed).map((r) => r.period)))
  const failures = eps.filter((ep) => ep.rows.some((r) => r.committedElsewhere))
  const recoveries = failures.map((ep) => {
    const failed = Math.min(...ep.rows.filter((r) => r.committedElsewhere).map((r) => r.period)); const next = ep.snapshots.find((s) => s.period >= failed && s.rows.some((r) => r.playerId !== ep.playerId && r.offered && !r.committedElsewhere)); return next ? next.period - failed : null
  })
  console.log('\n7/8. COMMITMENT TIMING AND FAILED-OFFER RECOVERY')
  console.log(`Signing Offer episodes ${signingEpisodes.length}: first Offer ${f(average(firstOffer), 1)}, first serious ${f(average(firstSerious), 1)}, commitment ${f(average(commitPeriod), 1)}; credible/blocked alternatives coexisted for ${f(average(blockedPeriods), 1)} observed periods.`)
  console.log(`Failed Offer episodes (target signed elsewhere): ${failures.length}; a different same-position top-25 target received an Offer afterward in ${pct(rate(recoveries.filter((r) => r !== null).length, failures.length))}; mean delay ${f(average(recoveries.filter((r): r is number => r !== null)), 1)} periods; immediate/same-snapshot recovery ${pct(rate(recoveries.filter((r) => r === 0).length, failures.length))}.`)
}

function groups(rows: readonly Decision[], eps: readonly Episode[]): void {
  console.log('\n9. TOP 3 VS ELITE #4–6')
  for (const [label, ids] of [['Top 3', TOP3], ['Elite #4–6', ELITE46]] as const) {
    const ds = rows.filter((r) => ids.has(r.snapshot.programId)); const es = eps.filter((e) => ids.has(e.programId)); const over = es.filter((ep) => episodeComparisons(ep).some((c) => c.margin < 0)).length
    console.log(`${label}: decisions ${ds.length}; median margin ${f(percentile(ds.map((r) => r.margin), .5))}; within switching scale ${pct(rate(ds.filter((r) => r.margin <= r.threshold).length, ds.length))}; episodes ${es.length}; ever overtaken ${pct(rate(over, es.length))}.`)
  }
}

function counterfactualCounts(all: readonly Snapshot[]): void {
  const openingSnapshots = all.filter((s) => s.rows.some((r) => r.offered)); const one = openingSnapshots.filter((s) => { const offered = s.rows.filter((r) => r.offered && r.offerUtility !== null).sort((a, b) => b.offerUtility! - a.offerUtility!)[0]; return offered && s.rows.some((r) => r.onBoard && !r.offered && !r.committedElsewhere && r.offerUtility !== null && offered.offerUtility! - r.offerUtility! <= switchThreshold(s.period)) })
  const narrow = openingSnapshots.filter((s) => { const offered = s.rows.filter((r) => r.offered && r.offerUtility !== null).sort((a, b) => b.offerUtility! - a.offerUtility!)[0]; return offered && s.rows.some((r) => r.onBoard && !r.offered && !r.committedElsewhere && r.offerUtility !== null && Math.abs(offered.offerUtility! - r.offerUtility!) <= 3) })
  console.log('\n10. DIAGNOSTIC-ONLY SECOND-PURSUIT ELIGIBILITY')
  console.log(`Opening snapshots with one additional premium candidate within the production switching-margin scale: ${one.length}/${openingSnapshots.length} (${pct(rate(one.length, openingSnapshots.length))}). Within ±3 utility: ${narrow.length}/${openingSnapshots.length} (${pct(rate(narrow.length, openingSnapshots.length))}). These are observational eligibility counts only; no commitments or outcomes were resimulated.`)
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 15, seeds: SEEDS, auditLevel: 'light' }); const all = snapshots(result.runs); const ds = decisions(all); const eps = episodes(all)
  console.log('COLLEGE HOOPS SIM — SAME-POSITION OFFER SELECTION MARGIN AUDIT')
  console.log('Configuration: 3 deterministic seeds × 15 Seasons × LIGHT; mature target classes S5–15; elite Programs; qualifying snapshot requires an Offered top-25 target and a Boarded-but-unoffered same-position top-25 alternative.')
  rules(); margins(ds); quality(ds); credibleAlternatives(all); episodeMetrics(all, eps); commitmentsAndRecovery(all, eps); groups(ds, eps); counterfactualCounts(all)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
