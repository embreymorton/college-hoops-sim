import { validateRotation, type Rotation } from './rotation'
import {
  derivePlayerMinutesV1,
  validateRotationV1,
  type RotationV1,
} from './rotationV1'
import type { Team } from './team'

/** Either persisted V0 minutes or canonical floor-aware V1 assignments. */
export type RotationInput = Rotation | RotationV1

/** Read-only aggregate Player minutes consumed by existing basketball math. */
export type AggregatePlayerMinutes = Readonly<Record<string, number>>

function isRotationV1(rotation: RotationInput): rotation is RotationV1 {
  return 'minutesByPosition' in rotation
}

/** Central validation boundary for either supported Rotation representation. */
export function validateRotationInput(
  team: Team,
  rotation: RotationInput,
) {
  return isRotationV1(rotation)
    ? validateRotationV1(team, rotation)
    : validateRotation(team, rotation)
}

/** Converges V0 and V1 into the aggregate-minute view used by simulation. */
export function derivePlayerMinutes(
  rotation: RotationInput,
): AggregatePlayerMinutes {
  return isRotationV1(rotation)
    ? derivePlayerMinutesV1(rotation)
    : rotation.minutes
}
