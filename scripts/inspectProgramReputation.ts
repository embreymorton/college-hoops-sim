import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import {
  deriveProgramReputationFromSeasonEvidence,
  deriveProgramReputationSeasonScore,
  deriveProgramReputationTier,
  type ProgramReputationSeasonEvidence,
  type ProgramReputationTier,
  type ProgramReputationTournamentFinish,
} from '../src/dynasty'
import { correlation } from './dynastyLongRunMetrics'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'

const SEEDS = Array.from({ length: 12 }, (_, index) => `program-reputation:${index + 1}`)
const CHECKPOINTS = [5, 10, 15, 25]
const prestige = new Map<string, number>(UNIVERSE_V0.programs.map((p) => [p.id, p.basePrestige]))
const name = new Map<string, string>(UNIVERSE_V0.programs.map((p) => [p.id, p.name]))

type Finish = ProgramReputationTournamentFinish
type SeasonInput = Omit<ProgramReputationSeasonEvidence, 'seasonNumber'> & { readonly seasonNumber?: number }
const productionEvidence = (history: readonly SeasonInput[]): ProgramReputationSeasonEvidence[] =>
  history.map((season, index) => ({ ...season, seasonNumber: season.seasonNumber ?? index + 1 }))
const seasonScore = (season: SeasonInput) => deriveProgramReputationSeasonScore(season)
const reputation = (history: readonly SeasonInput[]) =>
  deriveProgramReputationFromSeasonEvidence('diagnostic-program', productionEvidence(history)).score
const tierLabels: Readonly<Record<Exclude<ProgramReputationTier, 'unestablished'>, string>> = {
  low: 'Low', regional: 'Regional', emerging: 'Emerging', national: 'National',
  'national-power': 'National Power', elite: 'Elite',
}
const tier = (score: number) => tierLabels[deriveProgramReputationTier(score) as Exclude<ProgramReputationTier, 'unestablished'>]
const tiers = ['Low','Regional','Emerging','National','National Power','Elite']
const input = (wins:number, conferenceFinish:number, tournamentFinish:Finish='none'):SeasonInput => ({wins,losses:24-wins,conferenceFinish,tournamentFinish})
const fmt = (n:number|null,d=1)=>n===null?'Unestablished':n.toFixed(d)
const pct = (n:number,d:number)=>d?`${(100*n/d).toFixed(1)}%`:'—'
const seasonLabel=(s:SeasonInput)=>`${s.wins}-${s.losses}, C${s.conferenceFinish}, ${s.tournamentFinish}`

function pressureCases() {
  const cases: Array<[string,SeasonInput]> = [
    ['24-0 1st Champion',input(24,1,'champion')],['23-1 1st Champion',input(23,1,'champion')],
    ['23-1 1st Runner-up',input(23,1,'runner-up')],['22-2 1st Final Four',input(22,1,'final-four')],
    ['22-2 1st R16',input(22,1,'round-of-16')],['20-4 2nd Elite Eight',input(20,2,'elite-eight')],
    ['19-5 upper R16',input(19,3,'round-of-16')],['18-6 upper no Tournament',input(18,3)],
    ['17-7 upper Final Four',input(17,3,'final-four')],['14-10 middle Champion',input(14,5,'champion')],
    ['14-10 middle Elite Eight',input(14,5,'elite-eight')],['14-10 middle none',input(14,5)],
    ['8-16 bottom Final Four',input(8,8,'final-four')],['8-16 bottom none',input(8,8)],
  ]
  console.log('\nPRESSURE-TESTED SINGLE SEASONS')
  console.log('Case                              Season result  One-year Reputation')
  for(const [label,s] of cases) console.log(`${label.padEnd(34)}${seasonScore(s).toFixed(1).padStart(8)} ${fmt(reputation([s])).padStart(19)} ${tier(reputation([s])!)}`)

  const paths: Array<[string,SeasonInput[]]> = [
    ['Rocket ship',[input(18,2,'elite-eight'),input(22,1,'final-four'),input(23,1,'champion')]],
    ['Extreme two-year rise',[input(23,1,'runner-up'),input(24,1,'champion')]],
    ['Cinderella then validation',[input(14,5,'champion'),input(19,3,'round-of-16'),input(21,1,'final-four')]],
    ['Miracle then regression',[input(14,5,'champion'),input(12,5),input(10,7),input(9,8)]],
    ['Traditional rebuild',[input(9,8),input(13,6),input(17,3,'round-of-16'),input(20,2,'elite-eight'),input(21,1,'final-four'),input(22,1,'champion')]],
  ]
  console.log('\nSYNTHETIC TRAJECTORIES (Reputation after each completed Season)')
  for(const [label,path] of paths) console.log(`${label}: ${path.map((_,i)=>`${fmt(reputation(path.slice(0,i+1)))} ${tier(reputation(path.slice(0,i+1))!)}`).join(' → ')}`)
  const eliteEra=Array.from({length:5},()=>input(22,1,'final-four'))
  const decline=[input(14,5),input(10,7),input(7,8)]
  console.log(`Established elite decline: ${fmt(reputation(eliteEra))} ${tier(reputation(eliteEra)!)} → ${decline.map((_,i)=>`${fmt(reputation([...eliteEra,...decline.slice(0,i+1)]))} ${tier(reputation([...eliteEra,...decline.slice(0,i+1)])!)}`).join(' → ')}`)
}

async function main(){
  process.env.PROGRAM_REPUTATION_COMPACT='1'
  const result=await runLongRunCalibrationParallel({seasonsPerSeed:25,seeds:SEEDS,auditLevel:'light',workers:3})
  const rows=result.runs.flatMap(run=>run.programSeasonOutcomes.map(o=>({...o,seed:run.seed,prestige:prestige.get(o.programId)!})))
  const histories=(seed:string,id:string,through:number)=>rows.filter(r=>r.seed===seed&&r.programId===id&&r.seasonNumber<=through).sort((a,b)=>a.seasonNumber-b.seasonNumber)
  console.log('PROGRAM REPUTATION BASELINE DIAGNOSTIC')
  console.log(`${SEEDS.length} deterministic seeds × 25 Seasons × 32 Programs = ${rows.length} production Program-seasons; LIGHT lifecycle audit.`)
  console.log('Formula: season = 60% overall win% + 10% canonical conference finish + 30% furthest Tournament result; era weights 25/22/20/18/15; prior 50; maturity 40/65/90/96/100%.')
  pressureCases()
  console.log('\nMATURE TIER DISTRIBUTION')
  for(const cp of CHECKPOINTS){const x=rows.filter(r=>r.seasonNumber===cp).map(r=>reputation(histories(r.seed,r.programId,cp))!);console.log(`S${cp}: ${tiers.map(t=>`${t} ${x.filter(v=>tier(v)===t).length}/${x.length} (${pct(x.filter(v=>tier(v)===t).length,x.length)})`).join(' | ')}; range ${Math.min(...x).toFixed(1)}-${Math.max(...x).toFixed(1)}`)}
  const mature=rows.filter(r=>r.seasonNumber>=5).map(r=>({...r,reputation:reputation(histories(r.seed,r.programId,r.seasonNumber))!}))
  console.log(`Mature Prestige/Reputation correlation: ${correlation(mature.map(r=>({first:r.prestige,second:r.reputation}))).toFixed(3)}. High Prestige (80+) + Low/Regional Reputation: ${mature.filter(r=>r.prestige>=80&&r.reputation<48).length}; low Prestige (<40) + National Power: ${mature.filter(r=>r.prestige<40&&r.reputation>=66).length}; low Prestige + Elite: ${mature.filter(r=>r.prestige<40&&r.reputation>=71).length}.`)
  console.log('\nLOW-PRESTIGE MOBILITY (<40 Prestige)')
  const lowKeys=[...new Set(rows.filter(r=>r.prestige<40).map(r=>`${r.seed}|${r.programId}`))]
  for(const threshold of [48,55,66,71]){const reached=lowKeys.map(k=>{const [seed,id]=k.split('|');return rows.filter(r=>r.seed===seed&&r.programId===id).sort((a,b)=>a.seasonNumber-b.seasonNumber).find(r=>reputation(histories(seed!,id!,r.seasonNumber))!>=threshold)}).filter(Boolean) as typeof rows;console.log(`${tier(threshold)}+: ${reached.length}/${lowKeys.length}; first Season mean ${reached.length?(reached.reduce((s,r)=>s+r.seasonNumber,0)/reached.length).toFixed(1):'—'}, earliest ${reached.length?Math.min(...reached.map(r=>r.seasonNumber)):'—'}.`)}
  const transitions=mature.filter(r=>r.prestige<40&&r.reputation>=66&&reputation(histories(r.seed,r.programId,r.seasonNumber-1))!<66)
  for(const r of transitions.slice(0,8)){const h=histories(r.seed,r.programId,r.seasonNumber).slice(-5);console.log(`${r.seed} ${name.get(r.programId)} (Prestige ${r.prestige}) reached ${tier(r.reputation)} ${r.reputation.toFixed(1)} in S${r.seasonNumber}: ${h.map(seasonLabel).join(' | ')}`)}
  console.log('\nOBSERVED NATIONAL POWER TRANSITIONS (all Prestige levels)')
  const powerTransitions=mature.filter(r=>r.reputation>=66&&(reputation(histories(r.seed,r.programId,r.seasonNumber-1))??0)<66)
  for(const r of powerTransitions.slice(0,10)){const h=histories(r.seed,r.programId,r.seasonNumber).slice(-5);console.log(`${r.seed} ${name.get(r.programId)} (Prestige ${r.prestige}) → ${r.reputation.toFixed(1)} in S${r.seasonNumber}: ${h.map(seasonLabel).join(' | ')}`)}
  console.log('\nOBSERVED ELITE TRANSITIONS')
  const eliteTransitions=mature.filter(r=>r.reputation>=71&&(reputation(histories(r.seed,r.programId,r.seasonNumber-1))??0)<71)
  for(const r of eliteTransitions.slice(0,10)){const h=histories(r.seed,r.programId,r.seasonNumber).slice(-5);console.log(`${r.seed} ${name.get(r.programId)} (Prestige ${r.prestige}) → ${r.reputation.toFixed(1)} in S${r.seasonNumber}: ${h.map(seasonLabel).join(' | ')}`)}
  const eliteRuns:number[]=[]
  for(const key of new Set(mature.map(r=>`${r.seed}|${r.programId}`))){const [seed,id]=key.split('|'), values=mature.filter(r=>r.seed===seed&&r.programId===id).sort((a,b)=>a.seasonNumber-b.seasonNumber);let length=0;for(const row of values){if(row.reputation>=71)length+=1;else if(length){eliteRuns.push(length);length=0}}if(length)eliteRuns.push(length)}
  console.log(`Elite eras: ${eliteRuns.length}; distinct seed/Program paths ${new Set(mature.filter(r=>r.reputation>=71).map(r=>`${r.seed}|${r.programId}`)).size}; duration mean ${eliteRuns.length?(eliteRuns.reduce((a,b)=>a+b,0)/eliteRuns.length).toFixed(1):'—'}, median ${eliteRuns.length?[...eliteRuns].sort((a,b)=>a-b)[Math.floor(eliteRuns.length/2)]:'—'}, max ${eliteRuns.length?Math.max(...eliteRuns):'—'} Seasons.`)
  const deltas=mature.filter(r=>r.seasonNumber>5).map(r=>r.reputation-reputation(histories(r.seed,r.programId,r.seasonNumber-1))!)
  console.log('\nTREND SENSITIVITY')
  console.log(`Year-over-year |delta| median ${[...deltas].sort((a,b)=>Math.abs(a)-Math.abs(b))[Math.floor(deltas.length/2)]!.toFixed(1)}; mean ${(deltas.reduce((s,d)=>s+Math.abs(d),0)/deltas.length).toFixed(1)}; >=5 ${pct(deltas.filter(d=>Math.abs(d)>=5).length,deltas.length)}; >=10 ${pct(deltas.filter(d=>Math.abs(d)>=10).length,deltas.length)}.`)
  for(const threshold of [2,3,4,5]) console.log(`Threshold ±${threshold}: Rising ${pct(deltas.filter(d=>d>=threshold).length,deltas.length)}, Steady ${pct(deltas.filter(d=>Math.abs(d)<threshold).length,deltas.length)}, Falling ${pct(deltas.filter(d=>d<=-threshold).length,deltas.length)}.`)
}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href) await main()
