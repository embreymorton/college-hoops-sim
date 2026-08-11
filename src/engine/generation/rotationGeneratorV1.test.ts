import { describe, expect, it } from 'vitest'
import {
  calculateTeamStrength,
  convertRotationV0ToV1,
  derivePlayerMinutesV1,
  POSITIONS,
  validateRotationV1,
  type Player,
  type PlayerAttributes,
  type Position,
  type Team,
} from '../domain'
import { generateDefaultRotation } from './rotationGenerator'
import { generateDefaultRotationV1 } from './rotationGeneratorV1'

function attributesAt(rating: number): PlayerAttributes {
  return {
    finishing: rating,
    shooting: rating,
    playmaking: rating,
    ballHandling: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    rebounding: rating,
    athleticism: rating,
    stamina: rating,
  }
}

function makePlayer(id: string, position: Position, rating: number): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes: attributesAt(rating),
    potential: Math.max(rating, 90),
  }
}

function makeTeam(
  replacements: Partial<Record<Position, readonly Player[]>> = {},
): Team {
  return {
    id: 'rotation-v1-generator-fixture',
    name: 'Rotation V1 Generator',
    abbreviation: 'RVG',
    prestige: 60,
    roster: POSITIONS.flatMap(
      (position) =>
        replacements[position] ??
        [makePlayer(`${position}-default`, position, 75)],
    ),
  }
}

function congestionTeam(
  sourcePosition: Position,
  floorPosition: Position,
): Team {
  return makeTeam({
    [sourcePosition]: [
      makePlayer(`${sourcePosition}-starter`, sourcePosition, 99),
      makePlayer(`${sourcePosition}-upgrade`, sourcePosition, 70),
    ],
    [floorPosition]: [
      makePlayer(`${floorPosition}-incumbent-a`, floorPosition, 60),
      makePlayer(`${floorPosition}-incumbent-b`, floorPosition, 60),
    ],
  })
}

describe('generateDefaultRotationV1', () => {
  it('preserves the converted V0 rotation when no clear upgrade exists', () => {
    const team = makeTeam(
      Object.fromEntries(
        POSITIONS.map((position) => [
          position,
          [
            makePlayer(`${position}-a`, position, 76),
            makePlayer(`${position}-b`, position, 75),
          ],
        ]),
      ),
    )
    const baseline = convertRotationV0ToV1(
      team,
      generateDefaultRotation(team),
    )

    expect(generateDefaultRotationV1(team)).toEqual(baseline)
  })

  it.each([
    ['PG', 'SG'],
    ['SG', 'SF'],
    ['SF', 'PF'],
    ['PF', 'C'],
    ['C', 'PF'],
  ] as const)(
    'uses a meaningful legal %s -> %s upgrade',
    (sourcePosition, floorPosition) => {
      const team = congestionTeam(sourcePosition, floorPosition)
      const baseline = generateDefaultRotation(team)
      const rotation = generateDefaultRotationV1(team)
      const secondaryIds = Object.keys(
        rotation.minutesByPosition[floorPosition],
      ).filter(
        (playerId) =>
          team.roster.find((player) => player.id === playerId)?.position ===
          sourcePosition,
      )

      expect(validateRotationV1(team, rotation)).toEqual({
        valid: true,
        issues: [],
      })
      expect(secondaryIds.length).toBeGreaterThan(0)
      expect(
        secondaryIds.reduce(
          (total, playerId) =>
            total +
            (rotation.minutesByPosition[floorPosition][playerId] ?? 0),
          0,
        ),
      ).toBeGreaterThan(0)
      expect(calculateTeamStrength(team, rotation).overall).toBeGreaterThan(
        calculateTeamStrength(team, baseline).overall,
      )
      expect(
        Object.values(rotation.minutesByPosition[floorPosition]).reduce(
          (total, minutes) => total + minutes,
          0,
        ),
      ).toBe(40)
      expect(
        Math.max(...Object.values(derivePlayerMinutesV1(rotation))),
      ).toBeLessThanOrEqual(40)
    },
  )

  it('does not automatically turn a natural 36-minute star into a 40-minute Player', () => {
    const star = makePlayer('PG-star', 'PG', 99)
    const team = makeTeam({
      PG: [star, makePlayer('PG-backup', 'PG', 50)],
      SG: [
        makePlayer('SG-incumbent-a', 'SG', 60),
        makePlayer('SG-incumbent-b', 'SG', 60),
      ],
    })
    const baseline = generateDefaultRotation(team)
    const rotation = generateDefaultRotationV1(team)
    const totals = derivePlayerMinutesV1(rotation)

    expect(baseline.minutes[star.id]).toBe(36)
    expect(rotation.minutesByPosition.SG[star.id]).toBeUndefined()
    expect(totals[star.id]).toBe(36)
    expect(validateRotationV1(team, rotation).valid).toBe(true)
  })

  it('lets useful buried secondary talent absorb a weak backup role', () => {
    const usefulPg = makePlayer('PG-useful-secondary', 'PG', 85)
    const team = makeTeam({
      PG: [makePlayer('PG-starter', 'PG', 96), usefulPg],
      SG: [
        makePlayer('SG-good-starter', 'SG', 79),
        makePlayer('SG-weak-backup', 'SG', 62),
      ],
      SF: [makePlayer('SF-elite', 'SF', 99), makePlayer('SF-backup', 'SF', 75)],
      PF: [makePlayer('PF-elite', 'PF', 98), makePlayer('PF-backup', 'PF', 75)],
      C: [makePlayer('C-elite', 'C', 97), makePlayer('C-backup', 'C', 75)],
    })
    const natural = generateDefaultRotation(team)
    const rotation = generateDefaultRotationV1(team)
    const totals = derivePlayerMinutesV1(rotation)

    expect(natural.minutes['SG-good-starter']).toBe(32)
    expect(natural.minutes['SG-weak-backup']).toBe(8)
    expect(natural.minutes[usefulPg.id]).toBe(8)
    expect(rotation.minutesByPosition.SG[usefulPg.id]).toBe(8)
    expect(rotation.minutesByPosition.SG['SG-weak-backup']).toBeUndefined()
    expect(totals[usefulPg.id]).toBe(16)
    expect(validateRotationV1(team, rotation).valid).toBe(true)
  })

  it('does not substitute for a below-five-point improvement', () => {
    const team = makeTeam({
      PG: [
        makePlayer('PG-slight-a', 'PG', 78),
        makePlayer('PG-slight-b', 'PG', 77),
      ],
      SG: [
        makePlayer('SG-close-a', 'SG', 75),
        makePlayer('SG-close-b', 'SG', 74),
      ],
    })
    const baseline = convertRotationV0ToV1(
      team,
      generateDefaultRotation(team),
    )

    expect(generateDefaultRotationV1(team)).toEqual(baseline)
  })

  it('does not assign a tempting but ineligible Center to SF', () => {
    const team = makeTeam({
      SF: [
        makePlayer('SF-starter', 'SF', 75),
        makePlayer('SF-weak', 'SF', 55),
      ],
      PF: [makePlayer('PF-blocker', 'PF', 99)],
      C: [
        makePlayer('C-tempting-a', 'C', 99),
        makePlayer('C-tempting-b', 'C', 98),
      ],
    })
    const rotation = generateDefaultRotationV1(team)

    expect(Object.keys(rotation.minutesByPosition.SF)).not.toContain(
      'C-tempting-a',
    )
    expect(Object.keys(rotation.minutesByPosition.SF)).not.toContain(
      'C-tempting-b',
    )
    expect(validateRotationV1(team, rotation).valid).toBe(true)
  })

  it('is deterministic and does not mutate Team or shared Players', () => {
    const team = congestionTeam('SG', 'SF')
    const before = structuredClone(team)
    const first = generateDefaultRotationV1(team)

    expect(generateDefaultRotationV1(team)).toEqual(first)
    expect(team).toEqual(before)
  })
})
