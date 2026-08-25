import type { DynastyState } from '../src/dynasty'
import {
  RECRUITING_BOARD_LIMIT,
  deriveAiPositionCandidateUtility,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
} from '../src/dynasty'

export type EarlyMarketCandidate = 'baseline' | 'earlier-p4' | 'earlier-p6' | 'opportunity' | 'reach' | 'prestige-control'

const activePrograms = (dynasty: DynastyState, playerId: string) => Object.values(dynasty.recruiting!.programs)
  .filter((program) => program.programId !== dynasty.controlledProgramId && program.board.some((target) => target.playerId === playerId && deriveTargetStatus(dynasty.recruiting!, program.programId, playerId) === 'active')).length

/** Diagnostic-only pre-period board perturbation. Production Recruiting never imports this file. */
export function applyEarlyMarketCandidate(dynasty: DynastyState): DynastyState {
  const mode = process.env.RECRUIT_EARLY_MARKET_CANDIDATE as EarlyMarketCandidate | undefined
  if (!mode || mode === 'baseline' || !dynasty.recruiting || !dynasty.activeSeason) return dynasty
  const recruiting = dynasty.recruiting
  const period = recruiting.lastResolvedPeriod
  const programs = { ...recruiting.programs }
  const marketCounts = new Map(recruiting.recruits.map((recruit) => [recruit.player.id, activePrograms(dynasty, recruit.player.id)]))
  for (const programId of Object.keys(programs).sort()) {
    if (programId === dynasty.controlledProgramId) continue
    const program = programs[programId]!
    const prestige = dynasty.activeSeason.programStates[programId]!.team.prestige
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
    let board = [...program.board]
    const existing = new Set(board.map((target) => target.playerId))
    const candidates = recruiting.recruits.filter((recruit) =>
      recruit.nationalRank <= 25 && recruit.stars >= 4 && remaining[recruit.player.position] > 0 &&
      !recruiting.commitmentsByPlayerId[recruit.player.id] && !existing.has(recruit.player.id) &&
      (marketCounts.get(recruit.player.id) ?? 0) <= 1,
    ).map((recruit) => {
      const base = deriveAiPositionCandidateUtility(dynasty, recruiting, programId, recruit)
      const scarcity = Math.max(0, 2 - (marketCounts.get(recruit.player.id) ?? 0))
      const elite = (26 - recruit.nationalRank) / 25
      let adjustment = 0
      if (mode === 'earlier-p4' || mode === 'earlier-p6') adjustment = period >= (mode === 'earlier-p4' ? 3 : 5) ? 16 + 8 * elite : -999
      if (mode === 'opportunity') adjustment = period >= 2 ? scarcity * (7 + 5 * elite) : -999
      if (mode === 'reach') adjustment = period >= 2 && prestige >= 42 ? scarcity * (10 + 5 * elite) : -999
      if (mode === 'prestige-control') adjustment = Math.abs(recruit.positionRank - Math.max(1, Math.round(recruiting.recruits.filter((r) => r.player.position === recruit.player.position && !recruiting.commitmentsByPlayerId[r.player.id]).length * (1.08 - prestige * .0095))))
      return { recruit, utility: base + adjustment }
    }).sort((a, b) => b.utility - a.utility || a.recruit.nationalRank - b.recruit.nationalRank || a.recruit.player.id.localeCompare(b.recruit.player.id))
    const candidate = candidates[0]
    if (!candidate || candidate.utility < -18) continue
    if (mode === 'reach' && board.some((target) => {
      const recruit = recruiting.recruits.find((r) => r.player.id === target.playerId)
      return recruit && deriveAiPositionCandidateUtility(dynasty, recruiting, programId, recruit) < -18
    })) continue
    const target = { playerId: candidate.recruit.player.id, origin: 'assistant' as const, isFocused: false, hasActiveOffer: false }
    if (board.length < RECRUITING_BOARD_LIMIT) board.push(target)
    else {
      const replaceable = board.filter((entry) => !entry.hasActiveOffer && recruiting.recruits.find((r) => r.player.id === entry.playerId)?.player.position === candidate.recruit.player.position)
        .map((entry) => ({ entry, utility: deriveAiPositionCandidateUtility(dynasty, recruiting, programId, recruiting.recruits.find((r) => r.player.id === entry.playerId)!) }))
        .sort((a, b) => a.utility - b.utility || b.entry.playerId.localeCompare(a.entry.playerId))[0]
      if (!replaceable || candidate.utility < replaceable.utility + (mode === 'reach' ? 7 : 3)) continue
      board = board.map((entry) => entry.playerId === replaceable.entry.playerId ? target : entry)
    }
    existing.add(target.playerId)
    marketCounts.set(target.playerId, (marketCounts.get(target.playerId) ?? 0) + 1)
    programs[programId] = { ...program, board }
  }
  return { ...dynasty, recruiting: { ...recruiting, programs } }
}
