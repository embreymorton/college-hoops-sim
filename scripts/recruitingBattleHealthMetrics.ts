import type { Position } from '../src/engine'
import {
  deriveRecruitingBattleView,
  deriveCommitmentConfidenceThresholds,
  deriveRecruitProgramStandings,
  deriveRemainingOpeningsByPosition,
  deriveTargetStatus,
  getRecruit,
  MIN_MEANINGFUL_RELATIONSHIP,
  type DynastyState,
  type Recruit,
  type RecruitingReadiness,
} from '../src/dynasty'

export type CountBucket = '0' | '1' | '2' | '3+'
export type SparseCompetitionReason =
  | 'limited-positional-demand'
  | 'board-pursuit-without-offer-capacity'
  | 'eligible-programs-chose-other-targets'
  | 'board-capacity-observed'
  | 'unclassified-observable-constraint'

export interface PlanCoherenceObservation {
  readonly programKind:
    | 'controlled-baseline'
    | 'controlled-candidate'
    | 'ai'
  readonly focused: number
  readonly focusedOffered: number
  readonly missingOfferReasons: Readonly<Record<string, number>>
}

export function countBucket(count: number): CountBucket {
  if (count >= 3) return '3+'
  return String(Math.max(0, count)) as CountBucket
}

export function observePlanCoherence(
  dynasty: DynastyState,
  programId: string,
  programKind: PlanCoherenceObservation['programKind'],
): PlanCoherenceObservation {
  const recruiting = dynasty.recruiting!
  const program = recruiting.programs[programId]!
  const focused = program.board.filter(
    (target) =>
      target.isFocused &&
      deriveTargetStatus(recruiting, programId, target.playerId) === 'active',
  )
  const missingOfferReasons: Record<string, number> = {}
  for (const target of focused.filter(({ hasActiveOffer }) => !hasActiveOffer)) {
    const recruit = getRecruit(recruiting, target.playerId)!
    const remaining = deriveRemainingOpeningsByPosition(recruiting, program)[
      recruit.player.position
    ]
    const activeOffers = program.board.filter((candidate) => {
      const candidateRecruit = getRecruit(recruiting, candidate.playerId)
      return (
        candidate.hasActiveOffer &&
        candidateRecruit?.player.position === recruit.player.position &&
        deriveTargetStatus(recruiting, programId, candidate.playerId) === 'active'
      )
    }).length
    const reason =
      remaining <= 0
        ? 'no-remaining-position-opening'
        : activeOffers >= remaining
          ? 'offer-capacity-used-by-other-target'
          : 'planner-selected-other-target'
    missingOfferReasons[reason] = (missingOfferReasons[reason] ?? 0) + 1
  }
  return {
    programKind,
    focused: focused.length,
    focusedOffered: focused.filter(({ hasActiveOffer }) => hasActiveOffer).length,
    missingOfferReasons,
  }
}

export interface CompetitionObservation {
  readonly stars: Recruit['stars']
  readonly pursuers: number
  readonly offers: number
}

export function observeRecruitCompetition(
  dynasty: DynastyState,
  recruit: Recruit,
): CompetitionObservation {
  const view = deriveRecruitingBattleView(dynasty, recruit.player.id)
  return {
    stars: recruit.stars,
    pursuers: view.pursuingPrograms.length,
    offers: view.pursuingPrograms.filter(({ hasActiveOffer }) => hasActiveOffer)
      .length,
  }
}

export function classifySparseCompetitionReason(
  dynasty: DynastyState,
  recruit: Recruit,
): SparseCompetitionReason {
  const recruiting = dynasty.recruiting!
  const position: Position = recruit.player.position
  const programsWithNeed = Object.values(recruiting.programs).filter(
    (program) =>
      deriveRemainingOpeningsByPosition(recruiting, program)[position] > 0,
  )
  if (programsWithNeed.length <= 1) return 'limited-positional-demand'

  const pursuing = programsWithNeed.filter((program) =>
    program.board.some(({ playerId }) => playerId === recruit.player.id),
  )
  if (
    pursuing.some((program) => {
      const target = program.board.find(
        ({ playerId }) => playerId === recruit.player.id,
      )!
      if (target.hasActiveOffer) return false
      const remaining = deriveRemainingOpeningsByPosition(recruiting, program)[
        position
      ]
      const offeredAtPosition = program.board.filter((candidate) => {
        const candidateRecruit = getRecruit(recruiting, candidate.playerId)
        return candidate.hasActiveOffer && candidateRecruit?.player.position === position
      }).length
      return offeredAtPosition >= remaining
    })
  ) {
    return 'board-pursuit-without-offer-capacity'
  }
  const nonPursuing = programsWithNeed.filter(
    (program) =>
      !program.board.some(({ playerId }) => playerId === recruit.player.id),
  )
  if (nonPursuing.length > 0 && nonPursuing.every(({ board }) => board.length >= 10)) {
    return 'board-capacity-observed'
  }
  if (pursuing.length < programsWithNeed.length) {
    return 'eligible-programs-chose-other-targets'
  }
  return 'unclassified-observable-constraint'
}

export interface ReadinessTransitionObservation {
  readonly stars: Recruit['stars']
  readonly readiness: RecruitingReadiness
  readonly legacyReadiness: 'early' | Exclude<RecruitingReadiness, 'not-deciding' | 'decision-soon'>
  readonly decisionSoonBecomesEligibleNextPeriod: boolean
  readonly firstDecisionReadyPeriod: boolean
  readonly eventualWinnerWasLeading: boolean
  readonly eventualWinnerMetStandingGate: boolean
  readonly eventualWinnerMetSeparationGate: boolean
}

export function observeReadinessBeforeCommitment(
  before: DynastyState,
  playerId: string,
  commitmentPeriod: number,
  winnerProgramId: string,
): ReadinessTransitionObservation {
  const recruiting = before.recruiting!
  const recruit = getRecruit(recruiting, playerId)!
  const view = deriveRecruitingBattleView(before, playerId)
  const standings = deriveRecruitProgramStandings(before, playerId).filter(
    ({ programId }) => {
      const program = recruiting.programs[programId]!
      return (
        program.board.some(
          (target) => target.playerId === playerId && target.hasActiveOffer,
        ) &&
        deriveTargetStatus(recruiting, programId, playerId) === 'active' &&
        (recruiting.relationshipProgressByPlayerId[playerId]?.[programId] ?? 0) >=
          MIN_MEANINGFUL_RELATIONSHIP
      )
    },
  )
  const winner = standings.find(({ programId }) => programId === winnerProgramId)!
  const runnerUp = standings.find(({ programId }) => programId !== winnerProgramId)
  const confidence = deriveCommitmentConfidenceThresholds(recruit, commitmentPeriod)
  return {
    stars: recruit.stars,
    readiness: view.readiness,
    legacyReadiness:
      recruiting.lastResolvedPeriod < recruit.decisionReadyPeriod
        ? 'early'
        : view.readiness as Exclude<
            RecruitingReadiness,
            'not-deciding' | 'decision-soon'
          >,
    decisionSoonBecomesEligibleNextPeriod:
      view.readiness !== 'decision-soon' ||
      recruiting.lastResolvedPeriod + 1 === recruit.decisionReadyPeriod,
    firstDecisionReadyPeriod: commitmentPeriod === recruit.decisionReadyPeriod,
    eventualWinnerWasLeading:
      view.pursuingPrograms[0]?.programId === winnerProgramId,
    eventualWinnerMetStandingGate:
      winner !== undefined && winner.standing >= confidence.standing,
    eventualWinnerMetSeparationGate:
      winner !== undefined &&
      winner.standing - (runnerUp?.standing ?? 0) >= confidence.separation,
  }
}
