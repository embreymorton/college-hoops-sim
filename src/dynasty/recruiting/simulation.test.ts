import { describe, expect, it } from 'vitest'
import { simulateScheduledGame, simulatePendingGamesInRound } from '../../season'
import { UNIVERSE_V0 } from '../../universe'
import { removeRecruitingBoardTarget } from './boards'
import {
  deriveBaseRecruitAttraction,
  deriveProgramCommitments,
  deriveRecruitProgramStandings,
  getRecruit,
} from './queries'
import {
  deriveProgramActiveEffort,
  resolveRecruitingPeriod,
  syncRecruitingThroughCompletedRounds,
} from './simulation'
import { completeRounds, createRecruitingDynasty } from './testSupport'

describe('regular-season Recruiting advancement', () => {
  it('waits for the full basketball round and synchronizes each period once', () => {
    let dynasty = createRecruitingDynasty('round-gate')
    const roundOneGame = dynasty.activeSeason!.schedule.games.find(({ round }) => round === 1)!
    dynasty = {
      ...dynasty,
      activeSeason: simulateScheduledGame({
        season: dynasty.activeSeason!,
        scheduledGameId: roundOneGame.id,
        simulationSeed: 'one-user-game',
      }),
    }
    expect(syncRecruitingThroughCompletedRounds(dynasty).recruiting!.lastResolvedPeriod).toBe(0)
    expect(() => resolveRecruitingPeriod(dynasty, 1)).toThrow(/completed basketball Round/)

    dynasty = {
      ...dynasty,
      activeSeason: simulatePendingGamesInRound({
        season: dynasty.activeSeason!, round: 1, simulationSeed: 'round-gate-rest',
      }),
    }
    const advanced = syncRecruitingThroughCompletedRounds(dynasty)
    expect(advanced.recruiting!.lastResolvedPeriod).toBe(1)
    expect(syncRecruitingThroughCompletedRounds(advanced)).toEqual(advanced)
  })

  it('produces identical sequential and batched/Super-Sim-equivalent outcomes', () => {
    const initial = createRecruitingDynasty('batch-equivalence')
    let sequential = initial
    for (let round = 1; round <= 12; round += 1) {
      sequential = {
        ...sequential,
        activeSeason: simulatePendingGamesInRound({
          season: sequential.activeSeason!, round, simulationSeed: 'batch-games',
        }),
      }
      sequential = syncRecruitingThroughCompletedRounds(sequential)
    }
    const batch = syncRecruitingThroughCompletedRounds({
      ...initial,
      activeSeason: completeRounds(initial.activeSeason!, 12),
    })
    expect(batch.recruiting).toEqual(sequential.recruiting)
  })

  it('is Program/recruit iteration-order independent and seed-sensitive', () => {
    const initial = createRecruitingDynasty('order-independence')
    const completedSeason = completeRounds(initial.activeSeason!, 8)
    const normal = syncRecruitingThroughCompletedRounds({ ...initial, activeSeason: completedSeason })
    const reversed = syncRecruitingThroughCompletedRounds({
      ...initial,
      activeSeason: completedSeason,
      recruiting: {
        ...initial.recruiting!,
        recruits: [...initial.recruiting!.recruits].reverse(),
        programs: Object.fromEntries(Object.entries(initial.recruiting!.programs).reverse()),
      },
    })
    expect(reversed.recruiting).toEqual(normal.recruiting)

    const different = createRecruitingDynasty('order-independence-different')
    expect(different.recruiting).not.toEqual(initial.recruiting)
  })

  it('does not let AI rewrite the controlled board while replacing unavailable AI targets', () => {
    let dynasty = createRecruitingDynasty('ai-refresh')
    const controlled = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const removedControlledId = controlled.board[0]!.playerId
    dynasty = removeRecruitingBoardTarget({ dynasty, playerId: removedControlledId })
    const expectedControlledBoard = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board
    const aiId = UNIVERSE_V0.programs.map(({ id }) => id).find((id) => id !== dynasty.controlledProgramId)!
    const aiTarget = dynasty.recruiting!.programs[aiId]!.board[0]!.playerId
    const otherProgramId = UNIVERSE_V0.programs.map(({ id }) => id)
      .find((id) => id !== aiId && id !== dynasty.controlledProgramId)!
    dynasty = {
      ...dynasty,
      activeSeason: completeRounds(dynasty.activeSeason!, 1),
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          [aiTarget]: { playerId: aiTarget, programId: otherProgramId, timing: { kind: 'period', period: 0 }, targetSeasonNumber: 2 },
        },
      },
    }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    expect(dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board).toEqual(expectedControlledBoard)
    expect(dynasty.recruiting!.programs[aiId]!.board.some(({ playerId }) => playerId === aiTarget)).toBe(false)
  })
})

describe('Recruiting strategy model', () => {
  it('gives focus a fixed bonus without normalizing board effort', () => {
    const initial = createRecruitingDynasty('focus-progress')
    const programId = initial.controlledProgramId
    const targets = initial.recruiting!.programs[programId]!.board.slice(0, 2)
    const withFocus = (firstFocused: boolean, secondFocused: boolean) => ({
      ...initial,
      activeSeason: completeRounds(initial.activeSeason!, 1),
      recruiting: {
        ...initial.recruiting!,
        programs: {
          ...initial.recruiting!.programs,
          [programId]: {
            ...initial.recruiting!.programs[programId]!,
            board: [
              { ...targets[0]!, isFocused: firstFocused },
              { ...targets[1]!, isFocused: secondFocused },
            ],
          },
        },
      },
    })
    const focused = resolveRecruitingPeriod(withFocus(true, false), 1)
    const reversed = resolveRecruitingPeriod(withFocus(false, true), 1)
    const firstId = targets[0]!.playerId
    expect(focused.recruiting!.relationshipProgressByPlayerId[firstId]![programId])
      .toBeGreaterThan(reversed.recruiting!.relationshipProgressByPlayerId[firstId]![programId]!)
    expect(focused.recruiting!.relationshipProgressByPlayerId[firstId]![programId]).toBeCloseTo(6, 3)
  })

  it('keeps baseline and focused effort independent of board size', () => {
    const initial = createRecruitingDynasty('focus-board-size')
    const programId = initial.controlledProgramId
    const targets = initial.recruiting!.programs[programId]!.board
    const withBoard = (board: typeof targets) => ({
      ...initial,
      recruiting: {
        ...initial.recruiting!,
        programs: {
          ...initial.recruiting!.programs,
          [programId]: { ...initial.recruiting!.programs[programId]!, board },
        },
      },
    })
    const short = deriveProgramActiveEffort(withBoard([
      { ...targets[0]!, isFocused: false },
      { ...targets[1]!, isFocused: true },
      { ...targets[2]!, isFocused: false },
    ]).recruiting!, programId)
    const long = deriveProgramActiveEffort(withBoard(targets.slice(0, 9).map((target, index) => ({
      ...target,
      isFocused: index === 1,
    }))).recruiting!, programId)
    expect(short[targets[0]!.playerId]).toBe(long[targets[0]!.playerId])
    expect(short[targets[1]!.playerId]).toBe(long[targets[1]!.playerId])
    expect(short[targets[0]!.playerId]).toBe(3)
    expect(short[targets[1]!.playerId]).toBe(6)
  })

  it('preserves early work and redistributes all effort away from unavailable targets', () => {
    let dynasty = createRecruitingDynasty('persistent-progress')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 1) }
    dynasty = resolveRecruitingPeriod(dynasty, 1)
    const programId = dynasty.controlledProgramId
    const board = dynasty.recruiting!.programs[programId]!.board
    const removedId = board[0]!.playerId
    const retained = dynasty.recruiting!.relationshipProgressByPlayerId[removedId]![programId]
    dynasty = removeRecruitingBoardTarget({ dynasty, playerId: removedId })
    expect(dynasty.recruiting!.relationshipProgressByPlayerId[removedId]![programId]).toBe(retained)

    const unavailableId = dynasty.recruiting!.programs[programId]!.board[0]!.playerId
    dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: {
          ...dynasty.recruiting!.commitmentsByPlayerId,
          [unavailableId]: { playerId: unavailableId, programId: 'northbridge', timing: { kind: 'period', period: 1 }, targetSeasonNumber: 2 },
        },
      },
    }
    const effort = deriveProgramActiveEffort(dynasty.recruiting!, programId)
    expect(effort[unavailableId]).toBeUndefined()
    expect(Object.values(effort).every((value) => value === 3 || value === 6)).toBe(true)
  })

  it('makes elite recruits more prestige-sensitive and generally later-deciding', () => {
    const dynasty = createRecruitingDynasty('quality-strategy')
    const recruits = dynasty.recruiting!.recruits
    const elite = recruits.filter(({ stars }) => stars === 5)
    const lower = recruits.filter(({ stars }) => stars === 2)
    const teams = Object.values(dynasty.activeSeason!.programStates).map(({ team }) => team)
    const high = [...teams].sort((a, b) => b.prestige - a.prestige)[0]!
    const low = [...teams].sort((a, b) => a.prestige - b.prestige)[0]!
    const averageGap = (sample: typeof elite) => sample.reduce(
      (sum, recruit) => sum +
        deriveBaseRecruitAttraction(dynasty, recruit, high.id) -
        deriveBaseRecruitAttraction(dynasty, recruit, low.id),
      0,
    ) / sample.length
    const averageReady = (sample: typeof elite) => sample.reduce(
      (sum, recruit) => sum + recruit.decisionReadyPeriod, 0,
    ) / sample.length
    expect(averageGap(elite)).toBeGreaterThan(averageGap(lower))
    expect(averageReady(elite)).toBeGreaterThan(averageReady(lower))
  })

  it('requires readiness, meaningful involvement, confidence, and preserves final commitments', () => {
    let dynasty = createRecruitingDynasty('commitment-invariants')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!) }
    for (let period = 1; period <= 12; period += 1) dynasty = resolveRecruitingPeriod(dynasty, period)
    const earlyCommitments = structuredClone(dynasty.recruiting!.commitmentsByPlayerId)
    const earlyCommitment = Object.values(earlyCommitments)[0]
    if (earlyCommitment) {
      const lateProgramId = Object.keys(dynasty.recruiting!.programs).sort()
        .find((programId) => programId !== earlyCommitment.programId)!
      const lateProgram = dynasty.recruiting!.programs[lateProgramId]!
      dynasty = {
        ...dynasty,
        recruiting: {
          ...dynasty.recruiting!,
          programs: {
            ...dynasty.recruiting!.programs,
            [lateProgramId]: {
              ...lateProgram,
              board: [{ playerId: earlyCommitment.playerId, isFocused: true, hasActiveOffer: true }, ...lateProgram.board].slice(0, 10),
            },
          },
        },
      }
    }
    for (let period = 13; period <= 24; period += 1) dynasty = resolveRecruitingPeriod(dynasty, period)
    for (const [playerId, commitment] of Object.entries(earlyCommitments)) {
      expect(dynasty.recruiting!.commitmentsByPlayerId[playerId]).toEqual(commitment)
    }
    const commitments = Object.values(dynasty.recruiting!.commitmentsByPlayerId)
    expect(new Set(commitments.map(({ playerId }) => playerId)).size).toBe(commitments.length)
    for (const commitment of commitments) {
      const recruit = getRecruit(dynasty.recruiting!, commitment.playerId)!
      expect(commitment.timing.kind).toBe('period')
      if (commitment.timing.kind === 'period') {
        expect(commitment.timing.period).toBeGreaterThanOrEqual(recruit.decisionReadyPeriod)
      }
      expect(dynasty.recruiting!.relationshipProgressByPlayerId[commitment.playerId]![commitment.programId])
        .toBeGreaterThanOrEqual(8)
    }
    const destinations = Object.fromEntries(commitments.map(({ playerId, programId }) => [playerId, programId]))
    expect(Object.fromEntries(Object.values(dynasty.recruiting!.commitmentsByPlayerId)
      .map(({ playerId, programId }) => [playerId, programId]))).toEqual(destinations)

    for (const program of Object.values(dynasty.recruiting!.programs)) {
      const positionCounts: Record<string, number> = {}
      for (const commitment of deriveProgramCommitments(dynasty.recruiting!, program.programId)) {
        const position = getRecruit(dynasty.recruiting!, commitment.playerId)!.player.position
        positionCounts[position] = (positionCounts[position] ?? 0) + 1
        expect(positionCounts[position]).toBeLessThanOrEqual(program.projectedOpeningsByPosition[position])
      }
    }
  })

  it('allows accumulated relationships and prestige to change derived leaders before commitment', () => {
    let dynasty = createRecruitingDynasty('leader-flip')
    dynasty = { ...dynasty, activeSeason: completeRounds(dynasty.activeSeason!, 4) }
    const recruit = dynasty.recruiting!.recruits.find(({ decisionReadyPeriod }) => decisionReadyPeriod > 4)!
    const before = deriveRecruitProgramStandings(dynasty, recruit.player.id)
    dynasty = syncRecruitingThroughCompletedRounds(dynasty)
    const after = deriveRecruitProgramStandings(dynasty, recruit.player.id)
    expect(after.some(({ relationshipProgress }) => relationshipProgress > 0)).toBe(true)
    expect(after).not.toEqual(before)
  })
})
