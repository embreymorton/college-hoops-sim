import type {
  NationalLeaderCategory,
  NationalLeaderboards,
  NationalLeaderEntry,
  PlayerSeasonStats,
  SeasonState,
  TeamLeaderEntry,
  TeamPlayerLeaders,
} from './domain'
import { deriveProgramPlayerSeasonStats, deriveSeasonPlayerStats } from './playerStats'
import { deriveProgramRecord } from './queries'

/** Roughly the top 5–10 nationally per category is the readable V0 target. */
export const NATIONAL_LEADER_LIMIT = 10

export const NATIONAL_LEADER_CATEGORIES: readonly NationalLeaderCategory[] = [
  'points',
  'rebounds',
  'assists',
  'steals',
  'blocks',
]

const CATEGORY_RATE_FIELD: Readonly<Record<NationalLeaderCategory, keyof PlayerSeasonStats>> = {
  points: 'pointsPerGame',
  rebounds: 'reboundsPerGame',
  assists: 'assistsPerGame',
  steals: 'stealsPerGame',
  blocks: 'blocksPerGame',
}

/**
 * At least half of the Program's own completed regular-season games, rounded
 * up to a whole game, and zero (so no Player can qualify) before the Program
 * has completed any. Scales automatically across a partial Season without
 * hardcoding the eventual 24-game full schedule.
 */
export function getMinimumQualifyingGamesPlayed(
  programCompletedGames: number,
): number {
  return programCompletedGames === 0
    ? 0
    : Math.max(1, Math.ceil(programCompletedGames / 2))
}

function compareStatsDescending(field: keyof PlayerSeasonStats) {
  return (first: PlayerSeasonStats, second: PlayerSeasonStats): number =>
    (second[field] as number) - (first[field] as number) ||
    first.playerId.localeCompare(second.playerId)
}

function getCompletedGamesByProgramId(
  season: SeasonState,
): ReadonlyMap<string, number> {
  return new Map(
    Object.keys(season.programStates).map((programId) => {
      const record = deriveProgramRecord(season, programId)
      return [programId, record.wins + record.losses] as const
    }),
  )
}

/** Every current-roster Player who has appeared in enough of their own Program's completed games. */
function getQualifiedSeasonPlayerStats(season: SeasonState): PlayerSeasonStats[] {
  const completedGamesByProgramId = getCompletedGamesByProgramId(season)

  return deriveSeasonPlayerStats(season).filter((stats) => {
    const completedGames = completedGamesByProgramId.get(stats.programId) ?? 0

    return (
      completedGames > 0 &&
      stats.gamesPlayed >= getMinimumQualifyingGamesPlayed(completedGames)
    )
  })
}

/**
 * Derives the top qualified Players nationally in each counting-stat rate
 * category, straight from canonical Player Season Stats. Ties resolve by
 * Player ID so ranking output is stable regardless of Program iteration
 * order. Returns empty leaderboards before any regular-season game completes
 * anywhere.
 */
export function deriveNationalPlayerLeaders(
  season: SeasonState,
  limit: number = NATIONAL_LEADER_LIMIT,
): NationalLeaderboards {
  const qualified = getQualifiedSeasonPlayerStats(season)
  const leaderboards = {} as Record<
    NationalLeaderCategory,
    readonly NationalLeaderEntry[]
  >

  for (const category of NATIONAL_LEADER_CATEGORIES) {
    const field = CATEGORY_RATE_FIELD[category]

    leaderboards[category] = qualified
      .slice()
      .sort(compareStatsDescending(field))
      .slice(0, limit)
      .map((stats, index) => ({
        rank: index + 1,
        programId: stats.programId,
        playerId: stats.playerId,
        value: stats[field] as number,
        gamesPlayed: stats.gamesPlayed,
      }))
  }

  return leaderboards
}

/**
 * Derives one Program's single top qualified Player in points, rebounds, and
 * assists per game. A category is undefined only when no current-roster
 * Player on that Program yet qualifies (including before any Program game
 * completes).
 */
export function deriveTeamPlayerLeaders(
  season: SeasonState,
  programId: string,
): TeamPlayerLeaders {
  const record = deriveProgramRecord(season, programId)
  const completedGames = record.wins + record.losses
  const minimumGamesPlayed = getMinimumQualifyingGamesPlayed(completedGames)
  const qualified =
    completedGames === 0
      ? []
      : deriveProgramPlayerSeasonStats(season, programId).filter(
          (stats) => stats.gamesPlayed >= minimumGamesPlayed,
        )

  function topEntry(field: keyof PlayerSeasonStats): TeamLeaderEntry | undefined {
    if (qualified.length === 0) {
      return undefined
    }

    const [top] = qualified.slice().sort(compareStatsDescending(field))

    return { playerId: top!.playerId, value: top![field] as number }
  }

  return {
    points: topEntry('pointsPerGame'),
    rebounds: topEntry('reboundsPerGame'),
    assists: topEntry('assistsPerGame'),
  }
}
