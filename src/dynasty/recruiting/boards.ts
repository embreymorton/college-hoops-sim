import type { Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  MAX_RECRUITING_PRIORITY,
  FINAL_RECRUITING_PERIOD,
  MIN_RECRUITING_PRIORITY,
  RECRUITING_BOARD_LIMIT,
} from './constants'
import type {
  AddRecruitingBoardTargetOptions,
  RecruitingBoardTarget,
  RecruitingProgramState,
  RecruitingState,
  RemoveRecruitingBoardTargetOptions,
  UpdateRecruitingBoardPriorityOptions,
  UpdateRecruitingOfferOptions,
} from './domain'
import {
  deriveAvailableOfferSlotsByPosition,
  deriveBaseRecruitAttraction,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
  getRecruit,
} from './queries'

const DEFAULT_PRIORITIES = [5, 4, 3, 3, 2, 2, 1, 1, 1, 1] as const

function assertPriority(priority: number): void {
  if (
    !Number.isInteger(priority) ||
    priority < MIN_RECRUITING_PRIORITY ||
    priority > MAX_RECRUITING_PRIORITY
  ) {
    throw new RangeError(
      `Recruiting priority must be an integer from ${MIN_RECRUITING_PRIORITY} through ${MAX_RECRUITING_PRIORITY}.`,
    )
  }
}

function withProgramBoard(
  dynasty: DynastyState,
  programId: string,
  board: readonly RecruitingBoardTarget[],
): DynastyState {
  const recruiting = dynasty.recruiting!
  return {
    ...dynasty,
    recruiting: {
      ...recruiting,
      programs: {
        ...recruiting.programs,
        [programId]: { ...recruiting.programs[programId]!, board },
      },
    },
  }
}

function controlledProgram(dynasty: DynastyState): RecruitingProgramState {
  const program = dynasty.recruiting?.programs[dynasty.controlledProgramId]
  if (!program) throw new RangeError('Dynasty Recruiting is not initialized.')
  return program
}

/** Adds one eligible target to the user-owned controlled Program board. */
export function addRecruitingBoardTarget({
  dynasty,
  playerId,
  priority,
}: AddRecruitingBoardTargetOptions): DynastyState {
  assertPriority(priority)
  const program = controlledProgram(dynasty)
  const recruiting = dynasty.recruiting!
  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)
  if (program.board.some((target) => target.playerId === playerId)) {
    throw new RangeError('Recruit is already on the controlled Program board.')
  }
  if (program.board.length >= RECRUITING_BOARD_LIMIT) {
    throw new RangeError(`Recruiting board cannot exceed ${RECRUITING_BOARD_LIMIT} targets.`)
  }
  if (recruiting.commitmentsByPlayerId[playerId]) {
    throw new RangeError('A committed Recruit cannot be added to a board.')
  }
  if (program.projectedOpeningsByPosition[recruit.player.position] === 0) {
    throw new RangeError('Recruit position does not match a projected opening.')
  }
  if (deriveTargetStatus(recruiting, program.programId, playerId) !== 'active') {
    throw new RangeError('Recruit is not active for this Program position.')
  }
  return withProgramBoard(dynasty, program.programId, [
    ...program.board,
    { playerId, priority, hasActiveOffer: false },
  ])
}

/** Places one controlled-Program offer without changing priority or relationships. */
export function offerRecruit({
  dynasty,
  playerId,
}: UpdateRecruitingOfferOptions): DynastyState {
  const program = controlledProgram(dynasty)
  const recruiting = dynasty.recruiting!
  const target = program.board.find((entry) => entry.playerId === playerId)
  if (!target) throw new RangeError('Recruit must be on the controlled Program board before receiving an offer.')
  if (target.hasActiveOffer) throw new RangeError('Recruit already has an active offer.')
  const recruit = getRecruit(recruiting, playerId)!
  if (recruiting.commitmentsByPlayerId[playerId]) {
    throw new RangeError('A committed Recruit cannot receive an offer.')
  }
  if (deriveTargetStatus(recruiting, program.programId, playerId) !== 'active') {
    throw new RangeError('Recruit is not active for this Program position.')
  }
  if (deriveAvailableOfferSlotsByPosition(recruiting, program)[recruit.player.position] <= 0) {
    throw new RangeError('Program has no remaining active-offer capacity at this position.')
  }
  return withProgramBoard(dynasty, program.programId, program.board.map((entry) =>
    entry.playerId === playerId ? { ...entry, hasActiveOffer: true } : entry,
  ))
}

export function withdrawRecruitOffer({
  dynasty,
  playerId,
}: UpdateRecruitingOfferOptions): DynastyState {
  const program = controlledProgram(dynasty)
  const target = program.board.find((entry) => entry.playerId === playerId)
  if (!target) throw new RangeError('Recruit is not on the controlled Program board.')
  if (!target.hasActiveOffer) throw new RangeError('Recruit does not have an active offer.')
  return withProgramBoard(dynasty, program.programId, program.board.map((entry) =>
    entry.playerId === playerId ? { ...entry, hasActiveOffer: false } : entry,
  ))
}

/** Removes a target without deleting the canonical relationship history. */
export function removeRecruitingBoardTarget({
  dynasty,
  playerId,
}: RemoveRecruitingBoardTargetOptions): DynastyState {
  const program = controlledProgram(dynasty)
  if (!program.board.some((target) => target.playerId === playerId)) {
    throw new RangeError('Recruit is not on the controlled Program board.')
  }
  return withProgramBoard(
    dynasty,
    program.programId,
    program.board.filter((target) => target.playerId !== playerId),
  )
}

export function updateRecruitingBoardPriority({
  dynasty,
  playerId,
  priority,
}: UpdateRecruitingBoardPriorityOptions): DynastyState {
  assertPriority(priority)
  const program = controlledProgram(dynasty)
  if (!program.board.some((target) => target.playerId === playerId)) {
    throw new RangeError('Recruit is not on the controlled Program board.')
  }
  return withProgramBoard(
    dynasty,
    program.programId,
    program.board.map((target) =>
      target.playerId === playerId ? { ...target, priority } : target,
    ),
  )
}

function positionCandidates(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  position: Position,
): RecruitingBoardTarget[] {
  const team = dynasty.activeSeason!.programStates[programId]!.team
  const candidates = recruiting.recruits.filter(
    (recruit) =>
      recruit.player.position === position &&
      recruiting.commitmentsByPlayerId[recruit.player.id] === undefined,
  )
  const idealPositionRank = Math.max(
    1,
    Math.round(candidates.length * (1.08 - team.prestige * 0.0095)),
  )
  return candidates
    .map((recruit) => ({
      recruit,
      utility:
        -Math.abs(recruit.positionRank - idealPositionRank) * 2 +
        deriveBaseRecruitAttraction(dynasty, recruit, programId),
    }))
    .sort(
      (first, second) =>
        second.utility - first.utility ||
        first.recruit.nationalRank - second.recruit.nationalRank ||
        first.recruit.player.id.localeCompare(second.recruit.player.id),
    )
    .map(({ recruit }, index) => ({
      playerId: recruit.player.id,
      priority: DEFAULT_PRIORITIES[Math.min(index, DEFAULT_PRIORITIES.length - 1)]!,
      hasActiveOffer: false,
    }))
}

function offerUtility(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  target: RecruitingBoardTarget,
): number {
  const recruit = getRecruit(recruiting, target.playerId)!
  const relationshipProgress =
    recruiting.relationshipProgressByPlayerId[target.playerId]?.[programId] ?? 0
  const prestige = dynasty.activeSeason!.programStates[programId]!.team.prestige
  const planningPeriod = Math.min(
    FINAL_RECRUITING_PERIOD,
    recruiting.lastResolvedPeriod + 1,
  )
  const competingOffers = Object.values(recruiting.programs).reduce(
    (count, program) => count + program.board.filter((entry) =>
      entry.playerId === target.playerId &&
      entry.hasActiveOffer &&
      program.programId !== programId,
    ).length,
    0,
  )
  const standing =
    deriveBaseRecruitAttraction({ ...dynasty, recruiting }, recruit, programId) +
    relationshipProgress
  const uncoveredPremiumUrgency =
    recruit.stars >= 4 && competingOffers === 0
      ? Math.max(0, planningPeriod - 6) * (recruit.stars === 5 ? 3 : 1.5)
      : 0
  const eliteReachPenalty =
    recruit.stars === 5 ? Math.max(0, 65 - prestige) * 0.7 : 0
  return (
    recruit.qualityScore * (0.5 + prestige * 0.033) +
    (standing - recruit.commitmentStandingThreshold) *
      (0.65 + planningPeriod * 0.02) +
    (25 - recruit.decisionReadyPeriod) * 1.5 +
    relationshipProgress * 0.3 -
    competingOffers * (3 + planningPeriod * 0.35) +
    uncoveredPremiumUrgency -
    eliteReachPenalty
  )
}

function addPremiumDiscoveryTarget(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  position: Position,
): RecruitingProgramState {
  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  if (remaining[position] <= 0) return program
  const existingIds = new Set(program.board.map(({ playerId }) => playerId))
  const premium = recruiting.recruits
    .filter((recruit) =>
      recruit.stars >= 4 &&
      recruit.player.position === position &&
      !recruiting.commitmentsByPlayerId[recruit.player.id] &&
      !existingIds.has(recruit.player.id),
    )
    .map((recruit) => ({
      recruit,
      target: {
        playerId: recruit.player.id,
        priority: 2,
        hasActiveOffer: false,
      } satisfies RecruitingBoardTarget,
    }))
    .sort((first, second) =>
      offerUtility(dynasty, recruiting, program.programId, second.target) -
        offerUtility(dynasty, recruiting, program.programId, first.target) ||
      first.recruit.nationalRank - second.recruit.nationalRank ||
      first.recruit.player.id.localeCompare(second.recruit.player.id),
    )
  const candidate = premium[0]
  if (!candidate) return program

  const samePosition = program.board.filter((target) =>
    getRecruit(recruiting, target.playerId)?.player.position === position,
  )
  const bestExistingUtility = Math.max(
    ...samePosition.map((target) =>
      offerUtility(dynasty, recruiting, program.programId, target),
    ),
    Number.NEGATIVE_INFINITY,
  )
  const candidateUtility = offerUtility(
    dynasty,
    recruiting,
    program.programId,
    candidate.target,
  )
  const hasLeagueOffer = Object.values(recruiting.programs).some((state) =>
    state.board.some((target) =>
      target.playerId === candidate.recruit.player.id && target.hasActiveOffer,
    ),
  )
  const lateUncoveredPremium =
    recruiting.lastResolvedPeriod >= 7 && !hasLeagueOffer
  if (
    !lateUncoveredPremium &&
    candidateUtility < bestExistingUtility -
      2
  ) return program

  if (program.board.length < RECRUITING_BOARD_LIMIT) {
    return { ...program, board: [...program.board, candidate.target] }
  }
  const replaceable = samePosition
    .filter(({ hasActiveOffer }) => !hasActiveOffer)
    .sort((first, second) =>
      offerUtility(dynasty, recruiting, program.programId, first) -
        offerUtility(dynasty, recruiting, program.programId, second) ||
      second.playerId.localeCompare(first.playerId),
    )[0]
  if (
    !replaceable ||
    !lateUncoveredPremium &&
    candidateUtility <
      offerUtility(dynasty, recruiting, program.programId, replaceable) +
        4
  ) return program
  return {
    ...program,
    board: program.board.map((target) =>
      target.playerId === replaceable.playerId ? candidate.target : target,
    ),
  }
}

function discoverAiPremiumTargets(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
): RecruitingProgramState {
  let program = recruiting.programs[programId]!
  for (const position of Object.keys(program.projectedOpeningsByPosition) as Position[]) {
    program = addPremiumDiscoveryTarget(
      dynasty,
      { ...recruiting, programs: { ...recruiting.programs, [programId]: program } },
      program,
      position,
    )
  }
  return program
}

/** Clears structurally invalid active offers without choosing replacements. */
export function cleanupInvalidRecruitingOffers(
  recruiting: RecruitingState,
): RecruitingState {
  const programs = Object.fromEntries(Object.keys(recruiting.programs).sort().map((programId) => {
    const program = recruiting.programs[programId]!
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
    const retainedByPosition: Partial<Record<Position, number>> = {}
    const board = program.board.map((target) => {
      if (!target.hasActiveOffer) return target
      const recruit = getRecruit(recruiting, target.playerId)
      if (
        !recruit ||
        recruiting.commitmentsByPlayerId[target.playerId] ||
        deriveTargetStatus(recruiting, programId, target.playerId) !== 'active'
      ) return { ...target, hasActiveOffer: false }
      const position = recruit.player.position
      const retained = retainedByPosition[position] ?? 0
      if (retained >= remaining[position]) return { ...target, hasActiveOffer: false }
      retainedByPosition[position] = retained + 1
      return target
    })
    return [programId, { ...program, board }]
  }))
  return { ...recruiting, programs }
}

/** Deterministically fills offer slots and only switches for a meaningful utility gain. */
export function manageProgramRecruitingOffers(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
): RecruitingProgramState {
  const program = recruiting.programs[programId]!
  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  let board = [...program.board]
  for (const position of Object.keys(remaining) as Position[]) {
    const eligible = board.filter((target) => {
      const recruit = getRecruit(recruiting, target.playerId)
      return recruit?.player.position === position &&
        deriveTargetStatus(recruiting, programId, target.playerId) === 'active'
    }).sort((first, second) =>
      offerUtility(dynasty, recruiting, programId, second) -
        offerUtility(dynasty, recruiting, programId, first) ||
      first.playerId.localeCompare(second.playerId),
    )
    const desiredCount = remaining[position]
    const offered = eligible.filter(({ hasActiveOffer }) => hasActiveOffer)
    const selected = new Set(offered.map(({ playerId }) => playerId))
    for (const target of eligible) {
      if (selected.size >= desiredCount) break
      selected.add(target.playerId)
    }
    if (selected.size === desiredCount && desiredCount > 0) {
      const selectedTargets = eligible.filter(({ playerId }) => selected.has(playerId))
      const worst = selectedTargets.at(-1)
      const bestBackup = eligible.find(({ playerId }) => !selected.has(playerId))
      const switchingThreshold = Math.max(
        3,
        10 - (recruiting.lastResolvedPeriod + 1) * 0.3,
      )
      if (
        worst && bestBackup &&
        offerUtility(dynasty, recruiting, programId, bestBackup) >
          offerUtility(dynasty, recruiting, programId, worst) + switchingThreshold
      ) {
        selected.delete(worst.playerId)
        selected.add(bestBackup.playerId)
      }
    }
    board = board.map((target) => {
      const recruit = getRecruit(recruiting, target.playerId)
      return recruit?.player.position === position
        ? { ...target, hasActiveOffer: selected.has(target.playerId) }
        : target
    })
  }
  return { ...program, board }
}

/** Executes a user-owned fallback plan only when a previously active offer was lost. */
export function promoteControlledRecruitingBackups(
  dynasty: DynastyState,
  before: RecruitingState,
  after: RecruitingState,
): RecruitingState {
  const programId = dynasty.controlledProgramId
  const beforeProgram = before.programs[programId]
  const afterProgram = after.programs[programId]
  if (!beforeProgram || !afterProgram) return after
  const lostByPosition: Partial<Record<Position, number>> = {}
  for (const target of beforeProgram.board.filter(({ hasActiveOffer }) => hasActiveOffer)) {
    const stillOffered = afterProgram.board.some((entry) =>
      entry.playerId === target.playerId && entry.hasActiveOffer,
    )
    if (stillOffered) continue
    const recruit = getRecruit(before, target.playerId)
    if (recruit) {
      lostByPosition[recruit.player.position] =
        (lostByPosition[recruit.player.position] ?? 0) + 1
    }
  }
  let board = [...afterProgram.board]
  for (const position of Object.keys(lostByPosition) as Position[]) {
    const slots = Math.min(
      lostByPosition[position] ?? 0,
      deriveAvailableOfferSlotsByPosition(
        after,
        { ...afterProgram, board },
      )[position],
    )
    if (slots <= 0) continue
    const candidates = board.filter((target) => {
      const recruit = getRecruit(after, target.playerId)
      return !target.hasActiveOffer &&
        recruit?.player.position === position &&
        deriveTargetStatus(after, programId, target.playerId) === 'active'
    }).map((target) => {
      const recruit = getRecruit(after, target.playerId)!
      const standing =
        deriveBaseRecruitAttraction({ ...dynasty, recruiting: after }, recruit, programId) +
        (after.relationshipProgressByPlayerId[target.playerId]?.[programId] ?? 0)
      return { target, recruit, standing }
    }).sort((first, second) =>
      second.target.priority - first.target.priority ||
      second.standing - first.standing ||
      first.recruit.nationalRank - second.recruit.nationalRank ||
      first.target.playerId.localeCompare(second.target.playerId),
    )
    const promoted = new Set(candidates.slice(0, slots).map(({ target }) => target.playerId))
    board = board.map((target) =>
      promoted.has(target.playerId)
        ? { ...target, hasActiveOffer: true }
        : target,
    )
  }
  return {
    ...after,
    programs: {
      ...after.programs,
      [programId]: { ...afterProgram, board },
    },
  }
}

/** Deterministic reach/target/fallback plan keyed to current prestige and positional need. */
export function buildDefaultRecruitingBoard(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  existingBoard: readonly RecruitingBoardTarget[] = [],
): RecruitingBoardTarget[] {
  const program = recruiting.programs[programId]
  if (!program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  const board = existingBoard.filter(
    ({ playerId }) => deriveTargetStatus(recruiting, programId, playerId) === 'active',
  )
  const selected = new Set(board.map(({ playerId }) => playerId))
  const queues = Object.fromEntries(
    (Object.keys(remaining) as Position[]).map((position) => [
      position,
      positionCandidates(dynasty, recruiting, programId, position).filter(
        ({ playerId }) => !selected.has(playerId),
      ),
    ]),
  ) as Record<Position, RecruitingBoardTarget[]>
  const targetCounts = Object.fromEntries(
    (Object.keys(remaining) as Position[]).map((position) => [
      position,
      Math.min(remaining[position] * 3, queues[position].length),
    ]),
  ) as Record<Position, number>
  const addedByPosition = Object.fromEntries(
    (Object.keys(remaining) as Position[]).map((position) => [position, 0]),
  ) as Record<Position, number>

  while (board.length < RECRUITING_BOARD_LIMIT) {
    let added = false
    for (const position of Object.keys(remaining) as Position[]) {
      if (
        board.length >= RECRUITING_BOARD_LIMIT ||
        addedByPosition[position] >= targetCounts[position]
      ) continue
      const target = queues[position].shift()
      if (!target) continue
      board.push({ ...target, priority: DEFAULT_PRIORITIES[board.length]! })
      selected.add(target.playerId)
      addedByPosition[position] += 1
      added = true
    }
    if (!added) break
  }
  return board
}

export function refreshAiRecruitingBoards(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): RecruitingState {
  const cleaned = cleanupInvalidRecruitingOffers(recruiting)
  const context = { ...dynasty, recruiting: cleaned }
  const programs = { ...cleaned.programs }
  for (const programId of Object.keys(programs).sort()) {
    if (programId === dynasty.controlledProgramId) continue
    const program = programs[programId]!
    programs[programId] = {
      ...program,
      board: buildDefaultRecruitingBoard(
        context,
        { ...cleaned, programs },
        programId,
        program.board,
      ),
    }
    programs[programId] = discoverAiPremiumTargets(
      context,
      { ...cleaned, programs },
      programId,
    )
    programs[programId] = manageProgramRecruitingOffers(
      context,
      { ...cleaned, programs },
      programId,
    )
  }
  return { ...cleaned, programs }
}
