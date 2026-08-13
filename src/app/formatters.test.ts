import { describe, expect, it } from 'vitest'
import type { RotationV1, SimpleRotationIntentIssue, Team } from '../engine'
import {
  describeMinutesBudgetHint,
  describeSimpleRotationIssues,
  deriveSimplePlayerMinutes,
} from './formatters'

describe('describeMinutesBudgetHint', () => {
  it('returns null once the total matches the target', () => {
    expect(describeMinutesBudgetHint(200, 200)).toBeNull()
  })

  it('describes an under-budget draft as minutes to assign', () => {
    expect(describeMinutesBudgetHint(198, 200)).toBe('Assign 2 more minutes')
  })

  it('describes an over-budget draft as minutes to remove', () => {
    expect(describeMinutesBudgetHint(204, 200)).toBe('Remove 4 minutes')
  })

  it('uses singular phrasing for exactly one minute', () => {
    expect(describeMinutesBudgetHint(199, 200)).toBe('Assign 1 more minute')
    expect(describeMinutesBudgetHint(201, 200)).toBe('Remove 1 minute')
  })
})

describe('describeSimpleRotationIssues', () => {
  it('returns no messages for an empty issue list', () => {
    expect(describeSimpleRotationIssues([])).toEqual([])
  })

  it('never surfaces the raw INFEASIBLE_POSITION_COVERAGE code', () => {
    const issues: SimpleRotationIntentIssue[] = [
      {
        code: 'INFEASIBLE_POSITION_COVERAGE',
        message: 'raw engine message',
        position: 'C',
        actual: 20,
        expected: 40,
      },
    ]

    const messages = describeSimpleRotationIssues(issues)
    expect(messages).toHaveLength(1)
    expect(messages[0]).not.toContain('INFEASIBLE_POSITION_COVERAGE')
    expect(messages[0]).toMatch(/can't cover every position/)
    expect(messages[0]).toContain('(C)')
  })

  it('falls back to a generic message for unexpected compiler issues', () => {
    const issues: SimpleRotationIntentIssue[] = [
      {
        code: 'UNKNOWN_PLAYER',
        message: 'raw engine message',
        playerId: 'ghost',
      },
    ]

    const messages = describeSimpleRotationIssues(issues)
    expect(messages).toHaveLength(1)
    expect(messages[0]).not.toContain('UNKNOWN_PLAYER')
  })
})

describe('deriveSimplePlayerMinutes', () => {
  it('includes every roster Player with an explicit zero when unassigned', () => {
    const team: Team = {
      id: 'team-1',
      name: 'Fixture',
      abbreviation: 'FIX',
      prestige: 60,
      roster: [
        {
          id: 'p1',
          firstName: 'P',
          lastName: 'One',
          position: 'PG',
          classYear: 'JR',
          height: 74,
          attributes: {
            finishing: 70,
            shooting: 70,
            playmaking: 70,
            ballHandling: 70,
            perimeterDefense: 70,
            interiorDefense: 70,
            rebounding: 70,
            athleticism: 70,
            stamina: 70,
          },
          potential: 90,
        },
      ],
    }
    const rotation: RotationV1 = {
      minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} },
    }

    expect(deriveSimplePlayerMinutes(team, rotation)).toEqual({ p1: 0 })
  })
})
