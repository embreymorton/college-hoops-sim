import { describe, expect, it } from 'vitest'
import { POSITIONS, type Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  cleanupInvalidRecruitingOffers,
  manageProgramRecruitingOffers,
  offerRecruit,
  withdrawRecruitOffer,
} from './boards'
import type {
  PositionCounts,
  RecruitingBoardTarget,
  RecruitingProgramState,
} from './domain'
import {
  deriveActiveOfferCountsByPosition,
  deriveAvailableOfferSlotsByPosition,
  deriveBaseRecruitAttraction,
  deriveRemainingOpeningsByPosition,
} from './queries'
import {
  resolveRecruitingPeriod,
  syncRecruitingThroughCompletedRounds,
} from './simulation'
import { completeRounds, createRecruitingDynasty } from './testSupport'

function zeroCounts(): Record<Position, number> {
  return Object.fromEntries(POSITIONS.map((position) => [position, 0])) as Record<Position, number>
}

function setControlledBoard(
  dynasty: ReturnType<typeof createRecruitingDynasty>,
  board: readonly RecruitingBoardTarget[],
  openings: PositionCounts,
) {
  const programId = dynasty.controlledProgramId
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      programs: {
        ...dynasty.recruiting!.programs,
        [programId]: {
          ...dynasty.recruiting!.programs[programId]!,
          projectedOpeningsByPosition: openings,
          board,
        },
      },
    },
  }
}

describe('active recruiting offers', () => {
  it('initializes deterministic, serializable offers within positional capacity', () => {
    const dynasty = createRecruitingDynasty('default-offers')
    const repeat = createRecruitingDynasty('default-offers')
    expect(repeat.recruiting).toEqual(dynasty.recruiting)
    expect(JSON.parse(JSON.stringify(dynasty.recruiting))).toEqual(dynasty.recruiting)
    for (const program of Object.values(dynasty.recruiting!.programs)) {
      const offers = deriveActiveOfferCountsByPosition(dynasty.recruiting!, program)
      for (const position of POSITIONS) {
        expect(offers[position]).toBeLessThanOrEqual(program.projectedOpeningsByPosition[position])
        if (program.projectedOpeningsByPosition[position] > 0) {
          expect(offers[position]).toBe(program.projectedOpeningsByPosition[position])
        }
      }
    }
  })

  it('offers and withdraws only eligible controlled-board targets without changing focus', () => {
    let dynasty = createRecruitingDynasty('manual-offers')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const offered = program.board.find(({ hasActiveOffer }) => hasActiveOffer)!
    const backup = program.board.find((target) => {
      if (target.hasActiveOffer) return false
      const recruit = dynasty.recruiting!.recruits.find(({ player }) => player.id === target.playerId)!
      return deriveAvailableOfferSlotsByPosition(
        dynasty.recruiting!,
        program,
      )[recruit.player.position] === 0
    })!
    const wasFocused = offered.isFocused
    dynasty = withdrawRecruitOffer({ dynasty, playerId: offered.playerId })
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === offered.playerId)).toMatchObject({
        isFocused: wasFocused,
        hasActiveOffer: false,
      })
    dynasty = offerRecruit({ dynasty, playerId: backup.playerId })
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === backup.playerId)?.hasActiveOffer).toBe(true)
    expect(() => offerRecruit({ dynasty, playerId: backup.playerId })).toThrow(/already/)
  })

  it('rejects non-board, committed, and over-capacity offers', () => {
    let dynasty = createRecruitingDynasty('offer-validation')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const outside = dynasty.recruiting!.recruits.find(({ player }) =>
      !program.board.some(({ playerId }) => playerId === player.id),
    )!
    expect(() => offerRecruit({ dynasty, playerId: outside.player.id })).toThrow(/board/)

    const backup = program.board.find(({ hasActiveOffer }) => !hasActiveOffer)!
    expect(() => offerRecruit({ dynasty, playerId: backup.playerId })).toThrow(/capacity/)
    dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          [backup.playerId]: {
            playerId: backup.playerId,
            programId: 'northbridge',
            timing: { kind: 'period', period: 1 },
            targetSeasonNumber: 2,
          },
        },
      },
    }
    expect(() => offerRecruit({ dynasty, playerId: backup.playerId })).toThrow(/committed/)
  })

  it('preserves backup progress through an offer switch', () => {
    let dynasty = createRecruitingDynasty('offer-progress')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const offered = program.board.find(({ hasActiveOffer }) => hasActiveOffer)!
    const offeredRecruit = dynasty.recruiting!.recruits.find(({ player }) => player.id === offered.playerId)!
    const backup = program.board.find((target) => {
      const recruit = dynasty.recruiting!.recruits.find(({ player }) => player.id === target.playerId)!
      return !target.hasActiveOffer && recruit.player.position === offeredRecruit.player.position
    })!
    const progress = dynasty.recruiting!.relationshipProgressByPlayerId[backup.playerId]?.[dynasty.controlledProgramId] ?? 0
    expect(progress).toBeGreaterThan(0)
    dynasty = withdrawRecruitOffer({ dynasty, playerId: offered.playerId })
    dynasty = offerRecruit({ dynasty, playerId: backup.playerId })
    expect(dynasty.recruiting!.relationshipProgressByPlayerId[backup.playerId]![dynasty.controlledProgramId]).toBe(progress)
  })

  it('blocks an early backup, then permits it after the protected offer switches', () => {
    let dynasty = createRecruitingDynasty('protected-slot')
    const programId = dynasty.controlledProgramId
    const byPosition = POSITIONS.map((position) => ({
      position,
      premium: dynasty.recruiting!.recruits.find(
        (recruit) => recruit.player.position === position && recruit.stars >= 4,
      ),
      backup: [...dynasty.recruiting!.recruits].reverse().find(
        (recruit) => recruit.player.position === position && recruit.stars === 2,
      ),
    }))
    const pair = byPosition.find(({ premium, backup }) => premium && backup)!
    const premium = { ...pair.premium!, decisionReadyPeriod: 24 }
    const backup = {
      ...pair.backup!,
      decisionReadyPeriod: 1,
      commitmentStandingThreshold: 0,
      commitmentSeparationThreshold: 0,
    }
    const openings = zeroCounts()
    openings[pair.position] = 1
    const otherProgramId = Object.keys(dynasty.recruiting!.programs).sort()
      .find((id) => id !== programId)!
    const otherProgram: RecruitingProgramState = {
      programId: otherProgramId,
      projectedOpeningsByPosition: zeroCounts(),
      board: [],
    }
    dynasty = setControlledBoard(dynasty, [
      { playerId: premium.player.id, isFocused: true, hasActiveOffer: true },
      { playerId: backup.player.id, isFocused: true, hasActiveOffer: false },
    ], openings)
    dynasty = {
      ...dynasty,
      activeSeason: completeRounds(dynasty.activeSeason!, 2),
      recruiting: {
        ...dynasty.recruiting!,
        recruits: dynasty.recruiting!.recruits.map((recruit) =>
          recruit.player.id === premium.player.id ? premium :
            recruit.player.id === backup.player.id ? backup : recruit,
        ),
        programs: {
          [programId]: dynasty.recruiting!.programs[programId]!,
          [otherProgramId]: otherProgram,
        },
        relationshipProgressByPlayerId: {
          [backup.player.id]: { [programId]: 100 },
        },
      },
    }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    expect(dynasty.recruiting!.commitmentsByPlayerId[backup.player.id]).toBeUndefined()
    expect(dynasty.recruiting!.relationshipProgressByPlayerId[backup.player.id]![programId]).toBeGreaterThan(100)

    dynasty = withdrawRecruitOffer({ dynasty, playerId: premium.player.id })
    dynasty = offerRecruit({ dynasty, playerId: backup.player.id })
    dynasty = resolveRecruitingPeriod(dynasty, 2)
    expect(dynasty.recruiting!.commitmentsByPlayerId[backup.player.id]?.programId).toBe(programId)
    expect(deriveRemainingOpeningsByPosition(
      dynasty.recruiting!,
      dynasty.recruiting!.programs[programId]!,
    )[pair.position]).toBe(0)
    expect(dynasty.recruiting!.programs[programId]!.board.every(
      ({ hasActiveOffer }) => !hasActiveOffer,
    )).toBe(true)
  })

  it('cleans invalid controlled offers while AI deterministically replaces lost offers', () => {
    let dynasty = createRecruitingDynasty('offer-cleanup')
    const controlled = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const controlledOffer = controlled.board.find(({ hasActiveOffer }) => hasActiveOffer)!
    const cleaned = cleanupInvalidRecruitingOffers({
      ...dynasty.recruiting!,
      commitmentsByPlayerId: {
        [controlledOffer.playerId]: {
          playerId: controlledOffer.playerId,
          programId: 'northbridge',
          timing: { kind: 'period', period: 1 },
          targetSeasonNumber: 2,
        },
      },
    })
    expect(cleaned.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === controlledOffer.playerId)?.hasActiveOffer).toBe(false)

    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    const before = dynasty.recruiting!.programs['northbridge']!
    const lost = before.board.find(({ hasActiveOffer }) => hasActiveOffer)!
    dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          [lost.playerId]: {
            playerId: lost.playerId,
            programId: dynasty.controlledProgramId,
            timing: { kind: 'period', period: 0 },
            targetSeasonNumber: 2,
          },
        },
      },
    }
    const advanced = resolveRecruitingPeriod(dynasty, 1)
    expect(advanced.recruiting!.programs['northbridge']!.board
      .find(({ playerId }) => playerId === lost.playerId)).toBeUndefined()
    expect(Object.values(deriveActiveOfferCountsByPosition(
      advanced.recruiting!,
      advanced.recruiting!.programs['northbridge']!,
    )).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(0)
  })

  it('selects offer targets deterministically from quality and attainability', () => {
    const dynasty = createRecruitingDynasty('offer-utility')
    const recruits = dynasty.recruiting!.recruits
    const position = POSITIONS.find((candidatePosition) =>
      [5, 3, 2].every((stars) => recruits.some(
        (recruit) => recruit.player.position === candidatePosition && recruit.stars === stars,
      )),
    )!
    const targets = ([5, 3, 2] as const).map((stars) => ({
      playerId: recruits.find(
        (recruit) => recruit.player.position === position && recruit.stars === stars,
      )!.player.id,
      isFocused: false,
      hasActiveOffer: false,
    }))
    const openings = zeroCounts()
    openings[position] = 1
    const select = (programId: string, investedPlayerId?: string) => {
      const recruiting = {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [programId]: { programId, projectedOpeningsByPosition: openings, board: targets },
        },
        relationshipProgressByPlayerId: investedPlayerId
          ? { [investedPlayerId]: { [programId]: 30 } }
          : {},
      }
      return manageProgramRecruitingOffers(
        { ...dynasty, recruiting },
        recruiting,
        programId,
      ).board.find(({ hasActiveOffer }) => hasActiveOffer)!.playerId
    }
    const highProgramId = Object.values(dynasty.activeSeason!.programStates)
      .sort((first, second) => second.team.prestige - first.team.prestige)[0]!.team.id
    const lowProgramId = Object.values(dynasty.activeSeason!.programStates)
      .sort((first, second) => first.team.prestige - second.team.prestige)[0]!.team.id
    expect(select(highProgramId)).toBe(select(highProgramId))
    const selected = recruits.find(({ player }) => player.id === select(highProgramId))!
    expect(selected.stars).toBeGreaterThanOrEqual(4)
    const realisticId = targets[1]!.playerId
    expect(select(lowProgramId, realisticId)).toBe(realisticId)
  })

  it('promotes the user-focused backup identically in manual and batched advancement', () => {
    const initial = createRecruitingDynasty('controlled-fallback-equivalence')
    const programId = initial.controlledProgramId
    const position = POSITIONS.find((candidate) =>
      initial.recruiting!.recruits.filter(({ player }) => player.position === candidate).length >= 3,
    )!
    const recruits = initial.recruiting!.recruits
      .filter(({ player }) => player.position === position)
      .slice(0, 3)
      .map((recruit) => ({ ...recruit, decisionReadyPeriod: 24 }))
    const openings = zeroCounts()
    openings[position] = 1
    const otherProgramId = Object.keys(initial.recruiting!.programs).sort()
      .find((id) => id !== programId)!
    const board: RecruitingBoardTarget[] = [
      { playerId: recruits[0]!.player.id, isFocused: true, hasActiveOffer: true },
      { playerId: recruits[1]!.player.id, isFocused: true, hasActiveOffer: false },
      { playerId: recruits[2]!.player.id, isFocused: false, hasActiveOffer: false },
    ]
    const prepared: DynastyState = {
      ...setControlledBoard(initial, board, openings),
      activeSeason: completeRounds(initial.activeSeason!, 2),
      recruiting: {
        ...setControlledBoard(initial, board, openings).recruiting!,
        recruits: initial.recruiting!.recruits.map((recruit) =>
          recruits.find((candidate) => candidate.player.id === recruit.player.id) ?? recruit,
        ),
        commitmentsByPlayerId: {
          [recruits[0]!.player.id]: {
            playerId: recruits[0]!.player.id,
            programId: otherProgramId,
            timing: { kind: 'period', period: 0 },
            targetSeasonNumber: 2,
          },
        },
        relationshipProgressByPlayerId: {
          [recruits[1]!.player.id]: { [programId]: 12 },
        },
      },
    }
    let manual = resolveRecruitingPeriod(prepared, 1)
    manual = resolveRecruitingPeriod(manual, 2)
    const batched = syncRecruitingThroughCompletedRounds(prepared)
    expect(batched.recruiting).toEqual(manual.recruiting)
    const finalBoard = manual.recruiting!.programs[programId]!.board
    expect(finalBoard.find(({ playerId }) => playerId === recruits[1]!.player.id)?.hasActiveOffer).toBe(true)
    expect(finalBoard.find(({ playerId }) => playerId === recruits[0]!.player.id)?.isFocused)
      .toBe(false)
    expect(manual.recruiting!.relationshipProgressByPlayerId[recruits[1]!.player.id]![programId]).toBeGreaterThan(12)
  })

  it('does not undo a deliberate controlled offer withdrawal during advancement', () => {
    let dynasty = createRecruitingDynasty('deliberate-offer-vacancy')
    const programId = dynasty.controlledProgramId
    const offered = dynasty.recruiting!.programs[programId]!.board
      .find(({ hasActiveOffer }) => hasActiveOffer)!
    const offeredPosition = dynasty.recruiting!.recruits
      .find(({ player }) => player.id === offered.playerId)!.player.position
    dynasty = withdrawRecruitOffer({ dynasty, playerId: offered.playerId })
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    expect(dynasty.recruiting!.programs[programId]!.board.some((target) => {
      const recruit = dynasty.recruiting!.recruits.find(({ player }) => player.id === target.playerId)!
      return recruit.player.position === offeredPosition && target.hasActiveOffer
    })).toBe(false)
  })

  it('does not promote a backup when the offered commitment fills the position', () => {
    let dynasty = createRecruitingDynasty('filled-position-no-fallback')
    const programId = dynasty.controlledProgramId
    const recruit = { ...dynasty.recruiting!.recruits[0]!,
      decisionReadyPeriod: 1,
      commitmentStandingThreshold: 0,
      commitmentSeparationThreshold: 0,
    }
    const backup = dynasty.recruiting!.recruits.find(
      (candidate) => candidate.player.position === recruit.player.position &&
        candidate.player.id !== recruit.player.id,
    )!
    const openings = zeroCounts()
    openings[recruit.player.position] = 1
    dynasty = setControlledBoard(dynasty, [
      { playerId: recruit.player.id, isFocused: true, hasActiveOffer: true },
      { playerId: backup.player.id, isFocused: true, hasActiveOffer: false },
    ], openings)
    dynasty = {
      ...dynasty,
      activeSeason: completeRounds(dynasty.activeSeason!, 1),
      recruiting: {
        ...dynasty.recruiting!,
        recruits: dynasty.recruiting!.recruits.map((candidate) =>
          candidate.player.id === recruit.player.id ? recruit : candidate,
        ),
        relationshipProgressByPlayerId: {
          [recruit.player.id]: { [programId]: 100 },
        },
      },
    }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    expect(dynasty.recruiting!.commitmentsByPlayerId[recruit.player.id]?.programId).toBe(programId)
    expect(dynasty.recruiting!.programs[programId]!.board.every(
      ({ hasActiveOffer }) => !hasActiveOffer,
    )).toBe(true)
  })

  it('lets AI discover an attainable unsigned premium Recruit outside its board', () => {
    let dynasty = createRecruitingDynasty('premium-discovery')
    const programId = Object.values(dynasty.activeSeason!.programStates)
      .sort((first, second) => second.team.prestige - first.team.prestige)
      .map(({ team }) => team.id)
      .find((id) => id !== dynasty.controlledProgramId)!
    const premium = dynasty.recruiting!.recruits.find(({ stars }) => stars === 5)!
    const fallback = [...dynasty.recruiting!.recruits].reverse().find(
      (recruit) => recruit.player.position === premium.player.position,
    )!
    const openings = zeroCounts()
    openings[premium.player.position] = 1
    dynasty = {
      ...dynasty,
      activeSeason: completeRounds(dynasty.activeSeason!, 1),
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [programId]: {
            programId,
            projectedOpeningsByPosition: openings,
            board: [{ playerId: fallback.player.id, isFocused: false, hasActiveOffer: true }],
          },
        },
      },
    }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    expect(dynasty.recruiting!.programs[programId]!.board.some(
      ({ playerId }) => playerId === premium.player.id,
    )).toBe(true)
  })

  it('allows a clear elite lead to commit early while a tied battle waits', () => {
    const source = createRecruitingDynasty('elite-commitment-conditions')
    const programId = source.controlledProgramId
    const otherProgramId = Object.keys(source.recruiting!.programs).sort()
      .find((id) => id !== programId)!
    const elite = {
      ...source.recruiting!.recruits.find(({ stars }) => stars === 5)!,
      decisionReadyPeriod: 15,
      commitmentStandingThreshold: 64,
      commitmentSeparationThreshold: 4,
    }
    const openings = zeroCounts()
    openings[elite.player.position] = 1
    const programs = {
      [programId]: {
        programId,
        projectedOpeningsByPosition: openings,
        board: [{ playerId: elite.player.id, isFocused: true, hasActiveOffer: true }],
      },
      [otherProgramId]: {
        programId: otherProgramId,
        projectedOpeningsByPosition: openings,
        board: [{ playerId: elite.player.id, isFocused: true, hasActiveOffer: true }],
      },
    }
    const base = {
      ...source,
      activeSeason: completeRounds(source.activeSeason!, 21),
      recruiting: {
        ...source.recruiting!,
        recruits: [elite],
        programs,
        commitmentsByPlayerId: {},
      },
    }
    const clear = resolveRecruitingPeriod({
      ...base,
      recruiting: {
        ...base.recruiting!,
        lastResolvedPeriod: 14,
        relationshipProgressByPlayerId: {
          [elite.player.id]: { [programId]: 80, [otherProgramId]: 8 },
        },
      },
    }, 15)
    expect(clear.recruiting!.commitmentsByPlayerId[elite.player.id]?.timing).toEqual({ kind: 'period', period: 15 })

    const context = { ...base, recruiting: { ...base.recruiting!, lastResolvedPeriod: 20 } }
    const firstAttraction = deriveBaseRecruitAttraction(context, elite, programId)
    const secondAttraction = deriveBaseRecruitAttraction(context, elite, otherProgramId)
    const contested = resolveRecruitingPeriod({
      ...context,
      recruiting: {
        ...context.recruiting!,
        relationshipProgressByPlayerId: {
          [elite.player.id]: {
            [programId]: 100 - firstAttraction,
            [otherProgramId]: 100 - secondAttraction,
          },
        },
      },
    }, 21)
    expect(contested.recruiting!.commitmentsByPlayerId[elite.player.id]).toBeUndefined()
  })
})
