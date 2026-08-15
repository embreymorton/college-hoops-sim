import { calculateOverall, calculateTeamStrength, generateDefaultRotationV1, POSITIONS, type Player, type PlayerAttributes, type Position } from '../src/engine'
import { initializeDynastyState, type Recruit } from '../src/dynasty'
import { generateLegacyRecruitingClass } from '../src/dynasty/recruiting/generation'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { applyCandidateBToRecruitingClass } from './recruitPotGapCandidateB'
import { deriveProfileShape, PLAYER_ATTRIBUTE_KEYS } from './playerProfileSpecializationMetrics'
import { pearsonCorrelation, summarize } from './playerStatisticalIdentityMetrics'
import { summarizeRecruitPotGaps } from './talentPotGapMetrics'
import { applyPlayerProfileRedistributionCandidateA, CANDIDATE_A_CONFIG, CANDIDATE_A_NAMESPACE, type CandidateAResult } from './playerProfileRedistributionCandidateA'

const UNIVERSES = 250
const RECRUIT_CLASSES = Number(process.env.CLASSES ?? 500)
const seed = (index: number) => `player-statistical-identity-v1:generation:${String(index + 1).padStart(3, '0')}`
type Pair = { seed: string; programId: string; baseline: Player; result: CandidateAResult }
const pairs: Pair[] = []
const strengths: { baseline: number; candidate: number }[] = []
let nonSelectedExact = true
let selectedIdentityExact = true

for (let index = 0; index < UNIVERSES; index += 1) {
  const currentSeed = seed(index)
  const universe = initializeUniverse(UNIVERSE_V0, currentSeed)
  for (const state of universe.programs) {
    const roster = state.team.roster.map((baseline) => {
      const result = applyPlayerProfileRedistributionCandidateA(baseline)
      pairs.push({ seed: currentSeed, programId: state.program.id, baseline, result })
      if (!result.selected) nonSelectedExact &&= result.player === baseline && JSON.stringify(result.player) === JSON.stringify(baseline)
      if (result.selected) selectedIdentityExact &&= baseline.id === result.player.id && baseline.position === result.player.position && baseline.height === result.player.height && baseline.firstName === result.player.firstName && baseline.lastName === result.player.lastName && baseline.classYear === result.player.classYear && baseline.potential === result.player.potential
      return result.player
    })
    const candidateTeam = { ...state.team, roster }
    const candidateRotation = generateDefaultRotationV1(candidateTeam)
    strengths.push({ baseline: calculateTeamStrength(state.team, state.rotation).overall, candidate: calculateTeamStrength(candidateTeam, candidateRotation).overall })
  }
}

const selected = pairs.filter(({ result }) => result.selected)
const applied = pairs.filter(({ result }) => result.applied)
const basePlayers = pairs.map(({ baseline }) => baseline)
const candidatePlayers = pairs.map(({ result }) => result.player)
const overall = (player: Player) => calculateOverall(player)
const rate = (count: number, total: number) => total ? count / total : 0
const average = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
const attributeSummary = (players: readonly Player[], key: keyof PlayerAttributes) => ({ mean: summarize(players.map((p) => p.attributes[key])).mean, median: summarize(players.map((p) => p.attributes[key])).median })
const shape = (players: readonly Player[], position?: Position) => {
  const rows = position ? players.filter((p) => p.position === position) : players
  const shapes = rows.map((p) => deriveProfileShape(p.attributes))
  return { n: rows.length, spread: average(shapes.map((s) => s.spread)), gap: average(shapes.map((s) => s.topTwoMinusBottomTwo)), sd: average(shapes.map((s) => s.standardDeviation)), anyBelow70: rate(shapes.filter((s) => s.weaknesses.below70 > 0).length, shapes.length), anyBelow60: rate(shapes.filter((s) => s.weaknesses.below60 > 0).length, shapes.length), twoBelow60: rate(shapes.filter((s) => s.weaknesses.below60 >= 2).length, shapes.length) }
}
const correlation = (players: readonly Player[], position: Position) => {
  const rows = players.filter((p) => p.position === position)
  const values: number[] = []
  for (let i = 0; i < PLAYER_ATTRIBUTE_KEYS.length; i += 1) for (let j = i + 1; j < PLAYER_ATTRIBUTE_KEYS.length; j += 1) values.push(pearsonCorrelation(rows.map((p) => p.attributes[PLAYER_ATTRIBUTE_KEYS[i]!]), rows.map((p) => p.attributes[PLAYER_ATTRIBUTE_KEYS[j]!])) )
  return average(values)
}
const profiles = (players: readonly Player[]) => ({
  skilledBig: players.filter((p) => (p.position === 'PF' || p.position === 'C') && (p.attributes.playmaking >= 80 || (p.attributes.playmaking >= 76 && p.attributes.ballHandling >= 77))).length,
  eliteBigPasser: players.filter((p) => (p.position === 'PF' || p.position === 'C') && p.attributes.playmaking >= 84).length,
  reboundingGuard: players.filter((p) => (p.position === 'PG' || p.position === 'SG') && p.attributes.rebounding >= 88).length,
  pointForward: players.filter((p) => (p.position === 'SF' || p.position === 'PF') && p.attributes.playmaking >= 84 && p.attributes.ballHandling >= 82).length,
  offensiveSpecialist: players.filter((p) => [p.attributes.finishing, p.attributes.shooting, p.attributes.playmaking, p.attributes.ballHandling].filter((x) => x >= 90).length >= 2 && [p.attributes.perimeterDefense, p.attributes.interiorDefense, p.attributes.rebounding].filter((x) => x < 70).length >= 2).length,
  defensiveSpecialist: players.filter((p) => Math.max(p.attributes.perimeterDefense, p.attributes.interiorDefense) >= 90 && [p.attributes.shooting, p.attributes.playmaking, p.attributes.ballHandling].filter((x) => x < 70).length >= 2).length,
})

const exampleRows = [
  applied.find((p) => p.result.path === 'scoring-wing'),
  applied.find((p) => ['point-of-attack-guard', 'two-way-stopper', 'defensive-wing', 'rim-protector'].includes(p.result.path ?? '')),
  applied.find((p) => p.baseline.position === 'C' && p.result.kind === 'conventional'),
  applied.find((p) => p.baseline.position === 'PG'),
  applied.find((p) => p.result.kind === 'unusual-secondary'),
  applied.find((p) => Math.max(...PLAYER_ATTRIBUTE_KEYS.map((k) => Math.abs(p.result.player.attributes[k] - p.baseline.attributes[k]))) <= 8),
].filter((row): row is Pair => row !== undefined)
const examples = exampleRows.map(({ baseline, result }) => ({ id: baseline.id, position: baseline.position, path: result.path, baselineOverall: overall(baseline), candidateOverall: overall(result.player), baseline: baseline.attributes, candidate: result.player.attributes, weightedRemoved: result.weightedRemoved, weightedAdded: result.weightedAdded }))

const recruitsBase: Recruit[] = []
const recruitsCandidate: Recruit[] = []
let recruitNonSelectedExact = true
const rankMovement: number[] = []
for (let index = 0; index < RECRUIT_CLASSES; index += 1) {
  const dynastySeed = `candidate-a-recruit:${index}`
  const initialized = initializeUniverse(UNIVERSE_V0, `${dynastySeed}:universe`)
  const season = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse: initialized, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${dynastySeed}:schedule` }), seasonNumber: 1 })
  // Establishes the same Dynasty context as production without consuming Candidate A RNG.
  initializeDynastyState({ dynastyId: dynastySeed, dynastySeed, controlledProgramId: 'charlotte-tech', universe: UNIVERSE_V0, activeSeason: season })
  const legacy = generateLegacyRecruitingClass({ dynastySeed, targetSeasonNumber: 2, season })
  const baseline = applyCandidateBToRecruitingClass(legacy, dynastySeed, 2)
  const transformedLegacy = legacy.map((recruit) => ({ ...recruit, player: applyPlayerProfileRedistributionCandidateA(recruit.player).player }))
  const candidate = applyCandidateBToRecruitingClass(transformedLegacy, dynastySeed, 2)
  const candidateById = new Map(candidate.map((r) => [r.player.id, r]))
  for (const base of baseline) {
    const cand = candidateById.get(base.player.id)!
    const transform = applyPlayerProfileRedistributionCandidateA(legacy.find((r) => r.player.id === base.player.id)!.player)
    if (!transform.selected) recruitNonSelectedExact &&= JSON.stringify(base.player) === JSON.stringify(cand.player)
    rankMovement.push(Math.abs(cand.nationalRank - base.nationalRank))
  }
  recruitsBase.push(...baseline)
  recruitsCandidate.push(...candidate)
}
const recruitObs = (rows: readonly Recruit[]) => rows.map((r) => ({ stars: r.stars, overall: overall(r.player), potential: r.player.potential }))
const recruitDist = (rows: readonly Recruit[], field: 'overall' | 'potential') => summarize(rows.map((r) => field === 'overall' ? overall(r.player) : r.player.potential))
const starIds = (rows: readonly Recruit[], stars: number) => new Set(rows.filter((r) => r.stars === stars).map((r) => r.player.id))
const overlap = (a: Set<string>, b: Set<string>) => rate([...a].filter((id) => b.has(id)).length, a.size)

const report = {
  preregistration: { ...CANDIDATE_A_CONFIG, namespace: CANDIDATE_A_NAMESPACE },
  sample: { universes: UNIVERSES, players: pairs.length, positionCounts: Object.fromEntries(POSITIONS.map((p) => [p, basePlayers.filter((x) => x.position === p).length])), recruitClasses: RECRUIT_CLASSES, recruits: recruitsBase.length },
  selection: { selected: selected.length, rate: rate(selected.length, pairs.length), perUniverse: selected.length / UNIVERSES, applied: applied.length, genuinelySpecialized: applied.filter(({ baseline, result }) => deriveProfileShape(result.player.attributes).topTwoMinusBottomTwo - deriveProfileShape(baseline.attributes).topTwoMinusBottomTwo >= 8 && deriveProfileShape(result.player.attributes).weaknesses.below70 > 0).length, kind: { conventional: selected.filter((p) => p.result.kind === 'conventional').length, unusual: selected.filter((p) => p.result.kind === 'unusual-secondary').length, appliedConventional: applied.filter((p) => p.result.kind === 'conventional').length, appliedUnusual: applied.filter((p) => p.result.kind === 'unusual-secondary').length }, byPosition: Object.fromEntries(POSITIONS.map((p) => [p, selected.filter((x) => x.baseline.position === p).length])), byOvrBand: Object.fromEntries([['70-79', selected.filter((x) => x.result.baselineOverall < 80).length], ['80-84', selected.filter((x) => x.result.baselineOverall >= 80 && x.result.baselineOverall < 85).length], ['85-89', selected.filter((x) => x.result.baselineOverall >= 85 && x.result.baselineOverall < 90).length], ['90-94', selected.filter((x) => x.result.baselineOverall >= 90 && x.result.baselineOverall < 95).length], ['95+', selected.filter((x) => x.result.baselineOverall >= 95).length]]) },
  invariants: { nonSelectedExact, selectedIdentityExact, ovrGuardrail: selected.every((p) => Math.abs(p.result.candidateOverall - p.result.baselineOverall) <= 1), recruitNonSelectedExact },
  ovrMovement: Object.fromEntries([-1, 0, 1].map((d) => [String(d), selected.filter((p) => p.result.candidateOverall - p.result.baselineOverall === d).length]).concat([['other', selected.filter((p) => Math.abs(p.result.candidateOverall - p.result.baselineOverall) > 1).length]])),
  elite: Object.fromEntries([90,95,97].map((threshold) => [threshold, { baseline: basePlayers.filter((p) => overall(p) >= threshold).length / UNIVERSES, candidate: candidatePlayers.filter((p) => overall(p) >= threshold).length / UNIVERSES }])),
  shapes: { all: { baseline: shape(basePlayers), candidate: shape(candidatePlayers) }, selected: { baseline: shape(applied.map((p) => p.baseline)), candidate: shape(applied.map((p) => p.result.player)) }, elite85: { baseline: shape(basePlayers.filter((p) => overall(p) >= 85)), candidate: shape(candidatePlayers.filter((p) => overall(p) >= 85)) }, elite90: { baseline: shape(basePlayers.filter((p) => overall(p) >= 90)), candidate: shape(candidatePlayers.filter((p) => overall(p) >= 90)) }, elite95: { baseline: shape(basePlayers.filter((p) => overall(p) >= 95)), candidate: shape(candidatePlayers.filter((p) => overall(p) >= 95)) }, byPositionElite: Object.fromEntries([85, 90, 95].map((threshold) => [threshold, Object.fromEntries(POSITIONS.map((p) => [p, { baseline: shape(basePlayers.filter((x) => overall(x) >= threshold), p), candidate: shape(candidatePlayers.filter((x) => overall(x) >= threshold), p) }]))])) },
  correlation: Object.fromEntries(POSITIONS.map((p) => [p, { baseline: correlation(basePlayers, p), candidate: correlation(candidatePlayers, p) }])),
  positionAttributes: Object.fromEntries(POSITIONS.map((p) => [p, Object.fromEntries(PLAYER_ATTRIBUTE_KEYS.map((key) => [key, { baseline: attributeSummary(basePlayers.filter((x) => x.position === p), key), candidate: attributeSummary(candidatePlayers.filter((x) => x.position === p), key) }]))])),
  profiles: { baseline: profiles(basePlayers), candidate: profiles(candidatePlayers) }, examples,
  teamStrength: { baseline: summarize(strengths.map((x) => x.baseline)), candidate: summarize(strengths.map((x) => x.candidate)), meanDelta: average(strengths.map((x) => x.candidate - x.baseline)), maxAbsoluteDelta: Math.max(...strengths.map((x) => Math.abs(x.candidate - x.baseline))) },
  recruiting: { overall: { baseline: recruitDist(recruitsBase, 'overall'), candidate: recruitDist(recruitsCandidate, 'overall'), counts: Object.fromEntries([80,85,90].map((t) => [t, { baseline: recruitsBase.filter((r) => overall(r.player) >= t).length, candidate: recruitsCandidate.filter((r) => overall(r.player) >= t).length }])) }, potential: { baseline: recruitDist(recruitsBase, 'potential'), candidate: recruitDist(recruitsCandidate, 'potential'), counts: Object.fromEntries([90,95,99].map((t) => [t, { baseline: recruitsBase.filter((r) => r.player.potential >= t).length, candidate: recruitsCandidate.filter((r) => r.player.potential >= t).length }])) }, potGap: { baseline: summarizeRecruitPotGaps(recruitObs(recruitsBase)), candidate: summarizeRecruitPotGaps(recruitObs(recruitsCandidate)) }, stars: { fiveCounts: [starIds(recruitsBase, 5).size, starIds(recruitsCandidate, 5).size], fourCounts: [starIds(recruitsBase, 4).size, starIds(recruitsCandidate, 4).size], fiveOverlap: overlap(starIds(recruitsBase, 5), starIds(recruitsCandidate, 5)), fourOverlap: overlap(starIds(recruitsBase, 4), starIds(recruitsCandidate, 4)), rankMovement: summarize(rankMovement) } },
}
console.log(JSON.stringify(report, null, 2))
