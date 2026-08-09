import { describe, expect, it } from 'vitest'
import { POSITIONS, type Position } from '../../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../../postseason'
import { UNIVERSE_V0 } from '../../universe'
import type { DynastyState } from '../domain'
import {
  autoFinalizeRecruiting,
  deriveLateRecruitResolutionOrder,
  prepareLateRecruiting,
} from './finalization'
import type { PositionCounts, RecruitingState } from './domain'
import {
  deriveProgramCommitments,
  deriveRemainingOpeningsByPosition,
  getRecruit,
} from './queries'
import {
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
} from './simulation'
import { completeRounds, createRecruitingDynasty } from './testSupport'

function readyForLate(seed: string): DynastyState {
  let dynasty = createRecruitingDynasty(seed)
  dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!) }
  dynasty = syncRecruitingThroughCompletedRounds(dynasty)
  let postseason = initializePostseason({
    universe: UNIVERSE_V0,
    season: dynasty.activeSeason!,
  })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${seed}:postseason`,
    })
  }
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
}

function totalProjected(recruiting: RecruitingState): number {
  return Object.values(recruiting.programs).reduce(
    (total, program) => total + Object.values(program.projectedOpeningsByPosition)
      .reduce((sum, count) => sum + count, 0),
    0,
  )
}

function zeroCounts(): Record<Position, number> {
  return Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
}

describe('Late Recruiting and finalization', () => {
  it('creates a reviewable Late phase and preserves controlled valid offers', () => {
    const dynasty = readyForLate('late-prepare')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const protectedOffers = program.board.filter(({ hasActiveOffer }) => hasActiveOffer)
      .map(({ playerId }) => playerId)
    const prepared = prepareLateRecruiting(dynasty)
    expect(prepared.recruiting!.phase).toBe('late')
    expect(prepared.recruiting!.commitmentsByPlayerId).toEqual(
      dynasty.recruiting!.commitmentsByPlayerId,
    )
    for (const playerId of protectedOffers) {
      expect(prepared.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
        (target) => target.playerId === playerId,
      )?.hasActiveOffer).toBe(true)
    }
    expect(prepareLateRecruiting(prepared)).toEqual(prepared)
  })

  it('fills every positional opening, signs premium talent, and preserves identities', () => {
    const ready = readyForLate('late-canonical-finalization')
    const existingCommitments = structuredClone(ready.recruiting!.commitmentsByPlayerId)
    const result = autoFinalizeRecruiting(ready)
    const final = result.dynasty.recruiting!
    expect(final.phase).toBe('finalized')
    expect(Object.keys(final.commitmentsByPlayerId)).toHaveLength(totalProjected(final))
    for (const program of Object.values(final.programs)) {
      expect(Object.values(deriveRemainingOpeningsByPosition(final, program)).every(
        (count) => count === 0,
      )).toBe(true)
    }
    for (const recruit of final.recruits.filter(({ stars }) => stars >= 4)) {
      expect(final.commitmentsByPlayerId[recruit.player.id]).toBeDefined()
    }
    for (const [playerId, commitment] of Object.entries(existingCommitments)) {
      expect(final.commitmentsByPlayerId[playerId]).toEqual(commitment)
    }
    expect(Object.keys(final.commitmentsByPlayerId).every((playerId) =>
      getRecruit(final, playerId)?.player.id === playerId,
    )).toBe(true)
    expect(result.emergencyGeneratedRecruits).toBe(0)
  })

  it('archives one serializable CompletedRecruitingClass and repeated finalization is safe', () => {
    const first = autoFinalizeRecruiting(readyForLate('late-history'))
    expect(first.dynasty.completedRecruitingHistory).toHaveLength(1)
    expect(first.dynasty.completedRecruitingHistory[0]).toEqual({
      targetSeasonNumber: 2,
      recruitingState: first.dynasty.recruiting,
    })
    expect(first.dynasty.completedRecruitingHistory[0]!.recruitingState)
      .not.toBe(first.dynasty.recruiting)
    expect(JSON.parse(JSON.stringify(first.dynasty))).toEqual(first.dynasty)
    expect(autoFinalizeRecruiting(first.dynasty).dynasty).toEqual(first.dynasty)
  })

  it('expands the controlled board nationally only when Auto Finalize needs it', () => {
    const initial = readyForLate('late-controlled-expansion')
    const programId = initial.controlledProgramId
    const position = POSITIONS.find((candidate) =>
      initial.recruiting!.recruits.some(({ player }) => player.position === candidate),
    )!
    const openings = { ...zeroCounts(), [position]: 1 } satisfies PositionCounts
    const national = initial.recruiting!.recruits.find(
      ({ player }) => player.position === position,
    )!
    const recruiting: RecruitingState = {
      ...initial.recruiting!,
      phase: 'postseason',
      recruits: [national],
      programs: {
        [programId]: {
          programId,
          projectedOpeningsByPosition: openings,
          board: [],
        },
      },
      relationshipProgressByPlayerId: {},
      commitmentsByPlayerId: {},
    }
    const prepared = prepareLateRecruiting({ ...initial, recruiting })
    expect(prepared.recruiting!.programs[programId]!.board).toHaveLength(0)
    const final = autoFinalizeRecruiting(prepared).dynasty.recruiting!
    expect(final.programs[programId]!.board.some(
      ({ playerId }) => playerId === national.player.id,
    )).toBe(true)
    expect(final.commitmentsByPlayerId[national.player.id]?.programId).toBe(programId)
    expect(deriveProgramCommitments(final, programId)).toHaveLength(1)
  })

  it('keeps season-long relationship leadership authoritative in the late market', () => {
    const initial = readyForLate('late-relationships')
    const recruit = initial.recruiting!.recruits[0]!
    const fallback = initial.recruiting!.recruits.find(
      ({ player }) =>
        player.position === recruit.player.position && player.id !== recruit.player.id,
    )!
    const [programA, programB] = Object.keys(initial.recruiting!.programs).sort().slice(0, 2)
    const openings = { ...zeroCounts(), [recruit.player.position]: 1 }
    const recruiting: RecruitingState = {
      ...initial.recruiting!,
      phase: 'late',
      recruits: [recruit, fallback],
      programs: {
        [programA!]: { programId: programA!, projectedOpeningsByPosition: openings, board: [{ playerId: recruit.player.id, priority: 5, hasActiveOffer: true }] },
        [programB!]: { programId: programB!, projectedOpeningsByPosition: openings, board: [{ playerId: recruit.player.id, priority: 5, hasActiveOffer: true }] },
      },
      relationshipProgressByPlayerId: {
        [recruit.player.id]: { [programA!]: 200, [programB!]: 0 },
      },
      commitmentsByPlayerId: {},
    }
    const final = autoFinalizeRecruiting({ ...initial, controlledProgramId: programB!, recruiting })
      .dynasty.recruiting!
    expect(final.commitmentsByPlayerId[recruit.player.id]?.programId).toBe(programA)
  })

  it('is independent of Program and Recruit input ordering', () => {
    const ready = readyForLate('late-order-independence')
    const normal = autoFinalizeRecruiting(ready).dynasty.recruiting!
    const reversedRecruiting: RecruitingState = {
      ...ready.recruiting!,
      recruits: [...ready.recruiting!.recruits].reverse(),
      programs: Object.fromEntries(Object.entries(ready.recruiting!.programs).reverse()),
    }
    const reversed = autoFinalizeRecruiting({ ...ready, recruiting: reversedRecruiting })
      .dynasty.recruiting!
    expect(reversed.commitmentsByPlayerId).toEqual(normal.commitmentsByPlayerId)
  })

  it('resolves the late market by National Rank rather than star-specific rules', () => {
    const recruiting = readyForLate('late-rank-order').recruiting!
    const ordered = deriveLateRecruitResolutionOrder(recruiting)
      .map((playerId) => getRecruit(recruiting, playerId)!)
    expect(ordered.every((recruit, index) =>
      index === 0 || ordered[index - 1]!.nationalRank <= recruit.nationalRank,
    )).toBe(true)
    const premium = ordered.find(({ stars }) => stars === 5)!
    const lower = ordered.find(({ stars }) => stars === 2)!
    expect(ordered.indexOf(premium)).toBeLessThan(ordered.indexOf(lower))
  })

  it('lets AI search nationally for premium talent and refill after losing him', () => {
    const initial = readyForLate('late-ai-market')
    const premium = initial.recruiting!.recruits.find(({ stars }) => stars >= 4)!
    const fallback = initial.recruiting!.recruits.find(
      ({ player, stars }) =>
        player.position === premium.player.position && stars <= 3,
    )!
    const [programA, programB] = Object.keys(initial.recruiting!.programs).sort()
      .filter((programId) => programId !== initial.controlledProgramId)
      .slice(0, 2)
    const openings = { ...zeroCounts(), [premium.player.position]: 1 }
    const recruiting: RecruitingState = {
      ...initial.recruiting!,
      phase: 'postseason',
      recruits: [premium, fallback],
      programs: {
        [programA!]: { programId: programA!, projectedOpeningsByPosition: openings, board: [] },
        [programB!]: {
          programId: programB!,
          projectedOpeningsByPosition: openings,
          board: [{ playerId: premium.player.id, priority: 5, hasActiveOffer: true }],
        },
      },
      relationshipProgressByPlayerId: {
        [premium.player.id]: { [programA!]: 0, [programB!]: 200 },
      },
      commitmentsByPlayerId: {},
    }
    const prepared = prepareLateRecruiting({ ...initial, recruiting })
    expect(prepared.recruiting!.programs[programA!]!.board.some(
      ({ playerId, hasActiveOffer }) =>
        playerId === premium.player.id && hasActiveOffer,
    )).toBe(true)
    const final = autoFinalizeRecruiting(prepared).dynasty.recruiting!
    expect(final.commitmentsByPlayerId[premium.player.id]?.programId).toBe(programB)
    expect(final.commitmentsByPlayerId[fallback.player.id]?.programId).toBe(programA)
  })
})
