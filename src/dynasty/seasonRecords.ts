import type { Player, PlayerGameStats } from '../engine'
import {
  deriveNationalPlayerLeaders,
  deriveSeasonPlayerStats,
  type PlayerSeasonStats,
} from '../season'
import type { ProgramDefinition } from '../universe'
import type { DynastyState } from './domain'

export type RecordScope = 'game' | 'season' | 'career'
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

export interface DynastyRecordBook {
  readonly scope: RecordScope
  readonly category: RecordCategory
  readonly entries: readonly RecordBookEntry[]
}

const RATE_FIELD: Readonly<Record<RecordCategory, keyof PlayerSeasonStats>> = {
  points: 'pointsPerGame', rebounds: 'reboundsPerGame', assists: 'assistsPerGame',
  steals: 'stealsPerGame', blocks: 'blocksPerGame',
}

interface Candidate extends Omit<RecordBookEntry, 'rank'> {
  readonly tieKey: string
}

function sorted(candidates: Candidate[], limit: number): RecordBookEntry[] {
  return candidates.sort((a, b) => b.value - a.value || a.tieKey.localeCompare(b.tieKey))
    .slice(0, limit).map((candidate, index) => ({
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
  return new Map(Object.entries(season.programStates).flatMap(([programId, state]) =>
    state.team.roster.map((player) => [player.id, { player, programId }] as const)))
}

function identity(player: Player, program: ProgramDefinition) {
  return { playerId: player.id, firstName: player.firstName, lastName: player.lastName,
    programId: program.id, programName: program.name, programAbbreviation: program.abbreviation }
}

/** Pure completed-regular-season Record Book projection. */
export function deriveDynastyRecordBook(
  dynasty: Pick<DynastyState, 'history' | 'universe'>,
  scope: RecordScope,
  category: RecordCategory,
  limit = 10,
): DynastyRecordBook {
  const programs = new Map(dynasty.universe.programs.map((p) => [p.id, p]))
  const archives = [...dynasty.history].sort((a, b) => a.seasonNumber - b.seasonNumber)
  const candidates: Candidate[] = []

  if (scope === 'game') {
    for (const archive of archives) {
      const players = playerMap(archive.season)
      for (const game of [...archive.season.schedule.games].sort((a, b) => a.id.localeCompare(b.id))) {
        const result = archive.season.resultsByGameId[game.id]
        if (!result) continue
        for (const [programId, opponentId, rows] of [
          [game.homeProgramId, game.awayProgramId, result.homePlayerStats],
          [game.awayProgramId, game.homeProgramId, result.awayPlayerStats],
        ] as const) {
          const program = programs.get(programId); const opponent = programs.get(opponentId)
          if (!program || !opponent) continue
          for (const stats of rows as readonly PlayerGameStats[]) {
            if (stats.minutes <= 0) continue
            const match = players.get(stats.playerId)
            if (!match || match.programId !== programId) continue
            candidates.push({ ...identity(match.player, program), value: stats[category],
              seasonNumber: archive.seasonNumber, opponentProgramName: opponent.name,
              tieKey: `${archive.seasonNumber}:${game.id}:${stats.playerId}` })
          }
        }
      }
    }
  } else if (scope === 'season') {
    for (const archive of archives) {
      const players = playerMap(archive.season)
      const qualified = deriveNationalPlayerLeaders(archive.season, Number.MAX_SAFE_INTEGER)[category]
      for (const row of qualified) {
        const match = players.get(row.playerId); const program = programs.get(row.programId)
        const stats = deriveSeasonPlayerStats(archive.season).find((s) => s.playerId === row.playerId)
        if (!match || !program || !stats) continue
        candidates.push({ ...identity(match.player, program), value: stats[RATE_FIELD[category]] as number,
          gamesPlayed: stats.gamesPlayed, seasonNumber: archive.seasonNumber,
          tieKey: `${archive.seasonNumber}:${row.playerId}` })
      }
    }
  } else {
    const careers = new Map<string, { player: Player; programIds: string[]; total: number; games: number; seasons: number[] }>()
    for (const archive of archives) {
      const players = playerMap(archive.season)
      for (const stats of deriveSeasonPlayerStats(archive.season)) {
        const match = players.get(stats.playerId); if (!match) continue
        const current = careers.get(stats.playerId) ?? { player: match.player, programIds: [], total: 0, games: 0, seasons: [] }
        current.player = match.player; current.programIds.push(stats.programId); current.total += stats[category]
        current.games += stats.gamesPlayed; current.seasons.push(archive.seasonNumber); careers.set(stats.playerId, current)
      }
    }
    for (const [playerId, career] of careers) {
      if (career.games <= 0) continue
      const programId = career.programIds.at(-1)!; const program = programs.get(programId); if (!program) continue
      candidates.push({ ...identity(career.player, program), value: career.total, gamesPlayed: career.games,
        firstSeasonNumber: Math.min(...career.seasons), lastSeasonNumber: Math.max(...career.seasons), tieKey: playerId })
    }
  }

  return { scope, category, entries: sorted(candidates, Math.max(0, limit)) }
}
