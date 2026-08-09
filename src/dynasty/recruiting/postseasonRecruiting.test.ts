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
  deriveCommitmentConfidenceThresholds,
  resolvePostseasonRecruitingPeriod,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
} from './simulation'
import {
  deriveBaseRecruitAttraction,
  deriveTargetStatus,
} from './queries'
import type { RecruitingState } from './domain'
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

function decisionFixture(
  seed: string,
  leaderStanding: number,
  runnerUpStanding: number,
  standingThreshold = 100,
  separationThreshold = 12,
): DynastyState {
  let dynasty: DynastyState = enterPostseason(seed)
  for (let index = 0; index < TOURNAMENT_ROUNDS.length; index += 1) {
    dynasty = completeRound(dynasty, index)
  }
  const recruit = {
    ...dynasty.recruiting!.recruits[0]!,
    decisionReadyPeriod: 1,
    commitmentStandingThreshold: standingThreshold,
    commitmentSeparationThreshold: separationThreshold,
  }
  const [leaderId, runnerUpId] = Object.keys(dynasty.recruiting!.programs).sort()
    .slice(0, 2)
  const openings = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0, [recruit.player.position]: 1 }
  const programs = Object.fromEntries([leaderId!, runnerUpId!].map((programId) => [
    programId,
    {
      programId,
      projectedOpeningsByPosition: openings,
      board: [{ playerId: recruit.player.id, priority: 5, hasActiveOffer: true }],
    },
  ]))
  const recruiting: RecruitingState = {
    ...dynasty.recruiting!,
    phase: 'postseason',
    lastResolvedPeriod: 27,
    recruits: [recruit],
    programs,
    relationshipProgressByPlayerId: {
      [recruit.player.id]: {
        [leaderId!]: leaderStanding - 18 - deriveBaseRecruitAttraction(
          dynasty,
          recruit,
          leaderId!,
        ),
        [runnerUpId!]: runnerUpStanding - 18 - deriveBaseRecruitAttraction(
          dynasty,
          recruit,
          runnerUpId!,
        ),
      },
    },
    commitmentsByPlayerId: {},
  }
  return { ...dynasty, controlledProgramId: leaderId!, recruiting }
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

  it('eases only postseason confidence and resolves a clear late leader', () => {
    expect(deriveCommitmentConfidenceThresholds({
      commitmentStandingThreshold: 100,
      commitmentSeparationThreshold: 12,
    }, 24)).toEqual({ standing: 100, separation: 12 })
    expect(deriveCommitmentConfidenceThresholds({
      commitmentStandingThreshold: 100,
      commitmentSeparationThreshold: 12,
    }, 28)).toEqual({ standing: 94, separation: 9 })

    const dynasty = decisionFixture('postseason-clear-lead', 118, 109)
    const recruitId = dynasty.recruiting!.recruits[0]!.player.id
    const resolved = resolvePostseasonRecruitingPeriod(dynasty, 28)
    expect(resolved.recruiting!.commitmentsByPlayerId[recruitId]?.timing)
      .toEqual({ kind: 'period', period: 28 })
  })

  it('keeps close or low-confidence Period 28 battles unresolved', () => {
    const close = decisionFixture('postseason-close-lead', 118, 117)
    const closeId = close.recruiting!.recruits[0]!.player.id
    expect(resolvePostseasonRecruitingPeriod(close, 28)
      .recruiting!.commitmentsByPlayerId[closeId]).toBeUndefined()

    const belowThreshold = decisionFixture(
      'postseason-low-confidence',
      118,
      90,
      200,
      4,
    )
    const belowId = belowThreshold.recruiting!.recruits[0]!.player.id
    expect(resolvePostseasonRecruitingPeriod(belowThreshold, 28)
      .recruiting!.commitmentsByPlayerId[belowId]).toBeUndefined()
  })

  it('applies deterministic threshold easing without a star-tier input', () => {
    const thresholds = {
      commitmentStandingThreshold: 90,
      commitmentSeparationThreshold: 8,
    }
    expect(deriveCommitmentConfidenceThresholds(thresholds, 27)).toEqual(
      deriveCommitmentConfidenceThresholds(thresholds, 27),
    )
    expect(Object.keys(deriveCommitmentConfidenceThresholds(thresholds, 27)))
      .toEqual(['standing', 'separation'])
  })
})
