import type {
  CompletedTournamentGame,
  PostseasonState,
  ResolvedTournamentParticipants,
  TournamentGame,
  TournamentParticipantSource,
  TournamentRound,
} from './domain'
import { TOURNAMENT_ROUNDS } from './domain'

function resolveSource(
  postseason: PostseasonState,
  source: TournamentParticipantSource,
): string | undefined {
  if (source.type === 'seed') {
    return postseason.field.find(({ seed }) => seed === source.seed)?.programId
  }
  return postseason.resultsByGameId[source.gameId]?.winnerId
}

function seedFor(postseason: PostseasonState, programId: string): number {
  const entry = postseason.field.find((candidate) => candidate.programId === programId)
  if (!entry) {
    throw new RangeError(`Unknown tournament Program ID "${programId}".`)
  }
  return entry.seed
}

export function getTournamentGame(
  postseason: PostseasonState,
  tournamentGameId: string,
): TournamentGame {
  const game = postseason.bracket.games.find(({ id }) => id === tournamentGameId)
  if (!game) {
    throw new RangeError(`Unknown Tournament game ID "${tournamentGameId}".`)
  }
  return game
}

/** Resolves sources and orients the lower numeric seed as designated home. */
export function resolveTournamentGameParticipants(
  postseason: PostseasonState,
  tournamentGameId: string,
): ResolvedTournamentParticipants | undefined {
  const game = getTournamentGame(postseason, tournamentGameId)
  const first = resolveSource(postseason, game.participantSources[0])
  const second = resolveSource(postseason, game.participantSources[1])
  if (!first || !second) return undefined

  return seedFor(postseason, first) < seedFor(postseason, second)
    ? { homeProgramId: first, awayProgramId: second }
    : { homeProgramId: second, awayProgramId: first }
}

export function getGamesForTournamentRound(
  postseason: PostseasonState,
  round: TournamentRound,
): TournamentGame[] {
  return postseason.bracket.games.filter((game) => game.round === round)
}

export function getCompletedGamesForTournamentRound(
  postseason: PostseasonState,
  round: TournamentRound,
): CompletedTournamentGame[] {
  return getGamesForTournamentRound(postseason, round).flatMap((game) => {
    const result = postseason.resultsByGameId[game.id]
    return result ? [{ game, result }] : []
  })
}

export function getPendingGamesForTournamentRound(
  postseason: PostseasonState,
  round: TournamentRound,
): TournamentGame[] {
  return getGamesForTournamentRound(postseason, round).filter(
    ({ id }) => postseason.resultsByGameId[id] === undefined,
  )
}

export function getReadyGamesForTournamentRound(
  postseason: PostseasonState,
  round: TournamentRound,
): TournamentGame[] {
  return getPendingGamesForTournamentRound(postseason, round).filter(
    ({ id }) => resolveTournamentGameParticipants(postseason, id) !== undefined,
  )
}

export function getCurrentTournamentRound(
  postseason: PostseasonState,
): TournamentRound | undefined {
  return TOURNAMENT_ROUNDS.find(
    (round) => getPendingGamesForTournamentRound(postseason, round).length > 0,
  )
}

export function isTournamentComplete(postseason: PostseasonState): boolean {
  return postseason.bracket.games.every(
    ({ id }) => postseason.resultsByGameId[id] !== undefined,
  )
}

export function deriveNationalChampion(
  postseason: PostseasonState,
): string | undefined {
  const final = postseason.bracket.games.find(
    ({ round }) => round === 'championship',
  )
  return final ? postseason.resultsByGameId[final.id]?.winnerId : undefined
}

/**
 * Finds the TournamentGame a Program occupies at `round`, tracing forward
 * through the fixed bracket's static `winner(gameId)` links from its
 * Round-of-16 seed slot — even before every prior-round winner is resolved,
 * since those links never change. Returns undefined once a recorded result
 * shows the Program lost an earlier game in the chain, or if it was never in
 * the field. This performs no advancement or outcome prediction: it only
 * follows edges already present in `TournamentGame.participantSources`.
 */
export function getTournamentGameForProgram(
  postseason: PostseasonState,
  programId: string,
  round: TournamentRound,
): TournamentGame | undefined {
  const entry = postseason.field.find(
    (candidate) => candidate.programId === programId,
  )
  if (!entry) return undefined

  let currentGame = postseason.bracket.games.find(
    (game) =>
      game.round === 'round-of-16' &&
      game.participantSources.some(
        (source) => source.type === 'seed' && source.seed === entry.seed,
      ),
  )
  if (!currentGame) return undefined

  const targetIndex = TOURNAMENT_ROUNDS.indexOf(round)

  for (let roundIndex = 0; roundIndex < targetIndex; roundIndex += 1) {
    const result = postseason.resultsByGameId[currentGame.id]
    if (result && result.winnerId !== programId) {
      return undefined
    }

    const nextGame: TournamentGame | undefined = postseason.bracket.games.find(
      (game) =>
        game.participantSources.some(
          (source) =>
            source.type === 'winner' && source.gameId === currentGame!.id,
        ),
    )
    if (!nextGame) return undefined
    currentGame = nextGame
  }

  return currentGame
}

export function deriveRemainingProgramIds(postseason: PostseasonState): string[] {
  const eliminated = new Set(
    Object.values(postseason.resultsByGameId).map((result) =>
      result.winnerId === result.homeTeamId
        ? result.awayTeamId
        : result.homeTeamId,
    ),
  )
  return postseason.field
    .filter(({ programId }) => !eliminated.has(programId))
    .sort((first, second) => first.seed - second.seed)
    .map(({ programId }) => programId)
}
