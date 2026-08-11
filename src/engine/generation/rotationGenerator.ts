import {
  calculateOverall,
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  POSITIONS,
  type Player,
  type Rotation,
  type Team,
} from '../domain'

const DEFAULT_ROTATION_CONFIG = {
  /** Smaller values make quality gaps produce more top-heavy allocations. */
  qualityTemperature: 5,
  /** Applies only when a player has at least one natural-position backup. */
  maximumMinutesWithBackup: MAX_PLAYER_MINUTES - 4,
  /** Reserves the star workload ceiling for a Team's top three Players. */
  maximumMinutesOutsideTeamTopThree: MAX_PLAYER_MINUTES - 8,
  /** Third-or-deeper players below this initial share remain on the bench. */
  minimumAdditionalPlayerShare: 5,
} as const

interface PlayerAllocation {
  readonly player: Player
  readonly overall: number
  readonly weight: number
  readonly maximumMinutes: number
  rawMinutes: number
  minutes: number
}

function comparePlayerIds(firstId: string, secondId: string): number {
  if (firstId === secondId) {
    return 0
  }

  return firstId < secondId ? -1 : 1
}

function allocatePositionMinutes(
  players: readonly Player[],
  teamTopThreePlayerIds: ReadonlySet<string>,
): PlayerAllocation[] {
  if (players.length === 0) {
    throw new RangeError('Cannot generate a rotation without every position')
  }

  const rankedPlayers = [...players]
    .map((player) => ({ player, overall: calculateOverall(player) }))
    .sort(
      (first, second) =>
        second.overall - first.overall ||
        comparePlayerIds(first.player.id, second.player.id),
    )

  if (rankedPlayers.length === 1) {
    const onlyPlayer = rankedPlayers[0] as (typeof rankedPlayers)[number]

    return [
      {
        ...onlyPlayer,
        weight: 1,
        maximumMinutes: MINUTES_PER_POSITION,
        rawMinutes: MINUTES_PER_POSITION,
        minutes: MINUTES_PER_POSITION,
      },
    ]
  }

  const bestOverall = (rankedPlayers[0] as (typeof rankedPlayers)[number])
    .overall
  const initialWeights = rankedPlayers.map(({ overall }) =>
    Math.exp(
      (overall - bestOverall) / DEFAULT_ROTATION_CONFIG.qualityTemperature,
    ),
  )
  const initialTotalWeight = initialWeights.reduce(
    (sum, weight) => sum + weight,
    0,
  )
  const rotationPlayers = rankedPlayers.filter(
    (_, index) =>
      index < 2 ||
      ((initialWeights[index] as number) / initialTotalWeight) *
        MINUTES_PER_POSITION >=
        DEFAULT_ROTATION_CONFIG.minimumAdditionalPlayerShare,
  )
  const allocations: PlayerAllocation[] = rotationPlayers.map(
    ({ player, overall }) => ({
      player,
      overall,
      weight: Math.exp(
        (overall - bestOverall) /
          DEFAULT_ROTATION_CONFIG.qualityTemperature,
      ),
      maximumMinutes: teamTopThreePlayerIds.has(player.id)
        ? DEFAULT_ROTATION_CONFIG.maximumMinutesWithBackup
        : DEFAULT_ROTATION_CONFIG.maximumMinutesOutsideTeamTopThree,
      rawMinutes: 0,
      minutes: 0,
    }),
  )
  let remainingMinutes = MINUTES_PER_POSITION
  let uncappedAllocations = [...allocations]

  while (uncappedAllocations.length > 0) {
    const remainingWeight = uncappedAllocations.reduce(
      (sum, allocation) => sum + allocation.weight,
      0,
    )
    const newlyCapped = uncappedAllocations.filter(
      ({ weight, maximumMinutes }) =>
        (weight / remainingWeight) * remainingMinutes >
        maximumMinutes,
    )

    if (newlyCapped.length === 0) {
      for (const allocation of uncappedAllocations) {
        allocation.rawMinutes =
          (allocation.weight / remainingWeight) * remainingMinutes
        allocation.minutes = Math.floor(allocation.rawMinutes)
      }

      break
    }

    for (const allocation of newlyCapped) {
      allocation.rawMinutes = allocation.maximumMinutes
      allocation.minutes = allocation.maximumMinutes
      remainingMinutes -= allocation.maximumMinutes
    }

    uncappedAllocations = uncappedAllocations.filter(
      (allocation) => !newlyCapped.includes(allocation),
    )
  }

  let unassignedMinutes =
    MINUTES_PER_POSITION -
    allocations.reduce((sum, allocation) => sum + allocation.minutes, 0)

  while (unassignedMinutes > 0) {
    const nextAllocation = [...allocations]
      .filter(
        ({ minutes, maximumMinutes }) => minutes < maximumMinutes,
      )
      .sort(
        (first, second) =>
          second.rawMinutes - second.minutes -
            (first.rawMinutes - first.minutes) ||
          second.overall - first.overall ||
          comparePlayerIds(first.player.id, second.player.id),
      )[0]

    if (!nextAllocation) {
      throw new RangeError('Rotation minute caps cannot satisfy 40 minutes')
    }

    nextAllocation.minutes += 1
    unassignedMinutes -= 1
  }

  return allocations
}

/**
 * Deterministically derives a valid natural-position rotation from player
 * overall. Stamina is not weighted again because it already contributes to
 * overall. Zero-minute players are omitted from the returned mapping.
 */
export function generateDefaultRotation(team: Team): Rotation {
  const teamTopThreePlayerIds = new Set(
    team.roster
      .map((player) => ({ player, overall: calculateOverall(player) }))
      .sort(
        (first, second) =>
          second.overall - first.overall ||
          comparePlayerIds(first.player.id, second.player.id),
      )
      .slice(0, 3)
      .map(({ player }) => player.id),
  )
  const entries = POSITIONS.flatMap((position) =>
    allocatePositionMinutes(
      team.roster.filter((player) => player.position === position),
      teamTopThreePlayerIds,
    )
      .filter(({ minutes }) => minutes > 0)
      .map(({ player, minutes }) => [player.id, minutes] as const),
  )

  return { minutes: Object.fromEntries(entries) }
}
