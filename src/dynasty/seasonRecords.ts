import type { Player, PlayerGameStats } from '../engine'
import {
  deriveQualifiedSeasonPlayerStats,
  deriveSeasonPlayerStats,
  type PlayerSeasonStats,
} from '../season'
import type { ProgramDefinition } from '../universe'
import type { DynastyState } from './domain'

export type RecordCategory = 'points' | 'rebounds' | 'assists' | 'steals' | 'blocks'
export type StatisticalGameScope = 'regular-season'

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
  /** True only for a provisional active-Season rate entry. */
  readonly isLive?: boolean
}

export interface CategoryRecordBook {
  readonly singleGame: readonly RecordBookEntry[]
  readonly singleSeason: readonly RecordBookEntry[]
  readonly career: readonly RecordBookEntry[]
}

export type DynastyRecordBook = Readonly<Record<RecordCategory, CategoryRecordBook>>

export interface PlayerCareerHighEntry {
  readonly value: number
  readonly gameId: string
  readonly seasonNumber: number
  readonly opponentProgramName: string
  readonly occurrenceCount: number
}

export interface PlayerCareerHighs {
  readonly playerId: string
  readonly gameScope: StatisticalGameScope
  readonly hasAppearances: boolean
  readonly categories: Readonly<Record<RecordCategory, PlayerCareerHighEntry | null>>
}

export interface ProgramPlayerRecords {
  readonly programId: string
  readonly gameScope: StatisticalGameScope
  readonly hasAppearances: boolean
  readonly categories: Readonly<Record<RecordCategory, ProgramCategoryRecords>>
}

export interface ProgramCategoryRecords {
  readonly singleGame: RecordBookEntry | null
  readonly singleSeason: RecordBookEntry | null
  readonly career: RecordBookEntry | null
}

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
  readonly gameId?: string
}

interface CareerAccumulator {
  player: Player
  readonly programIds: string[]
  readonly totals: Record<RecordCategory, number>
  gamesPlayed: number
  readonly seasonNumbers: number[]
}

interface RecordCandidateCorpus {
  readonly gameCandidates: Record<RecordCategory, Candidate[]>
  readonly seasonCandidates: Record<RecordCategory, Candidate[]>
  readonly careerCandidates: Record<RecordCategory, Candidate[]>
  readonly programCareerCandidates: Record<RecordCategory, Candidate[]>
  readonly appearancePlayerIds: ReadonlySet<string>
  readonly appearanceProgramIds: ReadonlySet<string>
}

function sortAndRank(candidates: readonly Candidate[], limit: number): RecordBookEntry[] {
  return [...candidates]
    .sort((first, second) =>
      second.value - first.value || first.tieKey.localeCompare(second.tieKey),
    )
    .slice(0, limit)
    .map((candidate, index) => projectCandidate(candidate, index + 1))
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

function projectCandidate(candidate: Candidate, rank: number): RecordBookEntry {
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

function collectRegularSeasonRecordCandidates(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'activeSeason'>,
): RecordCandidateCorpus {
  const programs = new Map(dynasty.universe.programs.map((program) => [program.id, program]))
  const archives = [...dynasty.history].sort(
    (first, second) => first.seasonNumber - second.seasonNumber,
  )
  const archivedSeasonNumbers = new Set(archives.map(({ seasonNumber }) => seasonNumber))
  const seasons = [
    ...archives.map(({ seasonNumber, season }) => ({ seasonNumber, season, isLive: false })),
    ...(dynasty.activeSeason && !archivedSeasonNumbers.has(dynasty.activeSeason.seasonNumber)
      ? [{
          seasonNumber: dynasty.activeSeason.seasonNumber,
          season: dynasty.activeSeason,
          isLive: true,
        }]
      : []),
  ].sort((first, second) => first.seasonNumber - second.seasonNumber)
  const gameCandidates = emptyCandidates()
  const seasonCandidates = emptyCandidates()
  const careerByPlayerId = new Map<string, CareerAccumulator>()
  const careerByProgramAndPlayerId = new Map<string, CareerAccumulator>()
  const appearancePlayerIds = new Set<string>()
  const appearanceProgramIds = new Set<string>()

  for (const seasonSource of seasons) {
    const players = playerMap(seasonSource.season)

    for (const game of [...seasonSource.season.schedule.games].sort((first, second) =>
      first.id.localeCompare(second.id),
    )) {
      const result = seasonSource.season.resultsByGameId[game.id]
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
          appearancePlayerIds.add(stats.playerId)
          appearanceProgramIds.add(programId)

          for (const category of RECORD_CATEGORIES) {
            gameCandidates[category].push({
              ...identity(match.player, program),
              value: stats[category],
              gameId: game.id,
              seasonNumber: seasonSource.seasonNumber,
              opponentProgramName: opponent.name,
              tieKey: `${seasonSource.seasonNumber}:${game.id}:${stats.playerId}`,
            })
          }
        }
      }
    }

    const statsRows = deriveSeasonPlayerStats(seasonSource.season)
    const qualifiedRows = deriveQualifiedSeasonPlayerStats(seasonSource.season, statsRows)

    for (const category of RECORD_CATEGORIES) {
      for (const stats of qualifiedRows) {
        const match = players.get(stats.playerId)
        const program = programs.get(stats.programId)
        if (!match || !program) continue

        seasonCandidates[category].push({
          ...identity(match.player, program),
          value: stats[RATE_FIELD[category]] as number,
          gamesPlayed: stats.gamesPlayed,
          seasonNumber: seasonSource.seasonNumber,
          isLive: seasonSource.isLive,
          tieKey: `${seasonSource.seasonNumber}:${stats.playerId}`,
        })
      }
    }

    for (const stats of statsRows) {
      const match = players.get(stats.playerId)
      if (!match) continue
      const accumulators = [
        [careerByPlayerId, stats.playerId],
        [careerByProgramAndPlayerId, `${stats.programId}:${stats.playerId}`],
      ] as const
      for (const [accumulatorMap, key] of accumulators) {
        const career = accumulatorMap.get(key) ?? {
          player: match.player,
          programIds: [],
          totals: { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 },
          gamesPlayed: 0,
          seasonNumbers: [],
        }
        career.player = match.player
        career.programIds.push(stats.programId)
        career.gamesPlayed += stats.gamesPlayed
        career.seasonNumbers.push(seasonSource.seasonNumber)
        for (const category of RECORD_CATEGORIES) career.totals[category] += stats[category]
        accumulatorMap.set(key, career)
      }
    }
  }

  function buildCareerCandidates(
    accumulators: ReadonlyMap<string, CareerAccumulator>,
  ): Record<RecordCategory, Candidate[]> {
    const candidates = emptyCandidates()
    for (const [key, career] of accumulators) {
      if (career.gamesPlayed <= 0) continue
      const programId = career.programIds.at(-1)!
      const program = programs.get(programId)
      if (!program) continue
      for (const category of RECORD_CATEGORIES) {
        candidates[category].push({
          ...identity(career.player, program),
          value: career.totals[category],
          gamesPlayed: career.gamesPlayed,
          firstSeasonNumber: Math.min(...career.seasonNumbers),
          lastSeasonNumber: Math.max(...career.seasonNumbers),
          tieKey: key,
        })
      }
    }
    return candidates
  }

  return {
    gameCandidates,
    seasonCandidates,
    careerCandidates: buildCareerCandidates(careerByPlayerId),
    programCareerCandidates: buildCareerCandidates(careerByProgramAndPlayerId),
    appearancePlayerIds,
    appearanceProgramIds,
  }
}

/**
 * Derives every completed-regular-season Player record in one shared pass.
 * Category selection is deliberately left to the UI as a cheap read.
 */
export function deriveDynastyRecordBook(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'activeSeason'>,
  limit = 10,
): DynastyRecordBook {
  const { gameCandidates, seasonCandidates, careerCandidates } =
    collectRegularSeasonRecordCandidates(dynasty)

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

/** One Player's regular-season single-game career highs from canonical results. */
export function derivePlayerCareerHighs(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'activeSeason'>,
  playerId: string,
): PlayerCareerHighs {
  const corpus = collectRegularSeasonRecordCandidates(dynasty)
  const categories = {} as Record<RecordCategory, PlayerCareerHighEntry | null>

  for (const category of RECORD_CATEGORIES) {
    const candidates = corpus.gameCandidates[category]
      .filter((candidate) => candidate.playerId === playerId)
      .sort((first, second) =>
        second.value - first.value || first.tieKey.localeCompare(second.tieKey),
      )
    const best = candidates[0]
    categories[category] = best
      ? {
          value: best.value,
          gameId: best.gameId!,
          seasonNumber: best.seasonNumber!,
          opponentProgramName: best.opponentProgramName!,
          occurrenceCount: candidates.filter(({ value }) => value === best.value).length,
        }
      : null
  }

  return {
    playerId,
    gameScope: 'regular-season',
    hasAppearances: corpus.appearancePlayerIds.has(playerId),
    categories,
  }
}

/** Individual regular-season record holders while representing one Program. */
export function deriveProgramPlayerRecords(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'activeSeason'>,
  programId: string,
): ProgramPlayerRecords {
  if (!dynasty.universe.programs.some((program) => program.id === programId)) {
    throw new RangeError(`Unknown Program ID "${programId}" for Program Player Records.`)
  }
  const corpus = collectRegularSeasonRecordCandidates(dynasty)
  const categories = {} as Record<RecordCategory, ProgramCategoryRecords>

  for (const category of RECORD_CATEGORIES) {
    const first = (candidates: readonly Candidate[]) =>
      sortAndRank(candidates.filter((candidate) => candidate.programId === programId), 1)[0] ?? null
    categories[category] = {
      singleGame: first(corpus.gameCandidates[category]),
      singleSeason: first(corpus.seasonCandidates[category]),
      career: first(corpus.programCareerCandidates[category]),
    }
  }

  return {
    programId,
    gameScope: 'regular-season',
    hasAppearances: corpus.appearanceProgramIds.has(programId),
    categories,
  }
}
