import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'
import type { DynastyRunResult, RecruitingMarketRecruitTrace } from './inspectDynastyLongRun'
import type { EarlyMarketCandidate } from './recruitingEarlyMarketCandidates'

const MODES: EarlyMarketCandidate[] = ['baseline', 'earlier-p4', 'opportunity', 'reach', 'prestige-control']
const SEEDS = ['recruit-market-coverage:1', 'recruit-market-coverage:2', 'recruit-market-coverage:3'] as const
const CHECKPOINTS = [0, 4, 8, 12, 16, 20, 24, 28]
const START = 5, END = 15
const programPrestige = new Map(UNIVERSE_V0.programs.map((program) => [program.id, program.basePrestige]))
const pct = (n: number, d: number) => d ? 100 * n / d : 0
const mean = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0
const median = (xs: number[]) => { const s = [...xs].sort((a,b)=>a-b); return s.length ? (s[Math.floor((s.length-1)/2)]! + s[Math.ceil((s.length-1)/2)]!) / 2 : 0 }
const band = (rank: number) => rank <= 10 ? '1-10' : rank <= 25 ? '11-25' : rank <= 50 ? '26-50' : rank <= 75 ? '51-75' : '76+'
const key = (r: RecruitingMarketRecruitTrace & { seed: string }) => `${r.seed}|${r.targetSeasonNumber}|${r.playerId}`

function rows(runs: readonly DynastyRunResult[]) { return runs.flatMap((run) => run.recruitingMarket.filter((r) => r.targetSeasonNumber >= START && r.targetSeasonNumber <= END).map((r) => ({ ...r, seed: run.seed }))) }
function summarize(mode: string, runs: readonly DynastyRunResult[]) {
  const all = rows(runs), opening = all.filter((r) => r.period === 0), classes = new Set(opening.map((r) => `${r.seed}|${r.targetSeasonNumber}`))
  console.log(`\n=== ${mode} (${classes.size} classes / ${opening.length} recruits) ===`)
  console.log('Band   P0 active/offers  P12 0active/0offer  P16 <=1active  eventual signed  commit P mean')
  for (const label of ['1-10','11-25','26-50','51-75','76+']) {
    const o=opening.filter(r=>band(r.nationalRank)===label), p12=all.filter(r=>r.period===12&&band(r.nationalRank)===label&&!r.committedProgramId), p16=all.filter(r=>r.period===16&&band(r.nationalRank)===label&&!r.committedProgramId)
    const histories=o.map(r=>all.filter(x=>key(x)===key(r)).sort((a,b)=>a.period-b.period)), committed=histories.map(h=>h.find(r=>r.committedProgramId)).filter(Boolean) as typeof all
    console.log(`${label.padEnd(5)} ${mean(o.map(r=>r.pursuerProgramIds.length)).toFixed(2)}/${mean(o.map(r=>r.offerProgramIds.length)).toFixed(2)}       ${pct(p12.filter(r=>r.pursuerProgramIds.length===0).length,p12.length).toFixed(1)}%/${pct(p12.filter(r=>r.offerProgramIds.length===0).length,p12.length).toFixed(1)}%       ${pct(p16.filter(r=>r.pursuerProgramIds.length<=1).length,p16.length).toFixed(1)}%          ${pct(committed.length,histories.length).toFixed(1)}%          ${mean(committed.map(r=>r.period)).toFixed(1)}`)
  }
  const top=opening.filter(r=>r.nationalRank<=25), histories=top.map(r=>all.filter(x=>key(x)===key(r)).sort((a,b)=>a.period-b.period))
  const first=(h:typeof all, fn:(r:typeof all[number])=>boolean)=>h.find(fn)?.period??29
  const top10p12=all.filter(r=>r.period===12&&r.nationalRank<=10&&!r.committedProgramId)
  const jumps=histories.flatMap(h=>h.slice(1).map((r,i)=>r.pursuerProgramIds.length-h[i]!.pursuerProgramIds.length))
  const openCrowded=histories.flatMap(h=>h.slice(1).filter((r,i)=>h[i]!.pursuerProgramIds.length<=1&&r.pursuerProgramIds.length>=5)).length
  const offererPrestige=all.filter(r=>r.period===12&&r.nationalRank<=25).flatMap(r=>r.offerProgramIds.map(id=>programPrestige.get(id as typeof UNIVERSE_V0.programs[number]['id'])!))
  const inversions=all.filter(r=>CHECKPOINTS.includes(r.period)&&r.nationalRank<=25&&r.pursuerProgramIds.length<=1).filter(high=>all.some(low=>low.seed===high.seed&&low.targetSeasonNumber===high.targetSeasonNumber&&low.period===high.period&&low.position===high.position&&low.nationalRank>=high.nationalRank+20&&low.pursuerProgramIds.length>=2))
  console.log(`Top-25 first AI Board mean/median ${mean(histories.map(h=>first(h,r=>r.pursuerProgramIds.length>0))).toFixed(1)}/${median(histories.map(h=>first(h,r=>r.pursuerProgramIds.length>0))).toFixed(1)}; first Offer ${mean(histories.map(h=>first(h,r=>r.offerProgramIds.length>0))).toFixed(1)}/${median(histories.map(h=>first(h,r=>r.offerProgramIds.length>0))).toFixed(1)}; 2+ active ${mean(histories.map(h=>first(h,r=>r.pursuerProgramIds.length>=2))).toFixed(1)}; 2+ offers ${mean(histories.map(h=>first(h,r=>r.offerProgramIds.length>=2))).toFixed(1)}.`)
  console.log(`Top-10 <=1 active at P12: ${top10p12.filter(r=>r.pursuerProgramIds.length<=1).length}/${top10p12.length}; checkpoint inversion observations ${inversions.length}; max one-period active jump ${Math.max(...jumps)}; +5 jumps ${jumps.filter(n=>n>=5).length}; Open→Crowded ${openCrowded}; P12 offerer Prestige ${mean(offererPrestige).toFixed(1)}.`)
  const trace=histories.find(h=>h.some(r=>r.period===12&&!r.committedProgramId&&r.pursuerProgramIds.length<=1))
  if(trace) console.log(`Trace: ${trace[0]!.playerName} #${trace[0]!.nationalRank} ${trace[0]!.position}: ${trace.map(r=>`P${r.period} ${r.pursuerProgramIds.length}A/${r.offerProgramIds.length}O${r.committedProgramId?' C':''}`).join(' -> ')}`)
  return JSON.stringify(all.map(r=>[r.seed,r.targetSeasonNumber,r.period,r.playerId,r.pursuerProgramIds,r.offerProgramIds,r.committedProgramId]))
}

export async function main() {
  process.env.RECRUIT_MARKET_COVERAGE_CAPTURE='1'
  process.env.RECRUIT_MARKET_COMPACT='1'
  console.log('RECRUITING EARLY-MARKET CANDIDATE COMPARISON — diagnostic harness only')
  for (const mode of MODES) {
    process.env.RECRUIT_EARLY_MARKET_CANDIDATE=mode
    const result=await runLongRunCalibrationParallel({seasonsPerSeed:15,seeds:SEEDS,auditLevel:'light',workers:3})
    summarize(mode,result.runs)
  }
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) await main()
