import { describe, expect, it } from 'vitest'
import {
  getGamesForTournamentRound,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../../postseason'
import { UNIVERSE_V0 } from '../../universe'
import type { DynastyState } from '../domain'
import {
  resolvePostseasonRecruitingPeriod,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
} from './simulation'
import { deriveTargetStatus } from './queries'
import { completeRounds, createRecruitingDynasty } from './testSupport'

function enterPostseason(seed: string) {
  let dynasty = createRecruitingDynasty(seed)
  dynasty = {
    ...dynasty,
    activeSeason: completeRounds(dynasty.activeSeason!),
  }
  dynasty = syncRecruitingThroughCompletedRounds(dynasty)
  return {
    ...dynasty,
    activePostseason: initializePostseason({
      universe: UNIVERSE_V0,
      season: dynasty.activeSeason!,
    }),
  }
}

function completeRound(dynasty: DynastyState, index: number): DynastyState {
  return {
    ...dynasty,
    activePostseason: simulatePendingGamesInTournamentRound({
      postseason: dynasty.activePostseason!,
      round: TOURNAMENT_ROUNDS[index]!,
      simulationSeed: 'postseason-recruiting-games',
    }),
  }
}

describe('postseason Recruiting synchronization', () => {
  it('uses four globally completed Tournament rounds as Periods 25–28', () => {
    let dynasty: DynastyState = enterPostseason('postseason-clock')
    const omitted = Object.keys(dynasty.recruiting!.programs).sort().flatMap(
      (programId) => dynasty.activePostseason!.field.some((entry) => entry.programId === programId)
        ? []
        : dynasty.recruiting!.programs[programId]!.board
          .filter(({ playerId }) =>
            deriveTargetStatus(dynasty.recruiting!, programId, playerId) === 'active',
          )
          .map((target) => ({ programId, target })),
    )[0]!
    const omittedProgram = omitted.programId
    const target = omitted.target
    const before = dynasty.recruiting!.relationshipProgressByPlayerId[target.playerId]?.[omittedProgram] ?? 0

    expect(() => resolvePostseasonRecruitingPeriod(dynasty, 25)).toThrow(/round-of-16/)
    for (let index = 0; index < TOURNAMENT_ROUNDS.length; index += 1) {
      dynasty = completeRound(dynasty, index)
      dynasty = syncRecruitingThroughCompletedPostseasonRounds(dynasty)
      expect(dynasty.recruiting!.lastResolvedPeriod).toBe(25 + index)
    }
    expect(dynasty.recruiting!.phase).toBe('postseason')
    expect(
      dynasty.recruiting!.relationshipProgressByPlayerId[target.playerId]?.[omittedProgram] ?? 0,
    ).toBeGreaterThanOrEqual(before)
  })

  it('is identical sequentially and batched, including boards and offers', () => {
    const initial = enterPostseason('postseason-batch-equivalence')
    let sequential: DynastyState = initial
    for (let index = 0; index < TOURNAMENT_ROUNDS.length; index += 1) {
      sequential = completeRound(sequential, index)
      sequential = syncRecruitingThroughCompletedPostseasonRounds(sequential)
    }
    let complete = initial.activePostseason!
    for (const round of TOURNAMENT_ROUNDS) {
      complete = simulatePendingGamesInTournamentRound({
        postseason: complete,
        round,
        simulationSeed: 'postseason-recruiting-games',
      })
    }
    const batched = syncRecruitingThroughCompletedPostseasonRounds({
      ...initial,
      activePostseason: complete,
    })
    expect(batched.recruiting).toEqual(sequential.recruiting)
    expect(syncRecruitingThroughCompletedPostseasonRounds(batched)).toEqual(batched)
    for (const round of TOURNAMENT_ROUNDS) {
      expect(getGamesForTournamentRound(complete, round).every(
        ({ id }) => complete.resultsByGameId[id],
      )).toBe(true)
    }
  })
})
