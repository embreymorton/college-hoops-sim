import {
  addRecruitingBoardTarget,
  initializeDynastyState,
  initializeRecruiting,
  offerRecruit,
  setRecruitingFocus,
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
  { label: 'Top 3 — all focused', targets: 3, focusCount: 3 },
  { label: 'Top 4 — best 3 focused', targets: 4, focusCount: 3 },
  { label: 'Top 5 — best 3 focused', targets: 5, focusCount: 3 },
  { label: 'Generated board', targets: 0, focusCount: 0 },
] as const

interface Outcome { targeted: number; signed: number; rank: number; signedRank: number; stars5: number; signed5: number; offers: number; competitors: number; controlledEffort: number; aiEffort: number }

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

function boardEffort(dynasty: DynastyState, programId: string, playerId: string): number {
  const board = dynasty.recruiting!.programs[programId]!.board
  const target = board.find((entry) => entry.playerId === playerId)
  return target ? (target.isFocused ? 6 : 3) : 0
}

function configure(dynasty: DynastyState, targets: number, focusCount: number): { dynasty: DynastyState; targetIds: string[] } {
  if (targets === 0) return { dynasty, targetIds: dynasty.recruiting!.programs[dynasty.controlledProgramId!]!.board.map(({ playerId }) => playerId) }
  const controlled = dynasty.recruiting!.programs[dynasty.controlledProgramId!]!
  let current: DynastyState = { ...dynasty, recruiting: { ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs, [controlled.programId]: { ...controlled, board: [] } } } }
  const targetIds: string[] = []
  for (const recruit of current.recruiting!.recruits) {
    if (targetIds.length === targets) break
    try {
      current = addRecruitingBoardTarget({ dynasty: current, playerId: recruit.player.id })
      current = offerRecruit({ dynasty: current, playerId: recruit.player.id })
      if (targetIds.length < focusCount) current = setRecruitingFocus({ dynasty: current, playerId: recruit.player.id, isFocused: true })
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
console.log('Program           Strategy                    Sign %  Targets  Avg RK  5★ Signed  Avg Offers  Pursuers  Ctrl Effort  AI Effort')
for (const programId of PROGRAM_IDS) {
  const program = UNIVERSE_V0.programs.find(({ id }) => id === programId)!
  for (const strategy of STRATEGIES) {
    const rows: Outcome[] = []
    for (let trial = 0; trial < TRIALS; trial += 1) {
      const configured = configure(createDynasty(`recruiting-strategy:${trial}`, programId), strategy.targets, strategy.focusCount)
      const recruiting = configured.dynasty.recruiting!
      const snapshots = configured.targetIds.map((playerId) => {
        const competitors = Object.values(recruiting.programs).filter(({ board }) => board.some((entry) => entry.playerId === playerId)).length
        const aiEfforts = Object.keys(recruiting.programs).filter((id) => id !== programId).map((id) => boardEffort(configured.dynasty, id, playerId)).filter(Boolean)
        return { playerId, competitors, controlledEffort: boardEffort(configured.dynasty, programId, playerId), aiEffort: avg(aiEfforts) }
      })
      const final = resolve(configured.dynasty).recruiting!
      const selected = snapshots.map(({ playerId }) => recruiting.recruits.find((r) => r.player.id === playerId)!)
      const signed = selected.filter(({ player }) => final.commitmentsByPlayerId[player.id]?.programId === programId)
      rows.push({ targeted: selected.length, signed: signed.length, rank: avg(selected.map(({ nationalRank }) => nationalRank)), signedRank: avg(signed.map(({ nationalRank }) => nationalRank)), stars5: selected.filter(({ stars }) => stars === 5).length, signed5: signed.filter(({ stars }) => stars === 5).length, offers: selected.length, competitors: avg(snapshots.map(({ competitors }) => competitors)), controlledEffort: avg(snapshots.map(({ controlledEffort }) => controlledEffort)), aiEffort: avg(snapshots.map(({ aiEffort }) => aiEffort)) })
    }
    const targeted = rows.reduce((sum, row) => sum + row.targeted, 0)
    const signed = rows.reduce((sum, row) => sum + row.signed, 0)
    console.log(`${program.name.padEnd(17)} ${strategy.label.padEnd(27)} ${`${(100 * signed / Math.max(1, targeted)).toFixed(1)}%`.padEnd(7)} ${avg(rows.map((r) => r.targeted)).toFixed(1).padEnd(8)} ${avg(rows.map((r) => r.rank)).toFixed(1).padEnd(7)} ${(rows.reduce((sum, r) => sum + r.signed5, 0) / Math.max(1, rows.reduce((sum, r) => sum + r.stars5, 0))).toFixed(2).padEnd(10)} ${avg(rows.map((r) => r.offers)).toFixed(1).padEnd(11)} ${avg(rows.map((r) => r.competitors)).toFixed(1).padEnd(9)} ${avg(rows.map((r) => r.controlledEffort)).toFixed(1).padEnd(12)} ${avg(rows.map((r) => r.aiEffort)).toFixed(1)}`)
  }
}
console.log('\nEFFORT MODEL: every active board target receives 3 effort; each focused target receives +3. Neither value changes with Board size or unused Focus slots.')
console.log('Competition counts are programs with the Recruit on their board at strategy setup; no new serious-competitor threshold is invented.')
