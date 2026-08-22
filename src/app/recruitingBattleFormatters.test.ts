import { describe, expect, it } from 'vitest'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import {
  deriveBaseRecruitAttraction,
  deriveProgramRecruitingBoard,
  deriveRecruitingBattleView,
  deriveTargetStatus,
  type DynastyState,
} from '../dynasty'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import {
  deriveBattleGroups,
  deriveFocusTargetSummaries,
  deriveRecruitingActivityDescriptions,
  formatBattlePositionLabel,
  formatControlledPositionLabel,
  formatControlledPursuitLabel,
  formatReadinessLabel,
} from './recruitingBattleFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Same construction pattern as the domain battle-view tests: a Recruit actively
 * pursued by three known Programs, with the controlled Program Focused. */
function battleFixture(seed: string): {
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
      board: [{ playerId, isFocused: programId === controlledId, hasActiveOffer: true }],
    }
  }

  return {
    dynasty: { ...initial, recruiting: { ...recruiting, programs } },
    playerId,
    programIds,
  }
}

function withDecisionState(
  dynasty: DynastyState,
  playerId: string,
  programStandings: Readonly<Record<string, number>>,
  options: { readonly period?: number; readonly readyPeriod?: number } = {},
): DynastyState {
  const recruiting = dynasty.recruiting!
  const recruit = recruiting.recruits.find(({ player }) => player.id === playerId)!
  const nextRecruit = {
    ...recruit,
    decisionReadyPeriod: options.readyPeriod ?? 1,
    commitmentStandingThreshold: 100,
    commitmentSeparationThreshold: 5,
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

describe('Recruiting battle presentation formatters', () => {
  it('labels every readiness state without percentages or numeric estimates', () => {
    const states = ['not-deciding', 'decision-soon', 'developing', 'serious', 'decision-imminent', 'committed'] as const
    for (const readiness of states) {
      const label = formatReadinessLabel(readiness)
      expect(label).not.toMatch(/%/)
      expect(label).not.toMatch(/\d/)
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('labels leading/competitive/trailing distinctly', () => {
    expect(formatBattlePositionLabel('leading')).toBe('Leading')
    expect(formatBattlePositionLabel('competitive')).toBe('Competitive')
    expect(formatBattlePositionLabel('trailing')).toBe('Trailing')
  })

  it('labels controlled-Program commitment outcomes clearly and distinctly', () => {
    expect(formatControlledPositionLabel('committed-to-us')).toMatch(/us/i)
    expect(formatControlledPositionLabel('committed-elsewhere')).toMatch(/elsewhere/i)
    expect(formatControlledPositionLabel('committed-to-us')).not.toBe(
      formatControlledPositionLabel('committed-elsewhere'),
    )
  })

  it('derives a Focus target summary reflecting leading standing and Offer state', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-leading')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 80,
      [programIds[2]]: 75,
    })
    const board = deriveProgramRecruitingBoard(configured, configured.controlledProgramId)
    const [summary] = deriveFocusTargetSummaries(configured, board)

    expect(summary).toBeDefined()
    expect(summary!.playerId).toBe(playerId)
    expect(summary!.battle.controlled.position).toBe('leading')
    expect(summary!.battle.controlled.isFocused).toBe(true)
    expect(summary!.battle.controlled.hasActiveOffer).toBe(true)
  })

  it('groups the controlled Program inside its own actual standing, not a fixed row', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-leading-group')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 90,
      [programIds[2]]: 70,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    const controlledProgram = PROGRAMS_BY_ID.get(configured.controlledProgramId)!
    const { groups, overflowCount } = deriveBattleGroups(
      battle,
      controlledProgram,
      PROGRAMS_BY_ID,
    )

    expect(overflowCount).toBe(0)
    const leadingGroup = groups.find((group) => group.position === 'leading')!
    expect(leadingGroup.rows.map((row) => row.programId)).toEqual([programIds[0]])
    expect(leadingGroup.rows[0]!.isControlled).toBe(true)
    // No empty groups render.
    expect(groups.every((group) => group.rows.length > 0)).toBe(true)
  })

  it('places the controlled Program in the trailing group when it is trailing, not the leading group', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-trailing-group')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 60,
      [programIds[1]]: 100,
      [programIds[2]]: 90,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    const controlledProgram = PROGRAMS_BY_ID.get(configured.controlledProgramId)!
    const { groups } = deriveBattleGroups(battle, controlledProgram, PROGRAMS_BY_ID)

    const controlledGroup = groups.find((group) =>
      group.rows.some((row) => row.isControlled),
    )!
    expect(controlledGroup.position).toBe('trailing')
    const leadingGroup = groups.find((group) => group.position === 'leading')!
    expect(leadingGroup.rows.every((row) => !row.isControlled)).toBe(true)
  })

  it('never pushes the controlled Program into the overflow count, even when it would exceed the cap', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-overflow')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 90,
      [programIds[2]]: 60,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    const controlledProgram = PROGRAMS_BY_ID.get(configured.controlledProgramId)!
    // A limit of 0 forces every competitor into overflow — the controlled
    // Program (which is the leader here) must still appear in a group.
    const { groups, overflowCount } = deriveBattleGroups(
      battle,
      controlledProgram,
      PROGRAMS_BY_ID,
      0,
    )
    const totalCompetitors = battle.pursuingPrograms.filter(
      (entry) => entry.programId !== controlledProgram.id,
    ).length

    expect(overflowCount).toBe(totalCompetitors)
    const allRows = groups.flatMap((group) => group.rows)
    expect(allRows.some((row) => row.isControlled)).toBe(true)
    expect(allRows.every((row) => row.isControlled)).toBe(true)
  })

  it('never exposes raw attraction, relationship, or threshold fields through the grouped view-model', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-hidden')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 90,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    const controlledProgram = PROGRAMS_BY_ID.get(configured.controlledProgramId)!
    const { groups } = deriveBattleGroups(battle, controlledProgram, PROGRAMS_BY_ID)

    for (const row of groups.flatMap((group) => group.rows)) {
      expect(Object.keys(row).sort()).toEqual(
        ['accentColor', 'hasActiveOffer', 'isControlled', 'programId', 'programName'].sort(),
      )
    }
  })

  it('surfaces the controlled Program pursuit rank and field size from the existing projection', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-pursuit-rank')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 70,
      [programIds[1]]: 100,
      [programIds[2]]: 90,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)

    const controlledEntry = battle.pursuingPrograms.find(
      (entry) => entry.programId === programIds[0],
    )!
    // The controlled Program has the lowest configured standing among the
    // three explicitly ranked pursuers, so it cannot rank first.
    expect(controlledEntry.pursuitRank).toBeGreaterThan(1)

    const label = formatControlledPursuitLabel(battle, programIds[0], false, false)
    expect(label).toBe(
      `YOU · #${controlledEntry.pursuitRank} of ${battle.pursuingPrograms.length}`,
    )
  })

  it('includes Focused/Offered metadata alongside the pursuit rank without dropping either', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-pursuit-rank-meta')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 100,
      [programIds[1]]: 90,
      [programIds[2]]: 80,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    // The controlled Program has the highest configured standing, so it leads.
    const total = battle.pursuingPrograms.length

    expect(formatControlledPursuitLabel(battle, programIds[0], true, true)).toBe(
      `YOU · #1 of ${total} · Focused · Offered`,
    )
    expect(formatControlledPursuitLabel(battle, programIds[0], false, false)).toBe(
      `YOU · #1 of ${total}`,
    )
  })

  it('omits the pursuit rank when the controlled Program is not currently pursuing', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-pursuit-rank-absent')
    const recruiting = dynasty.recruiting!
    const withoutControlled: DynastyState = {
      ...dynasty,
      recruiting: {
        ...recruiting,
        programs: {
          ...recruiting.programs,
          [programIds[0]]: { ...recruiting.programs[programIds[0]]!, board: [] },
        },
      },
    }
    const battle = deriveRecruitingBattleView(withoutControlled, playerId)

    expect(battle.pursuingPrograms.some((entry) => entry.programId === programIds[0])).toBe(false)
    expect(formatControlledPursuitLabel(battle, programIds[0], false, false)).toBe('YOU')
  })

  it('never renders raw standing totals, thresholds, or probabilities alongside the pursuit rank', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-pursuit-rank-hidden')
    const configured = withDecisionState(dynasty, playerId, {
      [programIds[0]]: 70,
      [programIds[1]]: 100,
      [programIds[2]]: 90,
    })
    const battle = deriveRecruitingBattleView(configured, playerId)
    const label = formatControlledPursuitLabel(battle, programIds[0], false, false)

    expect(label).not.toMatch(/%/)
    expect(label).not.toMatch(/\d+\.\d/)
    expect(label).toMatch(/^YOU · #\d+ of \d+$/)
  })

  it('joins provable commitment activity with identity without inventing standing movement', () => {
    const { dynasty, playerId, programIds } = battleFixture('formatters-activity')
    const commitment = {
      playerId,
      programId: programIds[1],
      timing: { kind: 'period' as const, period: 4 },
      targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
    }
    const withCommitment: DynastyState = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        commitmentsByPlayerId: { [playerId]: commitment },
      },
    }

    const descriptions = deriveRecruitingActivityDescriptions(withCommitment, 3, PROGRAMS_BY_ID)
    expect(descriptions).toHaveLength(1)
    expect(descriptions[0]).toMatchObject({
      playerId,
      kind: 'tracked-committed-elsewhere',
      programName: PROGRAMS_BY_ID.get(programIds[1])!.name,
      wasFocused: true,
    })
    for (const key of Object.keys(descriptions[0]!)) {
      expect(key).not.toMatch(/standing|attraction|threshold|probability|utility/i)
    }

    // Nothing before the supplied period baseline: no false activity leaks through.
    expect(deriveRecruitingActivityDescriptions(withCommitment, 4, PROGRAMS_BY_ID)).toEqual([])
  })
})
