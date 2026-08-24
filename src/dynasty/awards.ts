import type { Player, PlayerGameStats } from '../engine'
import {
  deriveNationalChampion,
  getGamesForTournamentRound,
  type PostseasonState,
} from '../postseason'
import {
  derivePlayerSeasonStats,
  deriveProgramRecord,
  isRegularSeasonComplete,
  type PlayerSeasonStats,
  type SeasonState,
} from '../season'
import type {
  ConferenceDefinition,
  ProgramDefinition,
  UniverseDefinition,
} from '../universe'
import type { CompletedSeasonArchive, DynastyState } from './domain'

export const AWARDS_RULES_VERSION = 'awards-v1' as const
export const AWARDS_MINIMUM_MINUTES_PER_GAME = 12
export const FIRST_TEAM_SIZE = 5

export type AwardHonorType =
  | 'national-player-of-the-year'
  | 'national-freshman-of-the-year'
  | 'all-america-first-team'
  | 'conference-player-of-the-year'
  | 'conference-freshman-of-the-year'
  | 'all-conference-first-team'
  | 'tournament-most-outstanding-player'

export interface CompletedSeasonHonor {
  readonly type: AwardHonorType
  readonly playerId: string
  readonly programId: string
  readonly conferenceId?: string
  readonly rank?: number
}

export interface CompletedSeasonAwards {
  readonly rulesVersion: typeof AWARDS_RULES_VERSION
  readonly honors: readonly CompletedSeasonHonor[]
}

export interface RegularSeasonAwardScore {
  readonly productionScorePerGame: number
  readonly teamBonus: number
  readonly awardScore: number
}

interface AwardCandidate extends RegularSeasonAwardScore {
  readonly player: Player
  readonly playerId: string
  readonly programId: string
  readonly conferenceId: string
  readonly stats: PlayerSeasonStats
  readonly programWins: number
}

export interface ResolvedSeasonHonor {
  readonly seasonNumber: number
  readonly type: AwardHonorType
  readonly player: Player
  readonly program: ProgramDefinition
  readonly conference?: ConferenceDefinition
  readonly rank?: number
  /** Canonical regular-season production, derived for presentation only. */
  readonly seasonStats: PlayerSeasonStats
}

export interface TournamentMopSummary {
  readonly honor: ResolvedSeasonHonor
  readonly gamesPlayed: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
}

export interface AwardsValidationIssue {
  readonly code:
    | 'UNSUPPORTED_RULES_VERSION'
    | 'INVALID_HONOR_OUTCOME'
  readonly message: string
}

export interface AwardsValidationResult {
  readonly valid: boolean
  readonly issues: readonly AwardsValidationIssue[]
}

type AwardStatField = Extract<
  keyof PlayerGameStats,
  | 'points'
  | 'rebounds'
  | 'assists'
  | 'steals'
  | 'blocks'
  | 'turnovers'
  | 'fieldGoalsMade'
  | 'fieldGoalsAttempted'
  | 'freeThrowsMade'
  | 'freeThrowsAttempted'
>

function productionScore(stats: Pick<PlayerGameStats, AwardStatField>): number {
  return (
    stats.points +
    0.7 * stats.rebounds +
    0.7 * stats.assists +
    1.5 * stats.steals +
    1.5 * stats.blocks -
    0.7 * stats.turnovers -
    0.7 * (stats.fieldGoalsAttempted - stats.fieldGoalsMade) -
    0.3 * (stats.freeThrowsAttempted - stats.freeThrowsMade)
  )
}

/** Exact Awards V1 regular-season formula. Rounding is presentation-only. */
export function calculateRegularSeasonAwardScore(
  stats: PlayerSeasonStats,
  programWins: number,
  programLosses: number,
): RegularSeasonAwardScore {
  const programGames = programWins + programLosses
  const productionScorePerGame = stats.gamesPlayed === 0
    ? 0
    : productionScore(stats) / stats.gamesPlayed
  const teamBonus = programGames === 0 ? 0 : 2 * programWins / programGames
  return {
    productionScorePerGame,
    teamBonus,
    awardScore: productionScorePerGame + teamBonus,
  }
}

function playerProgramMap(season: SeasonState): ReadonlyMap<string, { player: Player; programId: string }> {
  return new Map(Object.keys(season.programStates).sort().flatMap((programId) =>
    season.programStates[programId]!.team.roster.map((player) =>
      [player.id, { player, programId }] as const,
    ),
  ))
}

function deriveCandidates(
  universe: UniverseDefinition,
  season: SeasonState,
): AwardCandidate[] {
  const conferenceByProgramId = new Map(
    universe.programs.map(({ id, conferenceId }) => [id, conferenceId]),
  )
  const candidates: AwardCandidate[] = []

  for (const programId of Object.keys(season.programStates).sort()) {
    const state = season.programStates[programId]!
    const record = deriveProgramRecord(season, programId)
    const programGames = record.wins + record.losses
    const conferenceId = conferenceByProgramId.get(programId)
    if (!conferenceId) throw new RangeError(`Unknown Awards Program ID "${programId}".`)

    for (const player of state.team.roster) {
      const stats = derivePlayerSeasonStats(season, programId, player.id)
      const minutesPerGame = stats.gamesPlayed === 0
        ? 0
        : stats.minutes / stats.gamesPlayed
      if (
        programGames === 0 ||
        stats.gamesPlayed < Math.ceil(programGames / 2) ||
        minutesPerGame < AWARDS_MINIMUM_MINUTES_PER_GAME
      ) {
        continue
      }
      candidates.push({
        player,
        playerId: player.id,
        programId,
        conferenceId,
        stats,
        programWins: record.wins,
        ...calculateRegularSeasonAwardScore(stats, record.wins, record.losses),
      })
    }
  }
  return candidates.sort(compareCandidates)
}

function compareCandidates(first: AwardCandidate, second: AwardCandidate): number {
  return (
    second.awardScore - first.awardScore ||
    second.productionScorePerGame - first.productionScorePerGame ||
    second.stats.gamesPlayed - first.stats.gamesPlayed ||
    second.stats.minutes - first.stats.minutes ||
    second.programWins - first.programWins ||
    first.playerId.localeCompare(second.playerId)
  )
}

function honor(
  type: AwardHonorType,
  candidate: AwardCandidate,
  extras: Pick<CompletedSeasonHonor, 'conferenceId' | 'rank'> = {},
): CompletedSeasonHonor {
  return {
    type,
    playerId: candidate.playerId,
    programId: candidate.programId,
    ...extras,
  }
}

interface TournamentCandidate {
  readonly playerId: string
  readonly programId: string
  readonly gamesPlayed: number
  readonly minutes: number
  readonly production: number
  readonly championshipProduction: number
  readonly playedChampionship: boolean
}

export function deriveTournamentMostOutstandingPlayer(
  postseason: PostseasonState,
): CompletedSeasonHonor {
  const championId = deriveNationalChampion(postseason)
  if (!championId) throw new RangeError('Awards require a National Champion.')
  const championship = postseason.bracket.games.find(({ round }) => round === 'championship')
  if (!championship) throw new RangeError('Awards require a championship game.')
  const totals = new Map<string, TournamentCandidate>()

  for (const game of postseason.bracket.games.slice().sort((a, b) => a.index - b.index)) {
    const result = postseason.resultsByGameId[game.id]
    if (!result) throw new RangeError(`Awards require completed Tournament game "${game.id}".`)
    const stats = result.homeTeamId === championId
      ? result.homePlayerStats
      : result.awayTeamId === championId
        ? result.awayPlayerStats
        : []
    for (const row of stats) {
      if (row.minutes <= 0) continue
      const existing = totals.get(row.playerId) ?? {
        playerId: row.playerId,
        programId: championId,
        gamesPlayed: 0,
        minutes: 0,
        production: 0,
        championshipProduction: 0,
        playedChampionship: false,
      }
      totals.set(row.playerId, {
        ...existing,
        gamesPlayed: existing.gamesPlayed + 1,
        minutes: existing.minutes + row.minutes,
        production: existing.production + productionScore(row),
        championshipProduction: game.id === championship.id
          ? productionScore(row)
          : existing.championshipProduction,
        playedChampionship: existing.playedChampionship || game.id === championship.id,
      })
    }
  }

  const [winner] = [...totals.values()]
    .filter(({ gamesPlayed, playedChampionship }) =>
      gamesPlayed >= 3 && playedChampionship,
    )
    .sort((first, second) =>
      second.production - first.production ||
      second.championshipProduction - first.championshipProduction ||
      second.minutes - first.minutes ||
      first.playerId.localeCompare(second.playerId),
    )
  if (!winner) throw new RangeError('National Champion has no eligible Tournament MOP candidate.')
  return {
    type: 'tournament-most-outstanding-player',
    playerId: winner.playerId,
    programId: championId,
  }
}

/** Projects every regular-season Awards V1 outcome from completed Season truth. */
export function deriveRegularSeasonAwards(
  universe: UniverseDefinition,
  season: SeasonState,
): CompletedSeasonAwards {
  if (!isRegularSeasonComplete(season)) {
    throw new RangeError('Awards require a completed regular season.')
  }
  const candidates = deriveCandidates(universe, season)
  const [nationalPoy] = candidates
  const nationalFoy = candidates.find(({ player }) => player.classYear === 'FR')
  if (!nationalPoy || !nationalFoy || candidates.length < FIRST_TEAM_SIZE) {
    throw new RangeError('Completed Season lacks eligible Awards candidates.')
  }
  const honors: CompletedSeasonHonor[] = [
    honor('national-player-of-the-year', nationalPoy),
    honor('national-freshman-of-the-year', nationalFoy),
    ...candidates.slice(0, FIRST_TEAM_SIZE).map((candidate, index) =>
      honor('all-america-first-team', candidate, { rank: index + 1 }),
    ),
  ]

  for (const conference of [...universe.conferences].sort((a, b) => a.id.localeCompare(b.id))) {
    const conferenceCandidates = candidates.filter(
      ({ conferenceId }) => conferenceId === conference.id,
    )
    const [conferencePoy] = conferenceCandidates
    const conferenceFoy = conferenceCandidates.find(
      ({ player }) => player.classYear === 'FR',
    )
    if (!conferencePoy || !conferenceFoy || conferenceCandidates.length < FIRST_TEAM_SIZE) {
      throw new RangeError(`Conference "${conference.id}" lacks eligible Awards candidates.`)
    }
    honors.push(
      honor('conference-player-of-the-year', conferencePoy, { conferenceId: conference.id }),
      honor('conference-freshman-of-the-year', conferenceFoy, { conferenceId: conference.id }),
      ...conferenceCandidates.slice(0, FIRST_TEAM_SIZE).map((candidate, index) =>
        honor('all-conference-first-team', candidate, {
          conferenceId: conference.id,
          rank: index + 1,
        }),
      ),
    )
  }
  return { rulesVersion: AWARDS_RULES_VERSION, honors }
}

/** Projects Tournament MOP when a completed championship has produced a Champion. */
export function projectTournamentMostOutstandingPlayer(
  postseason: PostseasonState,
): CompletedSeasonHonor | null {
  const championship = postseason.bracket.games.find(({ round }) => round === 'championship')
  if (
    !championship ||
    !postseason.resultsByGameId[championship.id] ||
    !deriveNationalChampion(postseason)
  ) {
    return null
  }
  return deriveTournamentMostOutstandingPlayer(postseason)
}

/** Awards become presentable only once every quarterfinal is canonical truth. */
export function areRegularSeasonAwardsRevealed(postseason: PostseasonState): boolean {
  const quarterfinals = getGamesForTournamentRound(postseason, 'quarterfinals')
  return quarterfinals.length > 0 && quarterfinals.every(
    ({ id }) => postseason.resultsByGameId[id] !== undefined,
  )
}

/** Composes the canonical live projections into the persisted Awards V1 outcome. */
export function deriveCompletedSeasonAwards(
  universe: UniverseDefinition,
  season: SeasonState,
  postseason: PostseasonState,
): CompletedSeasonAwards {
  const regularSeason = deriveRegularSeasonAwards(universe, season)
  const tournamentMop = projectTournamentMostOutstandingPlayer(postseason)
  if (!tournamentMop) throw new RangeError('Awards require a completed championship.')
  return {
    rulesVersion: AWARDS_RULES_VERSION,
    honors: [...regularSeason.honors, tournamentMop],
  }
}

/** Validates persisted judged outcomes against their immutable V1 source facts. */
export function validateCompletedSeasonAwards(
  universe: UniverseDefinition,
  archive: CompletedSeasonArchive,
): AwardsValidationResult {
  if (archive.awards.rulesVersion !== AWARDS_RULES_VERSION) {
    return {
      valid: false,
      issues: [{
        code: 'UNSUPPORTED_RULES_VERSION',
        message: `Unsupported Awards rules version "${String(archive.awards.rulesVersion)}".`,
      }],
    }
  }
  let expected: CompletedSeasonAwards
  try {
    expected = deriveCompletedSeasonAwards(universe, archive.season, archive.postseason)
  } catch (error) {
    return {
      valid: false,
      issues: [{
        code: 'INVALID_HONOR_OUTCOME',
        message: error instanceof Error ? error.message : 'Awards source facts are invalid.',
      }],
    }
  }
  if (JSON.stringify(archive.awards) !== JSON.stringify(expected)) {
    return {
      valid: false,
      issues: [{
        code: 'INVALID_HONOR_OUTCOME',
        message: 'Persisted Awards do not match the required deterministic V1 outcome.',
      }],
    }
  }
  return { valid: true, issues: [] }
}

function resolveHonor(
  seasonNumber: number,
  season: SeasonState,
  universe: UniverseDefinition,
  stored: CompletedSeasonHonor,
): ResolvedSeasonHonor {
  const playerMatch = playerProgramMap(season).get(stored.playerId)
  if (!playerMatch || playerMatch.programId !== stored.programId) {
    throw new RangeError(`Cannot resolve Awards Player "${stored.playerId}".`)
  }
  const program = universe.programs.find(({ id }) => id === stored.programId)
  if (!program) throw new RangeError(`Cannot resolve Awards Program "${stored.programId}".`)
  const conference = stored.conferenceId
    ? universe.conferences.find(({ id }) => id === stored.conferenceId)
    : undefined
  if (stored.conferenceId && !conference) {
    throw new RangeError(`Cannot resolve Awards Conference "${stored.conferenceId}".`)
  }
  return {
    seasonNumber,
    type: stored.type,
    player: playerMatch.player,
    program,
    conference,
    rank: stored.rank,
    seasonStats: derivePlayerSeasonStats(season, stored.programId, stored.playerId),
  }
}

function resolveProjectedHonor(
  season: SeasonState,
  universe: UniverseDefinition,
  stored: CompletedSeasonHonor,
): ResolvedSeasonHonor {
  return resolveHonor(season.seasonNumber, season, universe, stored)
}

/** Presentation-ready announced Awards from active canonical competition facts. */
export function deriveAnnouncedSeasonHonors(
  dynasty: Pick<DynastyState, 'activeSeason' | 'activePostseason' | 'universe'>,
): ResolvedSeasonHonor[] {
  const season = dynasty.activeSeason
  const postseason = dynasty.activePostseason
  if (!season || !postseason || !areRegularSeasonAwardsRevealed(postseason)) return []
  const regular = deriveRegularSeasonAwards(dynasty.universe, season).honors
  const mop = projectTournamentMostOutstandingPlayer(postseason)
  const resolved = regular.map(
    (stored) => resolveProjectedHonor(season, dynasty.universe, stored),
  )
  if (mop) {
    try {
      resolved.push(resolveProjectedHonor(season, dynasty.universe, mop))
    } catch {
      // Malformed/incomplete presentation fixtures must not obscure valid regular-season Awards.
    }
  }
  return resolved
}

/** Presentation-ready identities for one immutable completed Season outcome. */
export function deriveCompletedSeasonHonors(
  archive: CompletedSeasonArchive,
  universe: UniverseDefinition,
): ResolvedSeasonHonor[] {
  const validation = validateCompletedSeasonAwards(universe, archive)
  if (!validation.valid) throw new RangeError(validation.issues[0]!.message)
  return archive.awards.honors.map((stored) =>
    resolveHonor(archive.seasonNumber, archive.season, universe, stored),
  )
}

/** Every persisted honor for one stable Player, ordered by Season then stored semantic order. */
export function derivePlayerCareerHonors(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  playerId: string,
): ResolvedSeasonHonor[] {
  return [...dynasty.history]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .flatMap((archive) => deriveCompletedSeasonHonors(archive, dynasty.universe))
    .filter(({ player }) => player.id === playerId)
}

/** Archived honors plus currently announced honors, with stable semantic deduplication. */
export function derivePlayerCareerHonorsIncludingAnnounced(
  dynasty: DynastyState,
  playerId: string,
): ResolvedSeasonHonor[] {
  const honors = [
    ...derivePlayerCareerHonors(dynasty, playerId),
    ...deriveAnnouncedSeasonHonors(dynasty).filter(({ player }) => player.id === playerId),
  ]
  const seen = new Set<string>()
  return honors.filter((honor) => {
    const key = [honor.seasonNumber, honor.type, honor.conference?.id ?? '', honor.rank ?? ''].join(':')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).sort((a, b) => b.seasonNumber - a.seasonNumber)
}

/** Compact champion-run production for the resolved Tournament MOP. */
export function deriveTournamentMopSummaryFromSources(
  season: SeasonState,
  postseason: PostseasonState,
  universe: UniverseDefinition,
): TournamentMopSummary | null {
  const stored = projectTournamentMostOutstandingPlayer(postseason)
  if (!stored) return null
  let honor: ResolvedSeasonHonor
  try {
    honor = resolveProjectedHonor(season, universe, stored)
  } catch {
    return null
  }
  let gamesPlayed = 0
  let points = 0
  let rebounds = 0
  let assists = 0
  for (const game of postseason.bracket.games) {
    const result = postseason.resultsByGameId[game.id]
    if (!result) continue
    const rows = result.homeTeamId === stored.programId
      ? result.homePlayerStats
      : result.awayTeamId === stored.programId
        ? result.awayPlayerStats
        : []
    const row = rows.find(({ playerId }) => playerId === stored.playerId)
    if (!row || row.minutes <= 0) continue
    gamesPlayed += 1
    points += row.points
    rebounds += row.rebounds
    assists += row.assists
  }
  return {
    honor,
    gamesPlayed,
    pointsPerGame: gamesPlayed ? points / gamesPlayed : 0,
    reboundsPerGame: gamesPlayed ? rebounds / gamesPlayed : 0,
    assistsPerGame: gamesPlayed ? assists / gamesPlayed : 0,
  }
}

/** Compact champion-run production for the active resolved Tournament MOP. */
export function deriveTournamentMopSummary(
  dynasty: Pick<DynastyState, 'activeSeason' | 'activePostseason' | 'universe'>,
): TournamentMopSummary | null {
  const season = dynasty.activeSeason
  const postseason = dynasty.activePostseason
  if (!season || !postseason) return null
  return deriveTournamentMopSummaryFromSources(season, postseason, dynasty.universe)
}
