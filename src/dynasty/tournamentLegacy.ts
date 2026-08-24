import type { PlayerGameStats } from '../engine'
import {
  TOURNAMENT_ROUNDS,
  deriveNationalChampion,
  type PostseasonState,
  type TournamentRound,
} from '../postseason'
import { projectTournamentMostOutstandingPlayer } from './awards'
import type { DynastyState } from './domain'

const TOTAL_FIELDS = [
  'minutes', 'points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers',
  'fieldGoalsMade', 'fieldGoalsAttempted', 'threePointersMade',
  'threePointersAttempted', 'freeThrowsMade', 'freeThrowsAttempted',
] as const satisfies readonly (keyof PlayerGameStats)[]

type TotalField = (typeof TOTAL_FIELDS)[number]

export interface TournamentPlayerStats extends Record<TotalField, number> {
  readonly gamesPlayed: number
  readonly minutesPerGame: number
  readonly pointsPerGame: number
  readonly reboundsPerGame: number
  readonly assistsPerGame: number
  readonly stealsPerGame: number
  readonly blocksPerGame: number
  readonly turnoversPerGame: number
  readonly fieldGoalPercentage: number
  readonly threePointPercentage: number
  readonly freeThrowPercentage: number
}

export type TournamentRunFinish =
  | { readonly status: 'in-progress' }
  | { readonly status: 'eliminated'; readonly round: TournamentRound }
  | { readonly status: 'runner-up' }
  | { readonly status: 'national-champion' }

export interface PlayerTournamentGameLogEntry {
  readonly gameId: string
  readonly seasonNumber: number
  readonly round: TournamentRound
  readonly opponentProgramId: string
  readonly result: 'W' | 'L'
  readonly teamScore: number
  readonly opponentScore: number
  readonly overtimePeriods: number
  readonly didPlay: boolean
  readonly stats: PlayerGameStats
}

export interface PlayerTournamentRun {
  readonly seasonNumber: number
  readonly programId: string
  readonly seed: number
  readonly finish: TournamentRunFinish
  readonly isInProgress: boolean
  readonly isMop: boolean
  readonly stats: TournamentPlayerStats
  readonly games: readonly PlayerTournamentGameLogEntry[]
}

export interface PlayerTournamentCareer {
  readonly playerId: string
  readonly gameScope: 'tournament'
  readonly runs: readonly PlayerTournamentRun[]
  readonly stats: TournamentPlayerStats
  readonly tournamentAppearances: number
  readonly finalFourAppearances: number
  readonly championshipGameAppearances: number
  readonly nationalChampionships: number
}

function emptyTotals(): Record<TotalField, number> & { gamesPlayed: number } {
  return Object.fromEntries([
    ['gamesPlayed', 0],
    ...TOTAL_FIELDS.map((field) => [field, 0]),
  ]) as Record<TotalField, number> & { gamesPlayed: number }
}

function divideOrZero(value: number, denominator: number): number {
  return denominator === 0 ? 0 : value / denominator
}

function finalizeStats(
  totals: Record<TotalField, number> & { gamesPlayed: number },
): TournamentPlayerStats {
  return {
    ...totals,
    minutesPerGame: divideOrZero(totals.minutes, totals.gamesPlayed),
    pointsPerGame: divideOrZero(totals.points, totals.gamesPlayed),
    reboundsPerGame: divideOrZero(totals.rebounds, totals.gamesPlayed),
    assistsPerGame: divideOrZero(totals.assists, totals.gamesPlayed),
    stealsPerGame: divideOrZero(totals.steals, totals.gamesPlayed),
    blocksPerGame: divideOrZero(totals.blocks, totals.gamesPlayed),
    turnoversPerGame: divideOrZero(totals.turnovers, totals.gamesPlayed),
    fieldGoalPercentage: divideOrZero(totals.fieldGoalsMade, totals.fieldGoalsAttempted),
    threePointPercentage: divideOrZero(totals.threePointersMade, totals.threePointersAttempted),
    freeThrowPercentage: divideOrZero(totals.freeThrowsMade, totals.freeThrowsAttempted),
  }
}

function addStats(
  totals: Record<TotalField, number> & { gamesPlayed: number },
  row: PlayerGameStats,
): void {
  if (row.minutes > 0) totals.gamesPlayed += 1
  for (const field of TOTAL_FIELDS) totals[field] += row[field]
}

function findRosterProgram(postseason: PostseasonState, playerId: string): string | null {
  if (!postseason.programStates) return null
  const matches = Object.entries(postseason.programStates).filter(([, state]) =>
    state.team.roster.some(({ id }) => id === playerId),
  )
  if (matches.length > 1) {
    throw new RangeError(`Player ID "${playerId}" appears on multiple Tournament rosters.`)
  }
  return matches[0]?.[0] ?? null
}

function finishFor(postseason: PostseasonState, programId: string): TournamentRunFinish {
  if (deriveNationalChampion(postseason) === programId) return { status: 'national-champion' }
  const loss = postseason.bracket.games
    .slice()
    .sort((a, b) => a.index - b.index)
    .find((game) => {
      const result = postseason.resultsByGameId[game.id]
      return result &&
        (result.homeTeamId === programId || result.awayTeamId === programId) &&
        result.winnerId !== programId
    })
  if (!loss) return { status: 'in-progress' }
  return loss.round === 'championship'
    ? { status: 'runner-up' }
    : { status: 'eliminated', round: loss.round }
}

export interface TournamentSource {
  readonly seasonNumber: number
  readonly postseason: PostseasonState
  readonly isActive: boolean
  readonly storedMopPlayerId?: string
}

/** Completed archives plus a non-duplicated active Tournament, in Season order. */
export function collectTournamentSources(
  dynasty: Pick<DynastyState, 'history' | 'activePostseason' | 'activeSeason'>,
): TournamentSource[] {
  const archived = [...dynasty.history]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((archive) => ({
      seasonNumber: archive.seasonNumber,
      postseason: archive.postseason,
      isActive: false,
      storedMopPlayerId: archive.awards.honors.find(
        ({ type }) => type === 'tournament-most-outstanding-player',
      )?.playerId,
    }))
  const archivedSeasonNumbers = new Set(archived.map(({ seasonNumber }) => seasonNumber))
  const activeSeasonNumber = dynasty.activeSeason?.seasonNumber
  if (
    dynasty.activePostseason &&
    activeSeasonNumber !== undefined &&
    !archivedSeasonNumbers.has(activeSeasonNumber)
  ) {
    archived.push({
      seasonNumber: activeSeasonNumber,
      postseason: dynasty.activePostseason,
      isActive: true,
      storedMopPlayerId: projectTournamentMostOutstandingPlayer(
        dynasty.activePostseason,
      )?.playerId,
    })
  }
  return archived
}

/** Cross-season Tournament history derived only from canonical Postseason facts. */
export function derivePlayerTournamentCareer(
  dynasty: Pick<DynastyState, 'history' | 'activePostseason' | 'activeSeason'>,
  playerId: string,
): PlayerTournamentCareer {
  const runs = collectTournamentSources(dynasty).flatMap((source): PlayerTournamentRun[] => {
    const programId = findRosterProgram(source.postseason, playerId)
    if (!programId) return []
    const fieldEntry = source.postseason.field.find((entry) => entry.programId === programId)
    if (!fieldEntry) return []
    const totals = emptyTotals()
    const games = source.postseason.bracket.games
      .slice()
      .sort((a, b) => a.index - b.index)
      .flatMap((game): PlayerTournamentGameLogEntry[] => {
        const result = source.postseason.resultsByGameId[game.id]
        if (!result) return []
        const isHome = result.homeTeamId === programId
        const isAway = result.awayTeamId === programId
        if (!isHome && !isAway) return []
        const rows = isHome ? result.homePlayerStats : result.awayPlayerStats
        const row = rows.find(({ playerId: id }) => id === playerId)
        if (!row) return []
        addStats(totals, row)
        return [{
          gameId: game.id,
          seasonNumber: source.seasonNumber,
          round: game.round,
          opponentProgramId: isHome ? result.awayTeamId : result.homeTeamId,
          result: result.winnerId === programId ? 'W' : 'L',
          teamScore: isHome ? result.homeScore : result.awayScore,
          opponentScore: isHome ? result.awayScore : result.homeScore,
          overtimePeriods: result.overtimePeriods,
          didPlay: row.minutes > 0,
          stats: { ...row },
        }]
      })
    const finish = finishFor(source.postseason, programId)
    return [{
      seasonNumber: source.seasonNumber,
      programId,
      seed: fieldEntry.seed,
      finish,
      isInProgress: finish.status === 'in-progress',
      isMop: source.storedMopPlayerId === playerId,
      stats: finalizeStats(totals),
      games,
    }]
  })

  const careerTotals = emptyTotals()
  for (const run of runs) {
    careerTotals.gamesPlayed += run.stats.gamesPlayed
    for (const field of TOTAL_FIELDS) careerTotals[field] += run.stats[field]
  }
  const appearedRuns = runs.filter(({ stats }) => stats.gamesPlayed > 0)
  const reachedRound = (run: PlayerTournamentRun, round: TournamentRound) =>
    run.games.some((game) => game.round === round)

  return {
    playerId,
    gameScope: 'tournament',
    runs,
    stats: finalizeStats(careerTotals),
    tournamentAppearances: appearedRuns.length,
    finalFourAppearances: runs.filter((run) => reachedRound(run, 'semifinals')).length,
    championshipGameAppearances: runs.filter((run) => reachedRound(run, 'championship')).length,
    nationalChampionships: runs.filter(
      ({ finish }) => finish.status === 'national-champion',
    ).length,
  }
}

export const TOURNAMENT_TOTAL_FIELDS = TOTAL_FIELDS
export const TOURNAMENT_ROUND_ORDER = TOURNAMENT_ROUNDS
