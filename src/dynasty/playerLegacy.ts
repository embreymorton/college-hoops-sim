import { type Player } from '../engine'
import type { DynastyState } from './domain'
import {
  derivePlayerCareerHistory,
  type PlayerCareerHistory,
  type PlayerCareerSeasonRow,
} from './careerHistory'

export type KnownDynastyPlayerResolution = {
  readonly playerId: string
  readonly player: Player
  readonly programId: string
  readonly careerHistory: PlayerCareerHistory
}

export type DynastyPlayerResolution =
  | (KnownDynastyPlayerResolution & { readonly status: 'active' })
  | (KnownDynastyPlayerResolution & { readonly status: 'former' })
  | { readonly status: 'unknown'; readonly playerId: string }

export interface PlayerCareerSummary {
  readonly playerId: string
  readonly firstSeasonNumber: number
  readonly lastSeasonNumber: number
  readonly gamesPlayed: number
  readonly minutes: number
  readonly points: number
  readonly rebounds: number
  readonly assists: number
  readonly steals: number
  readonly blocks: number
  readonly turnovers: number
  readonly fieldGoalsMade: number
  readonly fieldGoalsAttempted: number
  readonly threePointersMade: number
  readonly threePointersAttempted: number
  readonly freeThrowsMade: number
  readonly freeThrowsAttempted: number
  readonly minutesPerGame: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
  readonly stealsPerGame: number
  readonly blocksPerGame: number
  readonly fieldGoalPercentage: number
  readonly threePointPercentage: number
  readonly freeThrowPercentage: number
  readonly finalOverall: number
  readonly peakOverall: number
}

interface RosterMatch {
  readonly programId: string
  readonly player: Player
}

function findUniqueRosterMatch(
  programStates: Readonly<Record<string, { readonly team: { readonly roster: readonly Player[] } }>>,
  playerId: string,
  seasonNumber: number,
): RosterMatch | null {
  const matches = Object.keys(programStates)
    .sort()
    .flatMap((programId) =>
      programStates[programId]!.team.roster
        .filter((player) => player.id === playerId)
        .map((player) => ({ programId, player })),
    )

  if (matches.length > 1) {
    throw new RangeError(
      `Player ID "${playerId}" appears multiple times in Season ${seasonNumber}.`,
    )
  }

  return matches[0] ?? null
}

/** Resolves one stable Player ID against current and completed Dynasty rosters. */
export function resolveDynastyPlayer(
  dynasty: DynastyState,
  playerId: string,
): DynastyPlayerResolution {
  if (dynasty.activeSeason) {
    const activeMatch = findUniqueRosterMatch(
      dynasty.activeSeason.programStates,
      playerId,
      dynasty.activeSeason.seasonNumber,
    )
    if (activeMatch) {
      return {
        status: 'active',
        playerId,
        ...activeMatch,
        careerHistory: derivePlayerCareerHistory(dynasty, playerId),
      }
    }
  }

  const archivedMatches = [...dynasty.history]
    .sort((first, second) => first.seasonNumber - second.seasonNumber)
    .flatMap((archive) => {
      const match = findUniqueRosterMatch(
        archive.season.programStates,
        playerId,
        archive.seasonNumber,
      )
      return match ? [{ seasonNumber: archive.seasonNumber, ...match }] : []
    })

  const duplicateSeason = archivedMatches.find(
    (match, index) =>
      archivedMatches.findIndex(
        (candidate) => candidate.seasonNumber === match.seasonNumber,
      ) !== index,
  )
  if (duplicateSeason) {
    throw new RangeError(
      `Player ID "${playerId}" has duplicate Season ${duplicateSeason.seasonNumber} archives.`,
    )
  }

  const latest = archivedMatches.at(-1)
  if (!latest) return { status: 'unknown', playerId }

  return {
    status: 'former',
    playerId,
    player: latest.player,
    programId: latest.programId,
    careerHistory: derivePlayerCareerHistory(dynasty, playerId),
  }
}

const TOTAL_FIELDS = [
  'minutes',
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
  'turnovers',
  'fieldGoalsMade',
  'fieldGoalsAttempted',
  'threePointersMade',
  'threePointersAttempted',
  'freeThrowsMade',
  'freeThrowsAttempted',
] as const

type TotalField = (typeof TOTAL_FIELDS)[number]

function divideOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

/** Aggregates regular-season career rows from canonical Season totals. */
export function derivePlayerCareerSummary(
  careerHistory: PlayerCareerHistory,
): PlayerCareerSummary {
  if (careerHistory.seasons.length === 0) {
    throw new RangeError('Player Career Summary requires at least one Season.')
  }

  const seasons = [...careerHistory.seasons].sort(
    (first, second) => first.seasonNumber - second.seasonNumber,
  )
  const totals = Object.fromEntries(
    TOTAL_FIELDS.map((field) => [field, 0]),
  ) as Record<TotalField, number>
  let gamesPlayed = 0

  for (const { stats } of seasons) {
    gamesPlayed += stats.gamesPlayed
    for (const field of TOTAL_FIELDS) totals[field] += stats[field]
  }

  const first = seasons[0] as PlayerCareerSeasonRow
  const final = seasons.at(-1) as PlayerCareerSeasonRow

  return {
    playerId: careerHistory.playerId,
    firstSeasonNumber: first.seasonNumber,
    lastSeasonNumber: final.seasonNumber,
    gamesPlayed,
    ...totals,
    minutesPerGame: divideOrZero(totals.minutes, gamesPlayed),
    pointsPerGame: divideOrZero(totals.points, gamesPlayed),
    reboundsPerGame: divideOrZero(totals.rebounds, gamesPlayed),
    assistsPerGame: divideOrZero(totals.assists, gamesPlayed),
    stealsPerGame: divideOrZero(totals.steals, gamesPlayed),
    blocksPerGame: divideOrZero(totals.blocks, gamesPlayed),
    fieldGoalPercentage: divideOrZero(
      totals.fieldGoalsMade,
      totals.fieldGoalsAttempted,
    ),
    threePointPercentage: divideOrZero(
      totals.threePointersMade,
      totals.threePointersAttempted,
    ),
    freeThrowPercentage: divideOrZero(
      totals.freeThrowsMade,
      totals.freeThrowsAttempted,
    ),
    finalOverall: final.overall,
    peakOverall: Math.max(...seasons.map(({ overall }) => overall)),
  }
}
