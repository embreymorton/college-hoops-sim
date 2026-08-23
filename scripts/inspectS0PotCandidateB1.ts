import { calculateOverall, type ClassYear } from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'
import { collectEndogenousPotReference } from './inspectEndogenousPotReference'
import { B1_TIERS, b1TierIndex, b1TierProbabilities, fitS0PotCandidateB1, generateS0PotCandidateB1, S0_POT_CANDIDATE_B1, type B1Model, type B1Observation } from './s0PotCandidateB1'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
type Ref = { id: string; name: string; position: string; overall: number; potential: number; stage: number }
type Row = { id: string; name: string; position: string; program: string; year: ClassYear; overall: number; legacy: number; b1: number; seed: string }
const fixed = (value: number, digits = 2) => Number.isFinite(value) ? value.toFixed(digits) : 'n/a'
const pct = (count: number, total: number) => total ? `${fixed(count / total * 100)}%` : 'n/a'
const table = (headers: string[], rows: (string | number)[][]) => { console.log(`| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((row) => console.log(`| ${row.join(' | ')} |`)) }
const gap = (overall: number, potential: number) => potential - overall
const hrBand = (headroom: number) => headroom <= 3 ? '0–3' : headroom <= 7 ? '4–7' : headroom <= 12 ? '8–12' : headroom <= 19 ? '13–19' : '20+'
const ovrBand = (overall: number) => overall < 65 ? '<65' : overall < 75 ? '65–74' : overall < 85 ? '75–84' : overall < 90 ? '85–89' : '90+'
const summary = (values: number[]) => ({ mean: average(values), med: percentile(values, .5), p75: percentile(values, .75), p90: percentile(values, .9), p95: percentile(values, .95), p99: percentile(values, .99), max: Math.max(...values) })

function observations(stages: Ref[][]): B1Observation[] { return stages.flatMap((rows, stage) => rows.map((row) => ({ overall: row.overall, potential: row.potential, stage }))) }
function generatedReference(stages: Ref[][], model: B1Model, seed: string): Ref[][] {
  return stages.map((rows, stage) => rows.map((row, index) => ({ ...row, potential: generateS0PotCandidateB1({ overall: row.overall, classYear: YEARS[stage]!, universeSeed: seed, programId: `reference-${stage}`, playerId: `${row.id}:${index}` }, model) })))
}
function collectS0(universes: number, root: string, model: B1Model) {
  const rows: Row[] = []; let preserved = true
  for (let index = 0; index < universes; index += 1) {
    const seed = `${root}:${index}`; const universe = initializeUniverse(UNIVERSE_V0, seed)
    for (const { program, team } of universe.programs) for (const player of team.roster) {
      const overall = calculateOverall(player); const before = JSON.stringify({ ...player, potential: undefined })
      const b1 = generateS0PotCandidateB1({ overall, classYear: player.classYear, universeSeed: seed, programId: program.id, playerId: player.id }, model)
      preserved &&= before === JSON.stringify({ ...player, potential: undefined })
      rows.push({ id: player.id, name: `${player.firstName} ${player.lastName}`, position: player.position, program: program.id, year: player.classYear, overall, legacy: player.potential, b1, seed })
    }
  }
  return { rows, preserved }
}
const tiers = <T>(rows: T[], potential: (row: T) => number) => [pct(rows.filter((row) => potential(row) < 60).length, rows.length), ...B1_TIERS.map((_, index) => pct(rows.filter((row) => potential(row) >= 60 && b1TierIndex(potential(row)) === index).length, rows.length))].join('/')
const thresholds = <T>(rows: T[], potential: (row: T) => number) => [85, 90, 95, 97, 99].map((threshold) => pct(rows.filter((row) => threshold === 99 ? potential(row) === 99 : potential(row) >= threshold).length, rows.length)).join('/')

function holdoutReport(actual: Ref[][], predicted: Ref[][]) {
  console.log('\n## Endogenous holdout — stage totals')
  table(['Arm/stage', 'N', '<60/Limited/Normal/High/VeryHigh/Elite/Exceptional', '85+/90+/95+/97+/99'], YEARS.flatMap((year, stage) => [
    [`Actual ${year}`, actual[stage]!.length, tiers(actual[stage]!, (row) => row.potential), thresholds(actual[stage]!, (row) => row.potential)],
    [`B1 ${year}`, predicted[stage]!.length, tiers(predicted[stage]!, (row) => row.potential), thresholds(predicted[stage]!, (row) => row.potential)],
  ]))
  console.log('\n## Endogenous holdout — conditional thresholds')
  table(['Arm/stage/band', 'N', '90+/95+/97+/99'], YEARS.flatMap((year, stage) => ['<65', '65–74', '75–84', '85–89', '90+'].flatMap((band) => [actual, predicted].map((source, arm) => {
    const rows = source[stage]!.filter((row) => ovrBand(row.overall) === band)
    return [`${arm ? 'B1' : 'Actual'} ${year} ${band}`, rows.length, [90, 95, 97, 99].map((threshold) => pct(rows.filter((row) => threshold === 99 ? row.potential === 99 : row.potential >= threshold).length, rows.length)).join('/')]
  }))))
}

function s0Marginals(rows: Row[], references: Ref[][]) {
  console.log('\n## S0 tier / POT marginals')
  table(['Arm/stage', 'N', 'tiers <60/L/N/H/VH/E/X', 'mean/med/P75/P90/P95/P99/max', '80+/85+/90+/95+/97+/99'], YEARS.flatMap((year, stage) => {
    const selected = rows.filter((row) => row.year === year); const ref = references[stage]!
    const make = (label: string, values: number[], tierText: string) => { const s = summary(values); return [label, values.length, tierText, `${fixed(s.mean)}/${s.med}/${s.p75}/${s.p90}/${s.p95}/${s.p99}/${s.max}`, [80,85,90,95,97,99].map((t)=>pct(values.filter((v)=>t===99?v===99:v>=t).length,values.length)).join('/')] }
    return [make(`Production ${year}`, selected.map((r)=>r.legacy), tiers(selected,(r)=>r.legacy)), make(`Diagnostic ${year}`,selected.map((r)=>r.b1),tiers(selected,(r)=>r.b1)),make(`Ref ${year}`,ref.map((r)=>r.potential),tiers(ref,(r)=>r.potential))]
  }))
}

function headroomAndCorrelation(rows: Row[], references: Ref[][]) {
  console.log('\n## Headroom and correlation')
  table(['Arm/stage','mean/med','0–3/4–7/8–12/13–19/20+','8+/13+/20+','OVR↔POT','OVR↔HR'],YEARS.flatMap((year,stage)=>{
    const selected=rows.filter((r)=>r.year===year); const ref=references[stage]!
    const make=(label:string, pairs:{overall:number;potential:number}[])=>{const gaps=pairs.map((r)=>gap(r.overall,r.potential)),s=summary(gaps);return[label,`${fixed(s.mean)}/${s.med}`,['0–3','4–7','8–12','13–19','20+'].map((b)=>pct(gaps.filter((g)=>hrBand(g)===b).length,gaps.length)).join('/'),[8,13,20].map((t)=>pct(gaps.filter((g)=>g>=t).length,gaps.length)).join('/'),fixed(correlation(pairs.map((r)=>({first:r.overall,second:r.potential}))),3),fixed(correlation(pairs.map((r)=>({first:r.overall,second:gap(r.overall,r.potential)}))),3)]}
    return[make(`Production ${year}`,selected.map((r)=>({overall:r.overall,potential:r.legacy}))),make(`Diagnostic ${year}`,selected.map((r)=>({overall:r.overall,potential:r.b1}))),make(`Ref ${year}`,ref)]
  }))
}

function conditional(rows: Row[]) {
  console.log('\n## S0 B1 conditional career profiles')
  table(['Stage/band','N','POT mean/med','tiers <60/L/N/H/VH/E/X','90+/95+/97+/99','HR mean','HR13+/20+'],YEARS.flatMap((year)=>['<65','65–74','75–84','85–89','90+'].map((band)=>{const selected=rows.filter((r)=>r.year===year&&ovrBand(r.overall)===band);return[`${year} ${band}`,selected.length,`${fixed(average(selected.map((r)=>r.b1)))}/${percentile(selected.map((r)=>r.b1),.5)}`,tiers(selected,(r)=>r.b1),[90,95,97,99].map((t)=>pct(selected.filter((r)=>t===99?r.b1===99:r.b1>=t).length,selected.length)).join('/'),fixed(average(selected.map((r)=>gap(r.overall,r.b1)))),[13,20].map((t)=>pct(selected.filter((r)=>gap(r.overall,r.b1)>=t).length,selected.length)).join('/')]})))
}

function specialProfiles(rows: Row[], references: Ref[][]) {
  console.log('\n## High vs Very High')
  table(['Stage/tier','N/rate','OVR mean/med','HR mean/med'],YEARS.flatMap((year)=>[2,3].map((tier)=>{const base=rows.filter((r)=>r.year===year),selected=base.filter((r)=>b1TierIndex(r.b1)===tier),os=summary(selected.map((r)=>r.overall)),hs=summary(selected.map((r)=>gap(r.overall,r.b1)));return[`${year} ${B1_TIERS[tier]!.name}`,`${selected.length}/${pct(selected.length,base.length)}`,`${fixed(os.mean)}/${os.med}`,`${fixed(hs.mean)}/${hs.med}`]})))
  console.log('\n## Elite carrier composition')
  table(['Population','N','<65/65–74/75–84/85–89/90+'],(['JR','SR'] as const).flatMap((year)=>[95,97].flatMap((threshold)=>{const stage=YEARS.indexOf(year),base=rows.filter((r)=>r.year===year&&r.b1>=threshold),ref=references[stage]!.filter((r)=>r.potential>=threshold);const mix=<T>(items:T[],ovr:(row:T)=>number)=>['<65','65–74','75–84','85–89','90+'].map((band)=>pct(items.filter((row)=>ovrBand(ovr(row))===band).length,items.length)).join('/');return[[`B1 ${year} ${threshold}+`,base.length,mix(base,(r)=>r.overall)],[`Ref ${year} ${threshold}+`,ref.length,mix(ref,(r)=>r.overall)]]})))
  console.log('\n## Elite realization')
  table(['Stage/ceiling','N/rate','OVR mean/med','HR mean/med','≤3/≤7/13+/20+'],YEARS.flatMap((year)=>[95,97,99].map((threshold)=>{const base=rows.filter((r)=>r.year===year),selected=base.filter((r)=>threshold===99?r.b1===99:r.b1>=threshold),os=summary(selected.map((r)=>r.overall)),hs=summary(selected.map((r)=>gap(r.overall,r.b1)));return[`${year} ${threshold}${threshold===99?'':'+'}`,`${selected.length}/${pct(selected.length,base.length)}`,`${fixed(os.mean)}/${os.med}`,`${fixed(hs.mean)}/${hs.med}`,[3,7].map((t)=>pct(selected.filter((r)=>gap(r.overall,r.b1)<=t).length,selected.length)).concat([13,20].map((t)=>pct(selected.filter((r)=>gap(r.overall,r.b1)>=t).length,selected.length))).join('/')]})))
  console.log('\n## Projects / polished / high-OVR diversity')
  const tests=[['<75/POT90+',(r:Row)=>r.overall<75&&r.b1>=90],['<75/POT95+',(r:Row)=>r.overall<75&&r.b1>=95],['<75/POT97+',(r:Row)=>r.overall<75&&r.b1>=97],['<75/POT99',(r:Row)=>r.overall<75&&r.b1===99],['<75/HR13+',(r:Row)=>r.overall<75&&gap(r.overall,r.b1)>=13],['<75/HR20+',(r:Row)=>r.overall<75&&gap(r.overall,r.b1)>=20],['75+/HR≤3',(r:Row)=>r.overall>=75&&gap(r.overall,r.b1)<=3],['85+/HR≤3',(r:Row)=>r.overall>=85&&gap(r.overall,r.b1)<=3],['90+/HR≤3',(r:Row)=>r.overall>=90&&gap(r.overall,r.b1)<=3]] as const
  table(['Profile',...YEARS],tests.map(([label,test])=>[label,...YEARS.map((year)=>{const base=rows.filter((r)=>r.year===year);return pct(base.filter(test).length,base.length)})]))
  table(['Stage/OVR','N','tiers','POT mean/med','95+/97+/99','HR mean/med'],YEARS.flatMap((year)=>([['85–89',85,89],['90+',90,Infinity]] as const).map(([label,low,high])=>{const selected=rows.filter((r)=>r.year===year&&r.overall>=low&&r.overall<=high),hs=summary(selected.map((r)=>gap(r.overall,r.b1)));return[`${year} ${label}`,selected.length,tiers(selected,(r)=>r.b1),`${fixed(average(selected.map((r)=>r.b1)))}/${percentile(selected.map((r)=>r.b1),.5)}`,[95,97,99].map((t)=>pct(selected.filter((r)=>t===99?r.b1===99:r.b1>=t).length,selected.length)).join('/'),`${fixed(hs.mean)}/${hs.med}`]})))
}

function examples(rows: Row[]) {
  const pick=(items:Row[],test:(row:Row)=>boolean)=>{const matches=items.filter(test).sort((a,b)=>a.overall-b.overall||a.id.localeCompare(b.id));return matches[Math.floor(matches.length/2)]}
  const format=(row?:Row)=>row?`${row.name} | ${row.program} | ${row.position} | ${row.year} | ${row.overall}/${row.b1} | ${B1_TIERS[b1TierIndex(row.b1)]!.name} | HR${gap(row.overall,row.b1)}`:'none'
  console.log('\n## Representative examples')
  for(const year of YEARS){const base=rows.filter((r)=>r.year===year);console.log(`${year}\n  polished ${format(pick(base,(r)=>r.overall>=75&&gap(r.overall,r.b1)<=3))}\n  runway ${format(pick(base,(r)=>r.overall>=80&&gap(r.overall,r.b1)>=4&&gap(r.overall,r.b1)<=12))}\n  very-high ${format(pick(base,(r)=>b1TierIndex(r.b1)===3))}\n  elite-project ${format(pick(base,(r)=>r.overall<75&&b1TierIndex(r.b1)===4))}\n  exceptional-project ${format(pick(base,(r)=>r.overall<75&&b1TierIndex(r.b1)===5))}`)}
  const groups=[...new Set(rows.map((r)=>r.seed))].map((seed)=>({seed,rows:rows.filter((r)=>r.seed===seed&&r.year==='FR').sort((a,b)=>b.overall-a.overall||a.id.localeCompare(b.id))})).sort((a,b)=>average(a.rows.slice(0,3).map((r)=>r.overall))-average(b.rows.slice(0,3).map((r)=>r.overall)))
  console.log('\n## Freshmen to Know — actual Season 1 ordering (OVR, then ID)')
  for(const[label,group]of[['Ordinary',groups[0]!],['Typical',groups[Math.floor(groups.length/2)]!],['Strong',groups.at(-1)!]]as const)console.log(`${label} ${group.seed}: ${group.rows.slice(0,3).map((r)=>`${r.name} | ${r.program} | ${r.position} | ${r.overall}/${r.b1} | ${B1_TIERS[b1TierIndex(r.b1)]!.name}`).join(' || ')}`)
}

export function runReport() {
  const fitClasses=Number(process.env.FIT_CLASSES??500),holdoutClasses=Number(process.env.HOLDOUT_CLASSES??500),universes=Number(process.env.UNIVERSES??500)
  const fitSeed='s0-pot-candidate-b1-fit:v1',holdoutSeed='s0-pot-candidate-b1-holdout:v1',s0Seed='s0-pot-candidate-b1-s0:v1'
  const fit=collectEndogenousPotReference(fitClasses,fitSeed).stages as Ref[][]; const model=fitS0PotCandidateB1(observations(fit)); const holdout=collectEndogenousPotReference(holdoutClasses,holdoutSeed).stages as Ref[][];const predicted=generatedReference(holdout,model,'s0-pot-candidate-b1-holdout-draw:v1');const s0=collectS0(universes,s0Seed,model)
  console.log(`# S0 POT Candidate B1\nFit ${fitClasses} classes/${fit[0]!.length} careers/${observations(fit).length} stage rows seed ${fitSeed}; holdout ${holdoutClasses}/${holdout[0]!.length}/${observations(holdout).length} seed ${holdoutSeed}; S0 ${universes} universes/${s0.rows.length} Players seed ${s0Seed}`)
  console.log(`\n## Model\n${JSON.stringify(S0_POT_CANDIDATE_B1)}\nOVR mean/scale ${fixed(model.overallMean,6)}/${fixed(model.overallScale,6)}; iterations ${model.iterations}; loss ${fixed(model.finalLoss,8)}`)
  table(['Tier',...S0_POT_CANDIDATE_B1.features],B1_TIERS.map((tier,index)=>[tier.name,...model.coefficients[index]!.map((value)=>fixed(value,6))]))
  table(['Tier','POT:weight'],B1_TIERS.map((tier,index)=>[tier.name,model.withinTierWeights[index]!.map((weight,offset)=>`${tier.minimum+offset}:${fixed(weight,6)}`).join(' ')]))
  holdoutReport(holdout,predicted);s0Marginals(s0.rows,holdout);headroomAndCorrelation(s0.rows,holdout);conditional(s0.rows);specialProfiles(s0.rows,holdout)
  const p99=s0.rows.filter((r)=>r.b1===99),incidence=[...new Set(s0.rows.map((r)=>r.seed))].map((seed)=>p99.filter((r)=>r.seed===seed).length),os=summary(p99.map((r)=>r.overall)),hs=summary(p99.map((r)=>gap(r.overall,r.b1)))
  console.log(`\n## POT99\n${p99.length}/${s0.rows.length} ${pct(p99.length,s0.rows.length)}; ${fixed(p99.length/universes)} per universe; zero/one/two/3+ ${[0,1,2].map((n)=>pct(incidence.filter((v)=>v===n).length,incidence.length)).join('/')} / ${pct(incidence.filter((v)=>v>=3).length,incidence.length)}; OVR ${fixed(os.mean)}/${os.med} range ${Math.min(...p99.map((r)=>r.overall))}-${Math.max(...p99.map((r)=>r.overall))}; HR ${fixed(hs.mean)}/${hs.med}; at OVR99 ${pct(p99.filter((r)=>r.overall===99).length,p99.length)}`)
  table(['Class','N/rate','OVR mean/med','HR mean/med'],YEARS.map((year)=>{const base=s0.rows.filter((r)=>r.year===year),selected=p99.filter((r)=>r.year===year),o=summary(selected.map((r)=>r.overall)),h=summary(selected.map((r)=>gap(r.overall,r.b1)));return[year,`${selected.length}/${pct(selected.length,base.length)}`,`${fixed(o.mean)}/${o.med}`,`${fixed(h.mean)}/${h.med}`]}))
  examples(s0.rows)
  console.log(`\n## Preservation\nNon-POT Player facts unchanged ${s0.preserved}; legal ${s0.rows.every((r)=>r.b1>=r.overall&&r.b1<=99)}; deterministic ${s0.rows.slice(0,100).every((r)=>generateS0PotCandidateB1({overall:r.overall,classYear:r.year,universeSeed:r.seed,programId:r.program,playerId:r.id},model)===r.b1)}; production matches validated diagnostic ${s0.rows.every((r)=>r.legacy===r.b1)}; B1 probabilities positive for every legal tier ${YEARS.every((_,stage)=>[60,70,80,90,99].every((overall)=>b1TierProbabilities(overall,stage,model).every((p,t)=>B1_TIERS[t]!.maximum<overall||p>0)))}`)
}
if(import.meta.url===`file://${process.argv[1]}`)runReport()
