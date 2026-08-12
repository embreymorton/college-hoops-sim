import { describe, expect, it } from 'vitest'
import type { DynastyState } from '../domain'
import type { RecruitingCommitment } from './domain'
import {
  deriveRecruitingBattleView,
  deriveRecruitingCommitmentActivity,
} from './battleView'
import { deriveBaseRecruitAttraction, deriveTargetStatus } from './queries'
import { createRecruitingDynasty } from './testSupport'

function battleFixture(seed = 'battle-view'): {
  dynasty: DynastyState
  playerId: string
  programIds: readonly [string, string, string]
} {
  const initial = createRecruitingDynasty(seed)
  const recruiting = initial.recruiting!
  const controlledId = initial.controlledProgramId
  const controlledTarget = recruiting.programs[controlledId]!.board[0]!
  const playerId = controlledTarget.playerId
  const otherIds = Object.keys(recruiting.programs)
    .sort()
    .filter(
      (programId) =>
        programId !== controlledId &&
        deriveTargetStatus(recruiting, programId, playerId) === 'active',
    )
    .slice(0, 2)
  const programIds = [controlledId, otherIds[0]!, otherIds[1]!] as const
  const programs = { ...recruiting.programs }

  for (const programId of programIds) {
    const program = programs[programId]!
    programs[programId] = {
      ...program,
      board: [
        {
          playerId,
          isFocused: programId === controlledId,
          hasActiveOffer: true,
        },
      ],
    }
  }

  return {
    dynasty: {
      ...initial,
      recruiting: { ...recruiting, programs },
    },
    playerId,
    programIds,
  }
}

function withDecisionState(
  dynasty: DynastyState,
  playerId: string,
  programStandings: Readonly<Record<string, number>>,
  options: {
    readonly period?: number
    readonly readyPeriod?: number
    readonly standingThreshold?: number
    readonly separationThreshold?: number
  } = {},
): DynastyState {
  const recruiting = dynasty.recruiting!
  const recruit = recruiting.recruits.find(
    ({ player }) => player.id === playerId,
  )!
  const nextRecruit = {
    ...recruit,
    decisionReadyPeriod: options.readyPeriod ?? 1,
    commitmentStandingThreshold: options.standingThreshold ?? 100,
    commitmentSeparationThreshold: options.separationThreshold ?? 5,
  }
  const context = {
    ...dynasty,
    recruiting: {
      ...recruiting,
      lastResolvedPeriod: options.period ?? 1,
      recruits: recruiting.recruits.map((candidate) =>
        candidate.player.id === playerId ? nextRecruit : candidate,
      ),
    },
  }
  return {
    ...context,
    recruiting: {
      ...context.recruiting!,
      relationshipProgressByPlayerId: {
        ...context.recruiting!.relationshipProgressByPlayerId,
        [playerId]: Object.fromEntries(
          Object.entries(programStandings).map(([programId, standing]) => [
            programId,
            standing - deriveBaseRecruitAttraction(context, nextRecruit, programId),
          ]),
        ),
      },
    },
  }
}

function withCommitment(
  dynasty: DynastyState,
  commitment: RecruitingCommitment,
): DynastyState {
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      commitmentsByPlayerId: {
        ...dynasty.recruiting!.commitmentsByPlayerId,
        [commitment.playerId]: commitment,
      },
    },
  }
}

describe('player-facing Recruiting battle projection', () => {
  it('projects a Recruit well before eligibility as not deciding', () => {
    const { dynasty, playerId } = battleFixture('battle-early')
    const configured = withDecisionState(
      dynasty,
      playerId,
      { [dynasty.controlledProgramId]: 120 },
      { period: 1, readyPeriod: 3, standingThreshold: 100 },
    )
    expect(deriveRecruitingBattleView(configured, playerId).readiness).toBe(
      'not-deciding',
    )
  })

  it('uses Decision Soon only one period before eligibility when current battle facts satisfy the next-window gates', () => {
    const { dynasty, playerId, programIds } = battleFixture('battle-soon')
    const weak = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 99, [programIds[1]]: 90 },
      { period: 1, readyPeriod: 2, standingThreshold: 100, separationThreshold: 5 },
    )
    expect(deriveRecruitingBattleView(weak, playerId).readiness).toBe(
      'not-deciding',
    )

    const closeRace = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 100, [programIds[1]]: 96 },
      { period: 1, readyPeriod: 2, standingThreshold: 100, separationThreshold: 5 },
    )
    expect(deriveRecruitingBattleView(closeRace, playerId).readiness).toBe(
      'not-deciding',
    )

    const soon = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 100, [programIds[1]]: 95 },
      { period: 1, readyPeriod: 2, standingThreshold: 100, separationThreshold: 5 },
    )
    const view = deriveRecruitingBattleView(soon, playerId)
    expect(view.readiness).toBe('decision-soon')
    expect(view).not.toHaveProperty('decisionReadyPeriod')
    expect(view).not.toHaveProperty('commitmentStandingThreshold')
    expect(view).not.toHaveProperty('commitmentSeparationThreshold')
  })

  it('uses the real standing and separation gates for readiness boundaries', () => {
    const { dynasty, playerId, programIds } = battleFixture('battle-readiness')
    const developing = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 99, [programIds[1]]: 90 },
    )
    expect(deriveRecruitingBattleView(developing, playerId).readiness).toBe(
      'developing',
    )

    const serious = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 100, [programIds[1]]: 96 },
    )
    expect(deriveRecruitingBattleView(serious, playerId).readiness).toBe(
      'serious',
    )

    const imminent = withDecisionState(
      dynasty,
      playerId,
      { [programIds[0]]: 100, [programIds[1]]: 95 },
    )
    expect(deriveRecruitingBattleView(imminent, playerId).readiness).toBe(
      'decision-imminent',
    )
  })

  it('projects Focus, Offer, deterministic competitors, and categorical standing', () => {
    const { dynasty, playerId, programIds } = battleFixture('battle-pursuit')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 98,
      [programIds[2]]: 80,
    })
    const view = deriveRecruitingBattleView(configured, playerId)

    expect(view.controlled).toMatchObject({
      isOnBoard: true,
      isFocused: true,
      hasActiveOffer: true,
      targetStatus: 'active',
      position: 'leading',
    })
    expect(view.pursuingPrograms.slice(0, 3)).toEqual([
      {
        programId: programIds[0],
        pursuitRank: 1,
        hasActiveOffer: true,
        position: 'leading',
      },
      {
        programId: programIds[1],
        pursuitRank: 2,
        hasActiveOffer: true,
        position: 'competitive',
      },
      {
        programId: programIds[2],
        pursuitRank: 3,
        hasActiveOffer: true,
        position: 'trailing',
      },
    ])
  })

  it('does not invent competitors and does not depend on Recruit name matching', () => {
    const { dynasty, playerId } = battleFixture('battle-identity')
    const renamed = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        recruits: dynasty.recruiting!.recruits.map((recruit) =>
          recruit.player.id === playerId
            ? {
                ...recruit,
                player: {
                  ...recruit.player,
                  firstName: 'Same',
                  lastName: 'Name',
                },
              }
            : recruit,
        ),
      },
    }
    const view = deriveRecruitingBattleView(renamed, playerId)
    const canonicalPursuers = Object.values(renamed.recruiting!.programs)
      .filter((program) =>
        program.board.some((target) => target.playerId === playerId),
      )
      .map(({ programId }) => programId)
      .sort()
    expect(view.playerId).toBe(playerId)
    expect(view.pursuingPrograms.map(({ programId }) => programId).sort()).toEqual(
      canonicalPursuers,
    )
  })

  it('represents commitments to the controlled Program and elsewhere clearly', () => {
    const { dynasty, playerId, programIds } = battleFixture('battle-commitment')
    const baseCommitment = {
      playerId,
      timing: { kind: 'period' as const, period: 4 },
      targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
    }
    const ours = deriveRecruitingBattleView(
      withCommitment(dynasty, {
        ...baseCommitment,
        programId: programIds[0],
      }),
      playerId,
    )
    expect(ours.readiness).toBe('committed')
    expect(ours.controlled.position).toBe('committed-to-us')
    expect(ours.commitment?.programId).toBe(programIds[0])

    const theirs = deriveRecruitingBattleView(
      withCommitment(dynasty, {
        ...baseCommitment,
        programId: programIds[1],
      }),
      playerId,
    )
    expect(theirs.controlled.position).toBe('committed-elsewhere')
    expect(theirs.controlled.targetStatus).toBe('committed-elsewhere')
  })

  it('derives only provable recent commitment activity in stable ID order', () => {
    const { dynasty, playerId, programIds } = battleFixture('battle-activity')
    const secondTrackedId = dynasty.recruiting!.programs[programIds[0]]!.board[1]
      ?.playerId
    const unrelated = dynasty.recruiting!.recruits.find(
      ({ player }) =>
        player.id !== playerId && player.id !== secondTrackedId,
    )!.player.id
    const commitments = {
      [playerId]: {
        playerId,
        programId: programIds[1],
        timing: { kind: 'period' as const, period: 6 },
        targetSeasonNumber: 2,
      },
      [unrelated]: {
        playerId: unrelated,
        programId: programIds[2],
        timing: { kind: 'period' as const, period: 6 },
        targetSeasonNumber: 2,
      },
    }
    const state = {
      ...dynasty,
      recruiting: { ...dynasty.recruiting!, commitmentsByPlayerId: commitments },
    }

    expect(deriveRecruitingCommitmentActivity(state, 5)).toEqual([
      {
        kind: 'tracked-committed-elsewhere',
        playerId,
        programId: programIds[1],
        timing: { kind: 'period', period: 6 },
        wasFocused: true,
      },
    ])
    expect(deriveRecruitingCommitmentActivity(state, 6)).toEqual([])

    const ours = withCommitment(dynasty, {
      playerId,
      programId: programIds[0],
      timing: { kind: 'period', period: 7 },
      targetSeasonNumber: 2,
    })
    expect(deriveRecruitingCommitmentActivity(ours, 6)[0]).toMatchObject({
      kind: 'committed-to-controlled',
      playerId,
      programId: programIds[0],
    })
  })

  it('is deterministic for the same seed and stable IDs', () => {
    const first = battleFixture('battle-replay')
    const second = battleFixture('battle-replay')
    expect(
      deriveRecruitingBattleView(first.dynasty, first.playerId),
    ).toEqual(deriveRecruitingBattleView(second.dynasty, second.playerId))
  })
})
