import { POSITIONS, type Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  cleanupInvalidRecruitingOffers,
} from './boards'
import {
  FINAL_RECRUITING_PERIOD,
  RECRUITING_BOARD_LIMIT,
} from './constants'
import type {
  RecruitingCommitment,
  RecruitingFinalizationResult,
  RecruitingProgramState,
  RecruitingState,
} from './domain'
import {
  deriveActiveOfferCountsByPosition,
  deriveBaseRecruitAttraction,
  deriveRecruitProgramStandings,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
  getRecruit,
} from './queries'

function standing(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  playerId: string,
  programId: string,
): number {
  const recruit = getRecruit(recruiting, playerId)!
  return deriveBaseRecruitAttraction(
    { ...dynasty, recruiting },
    recruit,
    programId,
  ) + (recruiting.relationshipProgressByPlayerId[playerId]?.[programId] ?? 0)
}

function openCount(recruiting: RecruitingState): number {
  return Object.values(recruiting.programs).reduce(
    (total, program) => total + Object.values(
      deriveRemainingOpeningsByPosition(recruiting, program),
    ).reduce((sum, count) => sum + count, 0),
    0,
  )
}

function unsignedAtPosition(
  recruiting: RecruitingState,
  position: Position,
) {
  return recruiting.recruits.filter(
    (recruit) =>
      recruit.player.position === position &&
      !recruiting.commitmentsByPlayerId[recruit.player.id],
  )
}

function addTarget(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  playerId: string,
): RecruitingProgramState {
  if (program.board.some((target) => target.playerId === playerId)) return program
  let board = [...program.board]
  if (board.length >= RECRUITING_BOARD_LIMIT) {
    const removable = board
      .filter(({ hasActiveOffer }) => !hasActiveOffer)
      .map((target) => ({
        target,
        status: deriveTargetStatus(
          recruiting,
          program.programId,
          target.playerId,
        ),
        standing: standing(
          dynasty,
          recruiting,
          target.playerId,
          program.programId,
        ),
        rank: getRecruit(recruiting, target.playerId)!.nationalRank,
      }))
      .sort((first, second) =>
        Number(first.status === 'active') - Number(second.status === 'active') ||
        Number(first.target.isFocused) - Number(second.target.isFocused) ||
        first.standing - second.standing ||
        second.rank - first.rank ||
        second.target.playerId.localeCompare(first.target.playerId),
      )[0]
    if (!removable) {
      throw new RangeError(`Program "${program.programId}" has no board space for Late Recruiting.`)
    }
    board = board.filter(({ playerId: id }) => id !== removable.target.playerId)
  }
  return {
    ...program,
    board: [...board, {
      playerId,
      isFocused: false,
      hasActiveOffer: false,
    }],
  }
}

function boardCandidates(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  program: RecruitingProgramState,
  position: Position,
) {
  return program.board
    .filter((target) => {
      const recruit = getRecruit(recruiting, target.playerId)
      return !target.hasActiveOffer &&
        recruit?.player.position === position &&
        deriveTargetStatus(recruiting, program.programId, target.playerId) === 'active'
    })
    .map((target) => ({
      target,
      recruit: getRecruit(recruiting, target.playerId)!,
      standing: standing(
        dynasty,
        recruiting,
        target.playerId,
        program.programId,
      ),
    }))
    .sort((first, second) =>
      Number(second.target.isFocused) - Number(first.target.isFocused) ||
      second.standing - first.standing ||
      first.recruit.nationalRank - second.recruit.nationalRank ||
      first.target.playerId.localeCompare(second.target.playerId),
    )
}

function nationalCandidates(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  programId: string,
  position: Position,
) {
  return unsignedAtPosition(recruiting, position)
    .map((recruit) => {
      const currentStanding = standing(
        dynasty,
        recruiting,
        recruit.player.id,
        programId,
      )
      const attainability = -Math.abs(
        currentStanding - recruit.commitmentStandingThreshold,
      )
      return {
        recruit,
        utility: recruit.qualityScore * 1.5 + currentStanding + attainability * 0.2,
      }
    })
    .sort((first, second) =>
      second.utility - first.utility ||
      first.recruit.nationalRank - second.recruit.nationalRank ||
      first.recruit.player.id.localeCompare(second.recruit.player.id),
    )
}

function fillOfferVacancies(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  expandControlledPool: boolean,
): RecruitingState {
  let current = cleanupInvalidRecruitingOffers(recruiting)
  for (const programId of Object.keys(current.programs).sort()) {
    let program = current.programs[programId]!
    for (const position of POSITIONS) {
      const remaining = deriveRemainingOpeningsByPosition(current, program)[position]
      let offered = deriveActiveOfferCountsByPosition(current, program)[position]
      while (offered < remaining) {
        const boardChoice = boardCandidates(
          dynasty,
          current,
          program,
          position,
        )[0]?.target
        let playerId = boardChoice?.playerId
        if (!playerId && (programId !== dynasty.controlledProgramId || expandControlledPool)) {
          const nationalChoice = nationalCandidates(
            dynasty,
            current,
            programId,
            position,
          ).find(({ recruit }) =>
            !program.board.some(({ playerId: id, hasActiveOffer }) =>
              id === recruit.player.id && hasActiveOffer,
            ),
          )
          if (nationalChoice) {
            playerId = nationalChoice.recruit.player.id
            program = addTarget(dynasty, current, program, playerId)
          }
        }
        if (!playerId) break
        program = {
          ...program,
          board: program.board.map((target) =>
            target.playerId === playerId
              ? { ...target, hasActiveOffer: true }
              : target,
          ),
        }
        current = {
          ...current,
          programs: { ...current.programs, [programId]: program },
        }
        offered += 1
      }
    }
    current = {
      ...current,
      programs: { ...current.programs, [programId]: program },
    }
  }
  return current
}

/** Prepares AI premium options in rank order without replacing controlled offers. */
export function preparePremiumLateMarket(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): RecruitingState {
  let current = recruiting
  const premium = current.recruits
    .filter((recruit) =>
      recruit.stars >= 4 &&
      !current.commitmentsByPlayerId[recruit.player.id],
    )
    .sort((first, second) =>
      first.nationalRank - second.nationalRank ||
      first.player.id.localeCompare(second.player.id),
    )
  for (const recruit of premium) {
    const activeOfferCount = () => Object.values(current.programs).reduce(
      (count, program) => count + Number(program.board.some((target) =>
        target.playerId === recruit.player.id && target.hasActiveOffer,
      )),
      0,
    )
    while (activeOfferCount() < 2) {
      const options = Object.keys(current.programs).sort()
        .filter((programId) => programId !== dynasty.controlledProgramId)
        .flatMap((programId) => {
        const program = current.programs[programId]!
        if (program.board.some((target) =>
          target.playerId === recruit.player.id && target.hasActiveOffer,
        )) return []
        if (deriveRemainingOpeningsByPosition(
          current,
          program,
        )[recruit.player.position] <= 0) return []
        const replacement = program.board
          .filter((target) => {
            const targetRecruit = getRecruit(current, target.playerId)
            return target.hasActiveOffer &&
              targetRecruit?.player.position === recruit.player.position &&
              targetRecruit.nationalRank > recruit.nationalRank
          })
          .sort((first, second) => {
            const firstRecruit = getRecruit(current, first.playerId)!
            const secondRecruit = getRecruit(current, second.playerId)!
            return secondRecruit.nationalRank - firstRecruit.nationalRank ||
              second.playerId.localeCompare(first.playerId)
          })[0]
        return replacement ? [{
          programId,
          program,
          replacement,
          standing: standing(
            dynasty,
            current,
            recruit.player.id,
            programId,
          ),
        }] : []
        })
        .sort((first, second) =>
          second.standing - first.standing ||
          first.programId.localeCompare(second.programId),
        )
      const choice = options[0]
      if (!choice) break
      let program: RecruitingProgramState = {
        ...choice.program,
        board: choice.program.board.map((target) =>
          target.playerId === choice.replacement.playerId
            ? { ...target, hasActiveOffer: false }
            : target,
        ),
      }
      program = addTarget(dynasty, current, program, recruit.player.id)
      program = {
        ...program,
        board: program.board.map((target) =>
          target.playerId === recruit.player.id
            ? { ...target, hasActiveOffer: true }
            : target,
        ),
      }
      current = {
        ...current,
        programs: { ...current.programs, [choice.programId]: program },
      }
    }
  }
  return current
}

/** Opens the user-reviewable Late Recruiting phase without finalizing the class. */
export function prepareLateRecruiting(dynasty: DynastyState): DynastyState {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (recruiting.phase === 'finalized' || recruiting.phase === 'late') return dynasty
  if (recruiting.lastResolvedPeriod !== FINAL_RECRUITING_PERIOD) {
    throw new RangeError('Late Recruiting requires completed Recruiting Period 28.')
  }
  let prepared = fillOfferVacancies(dynasty, recruiting, false)
  prepared = preparePremiumLateMarket(dynasty, prepared)
  return { ...dynasty, recruiting: { ...prepared, phase: 'late' } }
}

function resolveLateOffers(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): { recruiting: RecruitingState; commitments: number } {
  let current = recruiting
  let commitments = 0
  for (const playerId of deriveLateRecruitResolutionOrder(current)) {
    const recruit = getRecruit(current, playerId)!
    if (current.commitmentsByPlayerId[recruit.player.id]) continue
    const candidates = Object.keys(current.programs).sort().filter((programId) => {
      const program = current.programs[programId]!
      return program.board.some((target) =>
        target.playerId === recruit.player.id && target.hasActiveOffer,
      ) && deriveRemainingOpeningsByPosition(current, program)[recruit.player.position] > 0
    })
    if (candidates.length === 0) continue
    const candidateSet = new Set(candidates)
    const winner = deriveRecruitProgramStandings(
      { ...dynasty, recruiting: current },
      recruit.player.id,
    ).find(({ programId }) => candidateSet.has(programId))!
    const commitment: RecruitingCommitment = {
      playerId: recruit.player.id,
      programId: winner.programId,
      timing: { kind: 'late' },
      targetSeasonNumber: current.targetSeasonNumber,
    }
    current = cleanupInvalidRecruitingOffers({
      ...current,
      commitmentsByPlayerId: {
        ...current.commitmentsByPlayerId,
        [recruit.player.id]: commitment,
      },
    })
    commitments += 1
  }
  return { recruiting: current, commitments }
}

/** Canonical Signing Day order: strongest unsigned national rank first. */
export function deriveLateRecruitResolutionOrder(
  recruiting: RecruitingState,
): string[] {
  return recruiting.recruits
    .filter(({ player }) => !recruiting.commitmentsByPlayerId[player.id])
    .sort((first, second) =>
      first.nationalRank - second.nationalRank ||
      first.player.id.localeCompare(second.player.id),
    )
    .map(({ player }) => player.id)
}

function fallbackMatch(
  dynasty: DynastyState,
  recruiting: RecruitingState,
): RecruitingState {
  let current = recruiting
  for (const recruit of [...current.recruits].sort((first, second) =>
    first.nationalRank - second.nationalRank ||
    first.player.id.localeCompare(second.player.id),
  )) {
    if (current.commitmentsByPlayerId[recruit.player.id]) continue
    const programs = Object.keys(current.programs).sort().filter((programId) =>
      deriveRemainingOpeningsByPosition(
        current,
        current.programs[programId]!,
      )[recruit.player.position] > 0,
    )
    if (programs.length === 0) continue
    const winner = programs
      .map((programId) => ({
        programId,
        standing: standing(
          dynasty,
          current,
          recruit.player.id,
          programId,
        ),
      }))
      .sort((first, second) =>
        second.standing - first.standing ||
        first.programId.localeCompare(second.programId),
      )[0]!
    let program = addTarget(
      dynasty,
      current,
      current.programs[winner.programId]!,
      recruit.player.id,
    )
    program = {
      ...program,
      board: program.board.map((target) =>
        target.playerId === recruit.player.id
          ? { ...target, hasActiveOffer: true }
          : target,
      ),
    }
    current = cleanupInvalidRecruitingOffers({
      ...current,
      programs: { ...current.programs, [winner.programId]: program },
      commitmentsByPlayerId: {
        ...current.commitmentsByPlayerId,
        [recruit.player.id]: {
          playerId: recruit.player.id,
          programId: winner.programId,
          timing: { kind: 'late' },
          targetSeasonNumber: current.targetSeasonNumber,
        },
      },
    })
  }
  return current
}

function assertSufficientSupply(recruiting: RecruitingState): void {
  for (const position of POSITIONS) {
    const demand = Object.values(recruiting.programs).reduce(
      (sum, program) => sum + deriveRemainingOpeningsByPosition(
        recruiting,
        program,
      )[position],
      0,
    )
    const supply = unsignedAtPosition(recruiting, position).length
    if (supply < demand) {
      throw new RangeError(`Insufficient unsigned ${position} supply for Late Recruiting.`)
    }
  }
}

/** Deterministically fills every remaining opening and archives the incoming class. */
export function autoFinalizeRecruiting(
  dynasty: DynastyState,
): RecruitingFinalizationResult {
  if (dynasty.recruiting?.phase === 'finalized') {
    return {
      dynasty,
      resolutionPasses: 0,
      fallbackMatcherUsed: false,
      emergencyGeneratedRecruits: 0,
    }
  }
  let current = prepareLateRecruiting(dynasty)
  assertSufficientSupply(current.recruiting!)
  let resolutionPasses = 0
  let fallbackMatcherUsed = false
  while (openCount(current.recruiting!) > 0) {
    resolutionPasses += 1
    let offered = fillOfferVacancies(current, current.recruiting!, true)
    offered = preparePremiumLateMarket(current, offered)
    const resolved = resolveLateOffers(current, offered)
    current = { ...current, recruiting: resolved.recruiting }
    if (resolved.commitments > 0) continue
    fallbackMatcherUsed = true
    current = { ...current, recruiting: fallbackMatch(current, current.recruiting!) }
    if (openCount(current.recruiting!) > 0) {
      throw new RangeError('Late Recruiting could not fill every projected positional opening.')
    }
  }

  const finalizedState: RecruitingState = {
    ...cleanupInvalidRecruitingOffers(current.recruiting!),
    phase: 'finalized',
  }
  const alreadyArchived = current.completedRecruitingHistory.some(
    ({ targetSeasonNumber }) => targetSeasonNumber === finalizedState.targetSeasonNumber,
  )
  if (alreadyArchived) {
    throw new RangeError(
      `Recruiting class for Season ${finalizedState.targetSeasonNumber} is already finalized.`,
    )
  }
  current = {
    ...current,
    recruiting: finalizedState,
    completedRecruitingHistory: [
      ...current.completedRecruitingHistory,
      {
        targetSeasonNumber: finalizedState.targetSeasonNumber,
        recruitingState: structuredClone(finalizedState),
      },
    ],
  }
  return {
    dynasty: current,
    resolutionPasses,
    fallbackMatcherUsed,
    emergencyGeneratedRecruits: 0,
  }
}
