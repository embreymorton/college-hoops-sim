import { describe, expect, it } from 'vitest'
import { generateDefaultRotation, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  calculatePlayerMinutesV1,
  convertRotationV0ToV1,
  derivePlayerMinutesV1,
  getEligibleRotationPositions,
  POSITIONS,
  validateRotationV1,
  type Position,
  type RotationV1,
} from './index'

function makeTeam() {
  return generateTeam({
    name: 'Rotation V1 State',
    abbreviation: 'RV1',
    prestige: 60,
    rng: createRng('rotation-v1-domain-team'),
  })
}

function makeNaturalRotationV1(): RotationV1 {
  const team = makeTeam()

  return {
    minutesByPosition: Object.fromEntries(
      POSITIONS.map((position) => [
        position,
        {
          [team.roster.find((player) => player.position === position)!.id]:
            40,
        },
      ]),
    ) as RotationV1['minutesByPosition'],
  }
}

function cloneRotationV1(rotation: RotationV1): RotationV1 {
  return JSON.parse(JSON.stringify(rotation)) as RotationV1
}

function playerIdAt(rotation: RotationV1, position: Position): string {
  return Object.keys(rotation.minutesByPosition[position])[0] as string
}

describe('Rotation V1 domain foundation', () => {
  it('derives fixed secondary eligibility from natural position', () => {
    const team = makeTeam()
    const expected: Record<Position, readonly Position[]> = {
      PG: ['PG', 'SG'],
      SG: ['SG', 'SF'],
      SF: ['SF', 'PF'],
      PF: ['PF', 'C'],
      C: ['C', 'PF'],
    }

    for (const position of POSITIONS) {
      const player = team.roster.find(
        (candidate) => candidate.position === position,
      )!

      expect(getEligibleRotationPositions(player)).toEqual(expected[position])
    }
  })

  it('validates a natural-position-only 40-per-position, 200-minute rotation', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()

    expect(validateRotationV1(team, rotation)).toEqual({
      valid: true,
      issues: [],
    })
    expect(Object.values(derivePlayerMinutesV1(rotation))).toEqual(
      expect.arrayContaining([40, 40, 40, 40, 40]),
    )
  })

  it('allows secondary assignments and natural-secondary minute splits', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()
    const powerForwardId = playerIdAt(rotation, 'PF')
    const centerId = playerIdAt(rotation, 'C')

    rotation.minutesByPosition.PF = {
      [powerForwardId]: 24,
      [centerId]: 16,
    }
    rotation.minutesByPosition.C = {
      [centerId]: 24,
      [powerForwardId]: 16,
    }

    expect(validateRotationV1(team, rotation)).toEqual({
      valid: true,
      issues: [],
    })
    expect(calculatePlayerMinutesV1(rotation, powerForwardId)).toBe(40)
    expect(calculatePlayerMinutesV1(rotation, centerId)).toBe(40)
  })

  it.each([
    ['below', 39],
    ['above', 41],
  ])('rejects a floor position %s 40 minutes', (_label, minutes) => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()

    rotation.minutesByPosition.PG[playerIdAt(rotation, 'PG')] = minutes
    const result = validateRotationV1(team, rotation)

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_POSITION_TOTAL',
        position: 'PG',
        actual: minutes,
        expected: 40,
      }),
    )
  })

  it('rejects a Player above 40 aggregate minutes across floor positions', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()
    const powerForwardId = playerIdAt(rotation, 'PF')
    const centerId = playerIdAt(rotation, 'C')

    rotation.minutesByPosition.PF = {
      [powerForwardId]: 21,
      [centerId]: 19,
    }
    rotation.minutesByPosition.C = {
      [centerId]: 20,
      [powerForwardId]: 20,
    }

    expect(validateRotationV1(team, rotation).issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PLAYER_TOTAL',
        playerId: powerForwardId,
        actual: 41,
        expected: 40,
      }),
    )
  })

  it('rejects an illegal cross-position assignment', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()
    const pointGuardId = playerIdAt(rotation, 'PG')
    const centerId = playerIdAt(rotation, 'C')

    rotation.minutesByPosition.PG = { [centerId]: 40 }

    expect(validateRotationV1(team, rotation).issues).toContainEqual(
      expect.objectContaining({
        code: 'INELIGIBLE_POSITION',
        playerId: centerId,
        position: 'PG',
      }),
    )
    expect(pointGuardId).not.toBe(centerId)
  })

  it('rejects unknown IDs, including zero-minute assignments', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()

    rotation.minutesByPosition.SG['unknown-player'] = 0

    expect(validateRotationV1(team, rotation).issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_PLAYER',
        playerId: 'unknown-player',
        position: 'SG',
      }),
    )
  })

  it.each([
    ['negative', -1],
    ['not finite', Number.POSITIVE_INFINITY],
    ['NaN', Number.NaN],
  ])('rejects %s assignment minutes', (_label, minutes) => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()
    const shootingGuardId = playerIdAt(rotation, 'SG')

    rotation.minutesByPosition.SG[shootingGuardId] = minutes

    expect(validateRotationV1(team, rotation).issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PLAYER_MINUTES',
        playerId: shootingGuardId,
        position: 'SG',
      }),
    )
  })

  it('reports a missing floor-position assignment object safely', () => {
    const team = makeTeam()
    const malformed = makeNaturalRotationV1() as unknown as {
      minutesByPosition: Partial<RotationV1['minutesByPosition']>
    }

    delete malformed.minutesByPosition.SF
    const result = validateRotationV1(team, malformed as RotationV1)

    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_STRUCTURE',
        position: 'SF',
      }),
    )
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_POSITION_TOTAL',
        position: 'SF',
        actual: 0,
      }),
    )
  })

  it('losslessly and deterministically converts valid V0 without mutation', () => {
    const team = makeTeam()
    const rotationV0 = generateDefaultRotation(team)
    const teamBefore = JSON.parse(JSON.stringify(team))
    const rotationBefore = JSON.parse(JSON.stringify(rotationV0))

    const first = convertRotationV0ToV1(team, rotationV0)
    const second = convertRotationV0ToV1(team, rotationV0)

    expect(first).toEqual(second)
    expect(validateRotationV1(team, first)).toEqual({
      valid: true,
      issues: [],
    })
    expect(derivePlayerMinutesV1(first)).toEqual(rotationV0.minutes)
    for (const position of POSITIONS) {
      for (const playerId of Object.keys(first.minutesByPosition[position])) {
        expect(
          team.roster.find((player) => player.id === playerId)?.position,
        ).toBe(position)
      }
    }
    expect(team).toEqual(teamBefore)
    expect(rotationV0).toEqual(rotationBefore)
  })

  it('validates deterministically without mutating inputs', () => {
    const team = makeTeam()
    const rotation = makeNaturalRotationV1()
    const teamBefore = JSON.parse(JSON.stringify(team))
    const rotationBefore = cloneRotationV1(rotation)

    expect(validateRotationV1(team, rotation)).toEqual(
      validateRotationV1(team, rotation),
    )
    expect(team).toEqual(teamBefore)
    expect(rotation).toEqual(rotationBefore)
  })
})
