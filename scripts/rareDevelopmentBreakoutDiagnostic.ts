import { pathToFileURL } from 'node:url'
import { createRng } from '../src/engine'
import { deriveDevelopmentTendency } from '../src/dynasty'
import { UNIVERSE_V0 } from '../src/universe'
import { runLongRunCalibration } from './inspectDynastyLongRun'

const SEEDS = Array.from({ length: 10 }, (_, index) => `explosion-diagnostic-${index + 1}`)
const SEASONS = 10
const WARMUP = 4
const HEADROOM = 12
const FREQUENCIES = [{ id: 'D1', p: .034 }, { id: 'D2', p: .04 }, { id: 'D3', p: .045 }] as const
const MODELS = ['M1', 'M2'] as const
const NORMAL_CAP = { FR: 16, SO: 14, JR: 12 } as const
const FREAK_CAP = { FR: 20, SO: 18, JR: 16 } as const
type Stage = keyof typeof NORMAL_CAP
type Band = 'weak' | 'steady' | 'strong'
type Model = typeof MODELS[number]

interface Opportunity {
  seed: string; season: number; programId: string; conferenceId: string; prestige: number
  playerId: string; stage: Stage; tendency: Band; pre: number; potential: number
  ordinaryGain: number; ordinaryPost: number; priorGains: readonly number[]
  beforeRoster: readonly number[]; afterRoster: readonly number[]; rosterMean: number
}
interface Event extends Opportunity {
  model: Model; tier: 'meaningful' | 'major' | 'freak'; uncapped: number
  requestedTotal: number; totalGain: number; contribution: number; final: number
  potTruncation: number; capTruncation: number; beforeRank: number; afterRank: number
}

const mean = (v: readonly number[]) => v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0
function percentile(v: readonly number[], p: number): number {
  if (!v.length) return 0
  const sorted = [...v].sort((a, b) => a - b)
  return sorted[Math.round((sorted.length - 1) * p)]!
}
const pct = (v: number) => `${(v * 100).toFixed(2)}%`
const fixed = (v: number) => v.toFixed(2)
const choose = (n: number, k: number) => {
  let value = 1
  for (let i = 1; i <= k; i += 1) value *= (n - i + 1) / i
  return value
}
const binomialAtLeast = (n: number, k: number, p: number) => 1 - Array.from({ length: k }, (_, x) =>
  choose(n, x) * p ** x * (1 - p) ** (n - x)).reduce((s, x) => s + x, 0)
function seed(row: Opportunity, frequency: string, namespace: string): string {
  return JSON.stringify({ namespace: `college-hoops-sim:diagnostic-explosion:${namespace}:v2`, frequency,
    dynastySeed: row.seed, season: row.season, programId: row.programId, playerId: row.playerId })
}
function rank(value: number, roster: readonly number[]): number {
  return 1 + roster.filter((other) => other > value).length
}
function prestigeBand(value: number): string {
  return value >= 80 ? '80–100' : value >= 60 ? '60–79' : value >= 40 ? '40–59' : '1–39'
}

function build(): { rows: Opportunity[]; baseline: number[] } {
  const result = runLongRunCalibration({ seeds: SEEDS, seasonsPerSeed: SEASONS, auditLevel: 'light' })
  const rows: Opportunity[] = [], baseline: number[] = []
  const conference = new Map<string, string>(UNIVERSE_V0.programs.map(p => [p.id, p.conferenceId]))
  for (const run of result.runs) {
    const teams = new Map(run.rosterTraces.map(team => [`${team.seasonNumber}:${team.programId}`, team]))
    const players = new Map(run.rosterTraces.flatMap(team => team.players.map(player =>
      [`${team.seasonNumber}:${player.playerId}`, { team, player }] as const)))
    const prior = new Map<string, number[]>()
    for (const team of run.rosterTraces) {
      if (team.seasonNumber >= WARMUP) baseline.push(...team.players.map(p => p.overall))
      for (const player of team.players) {
        if (player.classYear === 'SR') continue
        const next = players.get(`${team.seasonNumber + 1}:${player.playerId}`)
        if (!next) continue
        const ordinaryGain = next.player.overall - player.overall
        const history = [...(prior.get(player.playerId) ?? [])]
        prior.set(player.playerId, [...history, ordinaryGain])
        if (team.seasonNumber < WARMUP) continue
        const afterTeam = teams.get(`${team.seasonNumber + 1}:${team.programId}`)!
        rows.push({ seed: run.seed, season: team.seasonNumber, programId: team.programId,
          conferenceId: conference.get(team.programId)!, prestige: team.prestige, playerId: player.playerId,
          stage: player.classYear as Stage, tendency: deriveDevelopmentTendency(player.playerSnapshot, run.seed),
          pre: player.overall, potential: player.potential, ordinaryGain, ordinaryPost: next.player.overall,
          priorGains: history, beforeRoster: team.players.map(p => p.overall),
          afterRoster: afterTeam.players.map(p => p.overall), rosterMean: mean(team.players.map(p => p.overall)) })
      }
    }
  }
  return { rows, baseline }
}

function simulate(rows: readonly Opportunity[], frequency: typeof FREQUENCIES[number], model: Model) {
  const eligible = rows.filter(r => r.potential - r.pre >= HEADROOM &&
    r.ordinaryGain < Math.min(NORMAL_CAP[r.stage], r.potential - r.pre))
  const rolled = eligible.filter(row => createRng(seed(row, 'shared', 'roll')).chance(frequency.p))
  const events: Event[] = []
  for (const row of rolled) {
    const rng = createRng(seed(row, 'shared', `magnitude-${model}`))
    const draw = rng.next()
    const tier = draw < (model === 'M1' ? .6 : .58) ? 'meaningful' :
      draw < (model === 'M1' ? .9 : .92) ? 'major' : 'freak'
    const uncapped = model === 'M1'
      ? tier === 'meaningful' ? rng.int(8, 10) : tier === 'major' ? rng.int(11, 13) : rng.int(14, 17)
      : tier === 'meaningful' ? rng.int(8, 11) : tier === 'major' ? rng.int(12, 15) : rng.int(16, 20)
    const cap = model === 'M2' && tier === 'freak' ? FREAK_CAP[row.stage] : NORMAL_CAP[row.stage]
    const requestedTotal = Math.min(cap, uncapped)
    const totalGain = Math.min(requestedTotal, row.potential - row.pre)
    const contribution = Math.max(0, totalGain - row.ordinaryGain)
    if (!contribution) continue
    const final = row.pre + totalGain
    events.push({ ...row, model, tier, uncapped, requestedTotal, totalGain, contribution, final,
      potTruncation: Math.max(0, requestedTotal - (row.potential - row.pre)),
      capTruncation: Math.max(0, uncapped - requestedTotal),
      beforeRank: rank(row.pre, row.beforeRoster), afterRank: rank(final,
        row.afterRoster.map(v => v === row.ordinaryPost ? final : v)) })
  }
  return { eligible, rolled, events }
}

function stories(events: readonly Event[]): string {
  const share = (test: (e: Event) => boolean) => pct(events.filter(test).length / events.length)
  return [
    `late ${share(e => e.stage !== 'FR' && e.priorGains.length > 0 && mean(e.priorGains) <= 3 && e.totalGain >= 11)}`,
    `project→contributor ${share(e => e.pre < 70 && e.final >= 74 && e.final < 82)}`,
    `project→star ${share(e => e.pre < 75 && e.final >= 82)}`,
    `steady→explosion ${share(e => e.priorGains.length > 0 && mean(e.priorGains) > 3 && e.totalGain >= 11)}`,
    `star→superstar ${share(e => e.pre >= 80 && e.final >= 90)}`,
  ].join(' | ')
}

function print(): void {
  const { rows, baseline } = build()
  const eligible = rows.filter(r => r.potential - r.pre >= HEADROOM && r.ordinaryGain < Math.min(NORMAL_CAP[r.stage], r.potential-r.pre))
  const offseasonKeys = [...new Set(rows.map(r => `${r.seed}:${r.season}`))]
  console.log('# Rare Development Breakouts — Final Tuning Diagnostic\n')
  console.log(`Configuration: ${SEEDS.length} seeds × ${SEASONS} full production seasons; mature Seasons ${WARMUP}–${SEASONS - 1}; ${rows.length} returner offseasons, ${eligible.length} eligible (${pct(eligible.length/rows.length)}); 12+ headroom. Separate v2 roll and magnitude namespaces; paired M1/M2 rolls.`)
  console.log(`Baseline: mean ${fixed(mean(baseline))}, median ${percentile(baseline,.5)}, SD ${fixed(Math.sqrt(mean(baseline.map(v => (v-mean(baseline))**2))))}; ` +
    [80,85,90,95,98,99].map(t => `${t}+ ${baseline.filter(v=>v>=t).length}`).join(' | ') + `; peak ${Math.max(...baseline)}.`)

  for (const frequency of FREQUENCIES) for (const model of MODELS) {
    const { rolled, events } = simulate(rows, frequency, model)
    const perSeason = offseasonKeys.map(k => events.filter(e => `${e.seed}:${e.season}` === k).length)
    console.log(`\n## ${frequency.id}-${model} — ${pct(frequency.p)} eligible roll`)
    console.log(`rolls ${rolled.length} (${pct(rolled.length/eligible.length)} eligible); realized ${events.length} (${pct(events.length/eligible.length)} eligible, ${pct(events.length/rows.length)} all returners); league mean/median/P10/P90 ${fixed(mean(perSeason))}/${percentile(perSeason,.5)}/${percentile(perSeason,.1)}/${percentile(perSeason,.9)}.`)
    console.log(`Seasons 0/1/2/3/4+: ${[0,1,2,3].map(n=>pct(perSeason.filter(v=>v===n).length/perSeason.length)).join(' / ')} / ${pct(perSeason.filter(v=>v>=4).length/perSeason.length)}; stage FR/SO/JR ${(['FR','SO','JR'] as const).map(s=>events.filter(e=>e.stage===s).length).join('/')}.`)
    const q = events.length / (offseasonKeys.length * UNIVERSE_V0.programs.length)
    console.log(`Program encounter estimate: one every ${fixed(1/q)} seasons; ≥1 in 5/10/15/20 ${[5,10,15,20].map(n=>pct(binomialAtLeast(n,1,q))).join('/')}; ≥2 in 10/15 ${pct(binomialAtLeast(10,2,q))}/${pct(binomialAtLeast(15,2,q))}; ≥3 in 20 ${pct(binomialAtLeast(20,3,q))}. Longest observed mature-window drought: ${SEASONS-WARMUP} seasons (right-censored).`)
    console.log(`Magnitude total mean/median/max ${fixed(mean(events.map(e=>e.totalGain)))}/${percentile(events.map(e=>e.totalGain),.5)}/${Math.max(...events.map(e=>e.totalGain))}; contribution ${fixed(mean(events.map(e=>e.contribution)))}. Stories: ${stories(events)}.`)
    console.log(`Roster rank movement avg ${fixed(mean(events.map(e=>e.beforeRank-e.afterRank)))}; outside→inside top 8/5/3 ${[8,5,3].map(n=>pct(events.filter(e=>e.beforeRank>n&&e.afterRank<=n).length/events.length)).join('/')}; became #1 ${pct(events.filter(e=>e.beforeRank>1&&e.afterRank===1).length/events.length)}.`)
    const thresholds = [80,85,90,95,98,99]
    console.log(`High-end additions/league-season ${thresholds.map(t=>`${t}+ ${fixed(events.filter(e=>e.ordinaryPost<t&&e.final>=t).length/offseasonKeys.length)}`).join(' | ')}; immediate mean OVR +${fixed(events.reduce((s,e)=>s+e.contribution,0)/baseline.length)}; peak ${Math.max(Math.max(...baseline),...events.map(e=>e.final))}.`)
    console.log(`POT truncated ${pct(events.filter(e=>e.potTruncation>0).length/events.length)} (avg ${fixed(mean(events.filter(e=>e.potTruncation>0).map(e=>e.potTruncation)))}); cap truncated ${pct(events.filter(e=>e.capTruncation>0).length/events.length)}; no-extra rolls ${pct((rolled.length-events.length)/rolled.length)}; freak rolls below 16 total ${pct(events.filter(e=>e.tier==='freak'&&e.totalGain<16).length/Math.max(1,events.filter(e=>e.tier==='freak').length))}.`)
    console.log(`Prestige events: ${['80–100','60–79','40–59','1–39'].map(b=>`${b} ${pct(events.filter(e=>prestigeBand(e.prestige)===b).length/events.length)}`).join(' | ')}; low-prestige late stories ${events.filter(e=>e.prestige<40&&e.stage!=='FR'&&mean(e.priorGains)<=3&&e.totalGain>=11).length}; conferences reached ${new Set(events.map(e=>e.conferenceId)).size}/${UNIVERSE_V0.conferences.length}.`)
    if (model === 'M2') {
      console.log(`Tail per league-season (seasons/event): ${[16,17,18,19,20].map(g=>{const n=events.filter(e=>e.totalGain===g).length;return `+${g} ${fixed(n/offseasonKeys.length)} (${n?fixed(offseasonKeys.length/n):'∞'})`}).join(' | ')}.`)
      const huge=events.filter(e=>e.totalGain>=16)
      console.log(`16+ recipients (${huge.length}): ${huge.map(e=>`${e.stage} ${e.pre}/${e.potential}→${e.final} ${e.tendency} P${e.prestige} prior[${e.priorGains.join(',')}] total+${e.totalGain} extra+${e.contribution} POTcut${e.potTruncation} CAPcut${e.capTruncation}`).join('; ') || 'none'}`)
    }
    if (frequency.id === 'D2' && model === 'M2') for (const band of ['weak','steady','strong'] as const) {
      const pop=rows.filter(r=>r.tendency===band), elig=eligible.filter(r=>r.tendency===band), rolls=rolled.filter(r=>r.tendency===band), ev=events.filter(r=>r.tendency===band)
      console.log(`Work Ethic ${band}: population ${pct(pop.length/rows.length)}, eligibility share ${pct(elig.length/eligible.length)}, roll ${pct(rolls.length/elig.length)}, realized ${ev.length} (${pct(ev.length/pop.length)} population), mean total ${fixed(mean(ev.map(e=>e.totalGain)))}.`)
    }
  }
  console.log('\nPreservation: observational overlays run after unchanged production Development. Non-events retain identical Player snapshots, attributes, OVR, POT, class, summaries, and production RNG consumption by construction.')
}

export function main(): void { print() }
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
