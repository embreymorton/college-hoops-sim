import { calculateOverall } from '../src/engine'
import { initializeDynastyState, initializeRecruiting, type Recruit } from '../src/dynasty'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { generateLegacyRecruitingClass } from '../src/dynasty/recruiting/generation'
import { summarizeDistribution } from './dynastyLongRunMetrics'
import { applyCandidateBToRecruitingClass, type CandidateBRecruit } from './recruitPotGapCandidateB'
import { summarizeRecruitPotGaps, type PotGapCohortKey } from './talentPotGapMetrics'

const CLASSES = Number(process.env.CLASSES ?? 500)
const TARGET_SEASON = 2
const baseline: Recruit[] = []
const candidate: CandidateBRecruit[] = []
let exactIdentity = true
let exactProductionEquivalence = true

function withoutPotential(recruit: Recruit) {
  return Object.fromEntries(Object.entries(recruit.player).filter(([key]) => key !== 'potential'))
}

for (let index = 0; index < CLASSES; index += 1) {
  const seed = `talent-distribution:${index}`
  const initialized = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const season = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse: initialized,
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }),
    seasonNumber: 1,
  })
  const liveRecruits = initializeRecruiting(initializeDynastyState({
    dynastyId: seed,
    dynastySeed: seed,
    controlledProgramId: 'charlotte-tech',
    universe: UNIVERSE_V0,
    activeSeason: season,
  })).recruiting!.recruits
  const recruits = generateLegacyRecruitingClass({ dynastySeed: seed, targetSeasonNumber: TARGET_SEASON, season })
  const derived = applyCandidateBToRecruitingClass(recruits, seed, TARGET_SEASON)
  const byId = new Map(derived.map((row) => [row.player.id, row]))
  exactIdentity &&= recruits.every((row) => {
    const paired = byId.get(row.player.id)
    return paired !== undefined && calculateOverall(row.player) === calculateOverall(paired.player) &&
      JSON.stringify(withoutPotential(row)) === JSON.stringify(withoutPotential(paired))
  })
  const liveById = new Map(liveRecruits.map((row) => [row.player.id, row]))
  exactProductionEquivalence &&= derived.every((row) => {
    const live = liveById.get(row.player.id)
    return live !== undefined && live.player.potential === row.player.potential &&
      live.nationalRank === row.nationalRank && live.positionRank === row.positionRank && live.stars === row.stars &&
      JSON.stringify(withoutPotential(live)) === JSON.stringify(withoutPotential(row))
  })
  baseline.push(...recruits)
  candidate.push(...derived)
}

const observations = (rows: readonly Recruit[]) => rows.map((row) => ({
  stars: row.stars,
  overall: calculateOverall(row.player),
  potential: row.player.potential,
}))
const baselineGaps = summarizeRecruitPotGaps(observations(baseline))
const candidateGaps = summarizeRecruitPotGaps(observations(candidate))
const baseByCohort = new Map(baselineGaps.map((row) => [row.key, row]))
const candidateByCohort = new Map(candidateGaps.map((row) => [row.key, row]))
const pct = (value: number) => `${(value * 100).toFixed(2)}%`
const deltaPp = (after: number, before: number) => (after - before) * 100
const distribution = (rows: readonly Recruit[], field: 'overall' | 'potential') => summarizeDistribution(rows.map((row) => field === 'overall' ? calculateOverall(row.player) : row.player.potential))
const basePot = distribution(baseline, 'potential')
const candPot = distribution(candidate, 'potential')
const baseOvr = distribution(baseline, 'overall')
const candOvr = distribution(candidate, 'overall')
const rateAt = (rows: readonly Recruit[], threshold: number) => rows.filter((row) => row.player.potential >= threshold).length / rows.length
const starCount = (rows: readonly Recruit[], stars: number) => rows.filter((row) => row.stars === stars).length
const starOvr = (rows: readonly Recruit[], stars: number) => summarizeDistribution(rows.filter((row) => row.stars === stars).map((row) => calculateOverall(row.player)))
const baselineFive = new Set(baseline.filter((row) => row.stars === 5).map((row) => row.player.id))
const candidateFive = candidate.filter((row) => row.stars === 5).map((row) => row.player.id)
const fiveOverlap = candidateFive.filter((id) => baselineFive.has(id)).length / candidateFive.length
const rankMoves = candidate.map((row) => Math.abs(row.nationalRank - row.baselineNationalRank))
const interventions = candidate.filter((row) => row.candidateB.eligible)
const grants = interventions.filter((row) => row.candidateB.grantedRunway > 0)
const pass = (condition: boolean) => condition ? 'PASS' : 'FAIL'
const cohort = (key: PotGapCohortKey) => [baseByCohort.get(key)!, candidateByCohort.get(key)!] as const

console.log(`RECRUIT POT-GAP CANDIDATE B — PAIRED ${CLASSES} CLASSES (${baseline.length} recruits)`)
console.log(`Seeds: talent-distribution:{0..${CLASSES - 1}} | experimental namespace: recruit-pot-gap-candidate-b:v1`)
console.log(`Production activation: YES | live production exact by Recruit ID: ${exactProductionEquivalence ? 'PASS' : 'FAIL'}`)
console.log('\nGAP COHORTS (baseline → candidate; percentage-point deltas)')
console.log('Cohort  n       Gap 0                 Gap 1–3               Gap 4–7               Gap 8–12              Gap 13+              Median')
for (const key of ['all', 'fiveStar', 'fourStar', 'ovr80', 'ovr85', 'ovr90'] as const) {
  const [before, after] = cohort(key)
  const cell = (bucket: keyof typeof before.buckets) => `${pct(before.buckets[bucket].rate)}→${pct(after.buckets[bucket].rate)} (${deltaPp(after.buckets[bucket].rate, before.buckets[bucket].rate).toFixed(2)})`
  console.log(`${before.label.padEnd(8)}${String(before.count).padEnd(8)}${cell('0').padEnd(22)}${cell('1-3').padEnd(22)}${cell('4-7').padEnd(22)}${cell('8-12').padEnd(22)}${cell('13+').padEnd(22)}${before.median.toFixed(1)}→${after.median.toFixed(1)}`)
}
console.log('\nDISTRIBUTIONS')
console.log(`OVR mean/median/P90: ${baseOvr.average.toFixed(3)}/${baseOvr.median.toFixed(1)}/${baseOvr.p90.toFixed(1)} → ${candOvr.average.toFixed(3)}/${candOvr.median.toFixed(1)}/${candOvr.p90.toFixed(1)}`)
for (const threshold of [80, 85, 90]) console.log(`OVR ${threshold}+ rate: ${pct(baseline.filter((row) => calculateOverall(row.player) >= threshold).length / baseline.length)} → ${pct(candidate.filter((row) => calculateOverall(row.player) >= threshold).length / candidate.length)}`)
console.log(`POT mean/median/P90: ${basePot.average.toFixed(3)}/${basePot.median.toFixed(1)}/${basePot.p90.toFixed(1)} → ${candPot.average.toFixed(3)}/${candPot.median.toFixed(1)}/${candPot.p90.toFixed(1)}`)
for (const threshold of [90, 95, 99]) console.log(`POT ${threshold}+ rate: ${pct(rateAt(baseline, threshold))} → ${pct(rateAt(candidate, threshold))} (${deltaPp(rateAt(candidate, threshold), rateAt(baseline, threshold)).toFixed(2)} pp)`)
console.log('\nRANK / STAR STABILITY')
for (const stars of [5, 4, 3, 2]) {
  const before = starOvr(baseline, stars); const after = starOvr(candidate, stars)
  console.log(`${stars}★ count: ${starCount(baseline, stars)} → ${starCount(candidate, stars)} | OVR mean/median: ${before.average.toFixed(2)}/${before.median.toFixed(1)} → ${after.average.toFixed(2)}/${after.median.toFixed(1)}`)
}
const move = summarizeDistribution(rankMoves)
console.log(`5★ membership overlap: ${pct(fiveOverlap)}`)
console.log(`Absolute rank movement mean/median/P90/max: ${move.average.toFixed(2)}/${move.median.toFixed(1)}/${move.p90.toFixed(1)}/${move.maximum.toFixed(0)}`)
console.log('\nINTERVENTION')
console.log(`Eligible: ${interventions.length} (${pct(interventions.length / candidate.length)}) | preserved zero: ${interventions.filter((row) => row.candidateB.preservedZero).length} (${pct(interventions.filter((row) => row.candidateB.preservedZero).length / interventions.length)}) | granted: ${grants.length} | capped at 99: ${interventions.filter((row) => row.candidateB.cappedAt99).length}`)
console.log(`Granted runway distribution 1/2/3/4/5/6: ${[1,2,3,4,5,6].map((gap) => `${gap}:${grants.filter((row) => row.candidateB.grantedRunway === gap).length}`).join(' | ')}`)

const c5 = candidateByCohort.get('fiveStar')!; const c80 = candidateByCohort.get('ovr80')!; const c85 = candidateByCohort.get('ovr85')!; const [ball, call] = cohort('all')
const gates: readonly [string, boolean][] = [
  ['5★ zero-gap ≤50%', c5.buckets['0'].rate <= .50], ['OVR80 zero-gap ≤55%', c80.buckets['0'].rate <= .55], ['OVR85 zero-gap ≤60%', c85.buckets['0'].rate <= .60],
  ['5★ gap0–3 ≤65%', c5.buckets['0'].rate + c5.buckets['1-3'].rate <= .65], ['OVR80 gap0–3 ≤70%', c80.buckets['0'].rate + c80.buckets['1-3'].rate <= .70], ['OVR85 gap0–3 ≤75%', c85.buckets['0'].rate + c85.buckets['1-3'].rate <= .75],
  ['5★ median ≥3', c5.median >= 3], ['OVR80 median ≥2', c80.median >= 2], ['OVR85 median ≥2', c85.median >= 2], ['attributes and OVR exact', exactIdentity],
  ['star counts identical', [5,4,3,2].every((stars) => starCount(baseline, stars) === starCount(candidate, stars))], ['5★ overlap ≥85%', fiveOverlap >= .85],
  ['5★ OVR mean/median move ≤0.5', Math.abs(starOvr(candidate, 5).average - starOvr(baseline, 5).average) <= .5 && Math.abs(starOvr(candidate, 5).median - starOvr(baseline, 5).median) <= .5],
  ['4★ OVR mean/median move ≤0.5', Math.abs(starOvr(candidate, 4).average - starOvr(baseline, 4).average) <= .5 && Math.abs(starOvr(candidate, 4).median - starOvr(baseline, 4).median) <= .5],
  ['POT mean increase ≤1', candPot.average - basePot.average <= 1], ['POT median increase ≤1', candPot.median - basePot.median <= 1], ['POT P90 increase ≤2', candPot.p90 - basePot.p90 <= 2],
  ['POT90 rate increase ≤3pp', deltaPp(rateAt(candidate, 90), rateAt(baseline, 90)) <= 3], ['POT95 rate increase ≤1pp', deltaPp(rateAt(candidate, 95), rateAt(baseline, 95)) <= 1], ['POT99 rate increase ≤0.25pp', deltaPp(rateAt(candidate, 99), rateAt(baseline, 99)) <= .25],
  ['overall gap median move ≤1', Math.abs(call.median - ball.median) <= 1], ['gap13+ share increase ≤3pp', deltaPp(call.buckets['13+'].rate, ball.buckets['13+'].rate) <= 3],
]
console.log('\nPRECOMMITTED GATE SCORECARD')
for (const [label, passed] of gates) console.log(`${pass(passed)}  ${label}`)
console.log(`DISPOSITION: ${gates.every(([, passed]) => passed) ? 'ACCEPT' : 'REJECT'} (${gates.filter(([, passed]) => passed).length}/${gates.length} gates passed; Candidate B is production default)`)
console.log(`ACTIVATION EQUIVALENCE: ${exactProductionEquivalence ? 'PASS' : 'FAIL'} (attributes, OVR, final POT, national/position rank, and stars exact by Recruit ID)`)
