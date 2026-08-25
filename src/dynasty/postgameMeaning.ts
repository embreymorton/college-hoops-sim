import type { Player, PlayerGameStats } from '../engine'
import { TOURNAMENT_ROUNDS, type PostseasonState, type TournamentRound } from '../postseason'
import {
  deriveConferenceRecord,
  deriveProgramRecord,
  type ProgramRecord,
  type SeasonState,
} from '../season'
import type { ScheduledGame } from '../schedule'
import type { ProgramDefinition } from '../universe'
import type { DynastyState } from './domain'
import {
  deriveDynastyRecordBook,
  derivePlayerCareerHighs,
  deriveProgramPlayerRecords,
  RECORD_CATEGORIES,
  type RecordCategory,
} from './seasonRecords'
import {
  derivePlayerTournamentCareerHighs,
  deriveTournamentRecordBook,
} from './tournamentRecords'

export type PostgameCompetition = 'regular-season' | 'tournament'
export type PostgamePresentation = 'live' | 'historical'

export interface PostgameProgramIdentity {
  readonly programId: string
  readonly name: string
  readonly abbreviation: string
}

export interface PostgamePlayerIdentity {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly program: PostgameProgramIdentity
}

export interface PostgameRecordValue {
  readonly category: RecordCategory
  readonly value: number
}

export type PostgameRecordScope =
  | 'dynasty-single-game'
  | 'program-single-game'
  | 'tournament-single-game'
  | 'tournament-run'
  | 'tournament-career'

export type PostgameMeaningFact =
  | {
      readonly kind: 'program-records'
      readonly first: PostgameProgramIdentity & {
        readonly overall: ProgramRecord
        readonly conference: ProgramRecord | null
      }
      readonly second: PostgameProgramIdentity & {
        readonly overall: ProgramRecord
        readonly conference: ProgramRecord | null
      }
    }
  | {
      readonly kind: 'competitive-outcome'
      readonly outcome: 'championship' | 'advancement'
      readonly winner: PostgameProgramIdentity
      readonly loser: PostgameProgramIdentity
      readonly completedRound: TournamentRound
      readonly nextRound: TournamentRound | null
    }
  | {
      readonly kind: 'statistical-record'
      readonly scope: PostgameRecordScope
      readonly player: PostgamePlayerIdentity
      readonly records: readonly PostgameRecordValue[]
    }
  | {
      readonly kind: 'career-high'
      readonly competition: PostgameCompetition
      readonly player: PostgamePlayerIdentity
      readonly records: readonly PostgameRecordValue[]
    }
  | {
      readonly kind: 'tournament-upset'
      readonly winner: PostgameProgramIdentity
      readonly loser: PostgameProgramIdentity
      readonly winnerSeed: number
      readonly loserSeed: number
    }
  | {
      readonly kind: 'streak'
      readonly streak: 'ten-wins' | 'undefeated-run-ended'
      readonly program: PostgameProgramIdentity
      readonly opponent: PostgameProgramIdentity
      readonly wins: number
    }

export interface PostgameMeaning {
  readonly competition: PostgameCompetition
  readonly gameId: string
  readonly presentation: PostgamePresentation
  readonly facts: readonly PostgameMeaningFact[]
}

export interface DerivePostgameMeaningOptions {
  readonly dynasty: DynastyState
  readonly competition: PostgameCompetition
  readonly gameId: string
  readonly perspectiveProgramId: string
  readonly presentation: PostgamePresentation
}

interface Candidate {
  readonly fact: PostgameMeaningFact
  readonly priority: number
  readonly controlledInvolvement: boolean
  readonly winnerInvolvement: boolean
  readonly categoryOrder: number
  readonly playerId: string
}

const CAREER_HIGH_THRESHOLDS: Readonly<Record<RecordCategory, number>> = {
  points: 35,
  rebounds: 18,
  assists: 12,
  steals: 5,
  blocks: 6,
}

function programIdentity(program: ProgramDefinition): PostgameProgramIdentity {
  return {
    programId: program.id,
    name: program.name,
    abbreviation: program.abbreviation,
  }
}

function programsById(dynasty: DynastyState): ReadonlyMap<string, ProgramDefinition> {
  return new Map(dynasty.universe.programs.map((program) => [program.id, program]))
}

function requireProgram(
  programs: ReadonlyMap<string, ProgramDefinition>,
  programId: string,
): ProgramDefinition {
  const program = programs.get(programId)
  if (!program) throw new RangeError(`Unknown Postgame Meaning Program ID "${programId}".`)
  return program
}

function playerIdentity(
  player: Player,
  program: ProgramDefinition,
): PostgamePlayerIdentity {
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    program: programIdentity(program),
  }
}

function compareCandidates(first: Candidate, second: Candidate): number {
  return (
    first.priority - second.priority ||
    Number(second.controlledInvolvement) - Number(first.controlledInvolvement) ||
    Number(second.winnerInvolvement) - Number(first.winnerInvolvement) ||
    first.categoryOrder - second.categoryOrder ||
    first.playerId.localeCompare(second.playerId)
  )
}

function finalize(
  competition: PostgameCompetition,
  gameId: string,
  presentation: PostgamePresentation,
  candidates: readonly Candidate[],
): PostgameMeaning {
  return {
    competition,
    gameId,
    presentation,
    facts: [...candidates].sort(compareCandidates).slice(0, 3).map(({ fact }) => fact),
  }
}

function categoryOrder(categories: readonly PostgameRecordValue[]): number {
  return Math.min(...categories.map(({ category }) => RECORD_CATEGORIES.indexOf(category)))
}

function seasonGameCompare(first: ScheduledGame, second: ScheduledGame): number {
  return first.round - second.round || first.index - second.index
}

function scopedSeason(season: SeasonState, target: ScheduledGame, includeTarget: boolean): SeasonState {
  return {
    ...season,
    resultsByGameId: Object.fromEntries(
      season.schedule.games
        .filter((game) => {
          const order = seasonGameCompare(game, target)
          return order < 0 || (includeTarget && order === 0)
        })
        .flatMap((game) => {
          const result = season.resultsByGameId[game.id]
          return result ? [[game.id, result] as const] : []
        }),
    ),
  }
}

function postseasonGameCompare(
  first: { readonly round: TournamentRound; readonly index: number },
  second: { readonly round: TournamentRound; readonly index: number },
): number {
  return (
    TOURNAMENT_ROUNDS.indexOf(first.round) - TOURNAMENT_ROUNDS.indexOf(second.round) ||
    first.index - second.index
  )
}

function scopedPostseason(
  postseason: PostseasonState,
  target: PostseasonState['bracket']['games'][number],
  includeTarget: boolean,
): PostseasonState {
  return {
    ...postseason,
    resultsByGameId: Object.fromEntries(
      postseason.bracket.games
        .filter((game) => {
          const order = postseasonGameCompare(game, target)
          return order < 0 || (includeTarget && order === 0)
        })
        .flatMap((game) => {
          const result = postseason.resultsByGameId[game.id]
          return result ? [[game.id, result] as const] : []
        }),
    ),
  }
}

function resultRows(
  homeProgramId: string,
  awayProgramId: string,
  result: {
    readonly homeTeamId: string
    readonly awayTeamId: string
    readonly homePlayerStats: readonly PlayerGameStats[]
    readonly awayPlayerStats: readonly PlayerGameStats[]
  },
): readonly { readonly programId: string; readonly stats: PlayerGameStats }[] {
  if (result.homeTeamId !== homeProgramId || result.awayTeamId !== awayProgramId) {
    throw new RangeError('Postgame Meaning result participants do not match the canonical game.')
  }
  return [
    ...result.homePlayerStats.map((stats) => ({ programId: homeProgramId, stats })),
    ...result.awayPlayerStats.map((stats) => ({ programId: awayProgramId, stats })),
  ]
}

function rosterPlayer(
  programStates: Readonly<Record<string, { readonly team: { readonly roster: readonly Player[] } }>>,
  programId: string,
  playerId: string,
): Player {
  const player = programStates[programId]?.team.roster.find(({ id }) => id === playerId)
  if (!player) {
    throw new RangeError(
      `Postgame Meaning cannot resolve Player "${playerId}" on Program "${programId}".`,
    )
  }
  return player
}

function candidateForFact(
  fact: PostgameMeaningFact,
  priority: number,
  perspectiveProgramId: string,
  winnerId: string,
  involvedProgramIds: readonly string[],
  records: readonly PostgameRecordValue[] = [],
  playerId = '',
): Candidate {
  return {
    fact,
    priority,
    controlledInvolvement: involvedProgramIds.includes(perspectiveProgramId),
    winnerInvolvement: involvedProgramIds.includes(winnerId),
    categoryOrder: records.length > 0 ? categoryOrder(records) : RECORD_CATEGORIES.length,
    playerId,
  }
}

function deriveRegularSeasonMeaning(options: DerivePostgameMeaningOptions): PostgameMeaning {
  const { dynasty, gameId, perspectiveProgramId, presentation } = options
  const season = dynasty.activeSeason
  if (!season) throw new RangeError('Regular-season Postgame Meaning requires an active Season.')
  const game = season.schedule.games.find(({ id }) => id === gameId)
  if (!game) throw new RangeError(`Unknown regular-season Postgame Meaning game ID "${gameId}".`)
  const result = season.resultsByGameId[gameId]
  if (!result) throw new RangeError(`Postgame Meaning game "${gameId}" has no completed result.`)
  const rows = resultRows(game.homeProgramId, game.awayProgramId, result)
  const programs = programsById(dynasty)
  requireProgram(programs, game.homeProgramId)
  requireProgram(programs, game.awayProgramId)
  const beforeSeason = scopedSeason(season, game, false)
  const afterSeason = scopedSeason(season, game, true)
  const beforeDynasty: DynastyState = { ...dynasty, activeSeason: beforeSeason, activePostseason: null }
  const candidates: Candidate[] = []
  const dynastyBook = deriveDynastyRecordBook(beforeDynasty, 1)
  const programBooks = new Map(
    [game.homeProgramId, game.awayProgramId].map((programId) => [
      programId,
      deriveProgramPlayerRecords(beforeDynasty, programId),
    ]),
  )
  const recordKeys = new Set<string>()
  const groupedRecords = new Map<string, {
    scope: PostgameRecordScope
    player: PostgamePlayerIdentity
    records: PostgameRecordValue[]
  }>()

  for (const { programId, stats } of rows) {
    if (stats.minutes <= 0) continue
    const program = requireProgram(programs, programId)
    const player = rosterPlayer(season.programStates, programId, stats.playerId)
    for (const category of RECORD_CATEGORIES) {
      const value = stats[category]
      const dynastyBaseline = dynastyBook[category].singleGame[0]?.value
      const programBaseline = programBooks.get(programId)!.categories[category].singleGame?.value
      const scope = dynastyBaseline !== undefined && value > dynastyBaseline
        ? 'dynasty-single-game'
        : programBaseline !== undefined && value > programBaseline
          ? 'program-single-game'
          : null
      if (!scope) continue
      const key = `${scope}:${stats.playerId}`
      const group = groupedRecords.get(key) ?? {
        scope,
        player: playerIdentity(player, program),
        records: [],
      }
      group.records.push({ category, value })
      groupedRecords.set(key, group)
      recordKeys.add(`${stats.playerId}:${category}`)
    }
  }

  for (const group of groupedRecords.values()) {
    const fact: PostgameMeaningFact = {
      kind: 'statistical-record',
      scope: group.scope,
      player: group.player,
      records: group.records,
    }
    candidates.push(candidateForFact(
      fact,
      group.scope === 'dynasty-single-game' ? 3 : 4,
      perspectiveProgramId,
      result.winnerId,
      [group.player.program.programId],
      group.records,
      group.player.playerId,
    ))
  }

  const careerCandidates: Candidate[] = []
  for (const { programId, stats } of rows) {
    if (stats.minutes <= 0) continue
    const prior = derivePlayerCareerHighs(beforeDynasty, stats.playerId)
    if (!prior.hasAppearances) continue
    const records = RECORD_CATEGORIES.flatMap((category): PostgameRecordValue[] => {
      const priorValue = prior.categories[category]?.value
      return priorValue !== undefined &&
        stats[category] > priorValue &&
        stats[category] >= CAREER_HIGH_THRESHOLDS[category] &&
        !recordKeys.has(`${stats.playerId}:${category}`)
        ? [{ category, value: stats[category] }]
        : []
    })
    if (records.length === 0) continue
    const program = requireProgram(programs, programId)
    const player = rosterPlayer(season.programStates, programId, stats.playerId)
    const fact: PostgameMeaningFact = {
      kind: 'career-high',
      competition: 'regular-season',
      player: playerIdentity(player, program),
      records,
    }
    careerCandidates.push(candidateForFact(
      fact, 6, perspectiveProgramId, result.winnerId, [programId], records, stats.playerId,
    ))
  }
  careerCandidates.sort(compareCandidates)
  if (careerCandidates[0]) candidates.push(careerCandidates[0])

  const orderedProgramGames = afterSeason.schedule.games
    .filter((candidate) =>
      (candidate.homeProgramId === result.winnerId || candidate.awayProgramId === result.winnerId) &&
      afterSeason.resultsByGameId[candidate.id],
    )
    .sort(seasonGameCompare)
  const winningTail = orderedProgramGames.slice(-10)
  if (
    winningTail.length === 10 &&
    winningTail.every(({ id }) => afterSeason.resultsByGameId[id]!.winnerId === result.winnerId)
  ) {
    const winnerProgram = requireProgram(programs, result.winnerId)
    const loserId = result.winnerId === game.homeProgramId ? game.awayProgramId : game.homeProgramId
    const loserProgram = requireProgram(programs, loserId)
    const fact: PostgameMeaningFact = {
      kind: 'streak', streak: 'ten-wins', program: programIdentity(winnerProgram),
      opponent: programIdentity(loserProgram), wins: 10,
    }
    candidates.push(candidateForFact(
      fact, 7, perspectiveProgramId, result.winnerId, [result.winnerId], [], '',
    ))
  }

  const loserId = result.winnerId === game.homeProgramId ? game.awayProgramId : game.homeProgramId
  const loserPriorGames = beforeSeason.schedule.games
    .filter((candidate) =>
      (candidate.homeProgramId === loserId || candidate.awayProgramId === loserId) &&
      beforeSeason.resultsByGameId[candidate.id],
    )
    .sort(seasonGameCompare)
  if (
    loserPriorGames.length >= 8 &&
    loserPriorGames.every(({ id }) => beforeSeason.resultsByGameId[id]!.winnerId === loserId)
  ) {
    const loserProgram = requireProgram(programs, loserId)
    const winnerProgram = requireProgram(programs, result.winnerId)
    const fact: PostgameMeaningFact = {
      kind: 'streak', streak: 'undefeated-run-ended', program: programIdentity(loserProgram),
      opponent: programIdentity(winnerProgram), wins: loserPriorGames.length,
    }
    candidates.push(candidateForFact(
      fact, 7, perspectiveProgramId, result.winnerId, [loserId, result.winnerId], [], '',
    ))
  }

  const firstId = perspectiveProgramId === game.awayProgramId
    ? game.awayProgramId
    : game.homeProgramId
  const secondId = firstId === game.homeProgramId ? game.awayProgramId : game.homeProgramId
  const recordFact: PostgameMeaningFact = {
    kind: 'program-records',
    first: {
      ...programIdentity(requireProgram(programs, firstId)),
      overall: deriveProgramRecord(afterSeason, firstId),
      conference: game.type === 'conference' ? deriveConferenceRecord(afterSeason, firstId) : null,
    },
    second: {
      ...programIdentity(requireProgram(programs, secondId)),
      overall: deriveProgramRecord(afterSeason, secondId),
      conference: game.type === 'conference' ? deriveConferenceRecord(afterSeason, secondId) : null,
    },
  }
  candidates.push(candidateForFact(
    recordFact, 8, perspectiveProgramId, result.winnerId, [firstId, secondId], [], '',
  ))

  return finalize('regular-season', gameId, presentation, candidates)
}

function tournamentRecordValues(
  beforeDynasty: DynastyState,
  afterDynasty: DynastyState,
  rows: readonly { readonly programId: string; readonly stats: PlayerGameStats }[],
): ReadonlyMap<string, {
  readonly scope: PostgameRecordScope
  readonly records: readonly PostgameRecordValue[]
}> {
  const before = deriveTournamentRecordBook(beforeDynasty, 10_000)
  const after = deriveTournamentRecordBook(afterDynasty, 10_000)
  const groups = new Map<string, { scope: PostgameRecordScope; records: PostgameRecordValue[] }>()
  const scopes = [
    ['tournament-single-game', 'singleGame'],
    ['tournament-run', 'tournamentRun'],
    ['tournament-career', 'career'],
  ] as const
  for (const { stats } of rows) {
    if (stats.minutes <= 0) continue
    for (const [scope, bookScope] of scopes) {
      for (const category of RECORD_CATEGORIES) {
        const baseline = before[category][bookScope][0]?.value
        if (baseline === undefined) continue
        const value = scope === 'tournament-single-game'
          ? stats[category]
          : after[category][bookScope].find(({ playerId }) => playerId === stats.playerId)?.value
        if (value === undefined || value <= baseline) continue
        const key = `${scope}:${stats.playerId}`
        const group = groups.get(key) ?? { scope, records: [] }
        group.records.push({ category, value })
        groups.set(key, group)
      }
    }
  }
  return groups
}

function deriveTournamentMeaning(options: DerivePostgameMeaningOptions): PostgameMeaning {
  const { dynasty, gameId, perspectiveProgramId, presentation } = options
  const postseason = dynasty.activePostseason
  if (!postseason || !dynasty.activeSeason) {
    throw new RangeError('Tournament Postgame Meaning requires active Season and Postseason state.')
  }
  const game = postseason.bracket.games.find(({ id }) => id === gameId)
  if (!game) throw new RangeError(`Unknown Tournament Postgame Meaning game ID "${gameId}".`)
  const result = postseason.resultsByGameId[gameId]
  if (!result) throw new RangeError(`Postgame Meaning game "${gameId}" has no completed result.`)
  const rows = resultRows(result.homeTeamId, result.awayTeamId, result)
  const programs = programsById(dynasty)
  const winnerProgram = requireProgram(programs, result.winnerId)
  const loserId = result.winnerId === result.homeTeamId ? result.awayTeamId : result.homeTeamId
  const loserProgram = requireProgram(programs, loserId)
  const beforePostseason = scopedPostseason(postseason, game, false)
  const afterPostseason = scopedPostseason(postseason, game, true)
  const beforeDynasty: DynastyState = { ...dynasty, activePostseason: beforePostseason }
  const afterDynasty: DynastyState = { ...dynasty, activePostseason: afterPostseason }
  const candidates: Candidate[] = []
  const roundIndex = TOURNAMENT_ROUNDS.indexOf(game.round)
  const nextRound = TOURNAMENT_ROUNDS[roundIndex + 1] ?? null
  const outcomeFact: PostgameMeaningFact = {
    kind: 'competitive-outcome',
    outcome: game.round === 'championship' ? 'championship' : 'advancement',
    winner: programIdentity(winnerProgram),
    loser: programIdentity(loserProgram),
    completedRound: game.round,
    nextRound,
  }
  candidates.push(candidateForFact(
    outcomeFact,
    game.round === 'championship' ? 1 : 2,
    perspectiveProgramId,
    result.winnerId,
    [result.winnerId, loserId],
  ))

  const recordGroups = tournamentRecordValues(beforeDynasty, afterDynasty, rows)
  const recordKeys = new Set<string>()
  for (const [key, group] of recordGroups) {
    const playerId = key.slice(key.indexOf(':') + 1)
    const row = rows.find(({ stats }) => stats.playerId === playerId)!
    const program = requireProgram(programs, row.programId)
    const player = rosterPlayer(postseason.programStates, row.programId, playerId)
    for (const { category } of group.records) recordKeys.add(`${playerId}:${category}`)
    const fact: PostgameMeaningFact = {
      kind: 'statistical-record',
      scope: group.scope,
      player: playerIdentity(player, program),
      records: group.records,
    }
    candidates.push(candidateForFact(
      fact, 3, perspectiveProgramId, result.winnerId, [row.programId],
      group.records, playerId,
    ))
  }

  const winnerSeed = postseason.field.find(({ programId }) => programId === result.winnerId)?.seed
  const loserSeed = postseason.field.find(({ programId }) => programId === loserId)?.seed
  if (winnerSeed === undefined || loserSeed === undefined) {
    throw new RangeError('Tournament Postgame Meaning cannot resolve participant seeds.')
  }
  if (winnerSeed > loserSeed) {
    const upsetFact: PostgameMeaningFact = {
      kind: 'tournament-upset',
      winner: programIdentity(winnerProgram),
      loser: programIdentity(loserProgram),
      winnerSeed,
      loserSeed,
    }
    candidates.push(candidateForFact(
      upsetFact, 5, perspectiveProgramId, result.winnerId, [result.winnerId, loserId],
    ))
  }

  const careerCandidates: Candidate[] = []
  for (const { programId, stats } of rows) {
    if (stats.minutes <= 0) continue
    const prior = derivePlayerTournamentCareerHighs(beforeDynasty, stats.playerId)
    if (!prior.hasAppearances) continue
    const records = RECORD_CATEGORIES.flatMap((category): PostgameRecordValue[] => {
      const priorValue = prior.categories[category]?.value
      return priorValue !== undefined &&
        stats[category] > priorValue &&
        stats[category] >= CAREER_HIGH_THRESHOLDS[category] &&
        !recordKeys.has(`${stats.playerId}:${category}`)
        ? [{ category, value: stats[category] }]
        : []
    })
    if (records.length === 0) continue
    const program = requireProgram(programs, programId)
    const player = rosterPlayer(postseason.programStates, programId, stats.playerId)
    const fact: PostgameMeaningFact = {
      kind: 'career-high', competition: 'tournament',
      player: playerIdentity(player, program), records,
    }
    careerCandidates.push(candidateForFact(
      fact, 6, perspectiveProgramId, result.winnerId, [programId], records, stats.playerId,
    ))
  }
  careerCandidates.sort(compareCandidates)
  if (careerCandidates[0]) candidates.push(careerCandidates[0])

  return finalize('tournament', gameId, presentation, candidates)
}

/** Pure, capped consequence projection over canonical completed-game facts. */
export function derivePostgameMeaning(options: DerivePostgameMeaningOptions): PostgameMeaning {
  return options.competition === 'regular-season'
    ? deriveRegularSeasonMeaning(options)
    : deriveTournamentMeaning(options)
}
