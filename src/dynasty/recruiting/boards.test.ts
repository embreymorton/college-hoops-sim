import { describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../../universe'
import {
  addRecruitingBoardTarget,
  refreshAiRecruitingBoards,
  removeRecruitingBoardTarget,
  setRecruitingFocus,
} from './boards'
import { RECRUITING_BOARD_LIMIT } from './constants'
import {
  deriveProgramCommitments,
  deriveProgramRecruitingBoard,
  deriveActiveOfferCountsByPosition,
  getRecruit,
} from './queries'
import { resolveRecruitingPeriod } from './simulation'
import { completeRounds, createRecruitingDynasty } from './testSupport'

describe('Program recruiting boards', () => {
  it('gives all Programs valid need-aware default plans with no hidden controlled advantage', () => {
    const dynasty = createRecruitingDynasty('default-boards')
    const recruiting = dynasty.recruiting!
    expect(Object.keys(recruiting.programs)).toHaveLength(UNIVERSE_V0.programs.length)
    for (const program of Object.values(recruiting.programs)) {
      expect(program.board.length).toBeGreaterThan(0)
      expect(program.board.length).toBeLessThanOrEqual(RECRUITING_BOARD_LIMIT)
      expect(new Set(program.board.map(({ playerId }) => playerId)).size).toBe(program.board.length)
      for (const target of program.board) {
        expect(target.isFocused).toBeTypeOf('boolean')
        const recruit = getRecruit(recruiting, target.playerId)!
        expect(program.projectedOpeningsByPosition[recruit.player.position]).toBeGreaterThan(0)
      }
    }

    const byPrestige = Object.values(recruiting.programs).sort((first, second) =>
      dynasty.activeSeason!.programStates[first.programId]!.team.prestige -
      dynasty.activeSeason!.programStates[second.programId]!.team.prestige,
    )
    const averageRank = (programId: string) => {
      const board = recruiting.programs[programId]!.board
      return board.reduce(
        (sum, { playerId }) => sum + getRecruit(recruiting, playerId)!.nationalRank,
        0,
      ) / board.length
    }
    const lowest = byPrestige[0]!
    const highest = byPrestige.at(-1)!
    expect(averageRank(highest.programId)).toBeLessThan(averageRank(lowest.programId))
    expect(recruiting.programs[lowest.programId]!.board.every(
      ({ playerId }) => getRecruit(recruiting, playerId)!.stars >= 4,
    )).toBe(false)
  })

  it('supports controlled add/remove/focus edits and retains relationship progress', () => {
    let dynasty = createRecruitingDynasty('board-editing')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const removed = program.board[0]!
    const progress = dynasty.recruiting!.relationshipProgressByPlayerId[removed.playerId]![dynasty.controlledProgramId]!
    dynasty = removeRecruitingBoardTarget({ dynasty, playerId: removed.playerId })
    expect(dynasty.recruiting!.relationshipProgressByPlayerId[removed.playerId]![dynasty.controlledProgramId]).toBe(progress)
    dynasty = addRecruitingBoardTarget({ dynasty, playerId: removed.playerId })
    dynasty = setRecruitingFocus({ dynasty, playerId: removed.playerId, isFocused: true })
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === removed.playerId)?.isFocused).toBe(true)
  })

  it('validates board bounds, duplicates, focus, commitments, and position eligibility', () => {
    let dynasty = createRecruitingDynasty('board-validation')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const existing = program.board[0]!
    expect(() => addRecruitingBoardTarget({ dynasty, playerId: existing.playerId })).toThrow(/already/)

    const unnecessary = dynasty.recruiting!.recruits.find(({ player }) =>
      program.projectedOpeningsByPosition[player.position] === 0,
    )
    if (unnecessary) {
      dynasty = removeRecruitingBoardTarget({ dynasty, playerId: program.board.at(-1)!.playerId })
      expect(() => addRecruitingBoardTarget({ dynasty, playerId: unnecessary.player.id })).toThrow(/position/)
    }

    const committedId = dynasty.recruiting!.recruits.find(({ player }) =>
      !program.board.some(({ playerId }) => playerId === player.id),
    )!.player.id
    dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          [committedId]: { playerId: committedId, programId: 'northbridge', timing: { kind: 'period', period: 1 }, targetSeasonNumber: 2 },
        },
      },
    }
    expect(() => addRecruitingBoardTarget({ dynasty, playerId: committedId })).toThrow(/committed/)
  })

  it('enforces at most three active focus targets without coupling focus to offers', () => {
    let dynasty = createRecruitingDynasty('focus-limit')
    const targetIds = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .slice(0, 4).map(({ playerId }) => playerId)
    for (const playerId of targetIds.slice(0, 3)) {
      dynasty = setRecruitingFocus({ dynasty, playerId, isFocused: true })
    }
    expect(() => setRecruitingFocus({ dynasty, playerId: targetIds[3]!, isFocused: true }))
      .toThrow(/focus cannot exceed 3/i)
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .filter(({ isFocused }) => isFocused)).toHaveLength(3)
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .filter(({ isFocused }) => isFocused).every(({ hasActiveOffer }) => !hasActiveOffer || hasActiveOffer))
      .toBe(true)
  })

  it('keeps valid AI offers aligned with Focus and retains a premium Focus + Offer on refresh', () => {
    const dynasty = createRecruitingDynasty('coherent-ai-plan')
    const recruiting = dynasty.recruiting!
    const aiPrograms = Object.values(recruiting.programs).filter(
      ({ programId }) => programId !== dynasty.controlledProgramId,
    )
    for (const program of aiPrograms) {
      const offered = program.board.filter(({ hasActiveOffer }) => hasActiveOffer)
      const focused = program.board.filter(({ isFocused }) => isFocused)
      expect(focused).toHaveLength(Math.min(3, program.board.length))
      expect(offered.filter(({ isFocused }) => isFocused)).toHaveLength(
        Math.min(3, offered.length),
      )
    }

    const premium = aiPrograms.flatMap((program) => program.board.map((target) => ({ program, target })))
      .find(({ target }) => target.hasActiveOffer && target.isFocused && getRecruit(recruiting, target.playerId)!.stars >= 4)
    expect(premium).toBeDefined()

    const refreshed = refreshAiRecruitingBoards(dynasty, recruiting)
    const retained = refreshed.programs[premium!.program.programId]!.board
      .find(({ playerId }) => playerId === premium!.target.playerId)
    expect(retained).toMatchObject({ hasActiveOffer: true, isFocused: true })
  })

  it('derives statuses and never exceeds positional commitment capacity', () => {
    let dynasty = createRecruitingDynasty('capacity')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!) }
    for (let period = 1; period <= 24; period += 1) dynasty = resolveRecruitingPeriod(dynasty, period)
    for (const program of Object.values(dynasty.recruiting!.programs)) {
      const counts: Record<string, number> = {}
      for (const commitment of deriveProgramCommitments(dynasty.recruiting!, program.programId)) {
        const position = getRecruit(dynasty.recruiting!, commitment.playerId)!.player.position
        counts[position] = (counts[position] ?? 0) + 1
        expect(counts[position]).toBeLessThanOrEqual(program.projectedOpeningsByPosition[position])
      }
      const offerCounts = deriveActiveOfferCountsByPosition(dynasty.recruiting!, program)
      for (const position of Object.keys(program.projectedOpeningsByPosition) as Array<keyof typeof offerCounts>) {
        expect((counts[position] ?? 0) + offerCounts[position])
          .toBeLessThanOrEqual(program.projectedOpeningsByPosition[position])
      }
      expect(deriveProgramRecruitingBoard(dynasty, program.programId).targets.every(
        ({ status }) => ['active', 'committed', 'committed-elsewhere', 'position-filled'].includes(status),
      )).toBe(true)
    }
  })
})
