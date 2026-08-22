import { describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
  type PostseasonState,
} from '../postseason'
import { UNIVERSE_V0 } from '../universe'
import { completeRounds, createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { deriveCompletedTournamentRecap } from './completedTournamentRecap'

function completedTournament(): PostseasonState {
  const dynasty = createRecruitingDynasty('completed-tournament-recap')
  const season = completeRounds(dynasty.activeSeason!)
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'completed-tournament-recap:postseason',
    })
  }
  return postseason
}

function losingProgramId(postseason: PostseasonState, round: typeof TOURNAMENT_ROUNDS[number]) {
  const game = postseason.bracket.games.find((candidate) => candidate.round === round)!
  const result = postseason.resultsByGameId[game.id]!
  return result.winnerId === result.homeTeamId ? result.awayTeamId : result.homeTeamId
}

describe('deriveCompletedTournamentRecap', () => {
  it('derives the canonical title game, champion-first score, runner-up, and overtime', () => {
    const postseason = completedTournament()
    const final = postseason.bracket.games.find(({ round }) => round === 'championship')!
    const originalResult = postseason.resultsByGameId[final.id]!
    const overtimePostseason = {
      ...postseason,
      resultsByGameId: {
        ...postseason.resultsByGameId,
        [final.id]: { ...originalResult, overtimePeriods: 2 },
      },
    }
    const before = structuredClone(overtimePostseason)
    const recap = deriveCompletedTournamentRecap({
      postseason: overtimePostseason,
      controlledProgramId: originalResult.winnerId,
      programs: UNIVERSE_V0.programs,
    })
    const runnerUpId = originalResult.winnerId === originalResult.homeTeamId
      ? originalResult.awayTeamId
      : originalResult.homeTeamId

    expect(recap).toMatchObject({
      championshipGameId: final.id,
      champion: {
        programId: originalResult.winnerId,
        score: originalResult.winnerId === originalResult.homeTeamId
          ? originalResult.homeScore
          : originalResult.awayScore,
      },
      runnerUp: {
        programId: runnerUpId,
        score: runnerUpId === originalResult.homeTeamId
          ? originalResult.homeScore
          : originalResult.awayScore,
      },
      overtimePeriods: 2,
    })
    expect(overtimePostseason).toEqual(before)
    expect(deriveCompletedTournamentRecap({
      postseason: overtimePostseason,
      controlledProgramId: originalResult.winnerId,
      programs: UNIVERSE_V0.programs,
    })).toEqual(recap)
  })

  it.each([
    ['round-of-16', 'Round of 16'],
    ['quarterfinals', 'Quarterfinals'],
    ['semifinals', 'Semifinals'],
  ] as const)('derives a %s exit', (round, label) => {
    const postseason = completedTournament()
    const recap = deriveCompletedTournamentRecap({
      postseason,
      controlledProgramId: losingProgramId(postseason, round),
      programs: UNIVERSE_V0.programs,
    })
    expect(recap.controlledProgram.finish).toEqual({
      kind: 'eliminated',
      round,
      label,
    })
  })

  it('distinguishes did-not-qualify, runner-up, and National Champion', () => {
    const postseason = completedTournament()
    const final = postseason.bracket.games.find(({ round }) => round === 'championship')!
    const result = postseason.resultsByGameId[final.id]!
    const runnerUpId = result.winnerId === result.homeTeamId
      ? result.awayTeamId
      : result.homeTeamId
    const nonQualifierId = UNIVERSE_V0.programs.find(
      ({ id }) => !postseason.field.some(({ programId }) => programId === id),
    )!.id
    const finishFor = (controlledProgramId: string) =>
      deriveCompletedTournamentRecap({
        postseason,
        controlledProgramId,
        programs: UNIVERSE_V0.programs,
      }).controlledProgram.finish

    expect(finishFor(nonQualifierId)).toEqual({
      kind: 'did-not-qualify',
      label: 'Did Not Qualify',
    })
    expect(finishFor(runnerUpId)).toEqual({ kind: 'runner-up', label: 'Runner-Up' })
    expect(finishFor(result.winnerId)).toEqual({
      kind: 'national-champion',
      label: 'National Champion',
    })
  })
})
