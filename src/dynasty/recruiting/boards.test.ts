import { describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../../universe'
import {
  addRecruitingBoardTarget,
  removeRecruitingBoardTarget,
  updateRecruitingBoardPriority,
} from './boards'
import { RECRUITING_BOARD_LIMIT } from './constants'
import {
  deriveProgramCommitments,
  deriveProgramRecruitingBoard,
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
        expect(target.priority).toBeGreaterThanOrEqual(1)
        expect(target.priority).toBeLessThanOrEqual(5)
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

  it('supports controlled add/remove/priority edits and retains relationship progress', () => {
    let dynasty = createRecruitingDynasty('board-editing')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const removed = program.board[0]!
    const progress = dynasty.recruiting!.relationshipProgressByPlayerId[removed.playerId]![dynasty.controlledProgramId]!
    dynasty = removeRecruitingBoardTarget({ dynasty, playerId: removed.playerId })
    expect(dynasty.recruiting!.relationshipProgressByPlayerId[removed.playerId]![dynasty.controlledProgramId]).toBe(progress)
    dynasty = addRecruitingBoardTarget({ dynasty, playerId: removed.playerId, priority: 2 })
    dynasty = updateRecruitingBoardPriority({ dynasty, playerId: removed.playerId, priority: 5 })
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
      .find(({ playerId }) => playerId === removed.playerId)?.priority).toBe(5)
  })

  it('validates board bounds, duplicates, priorities, commitments, and position eligibility', () => {
    let dynasty = createRecruitingDynasty('board-validation')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const existing = program.board[0]!
    expect(() => addRecruitingBoardTarget({ dynasty, playerId: existing.playerId, priority: 3 })).toThrow(/already/)
    expect(() => updateRecruitingBoardPriority({ dynasty, playerId: existing.playerId, priority: 6 })).toThrow(/priority/)

    const unnecessary = dynasty.recruiting!.recruits.find(({ player }) =>
      program.projectedOpeningsByPosition[player.position] === 0,
    )
    if (unnecessary) {
      dynasty = removeRecruitingBoardTarget({ dynasty, playerId: program.board.at(-1)!.playerId })
      expect(() => addRecruitingBoardTarget({ dynasty, playerId: unnecessary.player.id, priority: 3 })).toThrow(/position/)
    }

    const committedId = dynasty.recruiting!.recruits.find(({ player }) =>
      !program.board.some(({ playerId }) => playerId === player.id),
    )!.player.id
    dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          [committedId]: { playerId: committedId, programId: 'northbridge', period: 1, targetSeasonNumber: 2 },
        },
      },
    }
    expect(() => addRecruitingBoardTarget({ dynasty, playerId: committedId, priority: 3 })).toThrow(/committed/)
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
      expect(deriveProgramRecruitingBoard(dynasty, program.programId).targets.every(
        ({ status }) => ['active', 'committed', 'committed-elsewhere', 'position-filled'].includes(status),
      )).toBe(true)
    }
  })
})
