import { calculateOverall, type ClassYear, type Player, type Position } from '../../engine'
import type { DynastyState } from '../domain'
import { deriveProgramCommitments, deriveTargetStatus, getRecruit } from './queries'

export type RecruitPositionOutlookRowKind =
  | 'returner'
  | 'incoming-commitment'
  | 'viewed-hypothetical'

export type RecruitPositionOutlookInclusion =
  | 'hypothetical'
  | 'committed'
  | 'excluded-committed-elsewhere'
  | 'excluded-position-filled'

export interface RecruitPositionOutlookRow {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly kind: RecruitPositionOutlookRowKind
  readonly projectedClassYear: ClassYear
  readonly currentOverall: number
  readonly potential: number
  readonly isViewedRecruit: boolean
  /** Competition rank based only on current OVR. */
  readonly rank: number
  readonly isTiedAtRank: boolean
}

export interface RecruitPositionOutlookDeparture {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly currentOverall: number
}

export interface RecruitPositionOutlook {
  readonly position: Position
  readonly targetSeasonNumber: number
  readonly rows: readonly RecruitPositionOutlookRow[]
  readonly departures: readonly RecruitPositionOutlookDeparture[]
  readonly returningCount: number
  readonly viewedRecruitInclusion: RecruitPositionOutlookInclusion
  readonly viewedRecruitRank: number | null
  readonly viewedRecruitIsTiedAtRank: boolean
}

const NEXT_CLASS = {
  FR: 'SO',
  SO: 'JR',
  JR: 'SR',
} as const satisfies Readonly<Record<Exclude<ClassYear, 'SR'>, ClassYear>>

type UnrankedRow = Omit<RecruitPositionOutlookRow, 'rank' | 'isTiedAtRank'>

function rowFromPlayer(
  player: Player,
  kind: RecruitPositionOutlookRowKind,
  projectedClassYear: ClassYear,
  viewedPlayerId: string,
): UnrankedRow {
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    kind,
    projectedClassYear,
    currentOverall: calculateOverall(player),
    potential: player.potential,
    isViewedRecruit: player.id === viewedPlayerId,
  }
}

/**
 * Projects the controlled Program's natural-position group for one Recruit.
 * It composes frozen Recruiting capacity and live commitments without changing
 * either, and deliberately does not forecast Development or Rotation usage.
 */
export function deriveRecruitPositionOutlook(
  dynasty: DynastyState,
  playerId: string,
): RecruitPositionOutlook {
  const recruiting = dynasty.recruiting
  const season = dynasty.activeSeason
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (!season) throw new RangeError('Recruit position outlook requires an active Season.')

  const viewedRecruit = getRecruit(recruiting, playerId)
  if (!viewedRecruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)
  const controlledProgram = recruiting.programs[dynasty.controlledProgramId]
  const team = season.programStates[dynasty.controlledProgramId]?.team
  if (!controlledProgram || !team) {
    throw new RangeError(`Unknown controlled Recruiting Program "${dynasty.controlledProgramId}".`)
  }
  if (recruiting.targetSeasonNumber !== season.seasonNumber + 1) {
    throw new RangeError('Recruiting and active Season target different lifecycle years.')
  }

  const position = viewedRecruit.player.position
  const returningPlayers = team.roster.filter(
    (player): player is Player & { classYear: Exclude<ClassYear, 'SR'> } =>
      player.position === position && player.classYear !== 'SR',
  )
  const departures = team.roster
    .filter((player) => player.position === position && player.classYear === 'SR')
    .map((player) => ({
      playerId: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      currentOverall: calculateOverall(player),
    }))
    .sort((first, second) =>
      second.currentOverall - first.currentOverall || first.playerId.localeCompare(second.playerId),
    )

  const rows: UnrankedRow[] = returningPlayers.map((player) =>
    rowFromPlayer(player, 'returner', NEXT_CLASS[player.classYear], playerId),
  )
  const seenPlayerIds = new Set(team.roster.map(({ id }) => id))
  const controlledCommitments = deriveProgramCommitments(recruiting, dynasty.controlledProgramId)
  for (const commitment of controlledCommitments) {
    if (
      commitment.targetSeasonNumber !== recruiting.targetSeasonNumber ||
      recruiting.commitmentsByPlayerId[commitment.playerId] !== commitment
    ) {
      throw new RangeError(`Invalid Recruiting commitment for Player "${commitment.playerId}".`)
    }
    const recruit = getRecruit(recruiting, commitment.playerId)
    if (!recruit) {
      throw new RangeError(`Commitment references unknown Recruit Player ID "${commitment.playerId}".`)
    }
    if (seenPlayerIds.has(recruit.player.id)) {
      throw new RangeError(`Projected roster contains duplicate Player ID "${recruit.player.id}".`)
    }
    seenPlayerIds.add(recruit.player.id)
    if (recruit.player.position === position) {
      rows.push(rowFromPlayer(recruit.player, 'incoming-commitment', 'FR', playerId))
    }
  }

  const targetStatus = deriveTargetStatus(recruiting, dynasty.controlledProgramId, playerId)
  let viewedRecruitInclusion: RecruitPositionOutlookInclusion
  if (targetStatus === 'committed') {
    viewedRecruitInclusion = 'committed'
    if (!rows.some((row) => row.playerId === playerId)) {
      throw new RangeError(`Controlled commitment is missing viewed Recruit "${playerId}".`)
    }
  } else if (targetStatus === 'committed-elsewhere') {
    viewedRecruitInclusion = 'excluded-committed-elsewhere'
  } else if (targetStatus === 'position-filled' || recruiting.phase === 'finalized') {
    viewedRecruitInclusion = 'excluded-position-filled'
  } else {
    viewedRecruitInclusion = 'hypothetical'
    if (seenPlayerIds.has(playerId)) {
      throw new RangeError(`Projected roster contains duplicate Player ID "${playerId}".`)
    }
    rows.push(rowFromPlayer(viewedRecruit.player, 'viewed-hypothetical', 'FR', playerId))
  }

  rows.sort((first, second) =>
    second.currentOverall - first.currentOverall || first.playerId.localeCompare(second.playerId),
  )
  const rankedRows: RecruitPositionOutlookRow[] = rows.map((row, index) => {
    const rank = rows.findIndex(({ currentOverall }) => currentOverall === row.currentOverall) + 1
    return {
      ...row,
      rank,
      isTiedAtRank: rows.some(
        (other, otherIndex) => otherIndex !== index && other.currentOverall === row.currentOverall,
      ),
    }
  })
  const viewedRow = rankedRows.find(({ isViewedRecruit }) => isViewedRecruit)

  return {
    position,
    targetSeasonNumber: recruiting.targetSeasonNumber,
    rows: rankedRows,
    departures,
    returningCount: returningPlayers.length,
    viewedRecruitInclusion,
    viewedRecruitRank: viewedRow?.rank ?? null,
    viewedRecruitIsTiedAtRank: viewedRow?.isTiedAtRank ?? false,
  }
}
