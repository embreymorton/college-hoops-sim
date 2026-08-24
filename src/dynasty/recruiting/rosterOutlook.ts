import {
  POSITIONS,
  TEAM_ROSTER_SIZE,
  calculateOverall,
  type ClassYear,
  type Player,
  type Position,
} from '../../engine'
import type { DynastyState } from '../domain'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import {
  deriveProgramCommitments,
  deriveRemainingOpeningsByPosition,
  getRecruit,
} from './queries'

export interface NextSeasonRosterOutlookPlayer {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly projectedClassYear: ClassYear
  readonly currentOverall: number
  readonly potential: number
  readonly status: 'returning' | 'incoming'
}

export interface NextSeasonRosterOutlookPositionGroup {
  readonly position: Position
  readonly players: readonly NextSeasonRosterOutlookPlayer[]
  readonly remainingOpenings: number
}

export interface NextSeasonRosterOutlookDeparture {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly currentOverall: number
}

export interface NextSeasonRosterOutlook {
  readonly programId: string
  readonly targetSeasonNumber: number
  readonly projectedPlayerCount: number
  readonly remainingOpeningCount: number
  readonly positionGroups: readonly NextSeasonRosterOutlookPositionGroup[]
  readonly departures: readonly NextSeasonRosterOutlookDeparture[]
}

const NEXT_CLASS = {
  FR: 'SO',
  SO: 'JR',
  JR: 'SR',
} as const satisfies Readonly<Record<Exclude<ClassYear, 'SR'>, ClassYear>>

const positionRank = new Map(POSITIONS.map((position, index) => [position, index]))

function compareIdentity(
  first: Pick<NextSeasonRosterOutlookPlayer, 'lastName' | 'firstName' | 'playerId'>,
  second: Pick<NextSeasonRosterOutlookPlayer, 'lastName' | 'firstName' | 'playerId'>,
): number {
  return first.lastName.localeCompare(second.lastName) ||
    first.firstName.localeCompare(second.firstName) ||
    first.playerId.localeCompare(second.playerId)
}

function rowFromPlayer(
  player: Player,
  status: NextSeasonRosterOutlookPlayer['status'],
  projectedClassYear: ClassYear,
): NextSeasonRosterOutlookPlayer {
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    projectedClassYear,
    currentOverall: calculateOverall(player),
    potential: player.potential,
    status,
  }
}

/** Factual controlled-Program Season N+1 roster projection during Recruiting. */
export function deriveNextSeasonRosterOutlook(
  dynasty: DynastyState,
): NextSeasonRosterOutlook {
  const season = dynasty.activeSeason
  const recruiting = dynasty.recruiting
  if (!season) throw new RangeError('Next season roster outlook requires an active Season.')
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')
  if (recruiting.targetSeasonNumber !== season.seasonNumber + 1) {
    throw new RangeError('Recruiting and active Season target different lifecycle years.')
  }

  const programId = dynasty.controlledProgramId
  const team = season.programStates[programId]?.team
  const program = recruiting.programs[programId]
  if (!team || !program) {
    throw new RangeError(`Unknown controlled Recruiting Program "${programId}".`)
  }

  const genericOutlook = deriveProjectedRosterOutlook(team)
  for (const position of POSITIONS) {
    if (genericOutlook.projectedOpeningsByPosition[position] !== program.projectedOpeningsByPosition[position]) {
      throw new RangeError(`Recruiting opening facts do not match current ${position} senior departures.`)
    }
  }

  const seenPlayerIds = new Set<string>()
  const returning: NextSeasonRosterOutlookPlayer[] = []
  const departures: NextSeasonRosterOutlookDeparture[] = []
  for (const player of team.roster) {
    if (seenPlayerIds.has(player.id)) {
      throw new RangeError(`Projected roster contains duplicate Player ID "${player.id}".`)
    }
    seenPlayerIds.add(player.id)
    if (player.classYear === 'SR') {
      departures.push({
        playerId: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
        currentOverall: calculateOverall(player),
      })
    } else {
      returning.push(rowFromPlayer(player, 'returning', NEXT_CLASS[player.classYear]))
    }
  }

  const incoming: NextSeasonRosterOutlookPlayer[] = []
  const committedByPosition = Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
  for (const commitment of deriveProgramCommitments(recruiting, programId)) {
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
    committedByPosition[recruit.player.position] += 1
    if (committedByPosition[recruit.player.position] > program.projectedOpeningsByPosition[recruit.player.position]) {
      throw new RangeError(`Controlled commitments exceed projected ${recruit.player.position} capacity.`)
    }
    incoming.push(rowFromPlayer(recruit.player, 'incoming', 'FR'))
  }

  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  const positionGroups = POSITIONS.map((position) => ({
    position,
    players: [
      ...returning.filter((player) => player.position === position).sort(compareIdentity),
      ...incoming.filter((player) => player.position === position).sort(compareIdentity),
    ],
    remainingOpenings: remaining[position],
  }))
  const projectedPlayerCount = returning.length + incoming.length
  const remainingOpeningCount = POSITIONS.reduce((sum, position) => sum + remaining[position], 0)
  if (projectedPlayerCount + remainingOpeningCount !== TEAM_ROSTER_SIZE) {
    throw new RangeError('Projected roster membership and openings do not equal roster capacity.')
  }

  departures.sort((first, second) =>
    positionRank.get(first.position)! - positionRank.get(second.position)! || compareIdentity(first, second),
  )
  return {
    programId,
    targetSeasonNumber: recruiting.targetSeasonNumber,
    projectedPlayerCount,
    remainingOpeningCount,
    positionGroups,
    departures,
  }
}
