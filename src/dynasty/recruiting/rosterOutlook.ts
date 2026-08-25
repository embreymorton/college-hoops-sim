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
  deriveFlexibleOpenings,
  deriveMandatoryNeedsByPosition,
  deriveProgramCommitments,
  deriveProjectedCountsByPosition,
  deriveRemainingOpeningsByPosition,
  deriveRemainingScholarships,
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
  readonly projectedCount: number
  readonly mandatoryNeed: number
  readonly flexibleEligible: boolean
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
  readonly mandatoryNeedCount: number
  readonly flexibleOpeningCount: number
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
  if (!('capacityModel' in program)) {
    const expected = deriveProjectedRosterOutlook(team).projectedOpeningsByPosition
    for (const position of POSITIONS) {
      if (expected[position] !== program.projectedOpeningsByPosition[position]) {
        throw new RangeError(`Recruiting opening facts do not match current ${position} senior departures.`)
      }
    }
  } else {
    const actualReturners = team.roster.filter((player) => player.classYear !== 'SR')
    if (actualReturners.length !== program.projectedReturningPlayerCount) {
      throw new RangeError('Recruiting returner facts do not match the current roster.')
    }
    for (const position of POSITIONS) {
      if (actualReturners.filter((player) => player.position === position).length !==
        program.projectedReturnerCountsByPosition[position]) {
        throw new RangeError(`Recruiting returner facts do not match current ${position} players.`)
      }
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
    incoming.push(rowFromPlayer(recruit.player, 'incoming', 'FR'))
  }
  if (!('capacityModel' in program)) {
    for (const position of POSITIONS) {
      if (incoming.filter((player) => player.position === position).length > program.projectedOpeningsByPosition[position]) {
        throw new RangeError(`Controlled commitments exceed projected ${position} capacity.`)
      }
    }
  }

  const remaining = deriveRemainingOpeningsByPosition(recruiting, program)
  const projected = deriveProjectedCountsByPosition(recruiting, program)
  const mandatory = deriveMandatoryNeedsByPosition(recruiting, program)
  const positionGroups = POSITIONS.map((position) => ({
    position,
    players: [
      ...returning.filter((player) => player.position === position).sort(compareIdentity),
      ...incoming.filter((player) => player.position === position).sort(compareIdentity),
    ],
    remainingOpenings: remaining[position],
    projectedCount: projected[position],
    mandatoryNeed: mandatory[position],
    flexibleEligible: projected[position] < 3,
  }))
  const projectedPlayerCount = returning.length + incoming.length
  const remainingOpeningCount = deriveRemainingScholarships(recruiting, program)
  const mandatoryNeedCount = POSITIONS.reduce((sum, position) => sum + mandatory[position], 0)
  const flexibleOpeningCount = deriveFlexibleOpenings(recruiting, program)
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
    mandatoryNeedCount,
    flexibleOpeningCount,
    positionGroups,
    departures,
  }
}
