import {
  addRecruitingBoardTarget,
  initializeDynastyState,
  initializeRecruiting,
  offerRecruit,
  resolveRecruitingPeriod,
  syncRecruitingThroughCompletedPostseasonRounds,
  type DynastyState,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { initializeSeason, simulatePendingGamesInRound } from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const TRIALS = Number(process.env.TRIALS ?? 50)
const PROGRAM_IDS = ['pine-valley', 'charlotte-tech', 'northbridge'] as const
const STRATEGIES = [
  { label: 'Top 3 P3', targets: 3, priority: 3 },
  { label: 'Top 3 P5', targets: 3, priority: 5 },
  { label: 'Top 4 P5', targets: 4, priority: 5 },
  { label: 'Top 5 P5', targets: 5, priority: 5 },
  { label: 'Generated board', targets: 0, priority: 0 },
] as const

interface Outcome { targeted: number; signed: number; rank: number; signedRank: number; stars5: number; signed5: number; offers: number; competitors: number; controlledShare: number; aiShare: number }

function avg(values: readonly number[]) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0 }

function completeSeason(seed: string) {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  let season = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${seed}:schedule` }), seasonNumber: 1 })
  for (let round = 1; round <= season.schedule.roundCount; round += 1) season = simulatePendingGamesInRound({ season, round, simulationSeed: `${seed}:games` })
  return season
}

function createDynasty(seed: string, programId: string): DynastyState {
  const season = completeSeason(seed)
  return initializeRecruiting(initializeDynastyState({ dynastyId: `strategy:${seed}:${programId}`, dynastySeed: seed, controlledProgramId: programId, universe: UNIVERSE_V0, activeSeason: season }))
}

function boardShare(dynasty: DynastyState, programId: string, playerId: string): number {
  const board = dynasty.recruiting!.programs[programId]!.board
  const target = board.find((entry) => entry.playerId === playerId)
  const total = board.reduce((sum, entry) => sum + entry.priority, 0)
  return target && total ? target.priority / total : 0
}

function configure(dynasty: DynastyState, targets: number, priority: number): { dynasty: DynastyState; targetIds: string[] } {
  if (targets === 0) return { dynasty, targetIds: dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.map(({ playerId }) => playerId) }
  const controlled = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
  let current: DynastyState = { ...dynasty, recruiting: { ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs, [controlled.programId]: { ...controlled, board: [] } } } }
  const targetIds: string[] = []
  for (const recruit of current.recruiting!.recruits) {
    if (targetIds.length === targets) break
    try {
      current = addRecruitingBoardTarget({ dynasty: current, playerId: recruit.player.id, priority })
      current = offerRecruit({ dynasty: current, playerId: recruit.player.id })
      targetIds.push(recruit.player.id)
    } catch { /* Not legally offerable for this Program; try the next national rank. */ }
  }
  return { dynasty: current, targetIds }
}

function resolve(dynasty: DynastyState): DynastyState {
  let current = dynasty
  for (let period = 1; period <= 24; period += 1) current = resolveRecruitingPeriod(current, period)
  let postseason = initializePostseason({ universe: current.universe, season: current.activeSeason! })
  for (const round of TOURNAMENT_ROUNDS) postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: `${current.dynastySeed}:postseason` })
  return syncRecruitingThroughCompletedPostseasonRounds({ ...current, activePostseason: postseason })
}

console.log(`RECRUITING STRATEGY DIAGNOSTIC — ${TRIALS} deterministic trials`) 
console.log('Selection: highest national-rank Recruits that can be added and legally offered by the selected Program.\n')
console.log('Program           Strategy          Sign %  Targets  Avg RK  5★ Signed  Avg Offers  Pursuers  Ctrl Share  AI Share')
for (const programId of PROGRAM_IDS) {
  const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)!
  for (const strategy of STRATEGIES) {
    const rows: Outcome[] = []
    for (let trial = 0; trial < TRIALS; trial += 1) {
      const configured = configure(createDynasty(`recruiting-strategy:${trial}`, programId), strategy.targets, strategy.priority)
      const recruiting = configured.dynasty.recruiting!
      const snapshots = configured.targetIds.map((playerId) => {
        const competitors = Object.values(recruiting.programs).filter(({ board }) => board.some((entry) => entry.playerId === playerId)).length
        const aiShares = Object.keys(recruiting.programs).filter((id) => id !== programId).map((id) => boardShare(configured.dynasty, id, playerId)).filter(Boolean)
        return { playerId, competitors, controlledShare: boardShare(configured.dynasty, programId, playerId), aiShare: avg(aiShares) }
      })
      const final = resolve(configured.dynasty).recruiting!
      const selected = snapshots.map(({ playerId }) => recruiting.recruits.find((r) => r.player.id === playerId)!)
      const signed = selected.filter(({ player }) => final.commitmentsByPlayerId[player.id]?.programId === programId)
      rows.push({ targeted: selected.length, signed: signed.length, rank: avg(selected.map(({ nationalRank }) => nationalRank)), signedRank: avg(signed.map(({ nationalRank }) => nationalRank)), stars5: selected.filter(({ stars }) => stars === 5).length, signed5: signed.filter(({ stars }) => stars === 5).length, offers: selected.length, competitors: avg(snapshots.map(({ competitors }) => competitors)), controlledShare: avg(snapshots.map(({ controlledShare }) => controlledShare)), aiShare: avg(snapshots.map(({ aiShare }) => aiShare)) })
    }
    const targeted = rows.reduce((sum, row) => sum + row.targeted, 0)
    const signed = rows.reduce((sum, row) => sum + row.signed, 0)
    console.log(`${program.name.padEnd(17)} ${strategy.label.padEnd(17)} ${`${(100 * signed / Math.max(1, targeted)).toFixed(1)}%`.padEnd(7)} ${avg(rows.map((r) => r.targeted)).toFixed(1).padEnd(8)} ${avg(rows.map((r) => r.rank)).toFixed(1).padEnd(7)} ${(rows.reduce((sum, r) => sum + r.signed5, 0) / Math.max(1, rows.reduce((sum, r) => sum + r.stars5, 0))).toFixed(2).padEnd(10)} ${avg(rows.map((r) => r.offers)).toFixed(1).padEnd(11)} ${avg(rows.map((r) => r.competitors)).toFixed(1).padEnd(9)} ${(100 * avg(rows.map((r) => r.controlledShare))).toFixed(1).padEnd(10)} ${(100 * avg(rows.map((r) => r.aiShare))).toFixed(1)}`)
  }
}
console.log('\nATTENTION CONCENTRATION: equal priorities yield equal normalized effort; P3/P3/P3 and P5/P5/P5 each give 33.3% per target. Board sizes 3, 4, and 5 yield 33.3%, 25.0%, and 20.0% respectively.')
console.log('Competition counts are programs with the Recruit on their board at strategy setup; no new serious-competitor threshold is invented.')
