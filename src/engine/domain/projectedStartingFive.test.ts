import { describe, expect, it } from 'vitest'
import { generateDefaultRotationV1, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  compileSimpleRotationIntent,
  derivePlayerMinutesV1,
  deriveProjectedStartingFive,
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type RotationV1,
  type Team,
} from './index'

function attributes(): PlayerAttributes {
  return {
    finishing: 70,
    shooting: 70,
    playmaking: 70,
    ballHandling: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    rebounding: 70,
    athleticism: 70,
    stamina: 70,
  }
}

function player(id: string, position: Position): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes: attributes(),
    potential: 80,
  }
}

function fixtureTeam(players: Player[]): Team {
  return {
    id: 'projected-five',
    name: 'Projected Five',
    abbreviation: 'PFV',
    prestige: 50,
    roster: players,
  }
}

function rotation(
  assignments: Partial<Record<Position, Record<string, number>>>,
): RotationV1 {
  return {
    minutesByPosition: Object.fromEntries(
      POSITIONS.map((position) => [position, assignments[position] ?? {}]),
    ) as RotationV1['minutesByPosition'],
  }
}

function expectFive(team: Team, source: RotationV1) {
  const result = deriveProjectedStartingFive(team, source)
  expect(result.valid).toBe(true)
  if (!result.valid) throw new Error('Expected a projected Starting Five.')
  expect(new Set(Object.values(result.startingFive))).toHaveLength(5)
  expect(Object.keys(result.startingFive)).toEqual(POSITIONS)
  return result.startingFive
}

describe('deriveProjectedStartingFive', () => {
  it('projects the straightforward natural five-position lineup', () => {
    const team = fixtureTeam(POSITIONS.map((position) => player(position, position)))
    const source = rotation(
      Object.fromEntries(POSITIONS.map((position) => [position, { [position]: 40 }])),
    )

    expect(expectFive(team, source)).toEqual({
      PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C',
    })
  })

  it('uses a global optimum when one dual-position Player leads two buckets', () => {
    const team = fixtureTeam([
      player('dual-pg', 'PG'),
      player('other-pg', 'PG'),
      player('other-sg', 'SG'),
      player('sf', 'SF'),
      player('pf', 'PF'),
      player('c', 'C'),
    ])
    const source = rotation({
      PG: { 'dual-pg': 15, 'other-pg': 25 },
      SG: { 'dual-pg': 25, 'other-sg': 15 },
      SF: { sf: 40 }, PF: { pf: 40 }, C: { c: 40 },
    })

    expect(expectFive(team, source)).toEqual({
      PG: 'other-pg', SG: 'dual-pg', SF: 'sf', PF: 'pf', C: 'c',
    })
  })

  it('follows actual positional usage rather than total MPG or natural label alone', () => {
    const team = fixtureTeam([
      player('natural-sg', 'SG'),
      player('used-at-sg', 'PG'),
      player('other-pg', 'PG'),
      player('sf', 'SF'), player('pf', 'PF'), player('c', 'C'),
    ])
    const source = rotation({
      PG: { 'other-pg': 40 },
      SG: { 'used-at-sg': 30, 'natural-sg': 10 },
      SF: { sf: 40 }, PF: { pf: 40 }, C: { c: 40 },
    })

    expect(expectFive(team, source).SG).toBe('used-at-sg')
  })

  it('prefers natural assignments when represented positional minutes tie', () => {
    const team = fixtureTeam([
      player('dual', 'PG'), player('other-pg', 'PG'), player('natural-sg', 'SG'),
      player('sf', 'SF'), player('pf', 'PF'), player('c', 'C'),
    ])
    const source = rotation({
      PG: { dual: 20, 'other-pg': 20 },
      SG: { dual: 20, 'natural-sg': 20 },
      SF: { sf: 40 }, PF: { pf: 40 }, C: { c: 40 },
    })

    expect(expectFive(team, source)).toEqual({
      PG: 'dual', SG: 'natural-sg', SF: 'sf', PF: 'pf', C: 'c',
    })
  })

  it('prefers higher aggregate Player minutes after positional and natural ties', () => {
    const team = fixtureTeam([
      player('pg-more-total', 'PG'), player('pg-less-total', 'PG'),
      player('sg', 'SG'), player('sf', 'SF'), player('pf', 'PF'), player('c', 'C'),
    ])
    const source = rotation({
      PG: { 'pg-more-total': 20, 'pg-less-total': 20 },
      SG: { 'pg-more-total': 10, sg: 30 },
      SF: { sg: 10, sf: 30 },
      PF: { pf: 40 }, C: { c: 40 },
    })

    expect(expectFive(team, source).PG).toBe('pg-more-total')
  })

  it('uses stable Player ID as the final repeatable tie-break', () => {
    const team = fixtureTeam([
      player('pg-a', 'PG'), player('pg-b', 'PG'), player('sg', 'SG'),
      player('sf', 'SF'), player('pf', 'PF'), player('c', 'C'),
    ])
    const source = rotation({
      PG: { 'pg-b': 20, 'pg-a': 20 }, SG: { sg: 40 }, SF: { sf: 40 },
      PF: { pf: 40 }, C: { c: 40 },
    })

    const first = deriveProjectedStartingFive(team, source)
    expect(first).toEqual(deriveProjectedStartingFive(team, source))
    expect(first.valid && first.startingFive.PG).toBe('pg-a')
  })

  it('returns structured failure rather than projecting from invalid Rotation', () => {
    const team = fixtureTeam(POSITIONS.map((position) => player(position, position)))
    const result = deriveProjectedStartingFive(team, rotation({
      PG: { PG: 39 }, SG: { SG: 40 }, SF: { SF: 40 }, PF: { PF: 40 }, C: { C: 40 },
    }))

    expect(result).toMatchObject({
      valid: false,
      startingFive: null,
      issues: [{ code: 'INVALID_ROTATION' }],
    })
  })

  it('derives complete unique fives for generated defaults and compiled totals', () => {
    for (let index = 0; index < 64; index += 1) {
      const team = generateTeam({
        name: `Projected ${index}`,
        abbreviation: `P${index}`,
        prestige: 1 + ((index * 19) % 100),
        rng: createRng(`projected-starting-five:${index}`),
      })
      const defaultRotation = generateDefaultRotationV1(team)
      expectFive(team, defaultRotation)

      const compiled = compileSimpleRotationIntent(
        team,
        derivePlayerMinutesV1(defaultRotation),
      )
      expect(compiled.valid).toBe(true)
      if (compiled.valid) expectFive(team, compiled.rotation)
    }
  })
})
