import {
  calculateTeamStrength,
  convertRotationV0ToV1,
  generateDefaultRotation,
  generateDefaultRotationV1,
  POSITIONS,
  validateRotationV1,
} from '../src/engine'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const DIAGNOSTIC_SEEDS = [
  'rotation-v1-generation-a',
  'rotation-v1-generation-b',
  'rotation-v1-generation-c',
] as const

interface RotationV1GenerationSummary {
  readonly teams: number
  readonly teamsChanged: number
  readonly teamsChangedPercentage: number
  readonly averageOverallDelta: number
  readonly maximumOverallGain: number
  readonly minimumOverallDelta: number
  readonly regressions: number
  readonly playersWithSecondaryMinutes: number
  readonly totalSecondaryMinutes: number
  readonly paths: Readonly<Record<string, number>>
}

export function inspectRotationV1Generation(): RotationV1GenerationSummary {
  const deltas: number[] = []
  const secondaryPlayerKeys = new Set<string>()
  const paths: Record<string, number> = {}
  let teamsChanged = 0
  let totalSecondaryMinutes = 0
  let teamCount = 0

  for (const seed of DIAGNOSTIC_SEEDS) {
    const universe = initializeUniverse(UNIVERSE_V0, seed)

    for (const { team } of universe.programs) {
      const rotationV0 = generateDefaultRotation(team)
      const baselineV1 = convertRotationV0ToV1(team, rotationV0)
      const rotationV1 = generateDefaultRotationV1(team)
      const validation = validateRotationV1(team, rotationV1)

      if (!validation.valid) {
        throw new RangeError(
          `Invalid V1 diagnostic rotation for ${team.id}: ${validation.issues
            .map(({ message }) => message)
            .join(' ')}`,
        )
      }

      const delta =
        calculateTeamStrength(team, rotationV1).overall -
        calculateTeamStrength(team, rotationV0).overall

      deltas.push(delta)
      teamCount += 1

      if (JSON.stringify(rotationV1) !== JSON.stringify(baselineV1)) {
        teamsChanged += 1
      }

      for (const floorPosition of POSITIONS) {
        for (const [playerId, minutes] of Object.entries(
          rotationV1.minutesByPosition[floorPosition],
        )) {
          const player = team.roster.find(
            (candidate) => candidate.id === playerId,
          )

          if (!player || player.position === floorPosition || minutes <= 0) {
            continue
          }

          const path = `${player.position}->${floorPosition}`
          secondaryPlayerKeys.add(`${seed}:${team.id}:${player.id}`)
          totalSecondaryMinutes += minutes
          paths[path] = (paths[path] ?? 0) + minutes
        }
      }
    }
  }

  return {
    teams: teamCount,
    teamsChanged,
    teamsChangedPercentage: (teamsChanged / teamCount) * 100,
    averageOverallDelta:
      deltas.reduce((total, delta) => total + delta, 0) / deltas.length,
    maximumOverallGain: Math.max(...deltas),
    minimumOverallDelta: Math.min(...deltas),
    regressions: deltas.filter((delta) => delta < -Number.EPSILON).length,
    playersWithSecondaryMinutes: secondaryPlayerKeys.size,
    totalSecondaryMinutes,
    paths: Object.fromEntries(
      Object.entries(paths).sort(
        ([first], [second]) => first.localeCompare(second),
      ),
    ),
  }
}

console.log(JSON.stringify(inspectRotationV1Generation(), null, 2))
