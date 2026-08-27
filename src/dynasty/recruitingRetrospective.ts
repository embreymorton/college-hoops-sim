import { calculateOverall, type ClassYear, type Player, type Position } from '../engine'
import type { SeasonState } from '../season'
import type { DynastyState } from './domain'
import type { RecruitStarRating } from './recruiting/domain'

export type RecruitingRetrospectiveOutcome =
  | { readonly kind: 'incoming' }
  | {
      readonly kind: 'active'
      readonly classYear: ClassYear
      readonly currentOverall: number
      readonly currentProgramId: string
    }
  | {
      readonly kind: 'former'
      readonly peakOverall: number
      readonly finalOverall: number
      readonly finalProgramId: string
    }
  | {
      readonly kind: 'unavailable'
      readonly reason: 'missing-player' | 'destination-mismatch' | 'duplicate-player'
    }

export interface RecruitingRetrospectiveRow {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly stars: RecruitStarRating
  readonly nationalRank: number
  readonly entryOverall: number
  readonly entryPotential: number
  readonly signedProgramId: string
  readonly outcome: RecruitingRetrospectiveOutcome
}

export interface RecruitingClassRetrospective {
  readonly targetSeasonNumber: number
  readonly signeeCount: number
  readonly perspectiveProgramSigneeCount: number
  readonly rows: readonly RecruitingRetrospectiveRow[]
}

export interface RecruitingClassIndexEntry {
  readonly targetSeasonNumber: number
  readonly signeeCount: number
  readonly perspectiveProgramSigneeCount: number
}

interface RosterSnapshot {
  readonly seasonNumber: number
  readonly programId: string
  readonly player: Player
  readonly isActive: boolean
}

interface RosterIndex {
  readonly snapshotsByPlayerId: ReadonlyMap<string, readonly RosterSnapshot[]>
  readonly duplicatePlayerIds: ReadonlySet<string>
  readonly latestKnownSeasonNumber: number
}

function buildRosterIndex(dynasty: DynastyState): RosterIndex {
  const snapshotsByPlayerId = new Map<string, RosterSnapshot[]>()
  const duplicatePlayerIds = new Set<string>()
  const seenPlayerSeasons = new Set<string>()
  let latestKnownSeasonNumber = 0

  const addSeason = (season: SeasonState, isActive: boolean) => {
    latestKnownSeasonNumber = Math.max(latestKnownSeasonNumber, season.seasonNumber)
    const seenThisSeason = new Set<string>()
    for (const programId of Object.keys(season.programStates).sort()) {
      for (const player of season.programStates[programId]!.team.roster) {
        const playerSeasonKey = `${season.seasonNumber}:${player.id}`
        if (seenThisSeason.has(player.id) || seenPlayerSeasons.has(playerSeasonKey)) {
          duplicatePlayerIds.add(player.id)
        }
        seenThisSeason.add(player.id)
        seenPlayerSeasons.add(playerSeasonKey)
        const snapshots = snapshotsByPlayerId.get(player.id) ?? []
        snapshots.push({ seasonNumber: season.seasonNumber, programId, player, isActive })
        snapshotsByPlayerId.set(player.id, snapshots)
      }
    }
  }

  for (const archive of dynasty.history) addSeason(archive.season, false)
  if (dynasty.activeSeason) addSeason(dynasty.activeSeason, true)

  for (const snapshots of snapshotsByPlayerId.values()) {
    snapshots.sort((first, second) =>
      first.seasonNumber - second.seasonNumber ||
      first.programId.localeCompare(second.programId),
    )
  }

  return { snapshotsByPlayerId, duplicatePlayerIds, latestKnownSeasonNumber }
}

function deriveOutcome(
  playerId: string,
  signedProgramId: string,
  targetSeasonNumber: number,
  rosterIndex: RosterIndex,
): RecruitingRetrospectiveOutcome {
  if (rosterIndex.duplicatePlayerIds.has(playerId)) {
    return { kind: 'unavailable', reason: 'duplicate-player' }
  }

  const snapshots = rosterIndex.snapshotsByPlayerId.get(playerId) ?? []
  if (snapshots.length === 0) {
    return targetSeasonNumber > rosterIndex.latestKnownSeasonNumber
      ? { kind: 'incoming' }
      : { kind: 'unavailable', reason: 'missing-player' }
  }

  const first = snapshots[0]!
  if (first.programId !== signedProgramId) {
    return { kind: 'unavailable', reason: 'destination-mismatch' }
  }

  const active = snapshots.find(({ isActive }) => isActive)
  if (active) {
    return {
      kind: 'active',
      classYear: active.player.classYear,
      currentOverall: calculateOverall(active.player),
      currentProgramId: active.programId,
    }
  }

  const final = snapshots.at(-1)!
  return {
    kind: 'former',
    peakOverall: Math.max(...snapshots.map(({ player }) => calculateOverall(player))),
    finalOverall: calculateOverall(final.player),
    finalProgramId: final.programId,
  }
}

function findCompletedClass(dynasty: DynastyState, targetSeasonNumber: number) {
  const matches = dynasty.completedRecruitingHistory.filter(
    (completedClass) => completedClass.targetSeasonNumber === targetSeasonNumber,
  )
  if (matches.length !== 1) {
    throw new RangeError(
      matches.length === 0
        ? `No finalized Recruiting class targets Season ${targetSeasonNumber}.`
        : `Dynasty history contains duplicate Recruiting classes targeting Season ${targetSeasonNumber}.`,
    )
  }
  return matches[0]!
}

/** Derives one finalized national signing class without storing retrospective state. */
export function deriveRecruitingClassRetrospective(
  dynasty: DynastyState,
  targetSeasonNumber: number,
  perspectiveProgramId: string | null,
): RecruitingClassRetrospective {
  const completedClass = findCompletedClass(dynasty, targetSeasonNumber)
  const recruiting = completedClass.recruitingState
  const recruitsById = new Map(
    recruiting.recruits.map((recruit) => [recruit.player.id, recruit] as const),
  )
  const rosterIndex = buildRosterIndex(dynasty)

  const rows = Object.values(recruiting.commitmentsByPlayerId).map((commitment) => {
    const recruit = recruitsById.get(commitment.playerId)
    if (!recruit) {
      throw new RangeError(
        `Recruiting commitment references missing Recruit "${commitment.playerId}".`,
      )
    }
    if (commitment.targetSeasonNumber !== targetSeasonNumber) {
      throw new RangeError(
        `Recruiting commitment for "${commitment.playerId}" targets the wrong Season.`,
      )
    }
    return {
      playerId: recruit.player.id,
      firstName: recruit.player.firstName,
      lastName: recruit.player.lastName,
      position: recruit.player.position,
      stars: recruit.stars,
      nationalRank: recruit.nationalRank,
      entryOverall: calculateOverall(recruit.player),
      entryPotential: recruit.player.potential,
      signedProgramId: commitment.programId,
      outcome: deriveOutcome(
        recruit.player.id,
        commitment.programId,
        targetSeasonNumber,
        rosterIndex,
      ),
    }
  }).sort((first, second) =>
    first.nationalRank - second.nationalRank ||
    first.playerId.localeCompare(second.playerId),
  )

  return {
    targetSeasonNumber,
    signeeCount: rows.length,
    perspectiveProgramSigneeCount: rows.filter(
      ({ signedProgramId }) => signedProgramId === perspectiveProgramId,
    ).length,
    rows,
  }
}

/** Lists finalized national signing classes newest first, independent of archive order. */
export function deriveRecruitingClassIndex(
  dynasty: DynastyState,
  perspectiveProgramId: string | null,
): readonly RecruitingClassIndexEntry[] {
  const seen = new Set<number>()
  return [...dynasty.completedRecruitingHistory]
    .sort((first, second) => second.targetSeasonNumber - first.targetSeasonNumber)
    .map(({ targetSeasonNumber }) => {
      if (seen.has(targetSeasonNumber)) {
        throw new RangeError(
          `Dynasty history contains duplicate Recruiting classes targeting Season ${targetSeasonNumber}.`,
        )
      }
      seen.add(targetSeasonNumber)
      const commitments = Object.values(
        findCompletedClass(dynasty, targetSeasonNumber).recruitingState.commitmentsByPlayerId,
      )
      return {
        targetSeasonNumber,
        signeeCount: commitments.length,
        perspectiveProgramSigneeCount: commitments.filter(
          ({ programId }) => programId === perspectiveProgramId,
        ).length,
      }
    })
}
