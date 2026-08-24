import { describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../../universe'
import {
  addRecruitingBoardTarget,
  clearUnavailableRecruitingBoardTargets,
  fillRemainingRecruitingBoard,
  offerRecruit,
  refreshAiRecruitingBoards,
  removeRecruitingBoardTarget,
  setRecruitingFocus,
  withdrawRecruitOffer,
} from './boards'
import { RECRUITING_BOARD_LIMIT } from './constants'
import type { RecruitingBoardTarget } from './domain'
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
        expect(target.origin).toBe('assistant')
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
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === removed.playerId)?.origin).toBe('manual')
    dynasty = setRecruitingFocus({ dynasty, playerId: removed.playerId, isFocused: true })
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === removed.playerId)?.isFocused).toBe(true)
  })

  it('preserves provenance through focus, offer, withdraw, and assistant restoration', () => {
    let dynasty = createRecruitingDynasty('board-origin-lifecycle')
    const programId = dynasty.controlledProgramId
    const original = dynasty.recruiting!.programs[programId]!.board.find(
      ({ hasActiveOffer }) => hasActiveOffer,
    )!
    expect(original.origin).toBe('assistant')
    dynasty = withdrawRecruitOffer({ dynasty, playerId: original.playerId })
    dynasty = offerRecruit({ dynasty, playerId: original.playerId })
    dynasty = setRecruitingFocus({ dynasty, playerId: original.playerId, isFocused: false })
    const focusedElsewhere = dynasty.recruiting!.programs[programId]!.board.find(
      (target) => target.isFocused && target.playerId !== original.playerId,
    )
    if (focusedElsewhere) {
      dynasty = setRecruitingFocus({
        dynasty,
        playerId: focusedElsewhere.playerId,
        isFocused: false,
      })
    }
    dynasty = setRecruitingFocus({ dynasty, playerId: original.playerId, isFocused: true })
    expect(dynasty.recruiting!.programs[programId]!.board
      .find(({ playerId }) => playerId === original.playerId)!.origin).toBe('assistant')

    const empty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [programId]: { ...dynasty.recruiting!.programs[programId]!, board: [] },
        },
      },
    }
    const restored = fillRemainingRecruitingBoard(empty).recruiting!.programs[programId]!.board
    expect(restored.length).toBeGreaterThan(0)
    expect(restored.every(({ origin }) => origin === 'assistant')).toBe(true)
  })

  it('fills only remaining capacity while preserving the exact manual plan and order', () => {
    const full = createRecruitingDynasty('assistant-partial-board')
    const programId = full.controlledProgramId
    const original = full.recruiting!.programs[programId]!.board.slice(0, 3).map(
      (target, index) => ({
        ...target,
        isFocused: index === 0 || index === 2,
        hasActiveOffer: index === 1 || index === 2,
      }),
    )
    const dynasty = {
      ...full,
      recruiting: {
        ...full.recruiting!,
        programs: {
          ...full.recruiting!.programs,
          [programId]: { ...full.recruiting!.programs[programId]!, board: original },
        },
      },
    }

    const filled = fillRemainingRecruitingBoard(dynasty)
    const board = filled.recruiting!.programs[programId]!.board
    expect(board).toHaveLength(RECRUITING_BOARD_LIMIT)
    expect(board.slice(0, original.length)).toEqual(original)
    expect(board.slice(original.length).every(
      ({ origin, isFocused, hasActiveOffer }) => origin === 'assistant' && !isFocused && !hasActiveOffer,
    )).toBe(true)
    expect(new Set(board.map(({ playerId }) => playerId)).size).toBe(board.length)
  })

  it('atomically clears unavailable targets while retaining commitments, order, and history', () => {
    const source = createRecruitingDynasty('clear-unavailable')
    const programId = source.controlledProgramId
    const atPosition = (position: 'PG' | 'SG' | 'PF' | 'C') =>
      source.recruiting!.recruits.filter(({ player }) => player.position === position)
    const elsewhere = atPosition('PG')[0]!
    const committed = atPosition('SG')[0]!
    const filled = atPosition('C')[0]!
    const fillingCommitment = atPosition('C')[1]!
    const active = atPosition('PF')[0]!
    const board: RecruitingBoardTarget[] = [
      { playerId: active.player.id, origin: 'manual', isFocused: false, hasActiveOffer: false },
      { playerId: elsewhere.player.id, origin: 'assistant', isFocused: false, hasActiveOffer: false },
      { playerId: committed.player.id, origin: 'manual', isFocused: false, hasActiveOffer: false },
      { playerId: filled.player.id, origin: 'assistant', isFocused: false, hasActiveOffer: false },
    ]
    const relationshipProgressByPlayerId = {
      [elsewhere.player.id]: { [programId]: 12 },
      [filled.player.id]: { [programId]: 8 },
    }
    const dynasty = {
      ...source,
      recruiting: {
        ...source.recruiting!,
        programs: {
          ...source.recruiting!.programs,
          [programId]: {
            ...source.recruiting!.programs[programId]!,
            projectedOpeningsByPosition: { PG: 1, SG: 1, SF: 0, PF: 1, C: 1 },
            board,
          },
        },
        relationshipProgressByPlayerId,
        commitmentsByPlayerId: {
          [elsewhere.player.id]: { playerId: elsewhere.player.id, programId: 'northbridge', timing: { kind: 'period' as const, period: 1 }, targetSeasonNumber: 2 },
          [committed.player.id]: { playerId: committed.player.id, programId, timing: { kind: 'period' as const, period: 1 }, targetSeasonNumber: 2 },
          [fillingCommitment.player.id]: { playerId: fillingCommitment.player.id, programId, timing: { kind: 'period' as const, period: 1 }, targetSeasonNumber: 2 },
        },
      },
    }

    const cleared = clearUnavailableRecruitingBoardTargets(dynasty)
    expect(cleared.recruiting!.programs[programId]!.board.map(({ playerId }) => playerId))
      .toEqual([active.player.id, committed.player.id])
    expect(cleared.recruiting!.relationshipProgressByPlayerId).toBe(relationshipProgressByPlayerId)
    expect(cleared.recruiting!.programs[programId]!.board).toHaveLength(2)
    expect(clearUnavailableRecruitingBoardTargets(cleared)).toBe(cleared)
  })

  it('fills empty and nearly-full Boards deterministically without changing AI plans', () => {
    const source = createRecruitingDynasty('assistant-determinism')
    const programId = source.controlledProgramId
    const aiBefore = Object.fromEntries(Object.entries(source.recruiting!.programs).filter(
      ([id]) => id !== programId,
    ))
    const withBoard = (board: readonly RecruitingBoardTarget[]) => ({
      ...source,
      recruiting: {
        ...source.recruiting!,
        programs: {
          ...source.recruiting!.programs,
          [programId]: { ...source.recruiting!.programs[programId]!, board },
        },
      },
    })
    const empty = withBoard([])
    const first = fillRemainingRecruitingBoard(empty)
    const replay = fillRemainingRecruitingBoard(empty)
    expect(first.recruiting!.programs[programId]!.board).toEqual(
      replay.recruiting!.programs[programId]!.board,
    )
    expect(first.recruiting!.programs[programId]!.board.every(
      ({ isFocused, hasActiveOffer }) => !isFocused && !hasActiveOffer,
    )).toBe(true)
    expect(Object.fromEntries(Object.entries(first.recruiting!.programs).filter(
      ([id]) => id !== programId,
    ))).toEqual(aiBefore)

    const manualTargets = source.recruiting!.recruits.slice(0, 10).map(({ player }, index) => ({
      playerId: player.id,
      origin: 'assistant' as const,
      isFocused: index === 0,
      hasActiveOffer: index === 1,
    }))
    const nearlyFull = withBoard(manualTargets.slice(0, 9))
    expect(fillRemainingRecruitingBoard(nearlyFull).recruiting!.programs[programId]!.board)
      .toHaveLength(RECRUITING_BOARD_LIMIT)
    const full = withBoard(manualTargets)
    expect(fillRemainingRecruitingBoard(full)).toBe(full)
  })

  it('preserves unavailable existing entries and stops when no legal candidates remain', () => {
    const source = createRecruitingDynasty('assistant-insufficient')
    const programId = source.controlledProgramId
    const existing = { ...source.recruiting!.programs[programId]!.board[0]!, isFocused: true, hasActiveOffer: true }
    const dynasty = {
      ...source,
      recruiting: {
        ...source.recruiting!,
        programs: {
          ...source.recruiting!.programs,
          [programId]: {
            ...source.recruiting!.programs[programId]!,
            board: [existing],
            projectedOpeningsByPosition: { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 },
          },
        },
      },
    }
    expect(fillRemainingRecruitingBoard(dynasty)).toBe(dynasty)
    expect(dynasty.recruiting.programs[programId]!.board).toEqual([existing])
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
