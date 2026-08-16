import { POSITIONS, type Position } from '../../engine'
import type { DynastyState } from '../domain'
import { PRESTIGE_SENSITIVITY } from './constants'
import type {
  PositionCounts,
  ProgramRecruitingBoard,
  Recruit,
  RecruitingCommitment,
  RecruitingProgramState,
  RecruitProgramStanding,
  RecruitingState,
  RecruitingTargetStatus,
} from './domain'
import { createRng } from '../../engine'
import { isTournamentComplete } from '../../postseason'
import { FINAL_RECRUITING_PERIOD } from './constants'

export function getRecruit(
  recruiting: RecruitingState,
  playerId: string,
): Recruit | undefined {
  return recruiting.recruits.find(({ player }) => player.id === playerId)
}

/** Canonical lifecycle eligibility for the explicit Tournament → Late Recruiting handoff. */
export function canEnterLateRecruiting(dynasty: DynastyState): boolean {
  const recruiting = dynasty.recruiting
  const postseason = dynasty.activePostseason
  return Boolean(
    postseason &&
      isTournamentComplete(postseason) &&
      recruiting &&
      recruiting.phase !== 'late' &&
      recruiting.phase !== 'finalized' &&
      recruiting.lastResolvedPeriod === FINAL_RECRUITING_PERIOD,
  )
}

export function deriveRecruitNationalRank(recruit: Recruit): number {
  return recruit.nationalRank
}

export function deriveRecruitPositionRank(recruit: Recruit): number {
  return recruit.positionRank
}

export function deriveRecruitStarRating(recruit: Recruit): Recruit['stars'] {
  return recruit.stars
}

function affinitySeed(
  dynasty: Pick<DynastyState, 'dynastySeed'>,
  recruiting: RecruitingState,
  playerId: string,
  programId: string,
): string {
  return JSON.stringify({
    recruitingVersion: 'v0',
    dynastySeed: { type: typeof dynasty.dynastySeed, value: dynasty.dynastySeed },
    targetSeasonNumber: recruiting.targetSeasonNumber,
    stream: 'program-affinity',
    playerId,
    programId,
  })
}

/** Derived immutable-at-runtime attraction: quality-sensitive prestige plus affinity. */
export function deriveBaseRecruitAttraction(
  dynasty: DynastyState,
  recruit: Recruit,
  programId: string,
): number {
  const team = dynasty.activeSeason?.programStates[programId]?.team
  if (!team) throw new RangeError(`Unknown active-season Program "${programId}".`)
  const affinity = createRng(
    affinitySeed(dynasty, dynasty.recruiting!, recruit.player.id, programId),
  ).int(-12, 12)
  return Number((20 + team.prestige * PRESTIGE_SENSITIVITY[recruit.stars] + affinity).toFixed(2))
}

export function deriveRecruitProgramStandings(
  dynasty: DynastyState,
  playerId: string,
): RecruitProgramStanding[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)

  const standings = Object.keys(recruiting.programs).sort().map((programId) => {
    const baseAttraction = deriveBaseRecruitAttraction(dynasty, recruit, programId)
    const relationshipProgress = recruiting.relationshipProgressByPlayerId[playerId]?.[programId] ?? 0
    return {
      rank: 0,
      programId,
      baseAttraction,
      relationshipProgress,
      standing: Number((baseAttraction + relationshipProgress).toFixed(4)),
    }
  }).sort((first, second) =>
    second.standing - first.standing || first.programId.localeCompare(second.programId),
  )

  return standings.map((standing, index) => ({ ...standing, rank: index + 1 }))
}

export function deriveProgramCommitments(
  recruiting: RecruitingState,
  programId: string,
): RecruitingCommitment[] {
  return Object.values(recruiting.commitmentsByPlayerId)
    .filter((commitment) => commitment.programId === programId)
    .sort((first, second) => {
      const firstPeriod = first.timing.kind === 'period' ? first.timing.period : Number.MAX_SAFE_INTEGER
      const secondPeriod = second.timing.kind === 'period' ? second.timing.period : Number.MAX_SAFE_INTEGER
      return firstPeriod - secondPeriod || first.playerId.localeCompare(second.playerId)
    })
}

export function deriveRemainingOpeningsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const committedCounts = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
  for (const commitment of deriveProgramCommitments(recruiting, program.programId)) {
    const recruit = getRecruit(recruiting, commitment.playerId)
    if (recruit) committedCounts[recruit.player.position] += 1
  }
  return Object.fromEntries(POSITIONS.map((position) => [
    position,
    Math.max(0, program.projectedOpeningsByPosition[position] - committedCounts[position]),
  ])) as PositionCounts
}

export function deriveActiveOfferCountsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const counts = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
  for (const target of program.board) {
    if (!target.hasActiveOffer || deriveTargetStatus(recruiting, program.programId, target.playerId) !== 'active') continue
    const recruit = getRecruit(recruiting, target.playerId)
    if (recruit) counts[recruit.player.position] += 1
  }
  return counts
}

export function deriveAvailableOfferSlotsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  const activeOffers = deriveActiveOfferCountsByPosition(recruiting, program)
  return Object.fromEntries(POSITIONS.map((position) => [
    position,
    Math.max(0, remaining[position] - activeOffers[position]),
  ])) as PositionCounts
}

export function deriveTargetStatus(
  recruiting: RecruitingState,
  programId: string,
  playerId: string,
): RecruitingTargetStatus {
  const commitment = recruiting.commitmentsByPlayerId[playerId]
  if (commitment) return commitment.programId === programId ? 'committed' : 'committed-elsewhere'
  const recruit = getRecruit(recruiting, playerId)
  const program = recruiting.programs[programId]
  if (!recruit || !program) throw new RangeError('Unknown Recruiting target.')
  return deriveRemainingOpeningsByPosition(recruiting, program)[recruit.player.position] > 0
    ? 'active'
    : 'position-filled'
}

export function deriveProgramRecruitingBoard(
  dynasty: DynastyState,
  programId: string,
): ProgramRecruitingBoard {
  const recruiting = dynasty.recruiting
  const program = recruiting?.programs[programId]
  if (!recruiting || !program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  const standingByPlayer = new Map(
    program.board.map(({ playerId }) => [
      playerId,
      deriveRecruitProgramStandings(dynasty, playerId).find((entry) => entry.programId === programId)!.rank,
    ]),
  )
  return {
    programId,
    projectedOpeningsByPosition: program.projectedOpeningsByPosition,
    remainingOpeningsByPosition: deriveRemainingOpeningsByPosition(recruiting, program),
    activeOfferCountsByPosition: deriveActiveOfferCountsByPosition(recruiting, program),
    availableOfferSlotsByPosition: deriveAvailableOfferSlotsByPosition(recruiting, program),
    targets: program.board.map((target) => ({
      ...target,
      isFocused: target.isFocused ?? false,
      status: deriveTargetStatus(recruiting, programId, target.playerId),
      relationshipProgress: recruiting.relationshipProgressByPlayerId[target.playerId]?.[programId] ?? 0,
      standingRank: standingByPlayer.get(target.playerId)!,
    })),
  }
}

export function hasRemainingPositionNeed(
  recruiting: RecruitingState,
  programId: string,
  position: Position,
): boolean {
  const program = recruiting.programs[programId]
  return Boolean(program && deriveRemainingOpeningsByPosition(recruiting, program)[position] > 0)
}
