import type { Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  MAX_RECRUITING_PRIORITY,
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
} from './domain'
import {
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
    { playerId, priority },
  ])
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
    }))
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
  const context = { ...dynasty, recruiting }
  const programs = { ...recruiting.programs }
  for (const programId of Object.keys(programs).sort()) {
    if (programId === dynasty.controlledProgramId) continue
    const program = programs[programId]!
    programs[programId] = {
      ...program,
      board: buildDefaultRecruitingBoard(
        context,
        { ...recruiting, programs },
        programId,
        program.board,
      ),
    }
  }
  return { ...recruiting, programs }
}
