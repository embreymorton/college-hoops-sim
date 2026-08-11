import { convertRotationV0ToV1, type RotationV1, type Team } from '../domain'
import { generateDefaultRotation } from './rotationGenerator'

/** Preserves V0 defaults as natural-position-only canonical V1 state. */
export function generateNaturalDefaultRotationV1(team: Team): RotationV1 {
  return convertRotationV0ToV1(team, generateDefaultRotation(team))
}
