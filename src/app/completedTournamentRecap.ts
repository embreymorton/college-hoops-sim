import {
  TOURNAMENT_ROUNDS,
  getGamesForTournamentRound,
  isTournamentComplete,
  type PostseasonState,
  type TournamentBidType,
  type TournamentRound,
} from '../postseason'
import type { ProgramDefinition } from '../universe'

export type CompletedTournamentFinish =
  | { readonly kind: 'did-not-qualify'; readonly label: 'Did Not Qualify' }
  | {
      readonly kind: 'eliminated'
      readonly label: 'Round of 16' | 'Quarterfinals' | 'Semifinals'
      readonly round: Exclude<TournamentRound, 'championship'>
    }
  | { readonly kind: 'runner-up'; readonly label: 'Runner-Up' }
  | { readonly kind: 'national-champion'; readonly label: 'National Champion' }

export interface CompletedTournamentRecap {
  readonly championshipGameId: string
  readonly champion: {
    readonly programId: string
    readonly name: string
    readonly score: number
  }
  readonly runnerUp: {
    readonly programId: string
    readonly name: string
    readonly score: number
  }
  readonly overtimePeriods: number
  readonly controlledProgram: {
    readonly programId: string
    readonly name: string
    readonly seed: number | null
    readonly bidType: TournamentBidType | null
    readonly finish: CompletedTournamentFinish
  }
}

const ELIMINATION_LABELS: Record<
  Exclude<TournamentRound, 'championship'>,
  'Round of 16' | 'Quarterfinals' | 'Semifinals'
> = {
  'round-of-16': 'Round of 16',
  quarterfinals: 'Quarterfinals',
  semifinals: 'Semifinals',
}

/** Pure completed-Hub projection over canonical Tournament results. */
export function deriveCompletedTournamentRecap({
  postseason,
  controlledProgramId,
  programs,
}: {
  readonly postseason: PostseasonState
  readonly controlledProgramId: string
  readonly programs: readonly ProgramDefinition[]
}): CompletedTournamentRecap {
  if (!isTournamentComplete(postseason)) {
    throw new RangeError('Cannot derive a recap before the Tournament is complete.')
  }

  const championshipGames = getGamesForTournamentRound(postseason, 'championship')
  if (championshipGames.length !== 1) {
    throw new RangeError('Completed Tournament must contain exactly one championship game.')
  }
  const championshipGame = championshipGames[0]!
  const result = postseason.resultsByGameId[championshipGame.id]
  if (!result) {
    throw new RangeError('Completed Tournament is missing its championship result.')
  }

  const programById = new Map(programs.map((program) => [program.id, program] as const))
  const program = (programId: string): ProgramDefinition => {
    const found = programById.get(programId)
    if (!found) throw new RangeError(`Unknown Tournament Program ID "${programId}".`)
    return found
  }

  const championId = result.winnerId
  const runnerUpId = result.homeTeamId === championId
    ? result.awayTeamId
    : result.homeTeamId
  const scoreFor = (programId: string): number =>
    result.homeTeamId === programId ? result.homeScore : result.awayScore
  const controlledEntry = postseason.field.find(
    (entry) => entry.programId === controlledProgramId,
  )

  let finish: CompletedTournamentFinish
  if (!controlledEntry) {
    finish = { kind: 'did-not-qualify', label: 'Did Not Qualify' }
  } else if (controlledProgramId === championId) {
    finish = { kind: 'national-champion', label: 'National Champion' }
  } else if (controlledProgramId === runnerUpId) {
    finish = { kind: 'runner-up', label: 'Runner-Up' }
  } else {
    const loss = TOURNAMENT_ROUNDS.flatMap((round) =>
      getGamesForTournamentRound(postseason, round),
    ).find((game) => {
      const gameResult = postseason.resultsByGameId[game.id]
      return gameResult &&
        (gameResult.homeTeamId === controlledProgramId ||
          gameResult.awayTeamId === controlledProgramId) &&
        gameResult.winnerId !== controlledProgramId
    })
    if (!loss || loss.round === 'championship') {
      throw new RangeError(
        `Tournament qualifier "${controlledProgramId}" has no completed finish.`,
      )
    }
    finish = {
      kind: 'eliminated',
      round: loss.round,
      label: ELIMINATION_LABELS[loss.round],
    }
  }

  return {
    championshipGameId: championshipGame.id,
    champion: {
      programId: championId,
      name: program(championId).name,
      score: scoreFor(championId),
    },
    runnerUp: {
      programId: runnerUpId,
      name: program(runnerUpId).name,
      score: scoreFor(runnerUpId),
    },
    overtimePeriods: result.overtimePeriods,
    controlledProgram: {
      programId: controlledProgramId,
      name: program(controlledProgramId).name,
      seed: controlledEntry?.seed ?? null,
      bidType: controlledEntry?.bidType ?? null,
      finish,
    },
  }
}
