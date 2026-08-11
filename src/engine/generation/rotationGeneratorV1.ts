import {
  calculatePlayerDefense,
  calculatePlayerOffense,
  convertRotationV0ToV1,
  derivePlayerMinutesV1,
  getEligibleRotationPositions,
  MAX_PLAYER_MINUTES,
  POSITIONS,
  validateRotationV1,
  type Player,
  type RotationV1,
  type Team,
} from '../domain'
import { generateDefaultRotation } from './rotationGenerator'

const DEFAULT_ROTATION_V1_CONFIG = {
  /** Phase 6E.5's threshold for a clear rather than marginal talent gap. */
  minimumContributionImprovement: 5,
  /** Preserves V0's allocation ecology while exposing meaningfully buried talent. */
  maximumSecondaryMinutesPerPlayer: 8,
  /** Matches 6E.5's focus on replacing a real floor-position incumbent. */
  minimumDisplacedPlayerMinutes: 20,
  /** Matches 6E.5's definition of talent buried by natural-position depth. */
  buriedPlayerMaximumMinutes: 9,
  /** Preserves the V0 generator's four-minute headroom for a capped starter. */
  v0CappedPlayerMinutes: MAX_PLAYER_MINUTES - 4,
} as const

function playerContribution(player: Player): number {
  return (calculatePlayerOffense(player) + calculatePlayerDefense(player)) / 2
}

function comparePlayerIds(first: Player, second: Player): number {
  return first.id.localeCompare(second.id)
}

/**
 * Generates the existing V0 default, converts it losslessly, then applies a
 * conservative deterministic pass of legal secondary-position substitutions.
 */
export function generateDefaultRotationV1(team: Team): RotationV1 {
  const rotationV0 = generateDefaultRotation(team)
  const rotationV1 = convertRotationV0ToV1(team, rotationV0)
  const totalMinutes = derivePlayerMinutesV1(rotationV1)
  const rosterMinutes = (player: Player) => totalMinutes[player.id] ?? 0

  for (const floorPosition of POSITIONS) {
    const candidates = team.roster
      .filter(
        (player) => {
          const baselineMinutes = rotationV0.minutes[player.id] ?? 0

          return (
            player.position !== floorPosition &&
            getEligibleRotationPositions(player).includes(floorPosition) &&
            (baselineMinutes <=
              DEFAULT_ROTATION_V1_CONFIG.buriedPlayerMaximumMinutes ||
              baselineMinutes ===
                DEFAULT_ROTATION_V1_CONFIG.v0CappedPlayerMinutes)
          )
        },
      )
      .sort(
        (first, second) =>
          playerContribution(second) - playerContribution(first) ||
          rosterMinutes(first) - rosterMinutes(second) ||
          comparePlayerIds(first, second),
      )
    const recipients = team.roster
      .filter(
        (player) =>
          player.position === floorPosition &&
          (rotationV0.minutes[player.id] ?? 0) >=
            DEFAULT_ROTATION_V1_CONFIG.minimumDisplacedPlayerMinutes,
      )
      .sort(
        (first, second) =>
          playerContribution(first) - playerContribution(second) ||
          (rotationV0.minutes[second.id] ?? 0) -
            (rotationV0.minutes[first.id] ?? 0) ||
          comparePlayerIds(first, second),
      )

    for (const candidate of candidates) {
      let availableMinutes = Math.min(
        MAX_PLAYER_MINUTES - rosterMinutes(candidate),
        DEFAULT_ROTATION_V1_CONFIG.maximumSecondaryMinutesPerPlayer,
      )

      for (const recipient of recipients) {
        if (availableMinutes <= 0) {
          break
        }

        const contributionImprovement =
          playerContribution(candidate) - playerContribution(recipient)

        if (
          contributionImprovement <
          DEFAULT_ROTATION_V1_CONFIG.minimumContributionImprovement
        ) {
          continue
        }

        const recipientMinutes =
          rotationV1.minutesByPosition[floorPosition][recipient.id] ?? 0
        const transferredMinutes = Math.min(
          availableMinutes,
          recipientMinutes,
        )

        if (transferredMinutes <= 0) {
          continue
        }

        const remainingRecipientMinutes =
          recipientMinutes - transferredMinutes

        if (remainingRecipientMinutes === 0) {
          delete rotationV1.minutesByPosition[floorPosition][recipient.id]
        } else {
          rotationV1.minutesByPosition[floorPosition][recipient.id] =
            remainingRecipientMinutes
        }
        rotationV1.minutesByPosition[floorPosition][candidate.id] =
          (rotationV1.minutesByPosition[floorPosition][candidate.id] ?? 0) +
          transferredMinutes
        totalMinutes[recipient.id] =
          (totalMinutes[recipient.id] ?? 0) - transferredMinutes
        totalMinutes[candidate.id] =
          (totalMinutes[candidate.id] ?? 0) + transferredMinutes
        availableMinutes -= transferredMinutes
      }
    }
  }

  const validation = validateRotationV1(team, rotationV1)

  if (!validation.valid) {
    throw new RangeError(
      `Generated invalid Rotation V1: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return rotationV1
}
