import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import { average, percentile } from './dynastyLongRunMetrics'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'
import type { DynastyRunResult, RecruitingMarketRecruitTrace } from './inspectDynastyLongRun'

const SEEDS = ['recruit-market-coverage:1', 'recruit-market-coverage:2', 'recruit-market-coverage:3'] as const
const START = 5, END = 15
const CHECKPOINTS = [0, 4, 8, 12, 20, 24, 28]
const programs = new Map<string, (typeof UNIVERSE_V0.programs)[number]>(UNIVERSE_V0.programs.map((p) => [p.id, p]))
const pct = (n: number, d: number) => d ? `${(100 * n / d).toFixed(1)}%` : '—'
const f = (n: number) => n.toFixed(2)
const band = (rank: number) => rank <= 10 ? '1–10' : rank <= 25 ? '11–25' : rank <= 50 ? '26–50' : rank <= 75 ? '51–75' : '76+'
const bands = ['1–10', '11–25', '26–50', '51–75', '76+']
const median = (xs: number[]) => percentile(xs, .5)
const key = (seed: string, r: Pick<RecruitingMarketRecruitTrace, 'targetSeasonNumber'|'playerId'>) => `${seed}|${r.targetSeasonNumber}|${r.playerId}`

function marketRows(runs: readonly DynastyRunResult[]) { return runs.flatMap((run) => run.recruitingMarket.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END).map((r) => ({ ...r, seed: run.seed }))) }
function oppRows(runs: readonly DynastyRunResult[]) { return runs.flatMap((run) => run.recruitingMarketOpportunities.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END).map((r) => ({ ...r, seed: run.seed }))) }

function opening(rows: ReturnType<typeof marketRows>) {
  console.log('\n1. OPENING MARKET BY NATIONAL-RANK BAND')
  console.log('Band     N  Purs mean/med Offer mean/med 0Purs   0Off   1Off   2Off   3+Off Offerer prestige mean/med')
  for (const label of bands) {
    const x = rows.filter((r) => r.period === 0 && band(r.nationalRank) === label), pc=x.map(r=>r.pursuerProgramIds.length), oc=x.map(r=>r.offerProgramIds.length)
    const prest=x.flatMap(r=>r.offerProgramIds.map(id=>programs.get(id)!.basePrestige))
    console.log(`${label.padEnd(7)} ${String(x.length).padStart(4)} ${f(average(pc)).padStart(5)}/${f(median(pc)).padEnd(4)} ${f(average(oc)).padStart(5)}/${f(median(oc)).padEnd(4)} ${pct(pc.filter(n=>n===0).length,x.length).padStart(6)} ${pct(oc.filter(n=>n===0).length,x.length).padStart(6)} ${pct(oc.filter(n=>n===1).length,x.length).padStart(6)} ${pct(oc.filter(n=>n===2).length,x.length).padStart(6)} ${pct(oc.filter(n=>n>=3).length,x.length).padStart(7)} ${f(average(prest)).padStart(6)}/${f(median(prest))}`)
  }
  const premium=rows.filter(r=>r.period===0&&r.nationalRank<=25)
  console.log(`Premium state separation: no board ${premium.filter(r=>r.pursuerProgramIds.length===0).length}/${premium.length} (${pct(premium.filter(r=>r.pursuerProgramIds.length===0).length,premium.length)}); Pursuers/no Offers ${premium.filter(r=>r.pursuerProgramIds.length>0&&r.offerProgramIds.length===0).length}/${premium.length} (${pct(premium.filter(r=>r.pursuerProgramIds.length>0&&r.offerProgramIds.length===0).length,premium.length)}); Offered ${premium.filter(r=>r.offerProgramIds.length>0).length}/${premium.length} (${pct(premium.filter(r=>r.offerProgramIds.length>0).length,premium.length)}).`)
}

function funnel(opps: ReturnType<typeof oppRows>) {
  const x=opps.filter(r=>r.period===0), total=x.length, eligible=x.filter(r=>r.projectedOpening), boarded=eligible.filter(r=>r.onBoard), offered=boarded.filter(r=>r.offered)
  const noNeed=total-eligible.length, boardCapacity=eligible.filter(r=>!r.onBoard&&!r.boardFree), planner=eligible.filter(r=>!r.onBoard&&r.boardFree)
  const offerCapacity=boarded.filter(r=>!r.offered&&!r.offerFreeAtPosition), offerUtility=boarded.filter(r=>!r.offered&&r.offerFreeAtPosition)
  console.log('\n2. OPENING TOP-25 PROGRAM × RECRUIT FIRST-BOTTLENECK FUNNEL')
  console.log(`All Programs ${total}; position/capacity compatible ${eligible.length} (${pct(eligible.length,total)}); Boarded ${boarded.length} (${pct(boarded.length,eligible.length)} of eligible); Offered ${offered.length} (${pct(offered.length,boarded.length)} of Boarded).`)
  console.log(`First loss: no compatible opening ${noNeed} (${pct(noNeed,total)}); Board full ${boardCapacity.length} (${pct(boardCapacity.length,eligible.length)} of eligible); planner/candidate-ranking rejection with Board space ${planner.length} (${pct(planner.length,eligible.length)}); Boarded but Offer capacity blocked ${offerCapacity.length}; Boarded but Offer-selection utility rejected ${offerUtility.length}.`)
  const reach=planner.filter(r=>r.prestige<65).length
  console.log(`Among planner rejections, ${reach}/${planner.length} (${pct(reach,planner.length)}) were Prestige <65, where five-star reach penalty can contribute; production has no separate hard Prestige eligibility gate.`)
}

function lifecycle(rows: ReturnType<typeof marketRows>, runs: readonly DynastyRunResult[]) {
  const initial=rows.filter(r=>r.period===0&&r.nationalRank<=25), initiallyZero=initial.filter(r=>r.offerProgramIds.length===0), initialKeys=new Set(initiallyZero.map(r=>key(r.seed,r)))
  console.log('\n3. PREMIUM COVERAGE LIFECYCLE')
  console.log('Period Uncommitted All 0Purs/0Offer Initial-zero 0Purs/0Offer/Battle(2+) Committed')
  for(const period of CHECKPOINTS){const all=rows.filter(r=>r.period===period&&r.nationalRank<=25), live=all.filter(r=>!r.committedProgramId), z=all.filter(r=>initialKeys.has(key(r.seed,r))),zl=z.filter(r=>!r.committedProgramId); console.log(`${String(period).padStart(6)} ${String(live.length).padStart(11)} ${pct(live.filter(r=>r.pursuerProgramIds.length===0).length,live.length).padStart(7)}/${pct(live.filter(r=>r.offerProgramIds.length===0).length,live.length)} ${pct(zl.filter(r=>r.pursuerProgramIds.length===0).length,zl.length).padStart(8)}/${pct(zl.filter(r=>r.offerProgramIds.length===0).length,zl.length)}/${pct(zl.filter(r=>r.offerProgramIds.length>=2).length,zl.length)} ${pct(z.filter(r=>r.committedProgramId).length,z.length).padStart(9)}`)}
  const signed=runs.flatMap(run=>run.signedRecruits.filter(r=>r.targetSeasonNumber>=START&&r.targetSeasonNumber<=END).map(r=>({...r,seed:run.seed})))
  const zeroSigned=signed.filter(s=>initialKeys.has(`${s.seed}|${s.targetSeasonNumber}|${s.playerId}`)), allSigned=signed.filter(s=>s.nationalRank<=25)
  const histories=initiallyZero.map(r=>rows.filter(x=>key(x.seed,x)===key(r.seed,r))), everOffer=histories.filter(h=>h.some(x=>x.offerProgramIds.length>0)), everBattle=histories.filter(h=>h.some(x=>x.offerProgramIds.length>=2)), lateFirst=histories.filter(h=>{const first=h.find(x=>x.offerProgramIds.length>0)?.period;return first!==undefined&&first>=25})
  const p28live=rows.filter(r=>r.period===28&&initialKeys.has(key(r.seed,r))&&!r.committedProgramId)
  console.log(`Initially-zero resolution: ever acquired an Offer ${everOffer.length}/${initiallyZero.length} (${pct(everOffer.length,initiallyZero.length)}); ever reached 2+ Offers ${everBattle.length}/${initiallyZero.length} (${pct(everBattle.length,initiallyZero.length)}); first Offer at P25+ ${lateFirst.length}/${initiallyZero.length} (${pct(lateFirst.length,initiallyZero.length)}). At P28, ${p28live.length} remained uncommitted and ${p28live.filter(r=>r.offerProgramIds.length===0).length} of those had 0 Offers.`)
  console.log(`Final outcomes: initially-zero premium signed ${zeroSigned.length}/${initiallyZero.length}; winner Prestige mean ${f(average(zeroSigned.map(r=>r.prestige)))} vs ${f(average(allSigned.map(r=>r.prestige)))} all premium.`)
}

function inversions(rows: ReturnType<typeof marketRows>, opps: ReturnType<typeof oppRows>) {
  const opening=rows.filter(r=>r.period===0), groups=new Map<string,typeof opening>()
  for(const r of opening){const k=`${r.seed}|${r.targetSeasonNumber}|${r.position}`;groups.set(k,[...(groups.get(k)??[]),r])}
  const cases=[...groups.values()].flatMap(g=>g.flatMap(high=>high.offerProgramIds.length===0?g.filter(low=>low.nationalRank>=high.nationalRank+20&&low.offerProgramIds.length>=2).map(low=>({high,low})):[]))
  const affected=new Set(cases.map(c=>key(c.high.seed,c.high)))
  console.log('\n4. SAME-POSITION OPPORTUNITY COST')
  const premiumAffected=new Set(cases.filter(c=>c.high.nationalRank<=25).map(c=>key(c.high.seed,c.high)))
  console.log(`${cases.length} opening pair inversions (higher-ranked Recruit 0 Offers; same-position Recruit 20+ ranks lower with 2+); ${affected.size}/${opening.filter(r=>r.nationalRank<=75).length} distinct top-75 Recruits affected (${pct(affected.size,opening.filter(r=>r.nationalRank<=75).length)}), including ${premiumAffected.size}/825 top-25 (${pct(premiumAffected.size,825)}). Classes with ≥1: ${new Set(cases.map(c=>`${c.high.seed}|${c.high.targetSeasonNumber}`)).size}/33.`)
  for(const c of cases.slice(0,4)){
    const offerer=c.low.offerProgramIds[0]!, o=opps.find(x=>x.seed===c.high.seed&&x.targetSeasonNumber===c.high.targetSeasonNumber&&x.period===0&&x.playerId===c.high.playerId&&x.programId===offerer)
    const why=!o?.projectedOpening?'no compatible opening':!o.onBoard?`planner preferred Board target (position utility ${o.positionUtility.toFixed(1)} vs Board best ${o.bestBoardPositionUtility?.toFixed(1)})`:!o.offered?'Offer allocation preferred another target':'other'
    console.log(`S${c.high.targetSeasonNumber} ${c.high.playerName} #${c.high.nationalRank} ${c.high.position} (0) vs ${c.low.playerName} #${c.low.nationalRank} (${c.low.offerProgramIds.length}); ${programs.get(offerer)!.name} chose lower: ${why}.`)
  }
}

function traces(rows: ReturnType<typeof marketRows>) {
  const opening=rows.filter(r=>r.period===0&&r.nationalRank<=25), histories=(r:typeof opening[number])=>rows.filter(x=>key(x.seed,x)===key(r.seed,r)).sort((a,b)=>a.period-b.period)
  const healthy=opening.find(r=>r.offerProgramIds.length>=2), recovered=opening.find(r=>r.offerProgramIds.length===0&&histories(r).some(x=>x.period<=12&&x.offerProgramIds.length>=2)), weak=opening.find(r=>r.offerProgramIds.length===0&&histories(r).some(x=>x.period===20&&!x.committedProgramId&&x.offerProgramIds.length===0))
  console.log('\n5. REPRESENTATIVE RECRUIT TRACES')
  for(const [label,r] of [['healthy opening',healthy],['zero → healthy',recovered],['persistently weak',weak]] as const){if(!r)continue; console.log(`${label}: ${r.playerName} #${r.nationalRank} ${r.position} OVR/POT ${r.overall}/${r.potential} — ${histories(r).map(x=>`P${x.period} ${x.pursuerProgramIds.length}P/${x.offerProgramIds.length}O${x.committedProgramId?` committed ${programs.get(x.committedProgramId)?.name}`:''}`).join(' → ')}`)}
}

export async function main(){process.env.RECRUIT_MARKET_COVERAGE_CAPTURE='1';const result=await runLongRunCalibrationParallel({seasonsPerSeed:15,seeds:SEEDS,auditLevel:'light',workers:3});const rows=marketRows(result.runs),opps=oppRows(result.runs);console.log('COLLEGE HOOPS SIM — RECRUIT MARKET COVERAGE DIAGNOSTIC');console.log('Cohort: 3 deterministic seeds × 15 Seasons; mature target classes S5–15 = 33 classes, 5,280 Recruit-class observations; production checkpoints P0/P4/P8/P12/P20/P24/P28.');opening(rows);funnel(opps);lifecycle(rows,result.runs);inversions(rows,opps);traces(rows)}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href)await main()
