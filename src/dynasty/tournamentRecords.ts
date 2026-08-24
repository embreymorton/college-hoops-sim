import type { Player, PlayerGameStats } from '../engine'
import type { ProgramDefinition } from '../universe'
import type { DynastyState } from './domain'
import {
  collectTournamentSources,
  type PlayerTournamentGameLogEntry,
} from './tournamentLegacy'
import {
  RECORD_CATEGORIES,
  type RecordBookEntry,
  type RecordCategory,
} from './seasonRecords'

export interface TournamentCategoryRecordBook {
  readonly singleGame: readonly RecordBookEntry[]
  readonly tournamentRun: readonly RecordBookEntry[]
  readonly career: readonly RecordBookEntry[]
}

export type TournamentRecordBook = Readonly<
  Record<RecordCategory, TournamentCategoryRecordBook>
>

export interface PlayerTournamentCareerHighEntry {
  readonly value: number
  readonly gameId: string
  readonly seasonNumber: number
  readonly round: PlayerTournamentGameLogEntry['round']
  readonly opponentProgramName: string
  readonly occurrenceCount: number
}

export interface PlayerTournamentCareerHighs {
  readonly playerId: string
  readonly gameScope: 'tournament'
  readonly hasAppearances: boolean
  readonly categories: Readonly<
    Record<RecordCategory, PlayerTournamentCareerHighEntry | null>
  >
}

interface Candidate extends Omit<RecordBookEntry, 'rank'> {
  readonly tieKey: string
  readonly gameId?: string
  readonly round?: PlayerTournamentGameLogEntry['round']
}

interface CareerAccumulator {
  player: Player
  programId: string
  gamesPlayed: number
  readonly seasonNumbers: number[]
  readonly totals: Record<RecordCategory, number>
}

interface TournamentCandidateCorpus {
  readonly games: Record<RecordCategory, Candidate[]>
  readonly runs: Record<RecordCategory, Candidate[]>
  readonly careers: Record<RecordCategory, Candidate[]>
  readonly appearancePlayerIds: ReadonlySet<string>
}

function emptyCandidates(): Record<RecordCategory, Candidate[]> {
  return { points: [], rebounds: [], assists: [], steals: [], blocks: [] }
}

function identity(player: Player, program: ProgramDefinition) {
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    programId: program.id,
    programName: program.name,
    programAbbreviation: program.abbreviation,
  }
}

function project(candidate: Candidate, rank: number): RecordBookEntry {
  return {
    rank,
    playerId: candidate.playerId,
    firstName: candidate.firstName,
    lastName: candidate.lastName,
    value: candidate.value,
    programId: candidate.programId,
    programName: candidate.programName,
    programAbbreviation: candidate.programAbbreviation,
    seasonNumber: candidate.seasonNumber,
    opponentProgramName: candidate.opponentProgramName,
    gamesPlayed: candidate.gamesPlayed,
    firstSeasonNumber: candidate.firstSeasonNumber,
    lastSeasonNumber: candidate.lastSeasonNumber,
    isLive: candidate.isLive,
  }
}

function sortAndRank(candidates: readonly Candidate[], limit: number): RecordBookEntry[] {
  return [...candidates]
    .sort((a, b) => b.value - a.value || a.tieKey.localeCompare(b.tieKey))
    .slice(0, Math.max(0, limit))
    .map((candidate, index) => project(candidate, index + 1))
}

function rosterMap(postseason: DynastyState['history'][number]['postseason']) {
  return new Map(
    Object.entries(postseason.programStates).flatMap(([programId, state]) =>
      state.team.roster.map((player) => [player.id, { player, programId }] as const),
    ),
  )
}

function collectTournamentRecordCandidates(
  dynasty: Pick<DynastyState, 'history' | 'activePostseason' | 'activeSeason' | 'universe'>,
): TournamentCandidateCorpus {
  const programs = new Map(dynasty.universe.programs.map((program) => [program.id, program]))
  const games = emptyCandidates()
  const runs = emptyCandidates()
  const careerByPlayerId = new Map<string, CareerAccumulator>()
  const appearancePlayerIds = new Set<string>()

  for (const source of collectTournamentSources(dynasty)) {
    if (!source.postseason.programStates) continue
    const rosters = rosterMap(source.postseason)
    const runTotals = new Map<string, { gamesPlayed: number; totals: Record<RecordCategory, number> }>()
    for (const game of source.postseason.bracket.games.slice().sort((a, b) => a.index - b.index)) {
      const result = source.postseason.resultsByGameId[game.id]
      if (!result) continue
      for (const [programId, opponentId, rows] of [
        [result.homeTeamId, result.awayTeamId, result.homePlayerStats],
        [result.awayTeamId, result.homeTeamId, result.awayPlayerStats],
      ] as const) {
        const program = programs.get(programId)
        const opponent = programs.get(opponentId)
        if (!program || !opponent) continue
        for (const stats of rows as readonly PlayerGameStats[]) {
          if (stats.minutes <= 0) continue
          const match = rosters.get(stats.playerId)
          if (!match || match.programId !== programId) continue
          appearancePlayerIds.add(stats.playerId)
          const totals = runTotals.get(stats.playerId) ?? {
            gamesPlayed: 0,
            totals: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
          }
          totals.gamesPlayed += 1
          for (const category of RECORD_CATEGORIES) {
            totals.totals[category] += stats[category]
            games[category].push({
              ...identity(match.player, program),
              value: stats[category],
              gameId: game.id,
              round: game.round,
              seasonNumber: source.seasonNumber,
              opponentProgramName: opponent.name,
              tieKey: `${source.seasonNumber}:${game.index}:${stats.playerId}`,
            })
          }
          runTotals.set(stats.playerId, totals)
        }
      }
    }

    for (const [playerId, totals] of runTotals) {
      const match = rosters.get(playerId)
      const program = match ? programs.get(match.programId) : undefined
      if (!match || !program) continue
      for (const category of RECORD_CATEGORIES) {
        runs[category].push({
          ...identity(match.player, program),
          value: totals.totals[category],
          gamesPlayed: totals.gamesPlayed,
          seasonNumber: source.seasonNumber,
          isLive: source.isActive,
          tieKey: `${source.seasonNumber}:${playerId}`,
        })
      }
      const career = careerByPlayerId.get(playerId) ?? {
        player: match.player,
        programId: match.programId,
        gamesPlayed: 0,
        seasonNumbers: [],
        totals: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
      }
      career.player = match.player
      career.programId = match.programId
      career.gamesPlayed += totals.gamesPlayed
      career.seasonNumbers.push(source.seasonNumber)
      for (const category of RECORD_CATEGORIES) career.totals[category] += totals.totals[category]
      careerByPlayerId.set(playerId, career)
    }
  }

  const careers = emptyCandidates()
  for (const [playerId, career] of careerByPlayerId) {
    const program = programs.get(career.programId)
    if (!program) continue
    for (const category of RECORD_CATEGORIES) {
      careers[category].push({
        ...identity(career.player, program),
        value: career.totals[category],
        gamesPlayed: career.gamesPlayed,
        firstSeasonNumber: Math.min(...career.seasonNumbers),
        lastSeasonNumber: Math.max(...career.seasonNumbers),
        tieKey: playerId,
      })
    }
  }
  return { games, runs, careers, appearancePlayerIds }
}

export function deriveTournamentRecordBook(
  dynasty: Pick<DynastyState, 'history' | 'activePostseason' | 'activeSeason' | 'universe'>,
  limit = 10,
): TournamentRecordBook {
  const corpus = collectTournamentRecordCandidates(dynasty)
  return Object.fromEntries(RECORD_CATEGORIES.map((category) => [category, {
    singleGame: sortAndRank(corpus.games[category], limit),
    tournamentRun: sortAndRank(corpus.runs[category], limit),
    career: sortAndRank(corpus.careers[category], limit),
  }])) as unknown as TournamentRecordBook
}

export function derivePlayerTournamentCareerHighs(
  dynasty: Pick<DynastyState, 'history' | 'activePostseason' | 'activeSeason' | 'universe'>,
  playerId: string,
): PlayerTournamentCareerHighs {
  const corpus = collectTournamentRecordCandidates(dynasty)
  const categories = Object.fromEntries(RECORD_CATEGORIES.map((category) => {
    const candidates = corpus.games[category]
      .filter((candidate) => candidate.playerId === playerId)
      .sort((a, b) => b.value - a.value || a.tieKey.localeCompare(b.tieKey))
    const best = candidates[0]
    return [category, best ? {
      value: best.value,
      gameId: best.gameId!,
      seasonNumber: best.seasonNumber!,
      round: best.round!,
      opponentProgramName: best.opponentProgramName!,
      occurrenceCount: candidates.filter(({ value }) => value === best.value).length,
    } : null]
  })) as unknown as PlayerTournamentCareerHighs['categories']
  return { playerId, gameScope: 'tournament', hasAppearances: corpus.appearancePlayerIds.has(playerId), categories }
}
