import { describe, expect, it } from 'vitest'
import { generateDefaultRotation, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  convertRotationV0ToV1,
  derivePlayerMinutesV1,
  normalizeRotationToV1,
  POSITIONS,
  validateRotationV1,
  type Rotation,
  type RotationV1,
} from './index'

function makeTeam() {
  return generateTeam({
    name: 'Rotation Compatibility',
    abbreviation: 'RCP',
    prestige: 60,
    rng: createRng('rotation-compatibility-team'),
  })
}

function makeEditedRotation(): Rotation {
  const team = makeTeam()
  const rotation = generateDefaultRotation(team)

  for (const position of POSITIONS) {
    const players = team.roster.filter(
      (player) => player.position === position,
    )
    const donor = players.find(
      (player) => (rotation.minutes[player.id] ?? 0) > 0,
    )
    const recipient = players.find(
      (player) =>
        player.id !== donor?.id &&
        (rotation.minutes[player.id] ?? 0) < 40,
    )

    if (donor && recipient) {
      rotation.minutes[donor.id] =
        (rotation.minutes[donor.id] ?? 0) - 1
      rotation.minutes[recipient.id] =
        (rotation.minutes[recipient.id] ?? 0) + 1
      return rotation
    }
  }

  throw new Error('Could not construct an edited V0 Rotation fixture.')
}

function makeSecondaryRotation(): RotationV1 {
  const team = makeTeam()
  const rotation = convertRotationV0ToV1(
    team,
    generateDefaultRotation(team),
  )
  const powerForward = team.roster.find(
    (player) =>
      player.position === 'PF' &&
      (rotation.minutesByPosition.PF[player.id] ?? 0) > 0,
  )!
  const center = team.roster.find(
    (player) =>
      player.position === 'C' &&
      (rotation.minutesByPosition.C[player.id] ?? 0) > 0,
  )!

  rotation.minutesByPosition.PF[powerForward.id] =
    (rotation.minutesByPosition.PF[powerForward.id] ?? 0) - 1
  rotation.minutesByPosition.C[center.id] =
    (rotation.minutesByPosition.C[center.id] ?? 0) - 1
  rotation.minutesByPosition.PF[center.id] =
    (rotation.minutesByPosition.PF[center.id] ?? 0) + 1
  rotation.minutesByPosition.C[powerForward.id] =
    (rotation.minutesByPosition.C[powerForward.id] ?? 0) + 1

  return rotation
}

describe('Rotation persistence compatibility', () => {
  it('losslessly normalizes valid V0 into natural-only valid V1', () => {
    const team = makeTeam()
    const rotationV0 = generateDefaultRotation(team)
    const normalized = normalizeRotationToV1(team, rotationV0)

    expect(validateRotationV1(team, normalized)).toEqual({
      valid: true,
      issues: [],
    })
    expect(derivePlayerMinutesV1(normalized)).toEqual(rotationV0.minutes)
    for (const position of POSITIONS) {
      expect(
        Object.values(normalized.minutesByPosition[position]).reduce(
          (total, minutes) => total + minutes,
          0,
        ),
      ).toBe(40)
      for (const playerId of Object.keys(
        normalized.minutesByPosition[position],
      )) {
        expect(
          team.roster.find((player) => player.id === playerId)?.position,
        ).toBe(position)
      }
    }
  })

  it('preserves every minute of a legal user-edited V0 Rotation', () => {
    const team = makeTeam()
    const edited = makeEditedRotation()
    const generatedDefault = generateDefaultRotation(team)
    const normalized = normalizeRotationToV1(team, edited)

    expect(edited).not.toEqual(generatedDefault)
    expect(derivePlayerMinutesV1(normalized)).toEqual(edited.minutes)
    expect(normalized).toEqual(convertRotationV0ToV1(team, edited))
  })

  it('preserves valid secondary assignments and returns an isolated copy', () => {
    const team = makeTeam()
    const secondary = makeSecondaryRotation()
    const normalized = normalizeRotationToV1(team, secondary)

    expect(normalized).toEqual(secondary)
    expect(derivePlayerMinutesV1(normalized)).toEqual(
      derivePlayerMinutesV1(secondary),
    )
    expect(normalized).not.toBe(secondary)
    for (const position of POSITIONS) {
      expect(normalized.minutesByPosition[position]).not.toBe(
        secondary.minutesByPosition[position],
      )
    }
  })

  it('supports JSON round trips for both legacy V0 and secondary V1', () => {
    const team = makeTeam()
    const legacyV0 = makeEditedRotation()
    const secondaryV1 = makeSecondaryRotation()
    const parsedV0: unknown = JSON.parse(JSON.stringify(legacyV0))
    const parsedV1: unknown = JSON.parse(JSON.stringify(secondaryV1))

    expect(normalizeRotationToV1(team, parsedV0)).toEqual(
      convertRotationV0ToV1(team, legacyV0),
    )
    expect(normalizeRotationToV1(team, parsedV1)).toEqual(secondaryV1)
  })

  it.each([
    ['unknown Player', (rotation: Rotation) => {
      rotation.minutes['unknown-player'] = 0
    }],
    ['invalid minutes', (rotation: Rotation) => {
      rotation.minutes[Object.keys(rotation.minutes)[0]!] = -1
    }],
    ['invalid positional total', (rotation: Rotation) => {
      const playerId = Object.keys(rotation.minutes)[0]!
      rotation.minutes[playerId] = (rotation.minutes[playerId] ?? 0) - 1
    }],
  ] as const)('rejects invalid V0 with %s', (_label, invalidate) => {
    const team = makeTeam()
    const rotation = generateDefaultRotation(team)

    invalidate(rotation)

    expect(() => normalizeRotationToV1(team, rotation)).toThrow(
      /invalid Rotation V0/,
    )
  })

  it('rejects invalid V1 without treating it as legacy V0', () => {
    const team = makeTeam()
    const rotation = makeSecondaryRotation()
    const center = team.roster.find((player) => player.position === 'C')!

    rotation.minutesByPosition.PG = { [center.id]: 40 }

    expect(() => normalizeRotationToV1(team, rotation)).toThrow(
      /invalid Rotation V1/,
    )
  })

  it.each([
    null,
    {},
    { minutes: null },
    { minutes: {}, minutesByPosition: {} },
    { minutesByPosition: { PG: {} } },
  ])('rejects malformed or ambiguous state %#', (rotationLike) => {
    const team = makeTeam()

    expect(() => normalizeRotationToV1(team, rotationLike)).toThrow(
      RangeError,
    )
  })

  it('is deterministic and does not mutate Team, Players, V0, or V1', () => {
    const team = makeTeam()
    const rotationV0 = makeEditedRotation()
    const rotationV1 = makeSecondaryRotation()
    const before = structuredClone({ team, rotationV0, rotationV1 })

    expect(normalizeRotationToV1(team, rotationV0)).toEqual(
      normalizeRotationToV1(team, rotationV0),
    )
    expect(normalizeRotationToV1(team, rotationV1)).toEqual(
      normalizeRotationToV1(team, rotationV1),
    )
    expect({ team, rotationV0, rotationV1 }).toEqual(before)
  })
})
