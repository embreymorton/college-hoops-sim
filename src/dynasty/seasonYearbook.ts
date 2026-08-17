import type { GameResult } from '../engine'
import {
  deriveNationalChampion,
  getTournamentGame,
  isTournamentComplete,
  resolveTournamentGameParticipants,
  type TournamentBidType,
  type TournamentRound,
} from '../postseason'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveNationalPlayerLeaders,
  deriveProgramRecord,
  type NationalLeaderCategory,
  type ProgramRecord,
} from '../season'
import type {
  ConferenceDefinition,
  ProgramDefinition,
  UniverseDefinition,
} from '../universe'
import type { CompletedSeasonArchive, DynastyState } from './domain'

export const YEARBOOK_STATISTICAL_SCOPE = 'regular-season' as const

export interface HistoricalProgramIdentity {
  readonly programId: string
  readonly name: string
  readonly abbreviation: string
  readonly conferenceId: string
}

export interface HistoricalPlayerIdentity {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly program: HistoricalProgramIdentity
}

export type HistoricalTournamentOutcome =
  | { readonly status: 'did-not-qualify' }
  | {
      readonly status: 'eliminated'
      readonly seed: number
      readonly bidType: TournamentBidType
      readonly round: TournamentRound
    }
  | {
      readonly status: 'runner-up'
      readonly seed: number
      readonly bidType: TournamentBidType
    }
  | {
      readonly status: 'national-champion'
      readonly seed: number
      readonly bidType: TournamentBidType
    }

export interface HistoricalTournamentGame {
  readonly gameId: string
  readonly round: TournamentRound
  readonly index: number
  readonly homeProgram: HistoricalProgramIdentity
  readonly awayProgram: HistoricalProgramIdentity
  readonly homeSeed: number
  readonly awaySeed: number
  readonly result: GameResult
}

export interface ControlledTournamentGame extends HistoricalTournamentGame {
  readonly opponent: HistoricalProgramIdentity
  readonly resultForControlledProgram: 'win' | 'loss'
}

export interface CompletedSeasonIndexSummary {
  readonly seasonNumber: number
  readonly nationalChampion: HistoricalProgramIdentity
  readonly controlledProgram: HistoricalProgramIdentity
  readonly controlledProgramRecord: ProgramRecord
  readonly controlledTournamentOutcome: HistoricalTournamentOutcome
}

export interface HistoricalStandingRow {
  readonly place: number
  readonly program: HistoricalProgramIdentity
  readonly wins: number
  readonly losses: number
  readonly conferenceWins: number
  readonly conferenceLosses: number
  readonly winPercentage: number
  readonly conferenceWinPercentage: number
}

export interface HistoricalConferenceStandings {
  readonly conference: ConferenceDefinition
  readonly rows: readonly HistoricalStandingRow[]
}

export interface HistoricalLeaderRow {
  readonly rank: number
  readonly player: HistoricalPlayerIdentity
  readonly value: number
  readonly gamesPlayed: number
}

export type HistoricalLeaderboards = Readonly<
  Record<NationalLeaderCategory, readonly HistoricalLeaderRow[]>
>

export interface CompletedSeasonYearbook {
  readonly seasonNumber: number
  readonly championship: {
    readonly nationalChampion: HistoricalProgramIdentity
    readonly runnerUp: HistoricalProgramIdentity
    readonly game: HistoricalTournamentGame
  }
  readonly controlledProgramSeason: {
    readonly program: HistoricalProgramIdentity
    readonly overallRecord: ProgramRecord
    readonly conferenceRecord: ProgramRecord
    readonly conferencePlace: number
    readonly tournamentOutcome: HistoricalTournamentOutcome
    readonly tournamentGames: readonly ControlledTournamentGame[]
  }
  readonly conferenceStandings: readonly HistoricalConferenceStandings[]
  readonly tournament: {
    readonly games: readonly HistoricalTournamentGame[]
  }
  readonly statisticalLeaders: {
    readonly scope: typeof YEARBOOK_STATISTICAL_SCOPE
    readonly national: HistoricalLeaderboards
    readonly controlledProgram: HistoricalLeaderboards
  }
}

function programMap(universe: UniverseDefinition): ReadonlyMap<string, ProgramDefinition> {
  return new Map(universe.programs.map((program) => [program.id, program]))
}

function programIdentity(
  programs: ReadonlyMap<string, ProgramDefinition>,
  programId: string,
): HistoricalProgramIdentity {
  const program = programs.get(programId)
  if (!program) throw new RangeError(`Unknown historical Program ID "${programId}".`)
  return {
    programId: program.id,
    name: program.name,
    abbreviation: program.abbreviation,
    conferenceId: program.conferenceId,
  }
}

function assertArchive(
  archive: CompletedSeasonArchive,
  universe: UniverseDefinition,
): void {
  if (archive.seasonNumber !== archive.season.seasonNumber) {
    throw new RangeError('Completed Season archive number does not match its Season.')
  }
  if (
    archive.season.universeId !== universe.id ||
    archive.season.universeVersion !== universe.version ||
    archive.postseason.universeId !== universe.id ||
    archive.postseason.universeVersion !== universe.version
  ) {
    throw new RangeError('Completed Season archive does not match the supplied Universe.')
  }
  if (archive.postseason.seasonId !== archive.season.id) {
    throw new RangeError('Archived Tournament does not belong to the archived Season.')
  }
  if (!isTournamentComplete(archive.postseason)) {
    throw new RangeError('Completed Season archive contains an incomplete Tournament.')
  }
}

function tournamentGames(
  archive: CompletedSeasonArchive,
  programs: ReadonlyMap<string, ProgramDefinition>,
): HistoricalTournamentGame[] {
  const seeds = new Map(
    archive.postseason.field.map(({ programId, seed }) => [programId, seed]),
  )
  return archive.postseason.bracket.games
    .slice()
    .sort((first, second) => first.index - second.index)
    .map((game) => {
      const participants = resolveTournamentGameParticipants(archive.postseason, game.id)
      const result = archive.postseason.resultsByGameId[game.id]
      if (!participants || !result) {
        throw new RangeError(`Archived Tournament game "${game.id}" is unresolved.`)
      }
      const homeSeed = seeds.get(participants.homeProgramId)
      const awaySeed = seeds.get(participants.awayProgramId)
      if (homeSeed === undefined || awaySeed === undefined) {
        throw new RangeError(`Archived Tournament game "${game.id}" has an unseeded participant.`)
      }
      return {
        gameId: game.id,
        round: game.round,
        index: game.index,
        homeProgram: programIdentity(programs, participants.homeProgramId),
        awayProgram: programIdentity(programs, participants.awayProgramId),
        homeSeed,
        awaySeed,
        result,
      }
    })
}

/** Canonical completed-Tournament outcome for any Program in one archive. */
export function deriveHistoricalTournamentOutcome(
  archive: CompletedSeasonArchive,
  programId: string,
): HistoricalTournamentOutcome {
  const entry = archive.postseason.field.find((candidate) => candidate.programId === programId)
  if (!entry) return { status: 'did-not-qualify' }

  const championId = deriveNationalChampion(archive.postseason)
  if (!championId) throw new RangeError('Completed Season archive has no National Champion.')
  if (championId === programId) {
    return { status: 'national-champion', seed: entry.seed, bidType: entry.bidType }
  }

  const loss = archive.postseason.bracket.games.find((game) => {
    const participants = resolveTournamentGameParticipants(archive.postseason, game.id)
    const result = archive.postseason.resultsByGameId[game.id]
    return participants && result &&
      (participants.homeProgramId === programId || participants.awayProgramId === programId) &&
      result.winnerId !== programId
  })
  if (!loss) throw new RangeError(`Tournament qualifier "${programId}" has no final outcome.`)
  return loss.round === 'championship'
    ? { status: 'runner-up', seed: entry.seed, bidType: entry.bidType }
    : { status: 'eliminated', seed: entry.seed, bidType: entry.bidType, round: loss.round }
}

function historicalLeaderboards(
  archive: CompletedSeasonArchive,
  programs: ReadonlyMap<string, ProgramDefinition>,
): HistoricalLeaderboards {
  const rosters = new Map(
    Object.entries(archive.season.programStates).flatMap(([programId, state]) =>
      state.team.roster.map((player) => [player.id, { player, programId }] as const),
    ),
  )
  const leaders = deriveNationalPlayerLeaders(archive.season)
  return Object.fromEntries(
    Object.entries(leaders).map(([category, rows]) => [category, rows.map((row) => {
      const match = rosters.get(row.playerId)
      if (!match) throw new RangeError(`Unresolved historical Player ID "${row.playerId}".`)
      return {
        rank: row.rank,
        player: {
          playerId: match.player.id,
          firstName: match.player.firstName,
          lastName: match.player.lastName,
          program: programIdentity(programs, match.programId),
        },
        value: row.value,
        gamesPlayed: row.gamesPlayed,
      }
    })]),
  ) as unknown as HistoricalLeaderboards
}

function controlledLeaderboards(
  archive: CompletedSeasonArchive,
  programs: ReadonlyMap<string, ProgramDefinition>,
  controlledProgramId: string,
): HistoricalLeaderboards {
  const allQualified = deriveNationalPlayerLeaders(archive.season, Number.MAX_SAFE_INTEGER)
  const roster = new Map(
    archive.season.programStates[controlledProgramId]!.team.roster.map((player) => [player.id, player]),
  )
  return Object.fromEntries(
    Object.entries(allQualified).map(([category, rows]) => {
      const row = rows.find((candidate) => candidate.programId === controlledProgramId)
      if (!row) return [category, []]
      const player = roster.get(row.playerId)
      if (!player) throw new RangeError(`Unresolved historical Player ID "${row.playerId}".`)
      return [category, [{
        rank: 1,
        player: {
          playerId: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
          program: programIdentity(programs, controlledProgramId),
        },
        value: row.value,
        gamesPlayed: row.gamesPlayed,
      }]]
    }),
  ) as unknown as HistoricalLeaderboards
}

export function deriveCompletedSeasonIndex(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'controlledProgramId'>,
): CompletedSeasonIndexSummary[] {
  const seen = new Set<number>()
  const programs = programMap(dynasty.universe)
  programIdentity(programs, dynasty.controlledProgramId)
  return [...dynasty.history]
    .map((archive) => {
      if (seen.has(archive.seasonNumber)) {
        throw new RangeError(`Dynasty contains duplicate Season ${archive.seasonNumber} archives.`)
      }
      seen.add(archive.seasonNumber)
      assertArchive(archive, dynasty.universe)
      const championId = deriveNationalChampion(archive.postseason)
      if (!championId) throw new RangeError('Completed Season archive has no National Champion.')
      return {
        seasonNumber: archive.seasonNumber,
        nationalChampion: programIdentity(programs, championId),
        controlledProgram: programIdentity(programs, dynasty.controlledProgramId),
        controlledProgramRecord: deriveProgramRecord(archive.season, dynasty.controlledProgramId),
        controlledTournamentOutcome: deriveHistoricalTournamentOutcome(archive, dynasty.controlledProgramId),
      }
    })
    .sort((first, second) => second.seasonNumber - first.seasonNumber)
}

export function deriveCompletedSeasonYearbook(
  dynasty: Pick<DynastyState, 'history' | 'universe' | 'controlledProgramId'>,
  seasonNumber: number,
): CompletedSeasonYearbook {
  const matches = dynasty.history.filter((archive) => archive.seasonNumber === seasonNumber)
  if (matches.length !== 1) {
    throw new RangeError(
      matches.length === 0
        ? `No completed Season ${seasonNumber} archive exists.`
        : `Dynasty contains duplicate Season ${seasonNumber} archives.`,
    )
  }
  const archive = matches[0]!
  assertArchive(archive, dynasty.universe)
  const programs = programMap(dynasty.universe)
  const controlledProgram = programIdentity(programs, dynasty.controlledProgramId)
  if (!archive.season.programStates[dynasty.controlledProgramId]) {
    throw new RangeError(`Archived Season is missing controlled Program "${dynasty.controlledProgramId}".`)
  }
  const games = tournamentGames(archive, programs)
  const championshipGameDefinition = archive.postseason.bracket.games.find(
    ({ round }) => round === 'championship',
  )
  if (!championshipGameDefinition) throw new RangeError('Archived Tournament has no championship game.')
  getTournamentGame(archive.postseason, championshipGameDefinition.id)
  const championshipGame = games.find(({ gameId }) => gameId === championshipGameDefinition.id)!
  const championId = championshipGame.result.winnerId
  const runnerUp = championshipGame.homeProgram.programId === championId
    ? championshipGame.awayProgram
    : championshipGame.homeProgram
  const conference = dynasty.universe.conferences.find(
    ({ id }) => id === controlledProgram.conferenceId,
  )
  if (!conference) throw new RangeError(`Unknown historical Conference ID "${controlledProgram.conferenceId}".`)
  const controlledStandings = deriveConferenceStandings(
    dynasty.universe,
    archive.season,
    conference.id,
  )
  const conferencePlace = controlledStandings.findIndex(
    ({ programId }) => programId === dynasty.controlledProgramId,
  ) + 1
  if (conferencePlace === 0) throw new RangeError('Controlled Program is missing from conference standings.')
  const national = historicalLeaderboards(archive, programs)

  return {
    seasonNumber,
    championship: {
      nationalChampion: programIdentity(programs, championId),
      runnerUp,
      game: championshipGame,
    },
    controlledProgramSeason: {
      program: controlledProgram,
      overallRecord: deriveProgramRecord(archive.season, dynasty.controlledProgramId),
      conferenceRecord: deriveConferenceRecord(archive.season, dynasty.controlledProgramId),
      conferencePlace,
      tournamentOutcome: deriveHistoricalTournamentOutcome(archive, dynasty.controlledProgramId),
      tournamentGames: games.filter((game) => {
        const isHome = game.homeProgram.programId === dynasty.controlledProgramId
        const isAway = game.awayProgram.programId === dynasty.controlledProgramId
        return isHome || isAway
      }).map((game) => {
        const isHome = game.homeProgram.programId === dynasty.controlledProgramId
        return {
          ...game,
          opponent: isHome ? game.awayProgram : game.homeProgram,
          resultForControlledProgram: game.result.winnerId === dynasty.controlledProgramId
            ? 'win' as const
            : 'loss' as const,
        }
      }),
    },
    conferenceStandings: dynasty.universe.conferences.map((conferenceDefinition) => ({
      conference: conferenceDefinition,
      rows: deriveConferenceStandings(
        dynasty.universe,
        archive.season,
        conferenceDefinition.id,
      ).map((row, index) => ({
        place: index + 1,
        program: programIdentity(programs, row.programId),
        ...row,
      })),
    })),
    tournament: { games },
    statisticalLeaders: {
      scope: YEARBOOK_STATISTICAL_SCOPE,
      national,
      controlledProgram: controlledLeaderboards(
        archive,
        programs,
        dynasty.controlledProgramId,
      ),
    },
  }
}
