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
import { summarizeRecruitPotGaps } from './talentPotGapMetrics'

const CLASSES = Number(process.env.CLASSES ?? 50)

function format(values: readonly number[]) {
  const s = summarizeDistribution(values)
  return `min ${s.minimum.toFixed(0)} | P10 ${s.p10.toFixed(1)} | P25 ${s.p25.toFixed(1)} | med ${s.median.toFixed(1)} | P75 ${s.p75.toFixed(1)} | P90 ${s.p90.toFixed(1)} | max ${s.maximum.toFixed(0)}`
}

const recruits: Recruit[] = []
const recruitingClasses: Array<readonly Recruit[]> = []
const activePlayers: { overall: number; potential: number; classYear: string; prestige: number }[] = []
const teamOveralls: number[] = []
for (let index = 0; index < CLASSES; index += 1) {
  const seed = `talent-distribution:${index}`
  const initialized = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const season = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse: initialized, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
  const dynasty = initializeRecruiting(initializeDynastyState({ dynastyId: seed, dynastySeed: seed, controlledProgramId: 'charlotte-tech', universe: UNIVERSE_V0, activeSeason: season }))
  const recruitingClass = dynasty.recruiting!.recruits
  recruitingClasses.push(recruitingClass)
  recruits.push(...recruitingClass)
  for (const { team, rotation } of Object.values(season.programStates)) {
    teamOveralls.push(calculateTeamStrength(team, rotation).overall)
    for (const player of team.roster) activePlayers.push({ overall: calculateOverall(player), potential: player.potential, classYear: player.classYear, prestige: team.prestige })
  }
}
const potGapSummaries = summarizeRecruitPotGaps(
  recruits.map((recruit) => ({
    stars: recruit.stars,
    overall: calculateOverall(recruit.player),
    potential: recruit.player.potential,
  })),
)
const ovr = recruits.map(({ player }) => calculateOverall(player))
const pot = recruits.map(({ player }) => player.potential)
console.log(`RECRUIT TALENT DISTRIBUTION — ${CLASSES} deterministic classes (${recruits.length} Recruits)`)
console.log(`OVR: ${format(ovr)}`)
console.log(`POT: ${format(pot)}`)
console.log(`POT-OVR: ${format(recruits.map(({ player }) => player.potential - calculateOverall(player)))}`)
console.log(`Seed strategy: talent-distribution:{0..${CLASSES - 1}} with production universe, schedule, Dynasty, and Recruiting initialization`)
console.log('\nELITE RECRUIT POT-GAP CHARACTERIZATION')
console.log('Cohort    n      Gap 0          Gap 1–3        Gap 4–7        Gap 8–12       Gap 13+        Mean   Median  Min–Max  P25/P75')
for (const summary of potGapSummaries) {
  const bucket = (key: keyof typeof summary.buckets) => {
    const value = summary.buckets[key]
    return `${value.count} (${(value.rate * 100).toFixed(1)}%)`
  }
  console.log(
    `${summary.label.padEnd(9)}` +
    `${String(summary.count).padEnd(7)}` +
    `${bucket('0').padEnd(15)}` +
    `${bucket('1-3').padEnd(15)}` +
    `${bucket('4-7').padEnd(15)}` +
    `${bucket('8-12').padEnd(15)}` +
    `${bucket('13+').padEnd(15)}` +
    `${summary.mean.toFixed(1).padEnd(7)}` +
    `${summary.median.toFixed(1).padEnd(8)}` +
    `${`${summary.minimum.toFixed(0)}–${summary.maximum.toFixed(0)}`.padEnd(9)}` +
    `${summary.p25.toFixed(1)}/${summary.p75.toFixed(1)}`,
  )
}
console.log('\nSTARS  COUNT  OVR AVG/MED/RANGE  POT AVG/MED/RANGE')
for (const stars of [5, 4, 3, 2] as const) {
  const tier = recruits.filter((recruit) => recruit.stars === stars)
  const tierOvr = tier.map(({ player }) => calculateOverall(player)); const tierPot = tier.map(({ player }) => player.potential)
  const ovrSummary = summarizeDistribution(tierOvr); const potSummary = summarizeDistribution(tierPot)
  console.log(`${stars}★     ${String(tier.length).padEnd(6)} ${ovrSummary.average.toFixed(1)}/${ovrSummary.median.toFixed(1)}/P10 ${ovrSummary.p10.toFixed(0)}/P90 ${ovrSummary.p90.toFixed(0)}       ${potSummary.average.toFixed(1)}/${potSummary.median.toFixed(1)}/P10 ${potSummary.p10.toFixed(0)}/P90 ${potSummary.p90.toFixed(0)}       gap ${averageGap(tier).toFixed(1)}`)
}

function averageGap(values: readonly Recruit[]) {
  return values.reduce((sum, { player }) => sum + player.potential - calculateOverall(player), 0) / Math.max(1, values.length)
}

function frequency(label: string, predicate: (recruit: Recruit) => boolean) {
  const counts = recruitingClasses.map((recruitingClass) => recruitingClass.filter(predicate).length)
  const summary = summarizeDistribution(counts)
  console.log(`${label.padEnd(27)} mean ${summary.average.toFixed(2)} | med ${summary.median.toFixed(1)} | max ${summary.maximum.toFixed(0)} | classes ≥1 ${((counts.filter((value) => value > 0).length / CLASSES) * 100).toFixed(1)}%`)
}

console.log('\nTHRESHOLD FREQUENCIES PER CLASS')
for (const threshold of [90, 88, 85, 80]) frequency(`${threshold}+ OVR`, ({ player }) => calculateOverall(player) >= threshold)
for (const threshold of [70, 65, 60]) frequency(`OVR < ${threshold}`, ({ player }) => calculateOverall(player) < threshold)
console.log('\nARCHETYPE FREQUENCIES PER CLASS')
frequency('55–64 OVR / 80+ POT', ({ player }) => calculateOverall(player) >= 55 && calculateOverall(player) <= 64 && player.potential >= 80)
frequency('55–64 OVR / 85+ POT', ({ player }) => calculateOverall(player) >= 55 && calculateOverall(player) <= 64 && player.potential >= 85)
frequency('60–69 OVR / 85+ POT', ({ player }) => calculateOverall(player) >= 60 && calculateOverall(player) <= 69 && player.potential >= 85)
frequency('60–69 OVR / 90+ POT', ({ player }) => calculateOverall(player) >= 60 && calculateOverall(player) <= 69 && player.potential >= 90)
frequency('70–79 OVR / 90+ POT', ({ player }) => calculateOverall(player) >= 70 && calculateOverall(player) <= 79 && player.potential >= 90)
frequency('75+ OVR / gap ≤ 5', ({ player }) => calculateOverall(player) >= 75 && player.potential - calculateOverall(player) <= 5)
frequency('80+ OVR / gap ≤ 5', ({ player }) => calculateOverall(player) >= 80 && player.potential - calculateOverall(player) <= 5)
console.log(`Correlations: rank↔OVR ${correlation(recruits.map((r) => ({ first: r.nationalRank, second: calculateOverall(r.player) }))).toFixed(3)} | rank↔POT ${correlation(recruits.map((r) => ({ first: r.nationalRank, second: r.player.potential }))).toFixed(3)} | OVR↔POT ${correlation(recruits.map((r) => ({ first: calculateOverall(r.player), second: r.player.potential }))).toFixed(3)}`)
console.log('\nACTIVE SEASON 1 PLAYERS')
console.log(`OVR: ${format(activePlayers.map(({ overall }) => overall))}`)
console.log(`80+/85+/90+/95+: ${[80,85,90,95].map((t) => `${t}+ ${(activePlayers.filter(({ overall }) => overall >= t).length / CLASSES).toFixed(1)}`).join(' | ')}`)
console.log(`Team OVR (rotation-weighted): ${format(teamOveralls)}`)
for (const year of ['FR', 'SO', 'JR', 'SR']) console.log(`${year}: ${format(activePlayers.filter(({ classYear }) => classYear === year).map(({ overall }) => overall))}`)
console.log('\nREPRESENTATIVE PROSPECTS')
for (const [label, predicate] of [
  ['elite ready-now', ({ player }: Recruit) => calculateOverall(player) >= 85 && player.potential - calculateOverall(player) <= 6],
  ['elite upside', ({ player }: Recruit) => calculateOverall(player) >= 70 && calculateOverall(player) <= 79 && player.potential >= 92],
  ['good immediate', ({ player }: Recruit) => calculateOverall(player) >= 74 && calculateOverall(player) <= 78 && player.potential <= 84],
  ['developmental', ({ player }: Recruit) => calculateOverall(player) >= 65 && calculateOverall(player) <= 70 && player.potential >= 84],
  ['raw sleeper', ({ player }: Recruit) => calculateOverall(player) >= 55 && calculateOverall(player) <= 64 && player.potential >= 85],
  ['limited ceiling', ({ player }: Recruit) => calculateOverall(player) >= 64 && calculateOverall(player) <= 70 && player.potential <= 74],
] as const) {
  const recruit = recruits.find(predicate)
  if (recruit) console.log(`${label.padEnd(17)} #${recruit.nationalRank} ${recruit.stars}★ ${recruit.player.firstName} ${recruit.player.lastName} ${recruit.player.position} OVR ${calculateOverall(recruit.player)} POT ${recruit.player.potential}`)
}
