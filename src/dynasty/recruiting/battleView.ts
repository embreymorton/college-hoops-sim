import type { DynastyState } from '../domain'
import { MIN_MEANINGFUL_RELATIONSHIP } from './constants'
import type {
  Recruit,
  RecruitingCommitment,
  RecruitingTargetStatus,
} from './domain'
import {
  deriveRecruitProgramStandings,
  deriveTargetStatus,
  getRecruit,
} from './queries'
import { deriveCommitmentConfidenceThresholds } from './simulation'

export type RecruitingReadiness =
  | 'not-deciding'
  | 'decision-soon'
  | 'developing'
  | 'serious'
  | 'decision-imminent'
  | 'committed'

export type RecruitingBattlePosition =
  | 'leading'
  | 'competitive'
  | 'trailing'

export type ControlledRecruitingPosition =
  | RecruitingBattlePosition
  | 'not-pursuing'
  | 'committed-to-us'
  | 'committed-elsewhere'

export interface RecruitingBattleProgramView {
  readonly programId: string
  /** Rank among Programs with this Recruit on their current Board. */
  readonly pursuitRank: number
  readonly hasActiveOffer: boolean
  readonly position: RecruitingBattlePosition
}

export interface ControlledRecruitingBattleView {
  readonly isOnBoard: boolean
  readonly isFocused: boolean
  readonly hasActiveOffer: boolean
  readonly targetStatus: RecruitingTargetStatus | 'not-on-board'
  readonly position: ControlledRecruitingPosition
}

export interface RecruitingBattleView {
  readonly playerId: string
  readonly readiness: RecruitingReadiness
  readonly commitment: RecruitingCommitment | null
  readonly controlled: ControlledRecruitingBattleView
  /** Public pursuit projection; raw attraction, progress, and thresholds stay hidden. */
  readonly pursuingPrograms: readonly RecruitingBattleProgramView[]
}

export type RecruitingCommitmentActivityKind =
  | 'committed-to-controlled'
  | 'tracked-committed-elsewhere'

export interface RecruitingCommitmentActivity {
  readonly kind: RecruitingCommitmentActivityKind
  readonly playerId: string
  readonly programId: string
  readonly timing: RecruitingCommitment['timing']
  readonly wasFocused: boolean
}

function currentPursuers(dynasty: DynastyState, playerId: string) {
  const recruiting = dynasty.recruiting!
  const standingsByProgram = new Map(
    deriveRecruitProgramStandings(dynasty, playerId).map((entry) => [
      entry.programId,
      entry,
    ]),
  )

  return Object.values(recruiting.programs)
    .filter(
      (program) =>
        program.board.some((target) => target.playerId === playerId) &&
        deriveTargetStatus(recruiting, program.programId, playerId) === 'active',
    )
    .map((program) => ({
      program,
      target: program.board.find((target) => target.playerId === playerId)!,
      standing: standingsByProgram.get(program.programId)!,
    }))
    .sort(
      (first, second) =>
        second.standing.standing - first.standing.standing ||
        first.program.programId.localeCompare(second.program.programId),
    )
}

function eligibleCommitmentPursuers(
  dynasty: DynastyState,
  playerId: string,
) {
  const recruiting = dynasty.recruiting!
  return currentPursuers(dynasty, playerId).filter(
    ({ program, target }) =>
      target.hasActiveOffer &&
      deriveTargetStatus(recruiting, program.programId, playerId) === 'active' &&
      (recruiting.relationshipProgressByPlayerId[playerId]?.[
        program.programId
      ] ?? 0) >= MIN_MEANINGFUL_RELATIONSHIP,
  )
}

function deriveReadiness(
  dynasty: DynastyState,
  recruit: Recruit,
): RecruitingReadiness {
  const recruiting = dynasty.recruiting!
  if (recruiting.commitmentsByPlayerId[recruit.player.id]) return 'committed'
  const candidates = eligibleCommitmentPursuers(dynasty, recruit.player.id)
  const leader = candidates[0]
  const runnerUp = candidates[1]

  if (recruiting.lastResolvedPeriod < recruit.decisionReadyPeriod) {
    if (
      recruiting.lastResolvedPeriod + 1 !== recruit.decisionReadyPeriod ||
      !leader
    ) {
      return 'not-deciding'
    }
    const nextPeriodThresholds = deriveCommitmentConfidenceThresholds(
      recruit,
      recruit.decisionReadyPeriod,
    )
    return leader.standing.standing >= nextPeriodThresholds.standing &&
      leader.standing.standing - (runnerUp?.standing.standing ?? 0) >=
        nextPeriodThresholds.separation
      ? 'decision-soon'
      : 'not-deciding'
  }

  if (!leader) return 'developing'
  const thresholds = deriveCommitmentConfidenceThresholds(
    recruit,
    recruiting.lastResolvedPeriod,
  )
  if (leader.standing.standing < thresholds.standing) return 'developing'

  if (
    leader.standing.standing - (runnerUp?.standing.standing ?? 0) <
    thresholds.separation
  ) {
    return 'serious'
  }
  return 'decision-imminent'
}

/**
 * Player-safe projection of the canonical Recruiting contest. Exact attraction,
 * relationship totals, thresholds, AI utility, and future probabilities are
 * intentionally omitted.
 */
export function deriveRecruitingBattleView(
  dynasty: DynastyState,
  playerId: string,
): RecruitingBattleView {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)

  const commitment = recruiting.commitmentsByPlayerId[playerId] ?? null
  const pursuers = currentPursuers(dynasty, playerId)
  const confidence = deriveCommitmentConfidenceThresholds(
    recruit,
    recruiting.lastResolvedPeriod,
  )
  const leadingStanding = pursuers[0]?.standing.standing
  const pursuingPrograms = pursuers.map(
    ({ program, target, standing }, index): RecruitingBattleProgramView => ({
      programId: program.programId,
      pursuitRank: index + 1,
      hasActiveOffer: target.hasActiveOffer,
      position:
        index === 0
          ? 'leading'
          : leadingStanding !== undefined &&
              leadingStanding - standing.standing < confidence.separation
            ? 'competitive'
            : 'trailing',
    }),
  )

  const controlledProgramId = dynasty.controlledProgramId
  const controlledProgram = recruiting.programs[controlledProgramId]
  const controlledTarget = controlledProgram?.board.find(
    (target) => target.playerId === playerId,
  )
  const controlledPursuit = pursuingPrograms.find(
    ({ programId }) => programId === controlledProgramId,
  )
  const targetStatus = controlledTarget
    ? deriveTargetStatus(recruiting, controlledProgramId, playerId)
    : 'not-on-board'
  const controlledPosition: ControlledRecruitingPosition = commitment
    ? commitment.programId === controlledProgramId
      ? 'committed-to-us'
      : 'committed-elsewhere'
    : controlledPursuit?.position ?? 'not-pursuing'

  return {
    playerId,
    readiness: deriveReadiness(dynasty, recruit),
    commitment,
    controlled: {
      isOnBoard: controlledTarget !== undefined,
      isFocused: controlledTarget?.isFocused ?? false,
      hasActiveOffer: controlledTarget?.hasActiveOffer ?? false,
      targetStatus,
      position: controlledPosition,
    },
    pursuingPrograms,
  }
}

/**
 * Derives only commitment events that remain provable from current canonical
 * state. Standing movement is intentionally absent because no snapshots exist.
 */
export function deriveRecruitingCommitmentActivity(
  dynasty: DynastyState,
  sincePeriodExclusive = -1,
): RecruitingCommitmentActivity[] {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  const controlled = recruiting.programs[dynasty.controlledProgramId]
  const controlledTargets = new Map(
    controlled?.board.map((target) => [target.playerId, target]) ?? [],
  )

  return Object.values(recruiting.commitmentsByPlayerId)
    .filter((commitment) => {
      const period =
        commitment.timing.kind === 'period'
          ? commitment.timing.period
          : Number.MAX_SAFE_INTEGER
      return (
        period > sincePeriodExclusive &&
        (commitment.programId === dynasty.controlledProgramId ||
          controlledTargets.has(commitment.playerId))
      )
    })
    .sort((first, second) => {
      const firstPeriod =
        first.timing.kind === 'period'
          ? first.timing.period
          : Number.MAX_SAFE_INTEGER
      const secondPeriod =
        second.timing.kind === 'period'
          ? second.timing.period
          : Number.MAX_SAFE_INTEGER
      return (
        secondPeriod - firstPeriod ||
        first.playerId.localeCompare(second.playerId)
      )
    })
    .map((commitment) => ({
      kind:
        commitment.programId === dynasty.controlledProgramId
          ? 'committed-to-controlled'
          : 'tracked-committed-elsewhere',
      playerId: commitment.playerId,
      programId: commitment.programId,
      timing: commitment.timing,
      wasFocused: controlledTargets.get(commitment.playerId)?.isFocused ?? false,
    }))
}
