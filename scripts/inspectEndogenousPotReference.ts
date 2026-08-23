import { calculateOverall, type ClassYear, type Player } from '../src/engine'
import { developReturningPlayer, generateRecruitingClass } from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { average, correlation, percentile } from './dynastyLongRunMetrics'

const YEARS = ['FR', 'SO', 'JR', 'SR'] as const
const OVR_THRESHOLDS = [80, 85, 88, 90, 93, 95, 97, 98, 99] as const
type Row = { id: string; name: string; position: string; overall: number; potential: number; stage: number }
type Career = { id: string; stages: Row[] }
const fixed = (n: number, d = 2) => n.toFixed(d)
const pct = (n: number, d: number) => `${fixed(n / d * 100)}%`
const table = (headers: string[], rows: (string | number)[][]) => { console.log(`| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`); rows.forEach((r) => console.log(`| ${r.join(' | ')} |`)) }
const values = (rows: Row[], key: 'overall' | 'potential') => rows.map((r) => r[key])
const gap = (r: Row) => r.potential - r.overall
const summary = (v: number[]) => ({ mean: average(v), med: percentile(v, .5), p10: percentile(v, .1), p25: percentile(v, .25), p75: percentile(v, .75), p90: percentile(v, .9), p95: percentile(v, .95), p99: percentile(v, .99), max: v.reduce((a, b) => Math.max(a, b), -Infinity) })
const rate = (rows: Row[], test: (r: Row) => boolean) => `${rows.filter(test).length} (${pct(rows.filter(test).length, rows.length)})`
function makeSeason(seed: string) { const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`); return initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 }) }
const row = (player: Player, stage: number): Row => ({ id: player.id, name: `${player.firstName} ${player.lastName}`, position: player.position, overall: calculateOverall(player), potential: player.potential, stage })

export function collectEndogenousPotReference(classes: number, root: string) {
  const stages = YEARS.map(() => [] as Row[]); const careers: Career[] = []; const s0 = Object.fromEntries(YEARS.map((y) => [y, [] as Row[]])) as Record<ClassYear, Row[]>
  for (let index = 0; index < classes; index += 1) {
    const seed = `${root}:${index}`; const season = makeSeason(seed)
    Object.values(season.programStates).flatMap(({ team }) => team.roster).forEach((p) => s0[p.classYear].push(row(p, YEARS.indexOf(p.classYear))))
    const recruits = generateRecruitingClass({ dynastySeed: `${seed}:recruiting`, targetSeasonNumber: 2, season }); const programIds = Object.keys(season.programStates).sort()
    recruits.forEach(({ player }, playerIndex) => {
      let current = player; const snapshots = [row(current, 0)]; stages[0]!.push(snapshots[0]!)
      for (let stage = 1; stage < 4; stage += 1) { current = developReturningPlayer({ player: current, dynastySeed: `${seed}:recruiting`, completedSeasonNumber: stage, programId: programIds[playerIndex % programIds.length]! }); const snapshot = row(current, stage); snapshots.push(snapshot); stages[stage]!.push(snapshot) }
      careers.push({ id: player.id, stages: snapshots })
    })
  }
  return { stages, careers, s0 }
}

const headroomBand = (r: Row) => gap(r) <= 3 ? '0–3' : gap(r) <= 7 ? '4–7' : gap(r) <= 12 ? '8–12' : gap(r) <= 19 ? '13–19' : '20+'
function distributionRow(label: string, rows: Row[], key: 'overall' | 'potential') { const s = summary(values(rows, key)); return [label, rows.length, fixed(s.mean), s.med, s.p10, s.p25, s.p75, s.p90, s.p95, s.p99, s.max] }
function printConditional(stages: Row[][]) {
  const bands = [['<65', -Infinity, 64], ['65–74', 65, 74], ['75–84', 75, 84], ['85–89', 85, 89], ['90+', 90, Infinity]] as const
  console.log('\n## Conditional OVR profiles')
  for (let stage = 0; stage < 4; stage++) table(['Band', 'N', 'POT mean/med', 'POT90+/95+/97+/99', 'HR mean', 'HR13+', 'HR20+'], bands.map(([label, low, high]) => { const rows = stages[stage]!.filter((r) => r.overall >= low && r.overall <= high); return [label, rows.length, `${fixed(average(rows.map((r) => r.potential)))}/${percentile(rows.map((r) => r.potential), .5)}`, [90,95,97].map((t) => pct(rows.filter((r) => r.potential >= t).length, rows.length)).join('/') + `/${pct(rows.filter((r) => r.potential === 99).length, rows.length)}`, fixed(average(rows.map(gap))), pct(rows.filter((r) => gap(r) >= 13).length, rows.length), pct(rows.filter((r) => gap(r) >= 20).length, rows.length)] }))
}
function printJoint(stages: Row[][]) {
  const cohorts = [['<65/POT85+', (r:Row)=>r.overall<65&&r.potential>=85],['<65/POT95+', (r:Row)=>r.overall<65&&r.potential>=95],['65–74/POT90+', (r:Row)=>r.overall>=65&&r.overall<=74&&r.potential>=90],['65–74/POT95+', (r:Row)=>r.overall>=65&&r.overall<=74&&r.potential>=95],['75–84/POT90+', (r:Row)=>r.overall>=75&&r.overall<=84&&r.potential>=90],['75–84/POT95+', (r:Row)=>r.overall>=75&&r.overall<=84&&r.potential>=95],['85–89/POT90+', (r:Row)=>r.overall>=85&&r.overall<=89&&r.potential>=90],['85–89/POT95+', (r:Row)=>r.overall>=85&&r.overall<=89&&r.potential>=95],['85–89/POT97+', (r:Row)=>r.overall>=85&&r.overall<=89&&r.potential>=97],['90+/POT95+', (r:Row)=>r.overall>=90&&r.potential>=95],['90+/POT97+', (r:Row)=>r.overall>=90&&r.potential>=97],['90+/POT99', (r:Row)=>r.overall>=90&&r.potential===99]] as const
  console.log('\n## Joint profiles'); table(['Profile', ...YEARS], cohorts.map(([name,test]) => [name, ...stages.map((rows) => rate(rows,test))]))
}
function printProfileMix(stages: Row[][]) {
  const profiles = [['Polished 75+/HR≤3',(r:Row)=>r.overall>=75&&gap(r)<=3],['Ready 80+/HR4–7',(r:Row)=>r.overall>=80&&gap(r)>=4&&gap(r)<=7],['Developmental HR8–12',(r:Row)=>gap(r)>=8&&gap(r)<=12],['Project HR13–19',(r:Row)=>gap(r)>=13&&gap(r)<=19],['Extreme HR20+',(r:Row)=>gap(r)>=20],['Project 75+/HR13+',(r:Row)=>r.overall>=75&&gap(r)>=13],['Project <75/HR13+',(r:Row)=>r.overall<75&&gap(r)>=13]] as const
  console.log('\n## Profile mix'); table(['Profile', ...YEARS], profiles.map(([name,test]) => [name,...stages.map((rows)=>rate(rows,test))]))
}
function printElite(stages: Row[][]) {
  console.log('\n## Elite ceiling realization')
  for (const threshold of [90,95,97,99]) table([`POT ${threshold}${threshold===99?'':'+'}`, 'N','OVR mean/med/P90','HR mean/med','≤3','≤7','13+','20+'], stages.map((all,stage)=>{const rows=all.filter((r)=>threshold===99?r.potential===99:r.potential>=threshold); const o=summary(rows.map((r)=>r.overall)); const h=summary(rows.map(gap)); return [`+${stage}`,rows.length,`${fixed(o.mean)}/${o.med}/${o.p90}`,`${fixed(h.mean)}/${h.med}`,pct(rows.filter((r)=>gap(r)<=3).length,rows.length),pct(rows.filter((r)=>gap(r)<=7).length,rows.length),pct(rows.filter((r)=>gap(r)>=13).length,rows.length),pct(rows.filter((r)=>gap(r)>=20).length,rows.length)]}))
}
function pickExample(rows: Row[], test: (r:Row)=>boolean) { const matches=rows.filter(test).sort((a,b)=>a.overall-b.overall||a.id.localeCompare(b.id)); return matches[Math.floor(matches.length/2)] }
function formatExample(r?: Row) { return r ? `${r.name} ${r.position} ${r.overall}/${r.potential} HR${gap(r)}` : 'none' }

export function runReport() {
  const classes=Number(process.env.CLASSES??500); const root=process.env.SEED??'endogenous-pot-reference:v1'; const {stages,careers,s0}=collectEndogenousPotReference(classes,root)
  console.log(`# Endogenous POT Reference\nClasses ${classes}; Players ${careers.length}; stages ${stages.map((s)=>s.length).join('/')}; seed ${root}`)
  console.log('\n## OVR'); table(['Stage','N','Mean','Med','P10','P25','P75','P90','P95','P99','Max'],stages.map((r,i)=>distributionRow(`+${i}`,r,'overall'))); table(['Stage',...OVR_THRESHOLDS.map((t)=>`${t}+`)],stages.map((rows,i)=>[`+${i}`,...OVR_THRESHOLDS.map((t)=>rate(rows,(r)=>r.overall>=t))]))
  console.log('\n## POT'); table(['Stage','N','Mean','Med','P10','P25','P75','P90','P95','P99','Max'],stages.map((r,i)=>distributionRow(`+${i}`,r,'potential'))); table(['Stage','80+','85+','90+','95+','97+','99'],stages.map((rows,i)=>[`+${i}`,...[80,85,90,95,97].map((t)=>rate(rows,(r)=>r.potential>=t)),rate(rows,(r)=>r.potential===99)]))
  console.log('\n## Headroom'); table(['Stage','Mean','Med','P75','P90','P95','P99','Max','0–3','4–7','8–12','13–19','20+'],stages.map((rows,i)=>{const s=summary(rows.map(gap)); return [`+${i}`,fixed(s.mean),s.med,s.p75,s.p90,s.p95,s.p99,s.max,...['0–3','4–7','8–12','13–19','20+'].map((b)=>rate(rows,(r)=>headroomBand(r)===b))]})); table(['Stage','0','1–3','4–7','8–12','13–19','20–29','30+'],stages.map((rows,i)=>[`+${i}`,rate(rows,(r)=>gap(r)===0),rate(rows,(r)=>gap(r)>=1&&gap(r)<=3),rate(rows,(r)=>gap(r)>=4&&gap(r)<=7),rate(rows,(r)=>gap(r)>=8&&gap(r)<=12),rate(rows,(r)=>gap(r)>=13&&gap(r)<=19),rate(rows,(r)=>gap(r)>=20&&gap(r)<=29),rate(rows,(r)=>gap(r)>=30)]))
  console.log('\n## Correlations'); table(['Stage','OVR↔POT','OVR↔HR'],stages.map((rows,i)=>[`+${i}`,fixed(correlation(rows.map((r)=>({first:r.overall,second:r.potential}))),3),fixed(correlation(rows.map((r)=>({first:r.overall,second:gap(r)}))),3)]))
  printConditional(stages); printJoint(stages); printProfileMix(stages); printElite(stages)
  console.log('\n## Unrealized upperclassmen'); for(const stage of [2,3]) for(const threshold of [8,13,20]) {const rows=stages[stage]!.filter((r)=>gap(r)>=threshold); const o=summary(rows.map((r)=>r.overall)); const p=summary(rows.map((r)=>r.potential)); console.log(`+${stage} HR${threshold}+ ${rate(stages[stage]!,r=>gap(r)>=threshold)} | OVR ${fixed(o.mean)}/${o.med}/${o.p90}/${o.p99} POT ${fixed(p.mean)}/${p.med}/${p.p90}/${p.p99} | POT90/95/97/99 ${[90,95,97].map((t)=>pct(rows.filter((r)=>r.potential>=t).length,rows.length)).join('/')}/${pct(rows.filter((r)=>r.potential===99).length,rows.length)} | ${formatExample(rows[Math.floor(rows.length/2)])}`) }
  console.log('\n## Stage examples'); for(let stage=0;stage<4;stage++){const rows=stages[stage]!; console.log(`+${stage}: polished ${formatExample(pickExample(rows,r=>r.overall>=85&&gap(r)<=3))} | runway ${formatExample(pickExample(rows,r=>r.overall>=80&&gap(r)>=4&&gap(r)<=12))} | project ${formatExample(pickExample(rows,r=>r.overall<75&&r.potential>=95))} | ordinary ${formatExample(pickExample(rows,r=>r.potential<85&&gap(r)<=7))} | exceptional ${formatExample(pickExample(rows,r=>r.potential>=97))}`)}
  const pot99=careers.filter((c)=>c.stages[0]!.potential===99); console.log(`\n## POT99\n${pot99.length}/${careers.length} (${pct(pot99.length,careers.length)}), ${fixed(pot99.length/classes)} per class`); table(['Stage','OVR mean/med/P90/max','HR mean/med/P90/max','reach90/95/97/99'],stages.map((_,stage)=>{const rows=pot99.map((c)=>c.stages[stage]!);const o=summary(rows.map((r)=>r.overall));const h=summary(rows.map(gap));return[`+${stage}`,`${fixed(o.mean)}/${o.med}/${o.p90}/${o.max}`,`${fixed(h.mean)}/${h.med}/${h.p90}/${h.max}`,[90,95,97,99].map((t)=>pct(rows.filter((r)=>r.overall>=t).length,rows.length)).join('/')]}))
  console.log('\n## Trajectories'); const trajectoryTests=[['steady elite',(c:Career)=>c.stages[0]!.potential>=95&&c.stages[0]!.overall>=75&&c.stages[3]!.overall>=90],['polished limited',(c:Career)=>c.stages[0]!.overall>=85&&gap(c.stages[0]!)<=3],['raw project',(c:Career)=>c.stages[0]!.overall<65&&c.stages[0]!.potential>=95],['late developer',(c:Career)=>c.stages[0]!.overall<70&&c.stages[3]!.overall-c.stages[0]!.overall>=15],['99 POT',(c:Career)=>c.stages[0]!.potential===99],['unrealized',(c:Career)=>gap(c.stages[3]!)>=20]] as const; for(const [label,test] of trajectoryTests){const matches=careers.filter(test);const c=matches[Math.floor(matches.length/2)];console.log(`${label}: ${c?c.stages.map((r)=>`${r.overall}/${r.potential}`).join(' → '):'none'}`)}
  console.log('\n## Live S0 contrast'); table(['Class','POT mean/med','POT90+/95+/97+/99','HR 0–3/4–7/8–12/13–19/20+','OVR↔POT'],YEARS.map((year)=>{const rows=s0[year];return[year,`${fixed(average(rows.map((r)=>r.potential)))}/${percentile(rows.map((r)=>r.potential),.5)}`,[90,95,97].map((t)=>pct(rows.filter((r)=>r.potential>=t).length,rows.length)).join('/')+`/${pct(rows.filter((r)=>r.potential===99).length,rows.length)}`,['0–3','4–7','8–12','13–19','20+'].map((b)=>pct(rows.filter((r)=>headroomBand(r)===b).length,rows.length)).join('/'),fixed(correlation(rows.map((r)=>({first:r.overall,second:r.potential}))),3)]}))
  console.log(`\nInvariants deterministic input; IDs ${new Set(careers.map((c)=>c.id)).size}/${careers.length}; fixed POT ${careers.every((c)=>c.stages.every((r)=>r.potential===c.stages[0]!.potential))}; valid ceiling ${careers.every((c)=>c.stages.every((r)=>r.overall<=r.potential))}`)
}
if(import.meta.url===`file://${process.argv[1]}`)runReport()
