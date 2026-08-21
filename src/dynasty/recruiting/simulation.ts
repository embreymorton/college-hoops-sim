import {
  getGamesForTournamentRound,
  TOURNAMENT_ROUNDS,
  type TournamentRound,
} from '../../postseason'
import { isRoundComplete } from '../../season'
import type { DynastyState } from '../domain'
import { preparePremiumLateMarket } from './finalization'
import {
  cleanupInvalidRecruitingOffers,
  collapseEarlyClosePremiumSecondOffers,
  promoteControlledRecruitingBackups,
  refreshAiRecruitingBoards,
} from './boards'
import {
  MIN_MEANINGFUL_RELATIONSHIP,
  FINAL_RECRUITING_PERIOD,
  RECRUITING_BOARD_BASE_EFFORT,
  RECRUITING_FOCUS_BONUS_EFFORT,
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
    for (const target of targets) {
      const playerRelationships = relationships[target.playerId] ?? {}
      playerRelationships[programId] = Number(
        ((playerRelationships[programId] ?? 0) +
          RECRUITING_BOARD_BASE_EFFORT +
          (target.isFocused ? RECRUITING_FOCUS_BONUS_EFFORT : 0)).toFixed(4),
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
  const confidence = deriveCommitmentConfidenceThresholds(recruit, period)
  if (
    leader.standing < confidence.standing ||
    leader.standing - (runnerUp?.standing ?? 0) <
      confidence.separation
  ) return recruiting

  const commitment: RecruitingCommitment = {
    playerId,
    programId: leader.programId,
    timing: { kind: 'period', period },
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

/** Regular-season thresholds are frozen; only already-ready postseason battles ease. */
export function deriveCommitmentConfidenceThresholds(
  recruit: Pick<
    import('./domain').Recruit,
    'commitmentStandingThreshold' | 'commitmentSeparationThreshold'
  >,
  period: number,
): { readonly standing: number; readonly separation: number } {
  const postseasonStep = Math.max(
    0,
    Math.min(FINAL_RECRUITING_PERIOD, period) -
      REGULAR_SEASON_RECRUITING_PERIODS,
  )
  return {
    standing: recruit.commitmentStandingThreshold - postseasonStep * 1.5,
    separation: Math.max(
      2,
      recruit.commitmentSeparationThreshold - postseasonStep * 0.75,
    ),
  }
}

function resolveCanonicalPeriod(
  dynasty: DynastyState,
  period: number,
  experimentalEarlyClosePremiumSecondOffer = false,
): DynastyState {
  const periodStart = experimentalEarlyClosePremiumSecondOffer && period === 9
    ? collapseEarlyClosePremiumSecondOffers(dynasty, dynasty.recruiting!)
    : dynasty.recruiting!
  let recruiting = cleanupInvalidRecruitingOffers(periodStart)
  recruiting = promoteControlledRecruitingBackups(
    dynasty,
    periodStart,
    recruiting,
  )
  recruiting = refreshAiRecruitingBoards(
    dynasty,
    recruiting,
    experimentalEarlyClosePremiumSecondOffer,
  )
  if (period > REGULAR_SEASON_RECRUITING_PERIODS) {
    recruiting = preparePremiumLateMarket(dynasty, recruiting)
  }
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
    phase: period <= REGULAR_SEASON_RECRUITING_PERIODS
      ? 'regular-season'
      : 'postseason',
    lastResolvedPeriod: period,
    programs: canonicalPrograms(recruiting.programs),
  }
  if (experimentalEarlyClosePremiumSecondOffer && period === 8) {
    recruiting = collapseEarlyClosePremiumSecondOffers(
      { ...dynasty, recruiting },
      recruiting,
    )
  }
  recruiting = refreshAiRecruitingBoards(
    dynasty,
    recruiting,
    experimentalEarlyClosePremiumSecondOffer,
  )
  return { ...dynasty, recruiting }
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

  return resolveCanonicalPeriod(dynasty, period)
}

/** Tooling-only paired candidate; baseline resolveRecruitingPeriod is unchanged. */
export function resolveRecruitingPeriodWithEarlyClosePremiumSecondOffer(
  dynasty: DynastyState,
  period: number,
): DynastyState {
  if (!dynasty.recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (period !== dynasty.recruiting.lastResolvedPeriod + 1) throw new RangeError('Recruiting periods must resolve once in canonical order.')
  if (period < 1 || period > REGULAR_SEASON_RECRUITING_PERIODS) throw new RangeError('Recruiting period is outside the regular-season range.')
  if (!dynasty.activeSeason || !isRoundComplete(dynasty.activeSeason, period)) throw new RangeError(`Recruiting Period ${period} requires completed basketball Round ${period}.`)
  return resolveCanonicalPeriod(dynasty, period, true)
}

function postseasonRoundForPeriod(period: number): TournamentRound | undefined {
  return TOURNAMENT_ROUNDS[period - REGULAR_SEASON_RECRUITING_PERIODS - 1]
}

function isPostseasonRoundComplete(
  dynasty: DynastyState,
  round: TournamentRound,
): boolean {
  const postseason = dynasty.activePostseason
  return Boolean(postseason && getGamesForTournamentRound(postseason, round).every(
    ({ id }) => postseason.resultsByGameId[id] !== undefined,
  ))
}

/** Resolves one global Tournament-clock Recruiting period, independent of qualification. */
export function resolvePostseasonRecruitingPeriod(
  dynasty: DynastyState,
  period: number,
): DynastyState {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (period !== recruiting.lastResolvedPeriod + 1) {
    throw new RangeError('Recruiting periods must resolve once in canonical order.')
  }
  const round = postseasonRoundForPeriod(period)
  if (!round || period > FINAL_RECRUITING_PERIOD) {
    throw new RangeError('Recruiting period is outside the postseason range.')
  }
  if (!isPostseasonRoundComplete(dynasty, round)) {
    throw new RangeError(`Recruiting Period ${period} requires completed Tournament round "${round}".`)
  }
  return resolveCanonicalPeriod(dynasty, period)
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

/** Tooling-only paired candidate synchronization. */
export function syncRecruitingThroughCompletedRoundsWithEarlyClosePremiumSecondOffer(
  dynasty: DynastyState,
): DynastyState {
  const season = dynasty.activeSeason
  if (!season || !dynasty.recruiting) throw new RangeError('Recruiting synchronization requires active Season Recruiting.')
  let current = dynasty
  while (current.recruiting!.lastResolvedPeriod < REGULAR_SEASON_RECRUITING_PERIODS && isRoundComplete(season, current.recruiting!.lastResolvedPeriod + 1)) {
    current = resolveRecruitingPeriodWithEarlyClosePremiumSecondOffer(current, current.recruiting!.lastResolvedPeriod + 1)
  }
  return current
}

/** Idempotently catches Recruiting up to every globally completed Tournament round. */
export function syncRecruitingThroughCompletedPostseasonRounds(
  dynasty: DynastyState,
): DynastyState {
  if (!dynasty.activePostseason || !dynasty.recruiting) {
    throw new RangeError('Postseason Recruiting synchronization requires an active Tournament and Recruiting.')
  }
  if (dynasty.recruiting.lastResolvedPeriod < REGULAR_SEASON_RECRUITING_PERIODS) {
    throw new RangeError('Regular-season Recruiting must resolve before postseason Recruiting.')
  }
  let current = dynasty
  while (current.recruiting!.lastResolvedPeriod < FINAL_RECRUITING_PERIOD) {
    const nextPeriod = current.recruiting!.lastResolvedPeriod + 1
    const round = postseasonRoundForPeriod(nextPeriod)!
    if (!isPostseasonRoundComplete(current, round)) break
    current = resolvePostseasonRecruitingPeriod(current, nextPeriod)
  }
  return current
}

/** Absolute per-period effort by active target; never normalized by board size. */
export function deriveProgramActiveEffort(
  recruiting: RecruitingState,
  programId: string,
): Readonly<Record<string, number>> {
  const program = recruiting.programs[programId]
  if (!program) throw new RangeError(`Unknown Recruiting Program "${programId}".`)
  const targets = activeTargets(recruiting, program)
  return Object.fromEntries(
    targets.map((target) => [
      target.playerId,
      RECRUITING_BOARD_BASE_EFFORT +
        (target.isFocused ? RECRUITING_FOCUS_BONUS_EFFORT : 0),
    ]),
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
