import type { DynastyState } from '../domain'
import { requireControlledProgram } from '../control'
import {
  deriveRecruitingBattleView,
  type ControlledRecruitingPosition,
  type RecruitingReadiness,
} from './battleView'
import type { RecruitingCommitment } from './domain'
import { getRecruit } from './queries'

export type RecruitingMarketTier = 'forming' | 'open' | 'active' | 'crowded'

export interface RecruitMarketView {
  readonly playerId: string
  readonly tier: RecruitingMarketTier
  readonly isForming: boolean
  readonly activeProgramCount: number | null
  readonly activeOfferCount: number | null
  readonly controlledHasActiveOffer: boolean
  readonly isOpenRecruitmentOpportunity: boolean
}

/** Presentation-only thresholds: light, normal, and genuinely broad competition. */
export function deriveRecruitingMarketTier(activeProgramCount: number): Exclude<RecruitingMarketTier, 'forming'> {
  if (activeProgramCount <= 1) return 'open'
  if (activeProgramCount <= 4) return 'active'
  return 'crowded'
}

/** Player-safe current-market projection. No hidden Recruiting inputs escape this boundary. */
export function deriveRecruitMarketView(dynasty: DynastyState, playerId: string): RecruitMarketView {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)
  const battle = deriveRecruitingBattleView(dynasty, playerId)
  const isForming = recruiting.lastResolvedPeriod === 0
  const activeProgramCount = battle.pursuingPrograms.length
  const activeOfferCount = battle.pursuingPrograms.filter(({ hasActiveOffer }) => hasActiveOffer).length
  const tier = isForming ? 'forming' : deriveRecruitingMarketTier(activeProgramCount)
  return {
    playerId,
    tier,
    isForming,
    activeProgramCount: isForming ? null : activeProgramCount,
    activeOfferCount: isForming ? null : activeOfferCount,
    controlledHasActiveOffer: battle.controlled.hasActiveOffer,
    isOpenRecruitmentOpportunity:
      !isForming &&
      battle.commitment === null &&
      recruit.stars >= 4 &&
      tier === 'open' &&
      activeOfferCount <= 1 &&
      battle.readiness !== 'decision-soon' &&
      battle.readiness !== 'decision-imminent',
  }
}

export interface RecruitingPulseRecruitSnapshot {
  readonly playerId: string
  readonly nationalRank: number
  readonly isOnControlledBoard: boolean
  readonly isFocused: boolean
  readonly activeProgramIds: readonly string[]
  readonly activeOfferProgramIds: readonly string[]
  readonly controlledPosition: ControlledRecruitingPosition
  readonly readiness: RecruitingReadiness
  readonly marketTier: RecruitingMarketTier
  readonly commitment: RecruitingCommitment | null
}

export interface RecruitingPulseSnapshot {
  readonly baselinePeriod: number
  readonly recruits: readonly RecruitingPulseRecruitSnapshot[]
}

export function deriveRecruitingPulseSnapshot(
  dynasty: DynastyState,
  followedRecruitIds: readonly string[] = [],
): RecruitingPulseSnapshot | null {
  const recruiting = dynasty.recruiting
  if (!recruiting) return null
  const controlledProgramId = requireControlledProgram(dynasty)
  const controlled = recruiting.programs[controlledProgramId]
  const boardIds = controlled?.board.map(({ playerId }) => playerId) ?? []
  const trackedIds = [...new Set([...boardIds, ...followedRecruitIds])]
    .filter((playerId) => getRecruit(recruiting, playerId) !== undefined)
    .sort()
  return {
    baselinePeriod: recruiting.lastResolvedPeriod,
    recruits: trackedIds.map((playerId) => {
      const recruit = getRecruit(recruiting, playerId)!
      const battle = deriveRecruitingBattleView(dynasty, playerId)
      const market = deriveRecruitMarketView(dynasty, playerId)
      const target = controlled?.board.find((entry) => entry.playerId === playerId)
      return {
        playerId,
        nationalRank: recruit.nationalRank,
        isOnControlledBoard: target !== undefined,
        isFocused: target?.isFocused ?? false,
        activeProgramIds: battle.pursuingPrograms.map(({ programId }) => programId),
        activeOfferProgramIds: battle.pursuingPrograms.filter(({ hasActiveOffer }) => hasActiveOffer).map(({ programId }) => programId),
        controlledPosition: battle.controlled.position,
        readiness: battle.readiness,
        marketTier: market.tier,
        commitment: battle.commitment,
      }
    }),
  }
}

export type RecruitingPulseKind =
  | 'committed-to-controlled'
  | 'focused-committed-elsewhere'
  | 'tracked-committed-elsewhere'
  | 'readiness-escalated'
  | 'position-fell'
  | 'position-improved'
  | 'new-offer'
  | 'major-competitor-entered'
  | 'market-tier-changed'

export interface RecruitingPulseFact {
  readonly kind: RecruitingPulseKind
  readonly playerId: string
  readonly programId?: string
  readonly from?: string
  readonly to?: string
  readonly priority: number
}

const competitivePosition = (position: ControlledRecruitingPosition) =>
  position === 'leading' || position === 'competitive' || position === 'trailing'

/** Deterministic latest-action comparison. Commitments suppress obsolete movement for the same Recruit. */
export function deriveRecruitingPulse(
  baseline: RecruitingPulseSnapshot | null,
  dynasty: DynastyState,
): RecruitingPulseFact[] {
  if (!baseline || !dynasty.recruiting) return []
  const controlledProgramId = requireControlledProgram(dynasty)
  const current = deriveRecruitingPulseSnapshot(dynasty, baseline.recruits.map(({ playerId }) => playerId))
  if (!current) return []
  const currentById = new Map(current.recruits.map((row) => [row.playerId, row]))
  const facts: RecruitingPulseFact[] = []
  for (const before of baseline.recruits) {
    const after = currentById.get(before.playerId)
    if (!after) continue
    if (!before.commitment && after.commitment) {
      facts.push({
        kind: after.commitment.programId === controlledProgramId
          ? 'committed-to-controlled'
          : before.isFocused ? 'focused-committed-elsewhere' : 'tracked-committed-elsewhere',
        playerId: before.playerId,
        programId: after.commitment.programId,
        priority: after.commitment.programId === controlledProgramId ? 1 : before.isFocused ? 2 : 7,
      })
      continue
    }
    if (after.commitment) continue
    if (before.readiness !== after.readiness && (after.readiness === 'decision-imminent' || after.readiness === 'decision-soon')) {
      facts.push({ kind: 'readiness-escalated', playerId: before.playerId, from: before.readiness, to: after.readiness, priority: 3 })
    }
    if (competitivePosition(before.controlledPosition) && competitivePosition(after.controlledPosition)) {
      const order = { leading: 0, competitive: 1, trailing: 2 } as const
      const from = before.controlledPosition as keyof typeof order
      const to = after.controlledPosition as keyof typeof order
      if (order[to] > order[from]) facts.push({ kind: 'position-fell', playerId: before.playerId, from, to, priority: 4 })
      if (order[to] < order[from]) facts.push({ kind: 'position-improved', playerId: before.playerId, from, to, priority: 6 })
    }
    const newOffers = after.activeOfferProgramIds.filter((id) => id !== controlledProgramId && !before.activeOfferProgramIds.includes(id))
    if (before.isOnControlledBoard && newOffers.length) {
      facts.push({ kind: 'new-offer', playerId: before.playerId, programId: newOffers.sort()[0], priority: before.isFocused ? 5 : 6 })
    }
    const newPrograms = after.activeProgramIds.filter((id) => id !== controlledProgramId && !before.activeProgramIds.includes(id))
    const major = newPrograms.find((programId) => {
      const battle = deriveRecruitingBattleView(dynasty, before.playerId)
      const row = battle.pursuingPrograms.find((entry) => entry.programId === programId)
      return row?.position === 'leading' || row?.position === 'competitive'
    })
    if (before.isOnControlledBoard && major && !newOffers.includes(major)) {
      facts.push({ kind: 'major-competitor-entered', playerId: before.playerId, programId: major, priority: before.isFocused ? 5 : 6 })
    }
    if (before.marketTier !== 'forming' && after.marketTier !== 'forming' && before.marketTier !== after.marketTier) {
      facts.push({ kind: 'market-tier-changed', playerId: before.playerId, from: before.marketTier, to: after.marketTier, priority: 6 })
    }
  }
  return facts
    .sort((a, b) => a.priority - b.priority || (baseline.recruits.find((r) => r.playerId === a.playerId)?.nationalRank ?? 999) - (baseline.recruits.find((r) => r.playerId === b.playerId)?.nationalRank ?? 999) || a.playerId.localeCompare(b.playerId) || a.kind.localeCompare(b.kind))
    .filter((fact, index, all) => all.findIndex((row) => row.playerId === fact.playerId && row.kind === fact.kind) === index)
    .slice(0, 3)
}
