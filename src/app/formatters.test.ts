import { describe, expect, it } from 'vitest'
import {
  POSITIONS,
  type Player,
  type Position,
  type ProjectedStartingFive,
  type RotationV1,
  type SimpleRotationIntentIssue,
  type Team,
} from '../engine'
import {
  deriveSimpleRotationSections,
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

function makeSectionsPlayer(id: string, position: Position): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
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
  }
}

function makeSectionsTeam(): Team {
  return {
    id: 'sections-fixture',
    name: 'Sections Fixture',
    abbreviation: 'SEC',
    prestige: 60,
    roster: POSITIONS.flatMap((position) => [
      makeSectionsPlayer(`${position}-starter`, position),
      makeSectionsPlayer(`${position}-backup`, position),
    ]),
  }
}

function naturalSectionsStartingFive(): ProjectedStartingFive {
  return Object.fromEntries(
    POSITIONS.map((position) => [position, `${position}-starter`]),
  ) as ProjectedStartingFive
}

describe('deriveSimpleRotationSections', () => {
  it('places every projected starter, and only them, in starters, in PG → C order', () => {
    const team = makeSectionsTeam()
    const minutes = Object.fromEntries(team.roster.map((player) => [player.id, 20]))

    const sections = deriveSimpleRotationSections(
      team,
      minutes,
      naturalSectionsStartingFive(),
    )

    expect(sections.hasProjectedStartingFive).toBe(true)
    expect(sections.starters.map((starter) => starter.position)).toEqual([...POSITIONS])
    expect(sections.starters.map((starter) => starter.player.id)).toEqual(
      POSITIONS.map((position) => `${position}-starter`),
    )
  })

  it('keeps a projected starter out of Bench/Reserves even at 0 draft minutes', () => {
    const team = makeSectionsTeam()
    const minutes = Object.fromEntries(team.roster.map((player) => [player.id, 0]))

    const sections = deriveSimpleRotationSections(
      team,
      minutes,
      naturalSectionsStartingFive(),
    )

    expect(sections.bench).toHaveLength(0)
    expect(sections.reserves.map((player) => player.id)).not.toContain('PG-starter')
    expect(sections.starters.some((starter) => starter.player.id === 'PG-starter')).toBe(
      true,
    )
  })

  it('splits non-starters into Bench (MPG > 0) and Reserves (MPG === 0) from the current draft', () => {
    const team = makeSectionsTeam()
    const minutes = {
      ...Object.fromEntries(team.roster.map((player) => [player.id, 0])),
      'PG-backup': 12,
    }

    const sections = deriveSimpleRotationSections(
      team,
      minutes,
      naturalSectionsStartingFive(),
    )

    expect(sections.bench.map((player) => player.id)).toEqual(['PG-backup'])
    expect(sections.reserves.map((player) => player.id)).not.toContain('PG-backup')
  })

  it('orders Bench by descending draft MPG, breaking ties with roster order', () => {
    const team = makeSectionsTeam()
    const minutes = {
      ...Object.fromEntries(team.roster.map((player) => [player.id, 0])),
      'SG-backup': 6,
      'PF-backup': 6,
      'C-backup': 14,
    }

    const sections = deriveSimpleRotationSections(
      team,
      minutes,
      naturalSectionsStartingFive(),
    )

    expect(sections.bench.map((player) => player.id)).toEqual([
      'C-backup',
      'SG-backup',
      'PF-backup',
    ])
  })

  it('falls back to an empty starters list when no projection is available', () => {
    const team = makeSectionsTeam()
    const minutes = { ...Object.fromEntries(team.roster.map((player) => [player.id, 0])), 'PG-starter': 20 }

    const sections = deriveSimpleRotationSections(team, minutes, null)

    expect(sections.hasProjectedStartingFive).toBe(false)
    expect(sections.starters).toHaveLength(0)
    expect(sections.bench.map((player) => player.id)).toEqual(['PG-starter'])
  })
})
