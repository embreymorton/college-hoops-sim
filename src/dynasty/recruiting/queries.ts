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

export function getRecruit(
  recruiting: RecruitingState,
  playerId: string,
): Recruit | undefined {
  return recruiting.recruits.find(({ player }) => player.id === playerId)
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

export function canRecruitUseProjectedOpening(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  recruit: Recruit,
): boolean {
  if (!('capacityModel' in program)) {
    return program.projectedOpeningsByPosition[recruit.player.position] > 0
  }
  return deriveRemainingScholarships(recruiting, program) > 0 &&
    program.projectedReturnerCountsByPosition[recruit.player.position] < 3
}

export function deriveCommittedCountsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const counts = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
  for (const commitment of deriveProgramCommitments(recruiting, program.programId)) {
    const recruit = getRecruit(recruiting, commitment.playerId)
    if (recruit) counts[recruit.player.position] += 1
  }
  return counts
}

export function deriveProjectedCountsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const committed = deriveCommittedCountsByPosition(recruiting, program)
  if (!('capacityModel' in program)) {
    return Object.fromEntries(POSITIONS.map((position) => [
      position,
      program.projectedOpeningsByPosition[position] -
        Math.max(0, program.projectedOpeningsByPosition[position] - committed[position]),
    ])) as PositionCounts
  }
  return Object.fromEntries(POSITIONS.map((position) => [
    position,
    program.projectedReturnerCountsByPosition[position] + committed[position],
  ])) as PositionCounts
}

export function deriveRemainingScholarships(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): number {
  if (!('capacityModel' in program)) {
    return POSITIONS.reduce((sum, position) =>
      sum + Math.max(0, program.projectedOpeningsByPosition[position] - deriveCommittedCountsByPosition(recruiting, program)[position]), 0)
  }
  return Math.max(0, 12 - program.projectedReturningPlayerCount - deriveProgramCommitments(recruiting, program.programId).length)
}

export function deriveMandatoryNeedsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  if (!('capacityModel' in program)) return deriveRemainingOpeningsByPosition(recruiting, program)
  const projected = deriveProjectedCountsByPosition(recruiting, program)
  return Object.fromEntries(POSITIONS.map((position) => [position, Math.max(0, 2 - projected[position])])) as PositionCounts
}

export function deriveFlexibleOpenings(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): number {
  if (!('capacityModel' in program)) return 0
  return Math.max(0, deriveRemainingScholarships(recruiting, program) -
    POSITIONS.reduce((sum, position) => sum + deriveMandatoryNeedsByPosition(recruiting, program)[position], 0))
}

export function canRecruitUseRemainingOpening(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  playerId: string,
): boolean {
  const recruit = getRecruit(recruiting, playerId)
  return Boolean(recruit && deriveRemainingOpeningsByPosition(
    recruiting,
    program,
  )[recruit.player.position] > 0)
}

export function canProgramOfferRecruit(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  playerId: string,
): boolean {
  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) return false
  if (!('capacityModel' in program)) {
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)[recruit.player.position]
    const offered = program.board.filter((target) =>
      target.hasActiveOffer && target.playerId !== playerId &&
      getRecruit(recruiting, target.playerId)?.player.position === recruit.player.position &&
      !recruiting.commitmentsByPlayerId[target.playerId],
    ).length
    return offered < remaining
  }
  const offers = { ...deriveActiveOfferCountsByPosition(recruiting, program) }
  offers[recruit.player.position] += 1
  return isProgramOfferSetFeasible(recruiting, program, offers)
}

export function isProgramOfferSetFeasible(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  offers: PositionCounts,
): boolean {
  if (!('capacityModel' in program)) {
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
    return POSITIONS.every((position) => offers[position] <= remaining[position])
  }
  const projected = deriveProjectedCountsByPosition(recruiting, program)
  const remainingScholarships = deriveRemainingScholarships(recruiting, program)
  const offerTotal = POSITIONS.reduce((sum, position) => sum + offers[position], 0)
  if (offerTotal > remainingScholarships) return false
  if (POSITIONS.some((position) => projected[position] + offers[position] > 3)) return false
  const mandatoryAfterOffers = POSITIONS.reduce((sum, position) =>
    sum + Math.max(0, 2 - projected[position] - offers[position]), 0)
  return remainingScholarships - offerTotal >= mandatoryAfterOffers
}

export function deriveRemainingOpeningsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const committedCounts = deriveCommittedCountsByPosition(recruiting, program)
  if ('capacityModel' in program) {
    const projected = deriveProjectedCountsByPosition(recruiting, program)
    const remainingScholarships = deriveRemainingScholarships(recruiting, program)
    const mandatory = deriveMandatoryNeedsByPosition(recruiting, program)
    return Object.fromEntries(POSITIONS.map((position) => {
      const mandatoryElsewhere = POSITIONS.reduce((sum, other) =>
        sum + (other === position ? 0 : mandatory[other]), 0)
      return [position, Math.max(0, Math.min(3 - projected[position], remainingScholarships - mandatoryElsewhere))]
    })) as PositionCounts
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

export function deriveRecruitActiveOfferCount(
  recruiting: RecruitingState,
  playerId: string,
): number {
  return Object.values(recruiting.programs).reduce(
    (count, program) => count + Number(program.board.some(
      (target) => target.playerId === playerId && target.hasActiveOffer,
    )),
    0,
  )
}

export function deriveAvailableOfferSlotsByPosition(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
): PositionCounts {
  const activeOffers = deriveActiveOfferCountsByPosition(recruiting, program)
  if (!('capacityModel' in program)) {
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
    return Object.fromEntries(POSITIONS.map((position) => [position, Math.max(0, remaining[position] - activeOffers[position])])) as PositionCounts
  }
  return Object.fromEntries(POSITIONS.map((position) => {
    let available = 0
    const candidate = { ...activeOffers }
    while (true) {
      candidate[position] += 1
      if (!isProgramOfferSetFeasible(recruiting, program, candidate)) break
      available += 1
    }
    return [position, available]
  })) as PositionCounts
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
  return canRecruitUseRemainingOpening(recruiting, program, playerId)
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
    capacityModel: 'capacityModel' in program ? 'flexible-v1' : 'exact-v0',
    projectedOpeningsByPosition: 'capacityModel' in program
      ? deriveRemainingOpeningsByPosition({ ...recruiting, commitmentsByPlayerId: {} }, program)
      : program.projectedOpeningsByPosition,
    remainingOpeningsByPosition: deriveRemainingOpeningsByPosition(recruiting, program),
    projectedCountsByPosition: deriveProjectedCountsByPosition(recruiting, program),
    mandatoryNeedsByPosition: deriveMandatoryNeedsByPosition(recruiting, program),
    remainingScholarships: deriveRemainingScholarships(recruiting, program),
    flexibleOpenings: deriveFlexibleOpenings(recruiting, program),
    signedCommitmentCount: deriveProgramCommitments(recruiting, programId).length,
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
