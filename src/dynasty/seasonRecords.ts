import type { Player, PlayerGameStats } from '../engine'
import {
  deriveQualifiedSeasonPlayerStats,
  deriveSeasonPlayerStats,
  type PlayerSeasonStats,
} from '../season'
import type { ProgramDefinition } from '../universe'
import type { DynastyState } from './domain'

export type RecordCategory = 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks'

export interface RecordBookEntry {
  readonly rank: number
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly value: number
  readonly programId: string
  readonly programName: string
  readonly programAbbreviation: string
  readonly seasonNumber?: number
  readonly opponentProgramName?: string
  readonly gamesPlayed?: number
  readonly firstSeasonNumber?: number
  readonly lastSeasonNumber?: number
}

export interface CategoryRecordBook {
  readonly singleGame: readonly RecordBookEntry[]
  readonly singleSeason: readonly RecordBookEntry[]
  readonly career: readonly RecordBookEntry[]
}

export type DynastyRecordBook = Readonly<Record<RecordCategory, CategoryRecordBook>>

export const RECORD_CATEGORIES: readonly RecordCategory[] = [
  'points', 'rebounds', 'assists', 'steals', 'blocks',
]

const RATE_FIELD: Readonly<Record<RecordCategory, keyof PlayerSeasonStats>> = {
  points: 'pointsPerGame',
  rebounds: 'reboundsPerGame',
  assists: 'assistsPerGame',
  steals: 'stealsPerGame',
  blocks: 'blocksPerGame',
}

interface Candidate extends Omit<RecordBookEntry, 'rank'> {
  readonly tieKey: string
}

interface CareerAccumulator {
  player: Player
  readonly programIds: string[]
  readonly totals: Record<RecordCategory, number>
  gamesPlayed: number
  readonly seasonNumbers: number[]
}

function sortAndRank(candidates: readonly Candidate[], limit: number): RecordBookEntry[] {
  return [...candidates]
    .sort((first, second) =>
      second.value - first.value || first.tieKey.localeCompare(second.tieKey),
    )
    .slice(0, limit)
    .map((candidate, index) => ({
      rank: index + 1,
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
    }))
}

function playerMap(season: DynastyState['history'][number]['season']) {
  return new Map(
    Object.entries(season.programStates).flatMap(([programId, state]) =>
      state.team.roster.map((player) => [player.id, { player, programId }] as const),
    ),
  )
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

function emptyCandidates(): Record<RecordCategory, Candidate[]> {
  return { points: [], rebounds: [], assists: [], steals: [], blocks: [] }
}

/**
 * Derives every completed-regular-season Player record in one shared pass.
 * Category selection is deliberately left to the UI as a cheap read.
 */
export function deriveDynastyRecordBook(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  limit = 10,
): DynastyRecordBook {
  const programs = new Map(dynasty.universe.programs.map((program) => [program.id, program]))
  const archives = [...dynasty.history].sort(
    (first, second) => first.seasonNumber - second.seasonNumber,
  )
  const gameCandidates = emptyCandidates()
  const seasonCandidates = emptyCandidates()
  const careerByPlayerId = new Map<string, CareerAccumulator>()

  for (const archive of archives) {
    const players = playerMap(archive.season)

    for (const game of [...archive.season.schedule.games].sort((first, second) =>
      first.id.localeCompare(second.id),
    )) {
      const result = archive.season.resultsByGameId[game.id]
      if (!result) continue

      for (const [programId, opponentId, rows] of [
        [game.homeProgramId, game.awayProgramId, result.homePlayerStats],
        [game.awayProgramId, game.homeProgramId, result.awayPlayerStats],
      ] as const) {
        const program = programs.get(programId)
        const opponent = programs.get(opponentId)
        if (!program || !opponent) continue

        for (const stats of rows as readonly PlayerGameStats[]) {
          if (stats.minutes <= 0) continue
          const match = players.get(stats.playerId)
          if (!match || match.programId !== programId) continue

          for (const category of RECORD_CATEGORIES) {
            gameCandidates[category].push({
              ...identity(match.player, program),
              value: stats[category],
              seasonNumber: archive.seasonNumber,
              opponentProgramName: opponent.name,
              tieKey: `${archive.seasonNumber}:${game.id}:${stats.playerId}`,
            })
          }
        }
      }
    }

    const statsRows = deriveSeasonPlayerStats(archive.season)
    const qualifiedRows = deriveQualifiedSeasonPlayerStats(archive.season, statsRows)

    for (const category of RECORD_CATEGORIES) {
      for (const stats of qualifiedRows) {
        const match = players.get(stats.playerId)
        const program = programs.get(stats.programId)
        if (!match || !program || !stats) continue

        seasonCandidates[category].push({
          ...identity(match.player, program),
          value: stats[RATE_FIELD[category]] as number,
          gamesPlayed: stats.gamesPlayed,
          seasonNumber: archive.seasonNumber,
          tieKey: `${archive.seasonNumber}:${stats.playerId}`,
        })
      }
    }

    for (const stats of statsRows) {
      const match = players.get(stats.playerId)
      if (!match) continue
      const career = careerByPlayerId.get(stats.playerId) ?? {
        player: match.player,
        programIds: [],
        totals: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
        gamesPlayed: 0,
        seasonNumbers: [],
      }
      career.player = match.player
      career.programIds.push(stats.programId)
      career.gamesPlayed += stats.gamesPlayed
      career.seasonNumbers.push(archive.seasonNumber)
      for (const category of RECORD_CATEGORIES) career.totals[category] += stats[category]
      careerByPlayerId.set(stats.playerId, career)
    }
  }

  const careerCandidates = emptyCandidates()
  for (const [playerId, career] of careerByPlayerId) {
    if (career.gamesPlayed <= 0) continue
    const programId = career.programIds.at(-1)!
    const program = programs.get(programId)
    if (!program) continue
    for (const category of RECORD_CATEGORIES) {
      careerCandidates[category].push({
        ...identity(career.player, program),
        value: career.totals[category],
        gamesPlayed: career.gamesPlayed,
        firstSeasonNumber: Math.min(...career.seasonNumbers),
        lastSeasonNumber: Math.max(...career.seasonNumbers),
        tieKey: playerId,
      })
    }
  }

  const safeLimit = Math.max(0, limit)
  const recordBook = {} as Record<RecordCategory, CategoryRecordBook>
  for (const category of RECORD_CATEGORIES) {
    recordBook[category] = {
      singleGame: sortAndRank(gameCandidates[category], safeLimit),
      singleSeason: sortAndRank(seasonCandidates[category], safeLimit),
      career: sortAndRank(careerCandidates[category], safeLimit),
    }
  }
  return recordBook
}
