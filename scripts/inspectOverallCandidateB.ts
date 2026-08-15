import { calculateOverall, calculateTeamStrength, generateDefaultRotation, POSITIONS, type Player, type PlayerAttributes, type Position, type Rotation, type Team } from '../src/engine'
import { initializeDynastyState, type Recruit, type RecruitStarRating } from '../src/dynasty'
import { generateLegacyRecruitingClass } from '../src/dynasty/recruiting/generation'
import { finalizeRecruitPotential } from '../src/dynasty/recruiting/potential'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import { deriveProfileShape, PLAYER_ATTRIBUTE_KEYS } from './playerProfileSpecializationMetrics'
import { applyPlayerProfileRedistributionCandidateAV2 } from './playerProfileRedistributionCandidateAV2'
import { calculateOverallCandidateB, explainOverallCandidateB, OVR_CANDIDATE_B_CONFIG } from './overallCandidateB'
import { generateOverallCandidateBRotation } from './overallCandidateBRotation'
import { pearsonCorrelation, percentile, summarize } from './playerStatisticalIdentityMetrics'
import { summarizeRecruitPotGaps } from './talentPotGapMetrics'
import { applyCandidateBToRecruitingClass } from './recruitPotGapCandidateB'

const UNIVERSES = 250
const CLASSES = Number(process.env.CLASSES ?? 500)
type Row = { baseline: Player; candidateA: Player; selected: boolean; kind?: string; current: number; candidateBaseline: number; currentA: number; candidateCombined: number }
const rows: Row[] = []
const teamRows: { baselineStrength: number; candidateStrength: number; memberOverlap: number; starterOverlap: number; minuteMae: number }[] = []
const generationSeed = (index: number) => `player-statistical-identity-v1:generation:${String(index + 1).padStart(3, '0')}`
const overlap = (first: Set<string>, second: Set<string>) => [...first].filter((id) => second.has(id)).length / Math.max(1, first.size)
const members = (rotation: Rotation) => new Set(Object.keys(rotation.minutes))
const starters = (rotation: Rotation) => new Set(Object.entries(rotation.minutes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 5).map(([id]) => id))

for (let index = 0; index < UNIVERSES; index += 1) {
  const universe = initializeUniverse(UNIVERSE_V0, generationSeed(index))
  for (const state of universe.programs) {
    const candidateRoster = state.team.roster.map((baseline) => {
      const transformed = applyPlayerProfileRedistributionCandidateAV2(baseline)
      rows.push({ baseline, candidateA: transformed.player, selected: transformed.selected, kind: transformed.kind, current: calculateOverall(baseline), candidateBaseline: calculateOverallCandidateB(baseline), currentA: calculateOverall(transformed.player), candidateCombined: calculateOverallCandidateB(transformed.player) })
      return transformed.player
    })
    const team: Team = { ...state.team, roster: candidateRoster }
    const currentRotation = generateDefaultRotation(team)
    const candidateRotation = generateOverallCandidateBRotation(team, calculateOverallCandidateB)
    const currentMinutes = currentRotation.minutes
    const candidateMinutes = candidateRotation.minutes
    teamRows.push({ baselineStrength: calculateTeamStrength(team, currentRotation).overall, candidateStrength: calculateTeamStrength(team, candidateRotation).overall, memberOverlap: overlap(members(currentRotation), members(candidateRotation)), starterOverlap: overlap(starters(currentRotation), starters(candidateRotation)), minuteMae: team.roster.reduce((sum, player) => sum + Math.abs((currentMinutes[player.id] ?? 0) - (candidateMinutes[player.id] ?? 0)), 0) / team.roster.length })
  }
}

const values = (key: keyof Pick<Row, 'current' | 'candidateBaseline' | 'currentA' | 'candidateCombined'>, position?: Position) => rows.filter((row) => !position || row.baseline.position === position).map((row) => row[key])
const dist = (numbers: readonly number[]) => ({ ...summarize(numbers), p95: percentile(numbers, .95), p99: percentile(numbers, .99), at80: numbers.filter((v) => v >= 80).length, at85: numbers.filter((v) => v >= 85).length, at90: numbers.filter((v) => v >= 90).length, at95: numbers.filter((v) => v >= 95).length, at97: numbers.filter((v) => v >= 97).length })
const movement = (before: readonly number[], after: readonly number[]) => { const moves = after.map((value, index) => value - before[index]!); const abs = moves.map(Math.abs); return { mean: summarize(moves).mean, median: summarize(moves).median, meanAbsolute: summarize(abs).mean, p90Absolute: percentile(abs, .9), maximumAbsolute: Math.max(...abs), buckets: { leMinus5: moves.filter((x) => x <= -5).length, minus4ToMinus2: moves.filter((x) => x >= -4 && x <= -2).length, minus1ToPlus1: moves.filter((x) => x >= -1 && x <= 1).length, plus2ToPlus4: moves.filter((x) => x >= 2 && x <= 4).length, gePlus5: moves.filter((x) => x >= 5).length } } }
const relevant: Readonly<Record<Position, readonly (keyof PlayerAttributes)[]>> = { PG: ['shooting','playmaking','ballHandling','perimeterDefense','finishing'], SG: ['finishing','shooting','ballHandling','perimeterDefense','playmaking'], SF: PLAYER_ATTRIBUTE_KEYS.filter((x) => x !== 'stamina'), PF: ['finishing','interiorDefense','rebounding','athleticism'], C: ['finishing','interiorDefense','rebounding','athleticism'] }
const complete = rows.filter((row) => row.current >= 90 && relevant[row.baseline.position].every((key) => row.baseline.attributes[key] >= 75))
const classify = (row: Row) => row.selected ? row.kind : relevant[row.baseline.position].every((key) => row.baseline.attributes[key] >= 75) ? 'complete' : 'ordinary'
const entrant = (threshold: number) => rows.filter((r) => r.currentA < threshold && r.candidateCombined >= threshold)
const demotion = (threshold: number) => rows.filter((r) => r.currentA >= threshold && r.candidateCombined < threshold)
const example = (row: Row) => ({ id: row.baseline.id, position: row.baseline.position, classification: classify(row), attributes: row.candidateA.attributes, current: row.currentA, candidate: row.candidateCombined, explanation: explainOverallCandidateB(row.candidateA) })

const attrs = (finishing: number, shooting: number, playmaking: number, ballHandling: number, perimeterDefense: number, interiorDefense: number, rebounding: number, athleticism: number, stamina: number): PlayerAttributes => ({ finishing, shooting, playmaking, ballHandling, perimeterDefense, interiorDefense, rebounding, athleticism, stamina })
const probe = (name: string, position: Position, attributes: PlayerAttributes): Player => ({ id: `probe-${name}`, firstName: 'Probe', lastName: name, position, classYear: 'SR', height: 80, potential: 99, attributes })
const probes = [
  probe('SG offense-first','SG',attrs(97,98,85,94,60,45,48,94,90)), probe('SG two-way','SG',attrs(95,96,83,92,94,55,65,92,90)), probe('SG playmaker','SG',attrs(91,92,97,97,65,48,52,91,90)), probe('SG defensive','SG',attrs(82,80,70,78,98,65,62,96,91)),
  probe('C traditional','C',attrs(98,45,48,45,55,98,99,94,91)), probe('C rim-running','C',attrs(88,43,45,44,55,99,99,98,92)), probe('C stretch','C',attrs(88,94,62,60,65,88,86,86,90)), probe('C playmaker','C',attrs(88,72,97,90,70,86,84,88,91)),
  probe('PG offense-first','PG',attrs(92,98,98,98,58,42,48,92,91)), probe('SF point-forward','SF',attrs(88,85,97,94,78,70,78,90,91)), probe('PF point-forward','PF',attrs(90,78,96,91,78,82,82,90,91)), probe('SF defense-rebound','SF',attrs(82,72,68,70,92,92,96,93,90)), probe('complete superstar','SF',attrs(95,95,94,94,95,93,94,95,93)),
]
const controlled = probes.map((player) => ({ profile: player.lastName, current: calculateOverall(player), candidate: calculateOverallCandidateB(player), explanation: explainOverallCandidateB(player) }))
const exploit = POSITIONS.flatMap((position) => [1,2].map((count) => { const attributes = attrs(65,65,65,65,65,65,65,65,65); attributes.shooting = 99; if (count === 2) attributes.athleticism = 99; const player = probe(`${position}-${count}-skill`, position, attributes); return { position, extremeSkills: count, current: calculateOverall(player), candidate: calculateOverallCandidateB(player) } }))
const weaknessSensitivity = [80,70,60,50].flatMap((rating) => [
  (() => { const p = probe(`SG defense ${rating}`,'SG',attrs(95,96,90,94,rating,55,60,92,90)); return { profile: 'SG defense', rating, candidate: calculateOverallCandidateB(p) } })(),
  (() => { const p = probe(`PG defense ${rating}`,'PG',attrs(92,96,96,96,rating,45,50,92,90)); return { profile: 'PG defense', rating, candidate: calculateOverallCandidateB(p) } })(),
  (() => { const p = probe(`C shooting ${rating}`,'C',attrs(96,rating,55,55,60,96,97,93,90)); return { profile: 'C shooting', rating, candidate: calculateOverallCandidateB(p) } })(),
])

function starsForRank(rank: number, size: number): RecruitStarRating { if (rank <= Math.ceil(size*.06)) return 5; if (rank <= Math.ceil(size*.26)) return 4; if (rank <= Math.ceil(size*.72)) return 3; return 2 }
function experimentalClass(legacy: readonly Recruit[], dynastySeed: string, transform: boolean) {
  const rows = legacy.map((recruit) => { const player = transform ? applyPlayerProfileRedistributionCandidateAV2(recruit.player).player : recruit.player; const overall = calculateOverallCandidateB(player); const finalized = finalizeRecruitPotential({ overall, rawCeiling: recruit.player.potential, dynastySeed, targetSeasonNumber: 2, playerId: player.id }); return { ...recruit, player: { ...player, potential: finalized.potential }, qualityScore: Number((overall*.56 + finalized.potential*.44).toFixed(2)), experimentalOverall: overall, eligible: finalized.eligible } })
  const ranked = rows.slice().sort((a,b) => b.qualityScore-a.qualityScore || b.experimentalOverall-a.experimentalOverall || b.player.potential-a.player.potential || a.player.id.localeCompare(b.player.id)); const pos = Object.fromEntries(POSITIONS.map((p) => [p,0])) as Record<Position,number>
  return ranked.map((row,index) => ({ ...row, nationalRank:index+1, positionRank:++pos[row.player.position], stars:starsForRank(index+1,ranked.length) }))
}
const recruitBase: Recruit[] = [], recruitA: Recruit[] = [], recruitB: ReturnType<typeof experimentalClass> = [], recruitAB: ReturnType<typeof experimentalClass> = []
let up78=0, down78=0
let baselineEligible=0
for (let index=0; index<CLASSES; index+=1) { const seed=`candidate-b-ovr:${index}`; const initialized=initializeUniverse(UNIVERSE_V0,`${seed}:universe`); const season=initializeSeason({universe:UNIVERSE_V0,initializedUniverse:initialized,schedule:generateRegularSeasonSchedule({universe:UNIVERSE_V0,seed:`${seed}:schedule`}),seasonNumber:1}); initializeDynastyState({dynastyId:seed,dynastySeed:seed,controlledProgramId:'charlotte-tech',universe:UNIVERSE_V0,activeSeason:season}); const legacy=generateLegacyRecruitingClass({dynastySeed:seed,targetSeasonNumber:2,season}); const frozenBaseline=applyCandidateBToRecruitingClass(legacy,seed,2); const base=experimentalClass(legacy,seed,false); const combined=experimentalClass(legacy,seed,true); recruitBase.push(...frozenBaseline); recruitA.push(...legacy.map((r)=>({...r,player:applyPlayerProfileRedistributionCandidateAV2(r.player).player}))); recruitB.push(...base); recruitAB.push(...combined); baselineEligible+=frozenBaseline.filter((r)=>r.candidateB.eligible).length; for (const recruit of legacy) { const a=applyPlayerProfileRedistributionCandidateAV2(recruit.player).player; const before=calculateOverall(a), after=calculateOverallCandidateB(a); if(before<78&&after>=78)up78+=1;if(before>=78&&after<78)down78+=1 } }
const recruitDist=(items:readonly {player:Player}[], scorer:(p:Player)=>number)=>dist(items.map((r)=>scorer(r.player)))
const recruitObs=(items:readonly (Recruit & {experimentalOverall?:number})[], scorer:(p:Player)=>number)=>items.map((r)=>({stars:r.stars,overall:r.experimentalOverall??scorer(r.player),potential:r.player.potential}))
const stars=(items:readonly Recruit[], star:number)=>new Set(items.filter((r)=>r.stars===star).map((r)=>r.player.id))
const baselineRank=new Map(recruitBase.map((r)=>[r.player.id,r.nationalRank]))
const rankMoves=recruitAB.map((r)=>Math.abs(r.nationalRank-baselineRank.get(r.player.id)!))

console.log(JSON.stringify({ formula:OVR_CANDIDATE_B_CONFIG, sample:{universes:UNIVERSES,players:rows.length,teams:teamRows.length,recruitClasses:CLASSES,recruits:recruitBase.length}, controlled, exploit, weaknessSensitivity, populations:{baselineCurrent:dist(values('current')),baselineCandidate:dist(values('candidateBaseline')),candidateACurrent:dist(values('currentA')),combined:dist(values('candidateCombined'))}, byPosition:Object.fromEntries(POSITIONS.map((p)=>[p,{baselineCurrent:dist(values('current',p)),baselineCandidate:dist(values('candidateBaseline',p)),candidateACurrent:dist(values('currentA',p)),combined:dist(values('candidateCombined',p))}])), movement:{baseline:movement(values('current'),values('candidateBaseline')),candidateA:movement(values('currentA'),values('candidateCombined')),byPosition:Object.fromEntries(POSITIONS.map((p)=>[p,movement(values('currentA',p),values('candidateCombined',p))])),selected:movement(rows.filter((r)=>r.selected).map((r)=>r.currentA),rows.filter((r)=>r.selected).map((r)=>r.candidateCombined)),selectedConventional:movement(rows.filter((r)=>r.kind==='conventional').map((r)=>r.currentA),rows.filter((r)=>r.kind==='conventional').map((r)=>r.candidateCombined)),selectedUnusual:movement(rows.filter((r)=>r.kind==='unusual-secondary').map((r)=>r.currentA),rows.filter((r)=>r.kind==='unusual-secondary').map((r)=>r.candidateCombined))}, complete:{count:complete.length,movement:movement(complete.map((r)=>r.current),complete.map((r)=>r.candidateBaseline)),largeDemotionRate:complete.filter((r)=>r.candidateBaseline-r.current<=-5).length/Math.max(1,complete.length)}, entrants:{at90:entrant(90).length,at95:entrant(95).length,classification90:Object.fromEntries(['complete','conventional','unusual-secondary','ordinary'].map((kind)=>[kind,entrant(90).filter((r)=>classify(r)===kind).length])),examples90:entrant(90).slice(0,5).map(example),examples95:entrant(95).slice(0,5).map(example)}, demotions:{at90:demotion(90).length,at95:demotion(95).length,examples90:demotion(90).slice(0,5).map(example)}, eliteShape:{at90:deriveProfileShapeFromRows(rows.filter((r)=>r.candidateCombined>=90)),at95:deriveProfileShapeFromRows(rows.filter((r)=>r.candidateCombined>=95))}, rotation:{starterOverlap:summarize(teamRows.map((r)=>r.starterOverlap)),memberOverlap:summarize(teamRows.map((r)=>r.memberOverlap)),minuteMae:summarize(teamRows.map((r)=>r.minuteMae))}, teamStrength:{baseline:summarize(teamRows.map((r)=>r.baselineStrength)),candidate:summarize(teamRows.map((r)=>r.candidateStrength)),meanMovement:summarize(teamRows.map((r)=>r.candidateStrength-r.baselineStrength)).mean,rankCorrelation:pearsonCorrelation(teamRows.map((r)=>r.baselineStrength),teamRows.map((r)=>r.candidateStrength))}, recruiting:{distributions:{baselineCurrent:recruitDist(recruitBase,calculateOverall),candidateACurrent:recruitDist(recruitA,calculateOverall),baselineCandidate:recruitDist(recruitB,(p)=>calculateOverallCandidateB(p)),combined:recruitDist(recruitAB,(p)=>calculateOverallCandidateB(p))},eligibilityBoundary:{up78,down78,baselineEligible,baselineRate:baselineEligible/recruitBase.length,totalEligible:recruitAB.filter((r)=>r.eligible).length,rate:recruitAB.filter((r)=>r.eligible).length/recruitAB.length},pot:{baseline:dist(recruitBase.map((r)=>r.player.potential)),candidate:dist(recruitAB.map((r)=>r.player.potential))},potGap:{baseline:summarizeRecruitPotGaps(recruitObs(recruitBase,calculateOverall)),candidate:summarizeRecruitPotGaps(recruitObs(recruitAB as Recruit[],calculateOverallCandidateB))},potInvariants:{negative:recruitAB.filter((r)=>r.player.potential<r.experimentalOverall).length,above99:recruitAB.filter((r)=>r.player.potential>99).length},stars:{fiveCounts:[stars(recruitBase,5).size,stars(recruitAB as Recruit[],5).size],fourCounts:[stars(recruitBase,4).size,stars(recruitAB as Recruit[],4).size],fiveOverlap:overlap(stars(recruitBase,5),stars(recruitAB as Recruit[],5)),fourOverlap:overlap(stars(recruitBase,4),stars(recruitAB as Recruit[],4)),rankMovement:summarize(rankMoves)}}, developmentDependency:'Development V1 uses production calculateOverall for headroom, target, and POT caps; experimental Candidate B was not injected.'},null,2))

function deriveProfileShapeFromRows(items:readonly Row[]){const shapes=items.map((r)=>deriveProfileShape(r.candidateA.attributes));return{count:items.length,spread:summarize(shapes.map((s)=>s.spread)).mean,gap:summarize(shapes.map((s)=>s.topTwoMinusBottomTwo)).mean,anyBelow70:shapes.filter((s)=>s.weaknesses.below70>0).length/Math.max(1,shapes.length),anyBelow60:shapes.filter((s)=>s.weaknesses.below60>0).length/Math.max(1,shapes.length),positions:Object.fromEntries(POSITIONS.map((p)=>[p,items.filter((r)=>r.baseline.position===p).length])),kinds:Object.fromEntries(['complete','conventional','unusual-secondary','ordinary'].map((kind)=>[kind,items.filter((r)=>classify(r)===kind).length]))}}
