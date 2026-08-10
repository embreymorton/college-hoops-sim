import { calculateOverall, calculateTeamStrength } from '../src/engine'
import {
  initializeDynastyState,
  initializeRecruiting,
  type Recruit,
} from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { correlation, summarizeDistribution } from './dynastyLongRunMetrics'

const CLASSES = Number(process.env.CLASSES ?? 50)

function format(values: readonly number[]) {
  const s = summarizeDistribution(values)
  return `min ${s.minimum.toFixed(0)} | P10 ${s.p10.toFixed(1)} | P25 ${s.p25.toFixed(1)} | med ${s.median.toFixed(1)} | P75 ${s.p75.toFixed(1)} | P90 ${s.p90.toFixed(1)} | max ${s.maximum.toFixed(0)}`
}

const recruits: Recruit[] = []
const activePlayers: { overall: number; potential: number; classYear: string; prestige: number }[] = []
const teamOveralls: number[] = []
for (let index = 0; index < CLASSES; index += 1) {
  const seed = `talent-distribution:${index}`
  const initialized = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const season = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse: initialized, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
  const dynasty = initializeRecruiting(initializeDynastyState({ dynastyId: seed, dynastySeed: seed, controlledProgramId: 'charlotte-tech', universe: UNIVERSE_V0, activeSeason: season }))
  recruits.push(...dynasty.recruiting!.recruits)
  for (const { team, rotation } of Object.values(season.programStates)) {
    teamOveralls.push(calculateTeamStrength(team, rotation).overall)
    for (const player of team.roster) activePlayers.push({ overall: calculateOverall(player), potential: player.potential, classYear: player.classYear, prestige: team.prestige })
  }
}
const ovr = recruits.map(({ player }) => calculateOverall(player))
const pot = recruits.map(({ player }) => player.potential)
console.log(`RECRUIT TALENT DISTRIBUTION — ${CLASSES} deterministic classes (${recruits.length} Recruits)`)
console.log(`OVR: ${format(ovr)}`)
console.log(`POT: ${format(pot)}`)
console.log(`POT-OVR: ${format(recruits.map(({ player }) => player.potential - calculateOverall(player)))}`)
console.log('\nSTARS  COUNT  OVR AVG/MED/RANGE  POT AVG/MED/RANGE')
for (const stars of [5, 4, 3, 2] as const) {
  const tier = recruits.filter((recruit) => recruit.stars === stars)
  const tierOvr = tier.map(({ player }) => calculateOverall(player)); const tierPot = tier.map(({ player }) => player.potential)
  console.log(`${stars}★     ${String(tier.length).padEnd(6)} ${summarizeDistribution(tierOvr).average.toFixed(1)}/${summarizeDistribution(tierOvr).median.toFixed(1)}/${Math.min(...tierOvr)}–${Math.max(...tierOvr)}       ${summarizeDistribution(tierPot).average.toFixed(1)}/${summarizeDistribution(tierPot).median.toFixed(1)}/${Math.min(...tierPot)}–${Math.max(...tierPot)}`)
}
for (const threshold of [90, 88, 85, 80]) console.log(`${threshold}+ OVR per class: ${(ovr.filter((value) => value >= threshold).length / CLASSES).toFixed(2)}`)
for (const threshold of [70, 65, 60]) console.log(`OVR < ${threshold} per class: ${(ovr.filter((value) => value < threshold).length / CLASSES).toFixed(2)}`)
const raw = recruits.filter(({ player }) => calculateOverall(player) >= 55 && calculateOverall(player) <= 64 && player.potential >= 85)
console.log(`Raw 55–64 OVR / 85+ POT per class: ${(raw.length / CLASSES).toFixed(2)}`)
console.log(`Correlations: rank↔OVR ${correlation(recruits.map((r) => ({ first: r.nationalRank, second: calculateOverall(r.player) }))).toFixed(3)} | rank↔POT ${correlation(recruits.map((r) => ({ first: r.nationalRank, second: r.player.potential }))).toFixed(3)} | OVR↔POT ${correlation(recruits.map((r) => ({ first: calculateOverall(r.player), second: r.player.potential }))).toFixed(3)}`)
console.log('\nACTIVE SEASON 1 PLAYERS')
console.log(`OVR: ${format(activePlayers.map(({ overall }) => overall))}`)
console.log(`80+/85+/90+/95+: ${[80,85,90,95].map((t) => `${t}+ ${(activePlayers.filter(({ overall }) => overall >= t).length / CLASSES).toFixed(1)}`).join(' | ')}`)
console.log(`Team OVR (rotation-weighted): ${format(teamOveralls)}`)
for (const year of ['FR', 'SO', 'JR', 'SR']) console.log(`${year}: ${format(activePlayers.filter(({ classYear }) => classYear === year).map(({ overall }) => overall))}`)
console.log('\nRepresentative raw high-upside prospects:')
for (const recruit of raw.slice(0, 8)) console.log(`#${recruit.nationalRank} ${recruit.stars}★ ${recruit.player.position} OVR ${calculateOverall(recruit.player)} POT ${recruit.player.potential}`)
