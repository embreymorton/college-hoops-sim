import { POSITIONS } from './player'
import { validateRotation, type Rotation } from './rotation'
import {
  cloneRotationV1,
  convertRotationV0ToV1,
  validateRotationV1,
  type RotationV1,
} from './rotationV1'
import type { Team } from './team'

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key)
}

/**
 * Persistence/application-cutover boundary for legacy V0 and canonical V1.
 * It performs representation migration only; it never regenerates minutes.
 */
export function normalizeRotationToV1(
  team: Team,
  rotationLike: unknown,
): RotationV1 {
  if (!isRecord(rotationLike)) {
    throw new RangeError('Unsupported persisted Rotation structure.')
  }

  const hasV0Minutes = hasOwn(rotationLike, 'minutes')
  const hasV1Minutes = hasOwn(rotationLike, 'minutesByPosition')

  if (hasV0Minutes === hasV1Minutes) {
    throw new RangeError(
      'Persisted Rotation must contain exactly one supported representation.',
    )
  }

  if (hasV0Minutes) {
    if (!isRecord(rotationLike.minutes)) {
      throw new RangeError('Invalid persisted Rotation V0 structure.')
    }

    const rotation = rotationLike as unknown as Rotation
    const validation = validateRotation(team, rotation)

    if (!validation.valid) {
      throw new RangeError(
        `Cannot migrate invalid Rotation V0: ${validation.issues
          .map(({ message }) => message)
          .join(' ')}`,
      )
    }

    return convertRotationV0ToV1(team, rotation)
  }

  if (!isRecord(rotationLike.minutesByPosition)) {
    throw new RangeError('Invalid persisted Rotation V1 structure.')
  }

  const floorPositionKeys = Object.keys(rotationLike.minutesByPosition)

  if (
    floorPositionKeys.length !== POSITIONS.length ||
    floorPositionKeys.some(
      (position) => !POSITIONS.includes(position as (typeof POSITIONS)[number]),
    )
  ) {
    throw new RangeError(
      'Persisted Rotation V1 must contain exactly the five floor positions.',
    )
  }

  const rotation = rotationLike as unknown as RotationV1
  const validation = validateRotationV1(team, rotation)

  if (!validation.valid) {
    throw new RangeError(
      `Cannot normalize invalid Rotation V1: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return cloneRotationV1(rotation)
}
