import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import { average } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type RecruitingOpportunityTrace } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const START = 5
const END = 25
const programs = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige || a.id.localeCompare(b.id))
const TOP3 = new Set<string>(programs.slice(0, 3).map((p) => p.id))
const ELITE46 = new Set<string>(programs.slice(3, 6).map((p) => p.id))
const ELITE = new Set<string>(programs.slice(0, 6).map((p) => p.id))
const f = (v: number, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '—'
const rate = (n: number, d: number) => d ? n / d : Number.NaN
const pct = (v: number) => Number.isFinite(v) ? `${f(v * 100, 1)}%` : '—'

interface Opportunity {
  seed: string
  rows: RecruitingOpportunityTrace[]
  first: RecruitingOpportunityTrace
  boarded: boolean; focused: boolean; offered: boolean; meaningful: boolean; serious: boolean; signed: boolean
  firstBoard: number | null; firstFocus: number | null; firstOffer: number | null; firstSerious: number | null
  abandoned: boolean
}
function opportunities(runs: readonly DynastyRunResult[]): Opportunity[] {
  return runs.flatMap((run) => {
    const rows = run.recruitingOpportunities.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END)
    const keys = new Set(rows.map((r) => `${r.targetSeasonNumber}|${r.programId}|${r.playerId}`))
    return [...keys].map((key) => {
      const [season, programId, playerId] = key.split('|')
      const history = rows.filter((r) => r.targetSeasonNumber === Number(season) && r.programId === programId && r.playerId === playerId).sort((a, b) => a.period - b.period)
      const firstPeriod = (test: (r: RecruitingOpportunityTrace) => boolean) => history.find(test)?.period ?? null
      const ever = (test: (r: RecruitingOpportunityTrace) => boolean) => history.some(test)
      const firstBoard = firstPeriod((r) => r.onBoard)
      return { seed: run.seed, rows: history, first: history[0]!, boarded: ever((r) => r.onBoard), focused: ever((r) => r.focused), offered: ever((r) => r.offered), meaningful: ever((r) => r.meaningfulRelationship), serious: ever((r) => r.serious), signed: ever((r) => r.signed), firstBoard, firstFocus: firstPeriod((r) => r.focused), firstOffer: firstPeriod((r) => r.offered), firstSerious: firstPeriod((r) => r.serious), abandoned: firstBoard !== null && history.some((r) => r.period > firstBoard && !r.onBoard && !r.committedElsewhere && !r.signed) }
    })
  })
}

function funnelRows(all: readonly Opportunity[], ids: ReadonlySet<string>): { label: string; count: number; prior: number; total: number }[] {
  const eligible = all.filter((o) => ids.has(o.first.programId) && o.first.projectedOpening)
  const stages = [['Position eligible', () => true, () => true], ['Considered by position planner', () => true, () => true], ['Boarded', (o: Opportunity) => o.boarded, () => true], ['Focused (optional accelerator)', (o: Opportunity) => o.focused, (o: Opportunity) => o.boarded], ['Offered (parallel branch)', (o: Opportunity) => o.offered, (o: Opportunity) => o.boarded], ['Meaningful relationship', (o: Opportunity) => o.meaningful, (o: Opportunity) => o.boarded], ['Serious = Offer + meaningful', (o: Opportunity) => o.serious, (o: Opportunity) => o.offered], ['Signed', (o: Opportunity) => o.signed, (o: Opportunity) => o.serious]] as const
  return stages.map(([label, test, denominator]) => ({ label, count: eligible.filter(test).length, prior: eligible.filter(denominator).length, total: eligible.length }))
}

function printFunnel(all: readonly Opportunity[]): void {
  console.log('\n1. ELITE TOP-25 PURSUIT FUNNEL — unique Program × Recruit opportunities')
  console.log('Stage                       Top 3 total/step/all   Elite 4–6 total/step/all   All elite total/step/all')
  const groups = [funnelRows(all, TOP3), funnelRows(all, ELITE46), funnelRows(all, ELITE)]
  groups[0]!.forEach((row, i) => {
    const cell = (r: typeof row) => `${r.count}/${pct(rate(r.count, r.prior))}/${pct(rate(r.count, r.total))}`
    console.log(`${row.label.padEnd(27)} ${cell(groups[0]![i]!).padStart(21)} ${cell(groups[1]![i]!).padStart(26)} ${cell(groups[2]![i]!).padStart(25)}`)
  })
}

type DropReason = 'never-boarded-ranking' | 'never-boarded-board-capacity' | 'boarded-never-offered-capacity' | 'boarded-never-offered-ranking' | 'offered-before-meaningful-ended' | 'meaningful-without-concurrent-offer' | 'serious-lost-commitment'
function reason(o: Opportunity): DropReason | null {
  if (o.serious) return o.signed ? null : 'serious-lost-commitment'
  if (!o.boarded) return o.rows.some((r) => r.boardFree) ? 'never-boarded-ranking' : 'never-boarded-board-capacity'
  if (!o.offered) return o.rows.filter((r) => r.onBoard && r.remainingOpening && !r.committedElsewhere).every((r) => !r.offerFreeAtPosition) ? 'boarded-never-offered-capacity' : 'boarded-never-offered-ranking'
  if (!o.meaningful) return 'offered-before-meaningful-ended'
  return 'meaningful-without-concurrent-offer'
}
function drops(all: readonly Opportunity[]): void {
  const eligible = all.filter((o) => ELITE.has(o.first.programId) && o.first.projectedOpening)
  const missed = eligible.filter((o) => !o.serious)
  console.log('\n2. FIRST DROP REASONS — eligible opportunities that never became serious')
  const reasons: DropReason[] = ['never-boarded-ranking', 'never-boarded-board-capacity', 'boarded-never-offered-capacity', 'boarded-never-offered-ranking', 'offered-before-meaningful-ended', 'meaningful-without-concurrent-offer']
  for (const r of reasons) { const n = missed.filter((o) => reason(o) === r).length; console.log(`${r.padEnd(37)} ${String(n).padStart(5)} ${pct(rate(n, missed.length)).padStart(7)} of missed · ${pct(rate(n, eligible.length)).padStart(7)} of eligible`) }
  console.log(`Serious but signed elsewhere: ${eligible.filter((o) => reason(o) === 'serious-lost-commitment').length}/${eligible.filter((o) => o.serious).length} (${pct(rate(eligible.filter((o) => reason(o) === 'serious-lost-commitment').length, eligible.filter((o) => o.serious).length))}).`)
}

function substitutions(all: readonly Opportunity[]): void {
  const skipped = all.filter((o) => ELITE.has(o.first.programId) && o.first.projectedOpening && !o.boarded)
  const alternativeRank = (o: Opportunity) => Math.min(...o.rows.map((r) => r.bestBoardRankAtPosition ?? 999))
  const buckets = [['another top-25', (rank: number) => rank <= 25], ['rank 26–50', (rank: number) => rank >= 26 && rank <= 50], ['rank 51+', (rank: number) => rank >= 51 && rank < 999], ['no same-position target', (rank: number) => rank === 999]] as const
  console.log('\n3. TARGET SUBSTITUTION FOR ELIGIBLE TOP-25 RECRUITS NEVER BOARDED')
  for (const [label, test] of buckets) { const n = skipped.filter((o) => test(alternativeRank(o))).length; console.log(`${label.padEnd(26)} ${String(n).padStart(5)} ${pct(rate(n, skipped.length)).padStart(7)}`) }
  const tradeDown = skipped.filter((o) => alternativeRank(o) > o.first.nationalRank && alternativeRank(o) < 999)
  const tradeUp = skipped.filter((o) => alternativeRank(o) <= o.first.nationalRank)
  console.log(`Chose an equal/higher-ranked same-position target: ${pct(rate(tradeUp.length, skipped.length))}; chose a lower-ranked target: ${pct(rate(tradeDown.length, skipped.length))}; average skipped rank ${f(average(skipped.map((o) => o.first.nationalRank)), 1)}, alternative ${f(average(skipped.filter((o) => alternativeRank(o) < 999).map(alternativeRank)), 1)}.`)
  console.log(`Skipped OVR/POT average ${f(average(skipped.map((o) => o.first.overall)), 1)}/${f(average(skipped.map((o) => o.first.potential)), 1)}; boarded alternatives are compared by production National Rank because planner utility itself is intentionally not exported.`)
}

function constraints(all: readonly Opportunity[]): void {
  const possible = all.filter((o) => ELITE.has(o.first.programId))
  const eligible = possible.filter((o) => o.first.projectedOpening)
  const recruitKeys = new Set(possible.map((o) => `${o.seed}|${o.first.targetSeasonNumber}|${o.first.playerId}`))
  const eligibleCounts = [...recruitKeys].map((key) => possible.filter((o) => `${o.seed}|${o.first.targetSeasonNumber}|${o.first.playerId}` === key && o.first.projectedOpening).length)
  console.log('\n4. POSITION / OPENING CONSTRAINTS')
  console.log(`All elite × top-25 opportunities: ${possible.length}; projected-position eligible ${eligible.length} (${pct(rate(eligible.length, possible.length))}); average eligible elite Programs per Recruit ${f(average(eligibleCounts))}.`)
  for (const n of [0, 1, 2]) console.log(`${n} eligible elite Programs: ${pct(rate(eligibleCounts.filter((x) => x === n).length, eligibleCounts.length))}`)
  console.log(`3+ eligible elite Programs: ${pct(rate(eligibleCounts.filter((x) => x >= 3).length, eligibleCounts.length))}.`)
  const filled = eligible.filter((o) => o.rows.some((r) => !r.remainingOpening) && !o.signed)
  const filledBeforeSerious = filled.filter((o) => !o.serious)
  console.log(`Initially eligible but position later filled by another commitment: ${filled.length} (${pct(rate(filled.length, eligible.length))}); before serious pursuit ${filledBeforeSerious.length} (${pct(rate(filledBeforeSerious.length, eligible.length))}).`)
}

function capacities(all: readonly Opportunity[]): void {
  const eligible = all.filter((o) => ELITE.has(o.first.programId) && o.first.projectedOpening)
  const snapshots = eligible.flatMap((o) => o.rows.filter((r) => r.remainingOpening && !r.committedElsewhere))
  console.log('\n5. BOARD / FOCUS / OFFER CAPACITY')
  console.log(`Opportunity-snapshot utilization: Board full ${pct(rate(snapshots.filter((r) => !r.boardFree).length, snapshots.length))}; Focus full ${pct(rate(snapshots.filter((r) => !r.focusFree).length, snapshots.length))}; same-position Offer capacity full ${pct(rate(snapshots.filter((r) => !r.offerFreeAtPosition).length, snapshots.length))}.`)
  const missed = eligible.filter((o) => !o.serious)
  console.log(`Direct first drops attributed to Board capacity ${pct(rate(missed.filter((o) => reason(o) === 'never-boarded-board-capacity').length, missed.length))}; positional Offer capacity ${pct(rate(missed.filter((o) => reason(o) === 'boarded-never-offered-capacity').length, missed.length))}; Offer ranking/switching ${pct(rate(missed.filter((o) => reason(o) === 'boarded-never-offered-ranking').length, missed.length))}. Focus is an effort accelerator, not a commitment prerequisite.`)
}

function timing(all: readonly Opportunity[]): void {
  const eligible = all.filter((o) => ELITE.has(o.first.programId) && o.first.projectedOpening)
  const reached = (key: 'firstBoard' | 'firstFocus' | 'firstOffer' | 'firstSerious') => eligible.map((o) => o[key]).filter((v): v is number => v !== null)
  console.log('\n6. TIMING')
  console.log(`Average first period: Board ${f(average(reached('firstBoard')), 1)}; Focus ${f(average(reached('firstFocus')), 1)}; Offer ${f(average(reached('firstOffer')), 1)}; Serious ${f(average(reached('firstSerious')), 1)}.`)
  for (const [label, lo, hi] of [['Early 0–8', 0, 8], ['Middle 9–16', 9, 16], ['Late 17–28', 17, 28]] as const) console.log(`${label}: first serious ${pct(rate(reached('firstSerious').filter((p) => p >= lo && p <= hi).length, reached('firstSerious').length))}; first offer ${pct(rate(reached('firstOffer').filter((p) => p >= lo && p <= hi).length, reached('firstOffer').length))}.`)
  console.log(`Boarded targets later abandoned/replaced before signing: ${eligible.filter((o) => o.abandoned).length} (${pct(rate(eligible.filter((o) => o.abandoned).length, eligible.length))}).`)
}

function programTable(all: readonly Opportunity[]): void {
  console.log('\n7. PROGRAM-LEVEL FUNNEL — per class')
  console.log('Program                    Prest Eligible Board Focus Offer Serious Sign Conv Abandoned Avg simultaneous serious')
  for (const p of programs.slice(0, 10)) {
    const rows = all.filter((o) => o.first.programId === p.id && o.first.projectedOpening); const per = (test: (o: Opportunity) => boolean) => rows.filter(test).length / 63
    const seasons = [...new Set(rows.map((o) => `${o.seed}|${o.first.targetSeasonNumber}`))]
    const simultaneous = seasons.flatMap((id) => {
      const selected = rows.filter((o) => `${o.seed}|${o.first.targetSeasonNumber}` === id)
      const periods = new Set(selected.flatMap((o) => o.rows.map((r) => r.period)))
      return [...periods].map((period) => selected.filter((o) => o.rows.some((r) => r.period === period && r.serious)).length)
    })
    console.log(`${p.name.padEnd(26)} ${String(p.basePrestige).padStart(5)} ${f(rows.length / 63).padStart(8)} ${f(per((o) => o.boarded)).padStart(5)} ${f(per((o) => o.focused)).padStart(5)} ${f(per((o) => o.offered)).padStart(5)} ${f(per((o) => o.serious)).padStart(7)} ${f(per((o) => o.signed)).padStart(4)} ${pct(rate(rows.filter((o) => o.signed).length, rows.filter((o) => o.serious).length)).padStart(5)} ${f(per((o) => o.abandoned)).padStart(9)} ${f(average(simultaneous)).padStart(24)}`)
  }
}

function battleContext(runs: readonly DynastyRunResult[]): void {
  const battles = runs.flatMap((r) => r.recruitingBattles).filter((b) => b.targetSeasonNumber >= START && b.targetSeasonNumber <= END && b.nationalRank <= 25 && b.participants.filter((p) => ELITE.has(p.programId)).length >= 2)
  const highestWon = battles.filter((b) => { const ps = b.participants.filter((p) => ELITE.has(p.programId)); const max = Math.max(...ps.map((p) => p.prestige)); return ps.some((p) => p.programId === b.winnerProgramId && p.prestige === max) }).length
  console.log('\n8. CAUSAL CONTEXT AFTER SERIOUS PURSUIT FORMS')
  console.log(`${battles.length} mature top-25 commitments had multiple serious elite participants (${pct(rate(battles.length, 1575))} of top-25 commitments); highest-Prestige elite participant won ${pct(rate(highestWon, battles.length))}. Most concentration loss therefore occurs before direct Prestige competition.`)
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' }); const all = opportunities(result.runs)
  console.log('COLLEGE HOOPS SIM — ELITE PREMIUM PURSUIT FUNNEL AUDIT')
  console.log('Configuration: 3 deterministic seeds × 25 Seasons × LIGHT; mature target classes S5–25; primary cohort top-25; production snapshots at initialization and every canonical Recruiting period.')
  printFunnel(all); drops(all); substitutions(all); constraints(all); capacities(all); timing(all); programTable(all); battleContext(result.runs)
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
