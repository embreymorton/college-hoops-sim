import {
  calculateOverall,
  derivePlayerMinutesV1,
  type ClassYear,
  type Position,
} from '../engine'
import {
  deriveProgramPlayerSeasonStats,
  deriveQualifiedSeasonPlayerStats,
  deriveSeasonPlayerStats,
  deriveSeasonTeamStats,
  getCompletedGamesForProgram,
  type PlayerSeasonStats,
  type SeasonState,
  type TeamSeasonStats,
} from '../season'
import {
  TOURNAMENT_ROUNDS,
  type PostseasonState,
  type TournamentRound,
} from '../postseason'

export type MatchupScoutSampleStatus =
  | 'no-data'
  | 'limited'
  | 'early'
  | 'established'

export type MatchupScoutObservationFamily =
  | 'scoring'
  | 'shooting'
  | 'possession'
  | 'physical'
  | 'differential'

export interface MatchupScoutObservation {
  readonly key: string
  readonly family: MatchupScoutObservationFamily
  readonly label: string
  readonly rank: number
  readonly leagueSize: number
  readonly value: number
  readonly format: 'number' | 'percentage' | 'signed-number'
  readonly unit: string
  readonly polarity: 'strength' | 'weakness'
}

export interface MatchupScoutTopTenRank {
  readonly category: 'PPG' | 'RPG' | 'APG'
  readonly rank: number
}

export interface MatchupScoutPlayer {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly classYear: ClassYear
  readonly gamesPlayed: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
  readonly topTenRanks: readonly MatchupScoutTopTenRank[]
}

export interface MatchupScoutFormGame {
  readonly gameId: string
  readonly competition: 'regular-season' | 'tournament'
  readonly round: number | TournamentRound
  readonly opponentProgramId: string
  readonly location: 'home' | 'away' | 'neutral'
  readonly outcome: 'W' | 'L'
  readonly teamScore: number
  readonly opponentScore: number
}

export interface MatchupScoutStreak {
  readonly outcome: 'W' | 'L'
  readonly count: number
}

export interface MatchupScoutPriorMeeting {
  readonly scheduledGameId: string
  readonly round: number
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly homeScore: number
  readonly awayScore: number
  readonly winnerId: string
}

export interface MatchupScoutReport {
  readonly opponentProgramId: string
  readonly sampleStatus: MatchupScoutSampleStatus
  readonly gamesPlayed: number
  readonly observations: readonly MatchupScoutObservation[]
  readonly playersToWatch: readonly MatchupScoutPlayer[]
  readonly recentForm: readonly MatchupScoutFormGame[]
  readonly currentStreak: MatchupScoutStreak | null
  readonly priorMeeting: MatchupScoutPriorMeeting | null
}

export interface DeriveMatchupScoutOptions {
  readonly season: SeasonState
  readonly controlledProgramId: string
  readonly opponentProgramId: string
  readonly postseason?: PostseasonState | null
}

type MetricKey =
  | 'pointsPerGame'
  | 'opponentPointsPerGame'
  | 'fieldGoalPercentage'
  | 'threePointPercentage'
  | 'assistsPerGame'
  | 'turnoversPerGame'
  | 'reboundDifferentialPerGame'
  | 'opponentTurnoversPerGame'
  | 'blocksPerGame'
  | 'pointDifferentialPerGame'

interface ScoutTeamStats extends TeamSeasonStats {
  readonly reboundDifferentialPerGame: number
  readonly opponentTurnoversPerGame: number
}

interface MetricDefinition {
  readonly key: MetricKey
  readonly family: MatchupScoutObservationFamily
  readonly higherIsBetter: boolean
  readonly format: MatchupScoutObservation['format']
  readonly unit: string
  readonly priority: number
  readonly strengthLabels: readonly [major: string, ordinary: string]
  readonly weaknessLabels: readonly [major: string, ordinary: string]
  readonly allowStrength?: boolean
  readonly allowWeakness?: boolean
}

interface ObservationCandidate extends MatchupScoutObservation {
  readonly extremity: number
  readonly priority: number
}

const METRICS: readonly MetricDefinition[] = [
  {
    key: 'pointsPerGame', family: 'scoring', higherIsBetter: true,
    format: 'number', unit: 'PPG', priority: 0,
    strengthLabels: ['Elite scoring offense', 'Strong scoring offense'],
    weaknessLabels: ['Struggling scoring offense', 'Limited scoring offense'],
  },
  {
    key: 'opponentPointsPerGame', family: 'scoring', higherIsBetter: false,
    format: 'number', unit: 'Opp PPG', priority: 1,
    strengthLabels: ['Elite scoring defense', 'Stingy scoring defense'],
    weaknessLabels: ['Poor scoring defense', 'Vulnerable scoring defense'],
  },
  {
    key: 'fieldGoalPercentage', family: 'shooting', higherIsBetter: true,
    format: 'percentage', unit: 'FG', priority: 2,
    strengthLabels: ['Elite shooting efficiency', 'Efficient shooting'],
    weaknessLabels: ['Major shooting struggles', 'Inefficient shooting'],
  },
  {
    key: 'threePointPercentage', family: 'shooting', higherIsBetter: true,
    format: 'percentage', unit: '3P', priority: 3,
    strengthLabels: ['Elite from three', 'Dangerous from three'],
    weaknessLabels: ['Major struggles from three', 'Poor from three'],
  },
  {
    key: 'assistsPerGame', family: 'possession', higherIsBetter: true,
    format: 'number', unit: 'APG', priority: 4,
    strengthLabels: ['Elite ball movement', 'Strong ball movement'],
    weaknessLabels: ['Very limited ball movement', 'Limited ball movement'],
  },
  {
    key: 'turnoversPerGame', family: 'possession', higherIsBetter: false,
    format: 'number', unit: 'TOPG', priority: 5,
    strengthLabels: ['Elite ball security', 'Protects the ball'],
    weaknessLabels: ['Extremely turnover prone', 'Turnover prone'],
  },
  {
    key: 'reboundDifferentialPerGame', family: 'physical', higherIsBetter: true,
    format: 'signed-number', unit: 'REB diff', priority: 6,
    strengthLabels: ['Dominant on the glass', 'Strong on the glass'],
    weaknessLabels: ['Overwhelmed on the glass', 'Weak on the glass'],
  },
  {
    key: 'opponentTurnoversPerGame', family: 'physical', higherIsBetter: true,
    format: 'number', unit: 'Opp TOPG', priority: 7,
    strengthLabels: ['Elite at forcing turnovers', 'Forces turnovers'],
    weaknessLabels: ['Rarely forces turnovers', 'Limited turnover pressure'],
    allowWeakness: false,
  },
  {
    key: 'blocksPerGame', family: 'physical', higherIsBetter: true,
    format: 'number', unit: 'BPG', priority: 8,
    strengthLabels: ['Elite rim protection', 'Protects the rim'],
    weaknessLabels: ['Very limited rim protection', 'Limited rim protection'],
  },
  {
    key: 'pointDifferentialPerGame', family: 'differential', higherIsBetter: true,
    format: 'signed-number', unit: 'margin', priority: 9,
    strengthLabels: ['Dominant point differential', 'Strong point differential'],
    weaknessLabels: ['Major negative point differential', 'Poor point differential'],
  },
]

function divideOrZero(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function deriveScoutTeamStats(season: SeasonState): ScoutTeamStats[] {
  const baseStats = deriveSeasonTeamStats(season)
  const opponentRebounds = new Map<string, number>()
  const opponentTurnovers = new Map<string, number>()

  for (const game of season.schedule.games) {
    const result = season.resultsByGameId[game.id]
    if (!result) continue

    const homeRebounds = result.homePlayerStats.reduce((sum, row) => sum + row.rebounds, 0)
    const awayRebounds = result.awayPlayerStats.reduce((sum, row) => sum + row.rebounds, 0)
    const homeTurnovers = result.homePlayerStats.reduce((sum, row) => sum + row.turnovers, 0)
    const awayTurnovers = result.awayPlayerStats.reduce((sum, row) => sum + row.turnovers, 0)

    opponentRebounds.set(
      game.homeProgramId,
      (opponentRebounds.get(game.homeProgramId) ?? 0) + awayRebounds,
    )
    opponentRebounds.set(
      game.awayProgramId,
      (opponentRebounds.get(game.awayProgramId) ?? 0) + homeRebounds,
    )
    opponentTurnovers.set(
      game.homeProgramId,
      (opponentTurnovers.get(game.homeProgramId) ?? 0) + awayTurnovers,
    )
    opponentTurnovers.set(
      game.awayProgramId,
      (opponentTurnovers.get(game.awayProgramId) ?? 0) + homeTurnovers,
    )
  }

  return baseStats.map((stats) => ({
    ...stats,
    reboundDifferentialPerGame:
      stats.reboundsPerGame -
      divideOrZero(opponentRebounds.get(stats.programId) ?? 0, stats.gamesPlayed),
    opponentTurnoversPerGame: divideOrZero(
      opponentTurnovers.get(stats.programId) ?? 0,
      stats.gamesPlayed,
    ),
  }))
}

function competitionRank(
  rows: readonly ScoutTeamStats[],
  target: ScoutTeamStats,
  metric: MetricDefinition,
): number {
  const targetValue = target[metric.key]
  return 1 + rows.filter((row) =>
    metric.higherIsBetter
      ? row[metric.key] > targetValue
      : row[metric.key] < targetValue,
  ).length
}

function competitionRankEnd(
  rows: readonly ScoutTeamStats[],
  target: ScoutTeamStats,
  metric: MetricDefinition,
): number {
  const targetValue = target[metric.key]
  return rows.filter((row) =>
    metric.higherIsBetter
      ? row[metric.key] >= targetValue
      : row[metric.key] <= targetValue,
  ).length
}

function deriveObservationCandidates(
  rows: readonly ScoutTeamStats[],
  opponent: ScoutTeamStats,
): ObservationCandidate[] {
  const leagueSize = rows.length

  return METRICS.flatMap((metric) => {
    const rank = competitionRank(rows, opponent, metric)
    const rankEnd = competitionRankEnd(rows, opponent, metric)
    const isStrength = rankEnd <= 8
    const isWeakness = rank >= leagueSize - 7
    if (!isStrength && !isWeakness) return []
    if (isStrength && metric.allowStrength === false) return []
    if (isWeakness && metric.allowWeakness === false) return []

    const polarity = isStrength ? 'strength' : 'weakness'
    const major = isStrength ? rank <= 3 : rank >= leagueSize - 2
    const labels = isStrength ? metric.strengthLabels : metric.weaknessLabels
    const extremity = isStrength ? 9 - rank : rank - (leagueSize - 8)

    return [{
      key: metric.key,
      family: metric.family,
      label: labels[major ? 0 : 1],
      rank,
      leagueSize,
      value: opponent[metric.key],
      format: metric.format,
      unit: metric.unit,
      polarity,
      extremity,
      priority: metric.priority,
    }]
  })
}

function selectObservations(
  rows: readonly ScoutTeamStats[],
  opponent: ScoutTeamStats,
): MatchupScoutObservation[] {
  const limit = opponent.gamesPlayed >= 6 ? 3 : opponent.gamesPlayed >= 3 ? 2 : 0
  if (limit === 0) return []

  const selected: ObservationCandidate[] = []
  const usedFamilies = new Set<MatchupScoutObservationFamily>()
  const eligibleCandidates = deriveObservationCandidates(rows, opponent)
  const hasScoringCandidate = eligibleCandidates.some(
    ({ family }) => family === 'scoring',
  )
  const candidates = eligibleCandidates.filter(
    ({ family }) => family !== 'differential' || !hasScoringCandidate,
  ).sort(
    (first, second) =>
      second.extremity - first.extremity ||
      first.priority - second.priority ||
      first.key.localeCompare(second.key),
  )

  for (const candidate of candidates) {
    if (usedFamilies.has(candidate.family)) continue
    selected.push(candidate)
    usedFamilies.add(candidate.family)
    if (selected.length === limit) break
  }

  return selected.map((candidate) => ({
    key: candidate.key,
    family: candidate.family,
    label: candidate.label,
    rank: candidate.rank,
    leagueSize: candidate.leagueSize,
    value: candidate.value,
    format: candidate.format,
    unit: candidate.unit,
    polarity: candidate.polarity,
  }))
}

const PLAYER_RANK_CATEGORIES = [
  ['PPG', 'pointsPerGame'],
  ['RPG', 'reboundsPerGame'],
  ['APG', 'assistsPerGame'],
] as const satisfies readonly (readonly [
  MatchupScoutTopTenRank['category'],
  keyof PlayerSeasonStats,
])[]

function deriveTopTenRanks(
  qualified: readonly PlayerSeasonStats[],
): ReadonlyMap<string, readonly MatchupScoutTopTenRank[]> {
  const ranksByPlayerId = new Map<string, MatchupScoutTopTenRank[]>()

  for (const [category, field] of PLAYER_RANK_CATEGORIES) {
    for (const player of qualified) {
      const value = player[field] as number
      const rank = 1 + qualified.filter(
        (candidate) => (candidate[field] as number) > value,
      ).length
      const rankEnd = qualified.filter(
        (candidate) => (candidate[field] as number) >= value,
      ).length
      if (rankEnd > 10) continue
      const ranks = ranksByPlayerId.get(player.playerId) ?? []
      ranks.push({ category, rank })
      ranksByPlayerId.set(player.playerId, ranks)
    }
  }

  return ranksByPlayerId
}

function derivePlayersToWatch(
  season: SeasonState,
  opponentProgramId: string,
): MatchupScoutPlayer[] {
  const programState = season.programStates[opponentProgramId]
  if (!programState) {
    throw new RangeError(`Unknown Season Program ID "${opponentProgramId}".`)
  }

  const programStats = deriveProgramPlayerSeasonStats(season, opponentProgramId)
  const allPlayerStats = deriveSeasonPlayerStats(season)
  const qualified = deriveQualifiedSeasonPlayerStats(season, allPlayerStats)
  const qualifiedOpponent = qualified.filter(
    ({ programId }) => programId === opponentProgramId,
  )
  const topTenRanks = deriveTopTenRanks(qualified)
  const selectedIds: string[] = []

  for (const [, field] of PLAYER_RANK_CATEGORIES) {
    const leader = qualifiedOpponent.slice().sort(
      (first, second) =>
        (second[field] as number) - (first[field] as number) ||
        first.playerId.localeCompare(second.playerId),
    )[0]
    if (leader && !selectedIds.includes(leader.playerId)) {
      selectedIds.push(leader.playerId)
    }
    if (selectedIds.length === 3) break
  }

  if (selectedIds.length < 2) {
    const minutes = derivePlayerMinutesV1(programState.rotation)
    const fallback = programState.team.roster.slice().sort(
      (first, second) =>
        (minutes[second.id] ?? 0) - (minutes[first.id] ?? 0) ||
        calculateOverall(second) - calculateOverall(first) ||
        first.id.localeCompare(second.id),
    )
    for (const player of fallback) {
      if (!selectedIds.includes(player.id)) selectedIds.push(player.id)
      if (selectedIds.length >= 2) break
    }
  }

  const statsByPlayerId = new Map(
    programStats.map((stats) => [stats.playerId, stats] as const),
  )
  const playersById = new Map(
    programState.team.roster.map((player) => [player.id, player] as const),
  )

  return selectedIds.slice(0, 3).flatMap((playerId) => {
    const player = playersById.get(playerId)
    const stats = statsByPlayerId.get(playerId)
    if (!player || !stats) return []

    return [{
      playerId,
      firstName: player.firstName,
      lastName: player.lastName,
      position: player.position,
      classYear: player.classYear,
      gamesPlayed: stats.gamesPlayed,
      pointsPerGame: stats.pointsPerGame,
      reboundsPerGame: stats.reboundsPerGame,
      assistsPerGame: stats.assistsPerGame,
      topTenRanks: topTenRanks.get(playerId) ?? [],
    }]
  })
}

function regularSeasonForm(
  season: SeasonState,
  programId: string,
): MatchupScoutFormGame[] {
  return getCompletedGamesForProgram(season, programId)
    .slice()
    .sort((first, second) =>
      second.game.round - first.game.round ||
      second.game.index - first.game.index ||
      second.game.id.localeCompare(first.game.id),
    )
    .map(({ game, result }) => {
      const isHome = game.homeProgramId === programId
      return {
        gameId: game.id,
        competition: 'regular-season' as const,
        round: game.round,
        opponentProgramId: isHome ? game.awayProgramId : game.homeProgramId,
        location: isHome ? 'home' as const : 'away' as const,
        outcome: result.winnerId === programId ? 'W' as const : 'L' as const,
        teamScore: isHome ? result.homeScore : result.awayScore,
        opponentScore: isHome ? result.awayScore : result.homeScore,
      }
    })
}

function tournamentForm(
  postseason: PostseasonState | null | undefined,
  programId: string,
): MatchupScoutFormGame[] {
  if (!postseason) return []

  return postseason.bracket.games
    .flatMap((game) => {
      const result = postseason.resultsByGameId[game.id]
      if (!result) return []
      const isHome = result.homeTeamId === programId
      const isAway = result.awayTeamId === programId
      if (!isHome && !isAway) return []

      return [{
        gameId: game.id,
        competition: 'tournament' as const,
        round: game.round,
        opponentProgramId: isHome ? result.awayTeamId : result.homeTeamId,
        location: 'neutral' as const,
        outcome: result.winnerId === programId ? 'W' as const : 'L' as const,
        teamScore: isHome ? result.homeScore : result.awayScore,
        opponentScore: isHome ? result.awayScore : result.homeScore,
        tournamentRoundIndex: TOURNAMENT_ROUNDS.indexOf(game.round),
        gameIndex: game.index,
      }]
    })
    .sort((first, second) =>
      second.tournamentRoundIndex - first.tournamentRoundIndex ||
      second.gameIndex - first.gameIndex ||
      second.gameId.localeCompare(first.gameId),
    )
    .map((game) => ({
      gameId: game.gameId,
      competition: game.competition,
      round: game.round,
      opponentProgramId: game.opponentProgramId,
      location: game.location,
      outcome: game.outcome,
      teamScore: game.teamScore,
      opponentScore: game.opponentScore,
    }))
}

function derivePriorMeeting(
  season: SeasonState,
  controlledProgramId: string,
  opponentProgramId: string,
): MatchupScoutPriorMeeting | null {
  const meeting = getCompletedGamesForProgram(season, controlledProgramId)
    .filter(({ game }) =>
      game.homeProgramId === opponentProgramId ||
      game.awayProgramId === opponentProgramId,
    )
    .sort((first, second) =>
      second.game.round - first.game.round ||
      second.game.index - first.game.index ||
      second.game.id.localeCompare(first.game.id),
    )[0]

  if (!meeting) return null
  return {
    scheduledGameId: meeting.game.id,
    round: meeting.game.round,
    homeProgramId: meeting.game.homeProgramId,
    awayProgramId: meeting.game.awayProgramId,
    homeScore: meeting.result.homeScore,
    awayScore: meeting.result.awayScore,
    winnerId: meeting.result.winnerId,
  }
}

function deriveSampleStatus(gamesPlayed: number): MatchupScoutSampleStatus {
  if (gamesPlayed === 0) return 'no-data'
  if (gamesPlayed <= 2) return 'limited'
  if (gamesPlayed <= 5) return 'early'
  return 'established'
}

export function deriveMatchupScout({
  season,
  controlledProgramId,
  opponentProgramId,
  postseason = null,
}: DeriveMatchupScoutOptions): MatchupScoutReport {
  if (!season.programStates[controlledProgramId]) {
    throw new RangeError(`Unknown Season Program ID "${controlledProgramId}".`)
  }

  const teamStats = deriveScoutTeamStats(season)
  const opponent = teamStats.find(({ programId }) => programId === opponentProgramId)
  if (!opponent) {
    throw new RangeError(`Unknown Season Program ID "${opponentProgramId}".`)
  }

  const completeForm = [
    ...tournamentForm(postseason, opponentProgramId),
    ...regularSeasonForm(season, opponentProgramId),
  ]
  const recentForm = completeForm.slice(0, 5)
  const firstOutcome = completeForm[0]?.outcome
  const streakCount = firstOutcome
    ? completeForm.findIndex(({ outcome }) => outcome !== firstOutcome)
    : 0
  const normalizedStreakCount = streakCount === -1 ? completeForm.length : streakCount

  return {
    opponentProgramId,
    sampleStatus: deriveSampleStatus(opponent.gamesPlayed),
    gamesPlayed: opponent.gamesPlayed,
    observations: selectObservations(teamStats, opponent),
    playersToWatch: derivePlayersToWatch(season, opponentProgramId),
    recentForm,
    currentStreak:
      firstOutcome && normalizedStreakCount >= 2
        ? { outcome: firstOutcome, count: normalizedStreakCount }
        : null,
    priorMeeting: derivePriorMeeting(
      season,
      controlledProgramId,
      opponentProgramId,
    ),
  }
}
