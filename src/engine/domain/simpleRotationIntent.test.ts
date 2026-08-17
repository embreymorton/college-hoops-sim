import { describe, expect, it } from 'vitest'
import { generateDefaultRotationV1, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  compileSimpleRotationIntent,
  fillSimpleRotationIntent,
  derivePlayerMinutesV1,
  POSITIONS,
  validateRotationV1,
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

function team(roster: Player[]): Team {
  return {
    id: 'simple-rotation-intent-team',
    name: 'Simple Rotation Intent',
    abbreviation: 'SRI',
    prestige: 50,
    roster,
  }
}

function expectExactIntent(
  result: ReturnType<typeof compileSimpleRotationIntent>,
  expected: Readonly<Record<string, number>>,
  sourceTeam: Team,
): RotationV1 {
  expect(result.valid).toBe(true)
  if (!result.valid) throw new Error('Expected simple intent to compile.')

  expect(validateRotationV1(sourceTeam, result.rotation)).toEqual({
    valid: true,
    issues: [],
  })
  expect(derivePlayerMinutesV1(result.rotation)).toEqual(expected)

  for (const position of POSITIONS) {
    expect(
      Object.values(result.rotation.minutesByPosition[position]).reduce(
        (sum, minutes) => sum + minutes,
        0,
      ),
    ).toBe(40)
  }

  return result.rotation
}

describe('compileSimpleRotationIntent', () => {
  it('compiles a natural-position-only 200-minute intent', () => {
    const sourceTeam = team(POSITIONS.map((position) => player(position, position)))
    const intent = Object.fromEntries(POSITIONS.map((position) => [position, 40]))
    const rotation = expectExactIntent(
      compileSimpleRotationIntent(sourceTeam, intent),
      intent,
      sourceTeam,
    )

    for (const position of POSITIONS) {
      expect(rotation.minutesByPosition[position]).toEqual({ [position]: 40 })
    }
  })

  it('uses a secondary position when it is required for legal coverage', () => {
    const sourceTeam = team([
      player('pg', 'PG'),
      player('sg', 'SG'),
      player('sf', 'SF'),
      player('pf-natural', 'PF'),
      player('pf-at-center', 'PF'),
    ])
    const intent = {
      pg: 40,
      sg: 40,
      sf: 40,
      'pf-natural': 40,
      'pf-at-center': 40,
    }
    const rotation = expectExactIntent(
      compileSimpleRotationIntent(sourceTeam, intent),
      intent,
      sourceTeam,
    )

    expect(rotation.minutesByPosition.C).toEqual(
      expect.objectContaining({
        [Object.keys(rotation.minutesByPosition.C)[0]!]: 40,
      }),
    )
    expect(
      Object.keys(rotation.minutesByPosition.C).every((playerId) =>
        playerId.startsWith('pf-'),
      ),
    ).toBe(true)
  })

  it('globally prefers natural assignments and uses only necessary secondary minutes', () => {
    const sourceTeam = team([
      player('pg-a', 'PG'),
      player('pg-b', 'PG'),
      player('sg', 'SG'),
      player('sf', 'SF'),
      player('pf', 'PF'),
      player('c', 'C'),
    ])
    const intent = {
      'pg-a': 20,
      'pg-b': 20,
      sg: 40,
      sf: 40,
      pf: 40,
      c: 40,
    }
    const rotation = expectExactIntent(
      compileSimpleRotationIntent(sourceTeam, intent),
      intent,
      sourceTeam,
    )

    expect(rotation.minutesByPosition.PG).toEqual({ 'pg-a': 20, 'pg-b': 20 })
    expect(rotation.minutesByPosition.SG).toEqual({ sg: 40 })
    expect(
      POSITIONS.reduce(
        (total, position) =>
          total + Object.entries(rotation.minutesByPosition[position])
            .filter(([playerId]) =>
              sourceTeam.roster.find((candidate) => candidate.id === playerId)!
                .position !== position,
            )
            .reduce((sum, [, minutes]) => sum + minutes, 0),
        0,
      ),
    ).toBe(0)
  })

  it('is deterministic for a realistic flexible production-style roster', () => {
    const sourceTeam = generateTeam({
      name: 'Flexible Intent',
      abbreviation: 'FLX',
      prestige: 72,
      rng: createRng('simple-rotation-intent-flexible'),
    })
    const canonical = generateDefaultRotationV1(sourceTeam)
    const intent = derivePlayerMinutesV1(canonical)

    const first = compileSimpleRotationIntent(sourceTeam, intent)
    const second = compileSimpleRotationIntent(sourceTeam, intent)

    expect(first).toEqual(second)
    expectExactIntent(first, intent, sourceTeam)
  })

  it.each([198, 204])('rejects a temporary %i-minute draft without compiling', (total) => {
    const sourceTeam = team(POSITIONS.map((position) => player(position, position)))
    const result = compileSimpleRotationIntent(sourceTeam, {
      PG: total - 160,
      SG: 40,
      SF: 40,
      PF: 40,
      C: 40,
    })

    expect(result.valid).toBe(false)
    expect(result.rotation).toBeNull()
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_TOTAL_MINUTES',
        actual: total,
        expected: 200,
      }),
    )
  })

  it('fails cleanly when 200 minutes cannot cover all floor positions', () => {
    const sourceTeam = team(
      Array.from({ length: 5 }, (_, index) => player(`pg-${index}`, 'PG')),
    )
    const intent = Object.fromEntries(
      sourceTeam.roster.map((candidate) => [candidate.id, 40]),
    )
    const result = compileSimpleRotationIntent(sourceTeam, intent)

    expect(result.valid).toBe(false)
    expect(result.rotation).toBeNull()
    expect(result.issues.some(({ code }) => code === 'INFEASIBLE_POSITION_COVERAGE')).toBe(true)
  })

  it('reports unknown Players and existing per-Player minute limits', () => {
    const sourceTeam = team(POSITIONS.map((position) => player(position, position)))
    const result = compileSimpleRotationIntent(sourceTeam, {
      PG: 41,
      SG: 40,
      SF: 40,
      PF: 40,
      C: 39,
      unknown: 0,
    })

    expect(result.valid).toBe(false)
    expect(result.rotation).toBeNull()
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_PLAYER_MINUTES', playerId: 'PG' }),
      expect.objectContaining({ code: 'UNKNOWN_PLAYER', playerId: 'unknown' }),
    ]))
  })

  it('round-trips aggregate minutes for many generated legal Rotations', () => {
    for (let index = 0; index < 32; index += 1) {
      const sourceTeam = generateTeam({
        name: `Round Trip ${index}`,
        abbreviation: `R${index}`,
        prestige: 1 + ((index * 17) % 100),
        rng: createRng(`simple-rotation-round-trip:${index}`),
      })
      const intent = derivePlayerMinutesV1(generateDefaultRotationV1(sourceTeam))

      expectExactIntent(
        compileSimpleRotationIntent(sourceTeam, intent),
        intent,
        sourceTeam,
      )
    }
  })
})

describe('fillSimpleRotationIntent', () => {
  it('preserves one edited star exactly and fills a legal deterministic draft', () => {
    const sourceTeam = generateTeam({
      name: 'Preserve One',
      abbreviation: 'ONE',
      prestige: 70,
      rng: createRng('preserve-one'),
    })
    const current = derivePlayerMinutesV1(generateDefaultRotationV1(sourceTeam))
    const star = [...sourceTeam.roster].sort((a, b) => a.id.localeCompare(b.id))[0]!
    const preserved = { [star.id]: 36 }

    const first = fillSimpleRotationIntent(sourceTeam, current, preserved)
    const second = fillSimpleRotationIntent(sourceTeam, current, preserved)

    expect(first).toEqual(second)
    expect(first.valid).toBe(true)
    if (!first.valid) throw new Error('Expected fill to succeed.')
    expect(derivePlayerMinutesV1(first.rotation)[star.id]).toBe(36)
    expect(validateRotationV1(sourceTeam, first.rotation).valid).toBe(true)
  })

  it('handles no preserved values and several preserved values including zero', () => {
    const sourceTeam = team(POSITIONS.flatMap((position) => [
      player(`${position}-a`, position),
      player(`${position}-b`, position),
    ]))
    const current = Object.fromEntries(sourceTeam.roster.map((candidate) => [candidate.id, 20]))
    const none = fillSimpleRotationIntent(sourceTeam, current, {})
    expect(none.valid).toBe(true)

    const preserved = { 'PG-a': 40, 'SG-a': 32, 'SF-b': 0 }
    const several = fillSimpleRotationIntent(sourceTeam, current, preserved)
    expect(several.valid).toBe(true)
    if (!several.valid) throw new Error('Expected preserved fill to succeed.')
    const totals = derivePlayerMinutesV1(several.rotation)
    expect(totals['PG-a']).toBe(40)
    expect(totals['SG-a']).toBe(32)
    expect(totals['SF-b'] ?? 0).toBe(0)
  })

  it('accepts preserved values already totaling 200 when they are legal', () => {
    const sourceTeam = team(POSITIONS.map((position) => player(position, position)))
    const preserved = Object.fromEntries(POSITIONS.map((position) => [position, 40]))
    expect(fillSimpleRotationIntent(sourceTeam, preserved, preserved).valid).toBe(true)
  })

  it('rejects totals above 200, invalid values, and unknown IDs', () => {
    const sourceTeam = team(POSITIONS.map((position) => player(position, position)))
    const result = fillSimpleRotationIntent(sourceTeam, {}, {
      PG: 41,
      SG: 40,
      SF: 40,
      PF: 40,
      C: 40,
      unknown: -1,
    })
    expect(result.valid).toBe(false)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'INVALID_PLAYER_MINUTES', playerId: 'PG' }),
      expect.objectContaining({ code: 'UNKNOWN_PLAYER', playerId: 'unknown' }),
    ]))
  })

  it('reports impossible positional coverage without changing preserved intent', () => {
    const sourceTeam = team([
      player('pg', 'PG'), player('sg', 'SG'), player('sf', 'SF'),
      player('pf', 'PF'), player('c', 'C'),
    ])
    const result = fillSimpleRotationIntent(sourceTeam, {}, {
      pg: 40, sg: 40, sf: 40, pf: 40, c: 0,
    })
    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(expect.objectContaining({
      code: 'INFEASIBLE_POSITION_COVERAGE',
    }))
  })
})
