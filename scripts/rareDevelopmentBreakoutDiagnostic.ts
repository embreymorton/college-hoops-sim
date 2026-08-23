import { pathToFileURL } from 'node:url'
import {
  deriveDevelopmentTendency,
  deriveOffseasonExplosionRoll,
  EXPLOSION_CHANCE,
  EXPLOSION_ELIGIBILITY_HEADROOM,
  ORDINARY_DEVELOPMENT_CAP,
  type OffseasonDevelopmentExplosion,
} from '../src/dynasty'
import { UNIVERSE_V0 } from '../src/universe'
import { runLongRunCalibration, type DynastyRunResult, type ProgramRosterTrace } from './inspectDynastyLongRun'

const SEEDS = Array.from({ length: 10 }, (_, i) => `explosion-production-${i + 1}`)
const SEASONS = 10
const MATURE_START = 7
const mean = (v: readonly number[]) => v.length ? v.reduce((s,x)=>s+x,0)/v.length : 0
const pct = (v: number) => `${(v*100).toFixed(2)}%`
const fixed = (v: number) => v.toFixed(2)
const sd = (v: readonly number[]) => { const m=mean(v); return Math.sqrt(mean(v.map(x=>(x-m)**2))) }
const rank = (value: number, roster: readonly number[]) => 1 + roster.filter(v=>v>value).length
const prestigeBand = (v: number) => v>=80?'80–100':v>=60?'60–79':v>=40?'40–59':'1–39'

function maturePlayers(runs: readonly DynastyRunResult[]) {
  return runs.flatMap(r=>r.rosterTraces).filter(t=>t.seasonNumber>=MATURE_START).flatMap(t=>t.players.map(p=>p.overall))
}
function matureTeams(runs: readonly DynastyRunResult[]) {
  return runs.flatMap(r=>r.rosterTraces).filter(t=>t.seasonNumber>=MATURE_START).map(t=>t.overall)
}
function line(label: string, values: readonly number[]): string {
  return `${label}: mean ${fixed(mean(values))}, SD ${fixed(sd(values))}; ${[80,85,90,95,98,99].map(t=>`${t}+ ${values.filter(v=>v>=t).length}`).join(' | ')}; peak ${Math.max(...values)}`
}
function traces(run: DynastyRunResult): Map<string, ProgramRosterTrace> {
  return new Map(run.rosterTraces.map(t=>[`${t.seasonNumber}:${t.programId}`,t]))
}

function print(): void {
  const baseline = runLongRunCalibration({ seeds: SEEDS, seasonsPerSeed: SEASONS, auditLevel:'light', enableDevelopmentExplosions:false })
  const enabled = runLongRunCalibration({ seeds: SEEDS, seasonsPerSeed: SEASONS, auditLevel:'light', enableDevelopmentExplosions:true })
  const events = enabled.runs.flatMap(r=>r.developmentExplosions).filter(e=>e.completedSeasonNumber>=MATURE_START&&e.completedSeasonNumber<SEASONS)
  const offseasonCount = SEEDS.length * (SEASONS-MATURE_START)
  const conference = new Map<string,string>(UNIVERSE_V0.programs.map(p=>[p.id,p.conferenceId]))
  const eligible: { tendency:string; rolled:boolean; prestige:number }[]=[]
  for (const run of enabled.runs) for (const team of run.rosterTraces.filter(t=>t.seasonNumber>=MATURE_START&&t.seasonNumber<SEASONS)) for (const row of team.players) {
    if (row.classYear==='SR') continue
    const cap=ORDINARY_DEVELOPMENT_CAP[row.classYear as keyof typeof ORDINARY_DEVELOPMENT_CAP]
    if (row.potential-row.overall<EXPLOSION_ELIGIBILITY_HEADROOM||row.potential-row.overall<=cap) continue
    const options={player:row.playerSnapshot,dynastySeed:run.seed,completedSeasonNumber:team.seasonNumber,programId:team.programId}
    eligible.push({tendency:deriveDevelopmentTendency(row.playerSnapshot,run.seed),rolled:deriveOffseasonExplosionRoll(options),prestige:team.prestige})
  }
  console.log('# Production Rare Development Breakouts Diagnostic\n')
  console.log(`10 paired seeds × 10 full seasons; mature Seasons ${MATURE_START}–${SEASONS}; ${eligible.length} eligible opportunities. Configured roll ${pct(EXPLOSION_CHANCE)}, headroom ${EXPLOSION_ELIGIBILITY_HEADROOM}+, isolated production RNG.`)
  console.log(`Official events ${events.length}; ${fixed(events.length/offseasonCount)} per league offseason; eligible realized ${pct(events.length/eligible.length)}; all eligible rolls ${eligible.filter(e=>e.rolled).length} (${pct(eligible.filter(e=>e.rolled).length/eligible.length)}).`)
  console.log(`Class FR/SO/JR: ${(['FR','SO','JR'] as const).map(c=>events.filter(e=>e.completedClass===c).length).join('/')}; total-gain +16/+17/+18/+19/+20: ${[16,17,18,19,20].map(g=>events.filter(e=>e.totalGain===g).length).join('/')}.`)
  console.log('\n## Mature league talent')
  console.log(line('Baseline players',maturePlayers(baseline.runs)))
  console.log(line('Explosion players',maturePlayers(enabled.runs)))
  console.log(line('Baseline Team Strength OVR',matureTeams(baseline.runs)))
  console.log(line('Explosion Team Strength OVR',matureTeams(enabled.runs)))

  const rankMoves:{before:number;after:number;event:OffseasonDevelopmentExplosion;prestige:number;conference:string;prior:number[]}[]=[]
  for (const run of enabled.runs) {
    const byTrace=traces(run)
    for (const event of run.developmentExplosions.filter(e=>e.completedSeasonNumber>=MATURE_START&&e.completedSeasonNumber<SEASONS)) {
      const before=byTrace.get(`${event.completedSeasonNumber}:${event.programId}`)!
      const after=byTrace.get(`${event.completedSeasonNumber+1}:${event.programId}`)!
      const prior=run.developments.filter(d=>d.playerId===event.playerId&&d.seasonNumber<event.completedSeasonNumber).map(d=>d.overallGain)
      rankMoves.push({before:rank(event.previousOverall,before.players.map(p=>p.overall)),after:rank(event.currentOverall,after.players.map(p=>p.overall)),event,prestige:before.prestige,conference:conference.get(event.programId)!,prior})
    }
  }
  console.log('\n## Roster and story impact')
  console.log(`Average rank movement ${fixed(mean(rankMoves.map(r=>r.before-r.after)))}; outside→inside top 8/5/3 ${[8,5,3].map(n=>pct(rankMoves.filter(r=>r.before>n&&r.after<=n).length/rankMoves.length)).join('/')}; became #1 ${pct(rankMoves.filter(r=>r.before>1&&r.after===1).length/rankMoves.length)}.`)
  const story=(test:(r:typeof rankMoves[number])=>boolean)=>pct(rankMoves.filter(test).length/rankMoves.length)
  console.log(`Late bloomer ${story(r=>r.event.completedClass!=='FR'&&r.prior.length>0&&mean(r.prior)<=3&&r.event.totalGain>=11)}; project→contributor ${story(r=>r.event.previousOverall<70&&r.event.currentOverall>=74&&r.event.currentOverall<82)}; project→star ${story(r=>r.event.previousOverall<75&&r.event.currentOverall>=82)}; steady→explosion ${story(r=>r.prior.length>0&&mean(r.prior)>3&&r.event.totalGain>=11)}; star→superstar ${story(r=>r.event.previousOverall>=80&&r.event.currentOverall>=90)}.`)

  console.log('\n## Work Ethic and Program distribution')
  for (const band of ['weak','steady','strong'] as const) {
    const pop=eligible.filter(e=>e.tendency===band), rolls=pop.filter(e=>e.rolled), official=events.filter((event)=>{
      const run=enabled.runs.find(r=>r.seed&&r.rosterTraces.some(t=>t.seasonNumber===event.completedSeasonNumber&&t.programId===event.programId&&t.players.some(p=>p.playerId===event.playerId)))!
      const player=run.rosterTraces.find(t=>t.seasonNumber===event.completedSeasonNumber&&t.programId===event.programId)!.players.find(p=>p.playerId===event.playerId)!
      return deriveDevelopmentTendency(player.playerSnapshot,run.seed)===band
    })
    console.log(`${band}: eligibility ${pop.length} (${pct(pop.length/eligible.length)}), roll ${pct(rolls.length/pop.length)}, official ${official.length}, mean total ${fixed(mean(official.map(e=>e.totalGain)))}`)
  }
  console.log(`Prestige events: ${['80–100','60–79','40–59','1–39'].map(b=>`${b} ${rankMoves.filter(r=>prestigeBand(r.prestige)===b).length}`).join(' | ')}; conferences ${[...new Set(rankMoves.map(r=>r.conference))].join(', ')}.`)
  console.log(`POT truncated ${pct(events.filter(e=>e.potentialTruncation>0).length/events.length)}; average contribution ${fixed(mean(events.map(e=>e.explosionContribution)))}; mean total ${fixed(mean(events.map(e=>e.totalGain)))}; maximum ${Math.max(...events.map(e=>e.totalGain))}.`)
  console.log('\n## Representative production events')
  for (const row of [...rankMoves].sort((a,b)=>b.event.totalGain-a.event.totalGain||b.event.explosionContribution-a.event.explosionContribution).slice(0,12)) {
    const e=row.event
    console.log(`${e.completedClass} ${e.previousOverall}/${e.potential} → ${e.currentOverall}; ordinary +${e.ordinaryGain}, explosion +${e.explosionContribution}, total +${e.totalGain}; prior [${row.prior.join(',')}], P${row.prestige}, ${row.conference}`)
  }
  const nonEventParity=baseline.runs.flatMap(r=>r.rosterTraces).filter(t=>t.seasonNumber===1).every((team,i)=>JSON.stringify(team)===JSON.stringify(enabled.runs.flatMap(r=>r.rosterTraces).filter(t=>t.seasonNumber===1)[i]))
  console.log(`\nPaired Season-1 pre-explosion parity: ${nonEventParity}. Production unit tests own byte-exact non-event Player preservation.`)
}

export function main():void{print()}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main()
