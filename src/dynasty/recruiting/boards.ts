import type { Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  FINAL_RECRUITING_PERIOD,
  RECRUITING_BOARD_LIMIT,
  RECRUITING_FOCUS_LIMIT,
} from './constants'
import type {
  AddRecruitingBoardTargetOptions,
  RecruitingBoardTarget,
  RecruitingProgramState,
  RecruitingState,
  RemoveRecruitingBoardTargetOptions,
  UpdateRecruitingFocusOptions,
  UpdateRecruitingOfferOptions,
} from './domain'
import {
  deriveAvailableOfferSlotsByPosition,
  deriveBaseRecruitAttraction,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
  getRecruit,
} from './queries'

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
}: AddRecruitingBoardTargetOptions): DynastyState {
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
    { playerId, isFocused: false, hasActiveOffer: false },
  ])
}

/** Places one controlled-Program offer without changing focus or relationships. */
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

export function setRecruitingFocus({
  dynasty,
  playerId,
  isFocused,
}: UpdateRecruitingFocusOptions): DynastyState {
  const program = controlledProgram(dynasty)
  const target = program.board.find((entry) => entry.playerId === playerId)
  if (!target) {
    throw new RangeError('Recruit is not on the controlled Program board.')
  }
  const recruiting = dynasty.recruiting!
  if (isFocused && deriveTargetStatus(recruiting, program.programId, playerId) !== 'active') {
    throw new RangeError('Only active board recruits can be focused.')
  }
  if (
    isFocused && !target.isFocused &&
    program.board.filter((entry) => entry.isFocused && deriveTargetStatus(recruiting, program.programId, entry.playerId) === 'active').length >= RECRUITING_FOCUS_LIMIT
  ) {
    throw new RangeError(`Recruiting focus cannot exceed ${RECRUITING_FOCUS_LIMIT} active targets.`)
  }
  return withProgramBoard(
    dynasty,
    program.programId,
    program.board.map((target) =>
      target.playerId === playerId ? { ...target, isFocused } : target,
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
      isFocused: index < RECRUITING_FOCUS_LIMIT,
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
        isFocused: false,
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
      const isActive = deriveTargetStatus(recruiting, programId, target.playerId) === 'active'
      if (!target.hasActiveOffer && (!target.isFocused || isActive)) return target
      const recruit = getRecruit(recruiting, target.playerId)
      if (
        !recruit ||
        recruiting.commitmentsByPlayerId[target.playerId] ||
        !isActive
      ) return { ...target, hasActiveOffer: false, isFocused: false }
      if (!target.hasActiveOffer) return target
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

/**
 * Carries an AI's still-legal premium Focus + Offer pursuit through a refresh.
 * The target can still leave through normal cleanup, capacity exhaustion, or a
 * later commitment; this only prevents the planner from immediately trading a
 * coherent primary pursuit for an unrelated backup.
 */
function retainAiPremiumPursuits(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  previousBoard: readonly RecruitingBoardTarget[],
  planned: RecruitingProgramState,
): RecruitingProgramState {
  const remaining = deriveRemainingOpeningsByPosition(recruiting, planned)
  const retainedIds = new Set(
    previousBoard.filter((target) => {
      const recruit = getRecruit(recruiting, target.playerId)
      return target.isFocused && target.hasActiveOffer && recruit !== undefined && recruit.stars >= 4 &&
        deriveTargetStatus(recruiting, programId, target.playerId) === 'active'
    }).map(({ playerId }) => playerId),
  )
  let board = [...planned.board]
  for (const playerId of retainedIds) {
    const recruit = getRecruit(recruiting, playerId)
    const target = board.find((entry) => entry.playerId === playerId)
    if (!recruit || !target || target.hasActiveOffer || remaining[recruit.player.position] <= 0) continue
    const offeredAtPosition = board.filter((entry) =>
      entry.hasActiveOffer && getRecruit(recruiting, entry.playerId)?.player.position === recruit.player.position,
    )
    const replaceable = offeredAtPosition
      .filter((entry) => !retainedIds.has(entry.playerId))
      .sort((first, second) =>
        offerUtility(dynasty, recruiting, programId, first) - offerUtility(dynasty, recruiting, programId, second) ||
        first.playerId.localeCompare(second.playerId),
      )[0]
    if (!replaceable) continue
    board = board.map((entry) =>
      entry.playerId === replaceable.playerId
        ? { ...entry, hasActiveOffer: false }
        : entry.playerId === playerId ? { ...entry, hasActiveOffer: true } : entry,
    )
  }
  return { ...planned, board }
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
      Number(second.target.isFocused) - Number(first.target.isFocused) ||
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

function appendDefaultRecruitingTargets(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  existingBoard: readonly RecruitingBoardTarget[],
): RecruitingBoardTarget[] {
  const program = recruiting.programs[programId]
  if (!program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  const board = [...existingBoard]
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
      board.push(target)
      selected.add(target.playerId)
      addedByPosition[position] += 1
      added = true
    }
    if (!added) break
  }
  return board
}

/** Deterministic reach/target/fallback plan keyed to current prestige and positional need. */
export function buildDefaultRecruitingBoard(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  existingBoard: readonly RecruitingBoardTarget[] = [],
): RecruitingBoardTarget[] {
  const activeExistingBoard = existingBoard.filter(
    ({ playerId }) => deriveTargetStatus(recruiting, programId, playerId) === 'active',
  )
  const board = appendDefaultRecruitingTargets(
    dynasty,
    recruiting,
    programId,
    activeExistingBoard,
  )
  const focused = board.filter(({ isFocused }) => isFocused).slice(0, RECRUITING_FOCUS_LIMIT)
  const focusedIds = new Set(focused.map(({ playerId }) => playerId))
  return board.map((target, index) => ({
    ...target,
    // Existing user focus is retained; a generated plan focuses its first three
    // deterministic recommended targets and never normalizes unused slots.
    isFocused: focusedIds.has(target.playerId) || (activeExistingBoard.length === 0 && index < RECRUITING_FOCUS_LIMIT),
  }))
}

/**
 * Fills only unused controlled-Program Board capacity. Existing entries retain
 * their exact order, Focus, and Offer state; appended recommendations are Board
 * membership only and reuse the canonical deterministic planner ranking.
 */
export function fillRemainingRecruitingBoard(dynasty: DynastyState): DynastyState {
  const program = controlledProgram(dynasty)
  if (program.board.length >= RECRUITING_BOARD_LIMIT) return dynasty
  const recruiting = dynasty.recruiting!
  const filled = appendDefaultRecruitingTargets(
    dynasty,
    recruiting,
    program.programId,
    program.board,
  ).map((target, index) =>
    index < program.board.length
      ? target
      : { ...target, isFocused: false, hasActiveOffer: false },
  )
  if (filled.length === program.board.length) return dynasty
  return withProgramBoard(dynasty, program.programId, filled)
}

/**
 * Produces the AI-only Focus portion of a plan after offers have been chosen.
 * Existing offered pursuits lead, so Board / Focus / Offer express one plan;
 * viable backups still fill any unused Focus capacity deterministically.
 */
export function alignGeneratedRecruitingFocus(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  program: RecruitingProgramState = recruiting.programs[programId]!,
): RecruitingProgramState {
  const activeRecruiting = { ...recruiting, programs: { ...recruiting.programs, [programId]: program } }
  const focusIds = new Set(
    [...program.board]
      .filter((target) => deriveTargetStatus(activeRecruiting, programId, target.playerId) === 'active')
      .sort((first, second) =>
        Number(second.hasActiveOffer && second.isFocused) - Number(first.hasActiveOffer && first.isFocused) ||
        Number(second.hasActiveOffer) - Number(first.hasActiveOffer) ||
        offerUtility({ ...dynasty, recruiting: activeRecruiting }, activeRecruiting, programId, second) -
          offerUtility({ ...dynasty, recruiting: activeRecruiting }, activeRecruiting, programId, first) ||
        first.playerId.localeCompare(second.playerId),
      )
      .slice(0, RECRUITING_FOCUS_LIMIT)
      .map(({ playerId }) => playerId),
  )
  return {
    ...program,
    board: program.board.map((target) => ({ ...target, isFocused: focusIds.has(target.playerId) })),
  }
}

/** AI refreshes retain the accepted name while sharing the same alignment rule. */
export const alignAiRecruitingFocus = alignGeneratedRecruitingFocus

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
    programs[programId] = retainAiPremiumPursuits(
      context,
      { ...cleaned, programs },
      programId,
      program.board,
      programs[programId]!,
    )
    programs[programId] = alignAiRecruitingFocus(
      context,
      { ...cleaned, programs },
      programId,
      programs[programId]!,
    )
  }
  return { ...cleaned, programs }
}
