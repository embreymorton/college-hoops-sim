import { isRoundComplete } from '../../season'
import type { DynastyState } from '../domain'
import {
  cleanupInvalidRecruitingOffers,
  promoteControlledRecruitingBackups,
  refreshAiRecruitingBoards,
} from './boards'
import {
  MIN_MEANINGFUL_RELATIONSHIP,
  RECRUITING_EFFORT_PER_PERIOD,
  REGULAR_SEASON_RECRUITING_PERIODS,
} from './constants'
import type {
  RecruitingCommitment,
  RecruitingProgramState,
  RecruitingState,
} from './domain'
import {
  deriveRecruitProgramStandings,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
  getRecruit,
} from './queries'

function canonicalPrograms(
  programs: RecruitingState['programs'],
): RecruitingState['programs'] {
  return Object.fromEntries(
    Object.keys(programs).sort().map((programId) => [programId, programs[programId]!]),
  )
}

function activeTargets(
  recruiting: RecruitingState,
  program: RecruitingProgramState,
) {
  return program.board.filter(
    ({ playerId }) => deriveTargetStatus(recruiting, program.programId, playerId) === 'active',
  )
}

function applyPeriodEffort(recruiting: RecruitingState): RecruitingState {
  const relationships = structuredClone(recruiting.relationshipProgressByPlayerId)
  for (const programId of Object.keys(recruiting.programs).sort()) {
    const program = recruiting.programs[programId]!
    const targets = activeTargets(recruiting, program)
    const totalPriority = targets.reduce((sum, target) => sum + target.priority, 0)
    if (totalPriority === 0) continue
    for (const target of targets) {
      const playerRelationships = relationships[target.playerId] ?? {}
      playerRelationships[programId] = Number(
        ((playerRelationships[programId] ?? 0) +
          RECRUITING_EFFORT_PER_PERIOD * target.priority / totalPriority).toFixed(4),
      )
      relationships[target.playerId] = playerRelationships
    }
  }
  return { ...recruiting, relationshipProgressByPlayerId: relationships }
}

function activeCandidateProgramIds(
  recruiting: RecruitingState,
  playerId: string,
): string[] {
  return Object.keys(recruiting.programs).sort().filter((programId) => {
    const program = recruiting.programs[programId]!
    return (
      program.board.some((target) =>
        target.playerId === playerId && target.hasActiveOffer,
      ) &&
      deriveTargetStatus(recruiting, programId, playerId) === 'active' &&
      (recruiting.relationshipProgressByPlayerId[playerId]?.[programId] ?? 0) >=
        MIN_MEANINGFUL_RELATIONSHIP
    )
  })
}

function tryCommitRecruit(
  dynasty: DynastyState,
  recruiting: RecruitingState,
  playerId: string,
  period: number,
): RecruitingState {
  const recruit = getRecruit(recruiting, playerId)!
  if (
    recruiting.commitmentsByPlayerId[playerId] ||
    period < recruit.decisionReadyPeriod
  ) return recruiting

  const candidates = new Set(activeCandidateProgramIds(recruiting, playerId))
  if (candidates.size === 0) return recruiting
  const standings = deriveRecruitProgramStandings(
    { ...dynasty, recruiting },
    playerId,
  ).filter(({ programId }) => candidates.has(programId))
  const leader = standings[0]!
  const runnerUp = standings[1]
  if (
    leader.standing < recruit.commitmentStandingThreshold ||
    leader.standing - (runnerUp?.standing ?? 0) <
      recruit.commitmentSeparationThreshold
  ) return recruiting

  const commitment: RecruitingCommitment = {
    playerId,
    programId: leader.programId,
    period,
    targetSeasonNumber: recruiting.targetSeasonNumber,
  }
  return {
    ...recruiting,
    commitmentsByPlayerId: {
      ...recruiting.commitmentsByPlayerId,
      [playerId]: commitment,
    },
  }
}

/** Resolves exactly the next canonical regular-season recruiting period. */
export function resolveRecruitingPeriod(
  dynasty: DynastyState,
  period: number,
): DynastyState {
  if (!dynasty.recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (period !== dynasty.recruiting.lastResolvedPeriod + 1) {
    throw new RangeError('Recruiting periods must resolve once in canonical order.')
  }
  if (period < 1 || period > REGULAR_SEASON_RECRUITING_PERIODS) {
    throw new RangeError('Recruiting period is outside the regular-season range.')
  }
  if (!dynasty.activeSeason || !isRoundComplete(dynasty.activeSeason, period)) {
    throw new RangeError(`Recruiting Period ${period} requires completed basketball Round ${period}.`)
  }

  const periodStart = dynasty.recruiting
  let recruiting = cleanupInvalidRecruitingOffers(periodStart)
  recruiting = promoteControlledRecruitingBackups(
    dynasty,
    periodStart,
    recruiting,
  )
  recruiting = refreshAiRecruitingBoards(dynasty, recruiting)
  recruiting = applyPeriodEffort(recruiting)
  const recruits = [...recruiting.recruits].sort(
    (first, second) => first.nationalRank - second.nationalRank ||
      first.player.id.localeCompare(second.player.id),
  )
  recruiting = { ...recruiting, recruits }
  const beforeCommitments = recruiting
  for (const recruit of recruits) {
    recruiting = tryCommitRecruit(dynasty, recruiting, recruit.player.id, period)
  }
  recruiting = cleanupInvalidRecruitingOffers(recruiting)
  recruiting = promoteControlledRecruitingBackups(
    dynasty,
    beforeCommitments,
    recruiting,
  )
  recruiting = {
    ...recruiting,
    lastResolvedPeriod: period,
    programs: canonicalPrograms(recruiting.programs),
  }
  recruiting = refreshAiRecruitingBoards(dynasty, recruiting)
  return { ...dynasty, recruiting }
}

/** Idempotently catches Recruiting up to every fully completed basketball round. */
export function syncRecruitingThroughCompletedRounds(
  dynasty: DynastyState,
): DynastyState {
  const season = dynasty.activeSeason
  if (!season || !dynasty.recruiting) {
    throw new RangeError('Recruiting synchronization requires active Season Recruiting.')
  }
  let current = dynasty
  while (
    current.recruiting!.lastResolvedPeriod < REGULAR_SEASON_RECRUITING_PERIODS &&
    isRoundComplete(season, current.recruiting!.lastResolvedPeriod + 1)
  ) {
    current = resolveRecruitingPeriod(
      current,
      current.recruiting!.lastResolvedPeriod + 1,
    )
  }
  return current
}

export function deriveProgramActiveEffortShares(
  recruiting: RecruitingState,
  programId: string,
): Readonly<Record<string, number>> {
  const program = recruiting.programs[programId]
  if (!program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  const targets = activeTargets(recruiting, program)
  const totalPriority = targets.reduce((sum, target) => sum + target.priority, 0)
  return Object.fromEntries(
    targets.map((target) => [target.playerId, target.priority / totalPriority]),
  )
}

export function deriveProgramRemainingRecruitingCapacity(
  recruiting: RecruitingState,
  programId: string,
) {
  const program = recruiting.programs[programId]
  if (!program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  return deriveRemainingOpeningsByPosition(recruiting, program)
}
