import { calculateOverall, type Player } from '../engine'
import { getCurrentRound, derivePlayerSeasonStats, type SeasonState } from '../season'
import type { DynastyState } from './domain'
import { deriveDevelopmentSummary } from './development'
import type { RecruitStarRating } from './recruiting/domain'

export interface SeasonPreviewPlayerBase {
  readonly playerId: string
  readonly programId: string
  readonly player: Player
  readonly currentOverall: number
}

export interface ReturningStarPreview extends SeasonPreviewPlayerBase {
  readonly previousOverall: number
  readonly overallChange: number
  readonly previousPointsPerGame: number
}

export interface BiggestLeapPreview extends SeasonPreviewPlayerBase {
  readonly previousOverall: number
  readonly overallChange: number
}

export interface FreshFacePreview extends SeasonPreviewPlayerBase {
  readonly stars: RecruitStarRating
  readonly nationalRank: number
}

export interface FollowedSeasonPreview extends SeasonPreviewPlayerBase {
  readonly kind: 'returning' | 'freshman' | 'initial'
  readonly previousOverall: number | null
  readonly overallChange: number | null
}

export interface InitialSeasonPreview {
  readonly kind: 'initial'
  readonly seasonNumber: 1
  readonly establishedPlayers: readonly SeasonPreviewPlayerBase[]
  readonly freshmenToKnow: readonly SeasonPreviewPlayerBase[]
  readonly followedPlayers: readonly FollowedSeasonPreview[]
}

export interface RolloverSeasonPreview {
  readonly kind: 'rollover'
  readonly seasonNumber: number
  readonly returningStars: readonly ReturningStarPreview[]
  readonly biggestLeaps: readonly BiggestLeapPreview[]
  readonly freshFaces: readonly FreshFacePreview[]
  readonly followedPlayers: readonly FollowedSeasonPreview[]
}

export type SeasonPreview = InitialSeasonPreview | RolloverSeasonPreview

interface RosterMatch {
  readonly programId: string
  readonly player: Player
}

function indexSeasonRoster(season: SeasonState): Map<string, RosterMatch> {
  const players = new Map<string, RosterMatch>()
  for (const programId of Object.keys(season.programStates).sort()) {
    for (const player of season.programStates[programId]!.team.roster) {
      if (players.has(player.id)) {
        throw new RangeError(
          `Player ID "${player.id}" appears multiple times in Season ${season.seasonNumber}.`,
        )
      }
      players.set(player.id, { programId, player })
    }
  }
  return players
}

function baseRow(match: RosterMatch): SeasonPreviewPlayerBase {
  return {
    playerId: match.player.id,
    programId: match.programId,
    player: match.player,
    currentOverall: calculateOverall(match.player),
  }
}

function compareOverallThenId(
  first: SeasonPreviewPlayerBase,
  second: SeasonPreviewPlayerBase,
): number {
  return second.currentOverall - first.currentOverall ||
    first.playerId.localeCompare(second.playerId)
}

function followedInitialRows(
  followedPlayerIds: readonly string[],
  activeById: ReadonlyMap<string, RosterMatch>,
): FollowedSeasonPreview[] {
  return [...new Set(followedPlayerIds)].flatMap((playerId) => {
    const match = activeById.get(playerId)
    return match
      ? [{ ...baseRow(match), kind: 'initial' as const, previousOverall: null, overallChange: null }]
      : []
  }).slice(0, 5)
}

/** True only while canonical regular-season progression is in Round 1 or 2. */
export function shouldPromoteSeasonPreview(season: SeasonState): boolean {
  const currentRound = getCurrentRound(season)
  return currentRound === 1 || currentRound === 2
}

/** Introduces the active Season's cast from existing Dynasty facts only. */
export function deriveSeasonPreview(
  dynasty: DynastyState,
  followedPlayerIds: readonly string[],
): SeasonPreview {
  const activeSeason = dynasty.activeSeason
  if (!activeSeason) {
    throw new RangeError('Season Preview requires an active Season.')
  }

  const activeById = indexSeasonRoster(activeSeason)
  const activeRows = [...activeById.values()].map(baseRow)

  if (activeSeason.seasonNumber === 1) {
    return {
      kind: 'initial',
      seasonNumber: 1,
      establishedPlayers: activeRows
        .filter(({ player }) => player.classYear !== 'FR')
        .sort(compareOverallThenId)
        .slice(0, 3),
      freshmenToKnow: activeRows
        .filter(({ player }) => player.classYear === 'FR')
        .sort(compareOverallThenId)
        .slice(0, 3),
      followedPlayers: followedInitialRows(followedPlayerIds, activeById),
    }
  }

  const priorSeasonNumber = activeSeason.seasonNumber - 1
  const matchingArchives = dynasty.history.filter(
    ({ seasonNumber }) => seasonNumber === priorSeasonNumber,
  )
  if (matchingArchives.length !== 1) {
    throw new RangeError(
      `Season Preview requires exactly one Season ${priorSeasonNumber} archive.`,
    )
  }
  const matchingClasses = dynasty.completedRecruitingHistory.filter(
    ({ targetSeasonNumber }) => targetSeasonNumber === activeSeason.seasonNumber,
  )
  if (matchingClasses.length !== 1) {
    throw new RangeError(
      `Season Preview requires exactly one Recruiting class targeting Season ${activeSeason.seasonNumber}.`,
    )
  }

  const priorSeason = matchingArchives[0]!.season
  const priorById = indexSeasonRoster(priorSeason)
  const returningRows: ReturningStarPreview[] = []
  for (const [playerId, current] of activeById) {
    const previous = priorById.get(playerId)
    if (!previous) continue
    const development = deriveDevelopmentSummary(
      current.programId,
      previous.player,
      current.player,
    )
    returningRows.push({
      ...baseRow(current),
      previousOverall: development.previousOverall,
      overallChange: development.overallChange,
      previousPointsPerGame: derivePlayerSeasonStats(
        priorSeason,
        previous.programId,
        playerId,
      ).pointsPerGame,
    })
  }

  const returningStars = returningRows
    .filter(({ player }) => player.classYear !== 'FR')
    .sort((first, second) =>
      second.currentOverall - first.currentOverall ||
      second.previousPointsPerGame - first.previousPointsPerGame ||
      first.playerId.localeCompare(second.playerId),
    )
    .slice(0, 3)
  const returningStarIds = new Set(returningStars.map(({ playerId }) => playerId))
  const biggestLeaps: BiggestLeapPreview[] = returningRows
    .filter(({ playerId, overallChange }) =>
      overallChange > 0 && !returningStarIds.has(playerId),
    )
    .sort((first, second) =>
      second.overallChange - first.overallChange ||
      second.currentOverall - first.currentOverall ||
      first.playerId.localeCompare(second.playerId),
    )
    .slice(0, 3)
    .map(({ previousPointsPerGame: _previousPointsPerGame, ...row }) => row)

  const recruitingClass = matchingClasses[0]!.recruitingState
  const recruitsById = new Map(
    recruitingClass.recruits.map((recruit) => [recruit.player.id, recruit] as const),
  )
  const freshmanIds = new Set<string>()
  const freshFaces: FreshFacePreview[] = []
  for (const current of activeById.values()) {
    if (current.player.classYear !== 'FR') continue
    const recruit = recruitsById.get(current.player.id)
    const commitment = recruitingClass.commitmentsByPlayerId[current.player.id]
    if (!recruit || !commitment || commitment.programId !== current.programId) {
      throw new RangeError(
        `Active freshman "${current.player.id}" does not match the canonical Recruiting class destination.`,
      )
    }
    freshmanIds.add(current.player.id)
    freshFaces.push({
      ...baseRow(current),
      stars: recruit.stars,
      nationalRank: recruit.nationalRank,
    })
  }
  freshFaces.sort((first, second) =>
    first.nationalRank - second.nationalRank ||
    first.playerId.localeCompare(second.playerId),
  )

  const returningById = new Map(returningRows.map((row) => [row.playerId, row]))
  const followedPlayers: FollowedSeasonPreview[] = []
  for (const playerId of new Set(followedPlayerIds)) {
    if (followedPlayers.length === 5) break
    const current = activeById.get(playerId)
    if (!current) continue
    const returning = returningById.get(playerId)
    if (returning) {
      followedPlayers.push({
        ...baseRow(current),
        kind: 'returning',
        previousOverall: returning.previousOverall,
        overallChange: returning.overallChange,
      })
      continue
    }
    if (freshmanIds.has(playerId)) {
      followedPlayers.push({
        ...baseRow(current),
        kind: 'freshman',
        previousOverall: null,
        overallChange: null,
      })
      continue
    }
    throw new RangeError(
      `Active Player "${playerId}" is neither a returner nor an incoming freshman.`,
    )
  }

  return {
    kind: 'rollover',
    seasonNumber: activeSeason.seasonNumber,
    returningStars,
    biggestLeaps,
    freshFaces: freshFaces.slice(0, 3),
    followedPlayers,
  }
}
