import { describe, expect, it } from 'vitest'
import {
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  POSITIONS,
  createRng,
  generateDefaultRotation,
  generateTeam,
} from '../src/engine'
import {
  eligibleFloorPositions,
  generateFlexibleDiagnosticRotation,
} from './rotationFlexibilityDiagnostic'

const team = generateTeam({
  name: 'Diagnostic Rotation Team',
  abbreviation: 'DRT',
  prestige: 70,
  rng: createRng('rotation-flexibility-test-team'),
})

describe('rotation flexibility diagnostic helpers', () => {
  it('uses deterministic candidate allocations', () => {
    expect(generateFlexibleDiagnosticRotation(team, 'adjacent')).toEqual(
      generateFlexibleDiagnosticRotation(team, 'adjacent'),
    )
    expect(generateFlexibleDiagnosticRotation(team, 'secondary')).toEqual(
      generateFlexibleDiagnosticRotation(team, 'secondary'),
    )
  })

  it.each(['adjacent', 'secondary'] as const)(
    'assigns exactly 200 minutes and 40 to every floor position for %s',
    (model) => {
      const rotation = generateFlexibleDiagnosticRotation(team, model)
      expect(Object.values(rotation.minutesByPlayerId).reduce((sum, minutes) => sum + minutes, 0)).toBe(200)
      expect(Object.values(rotation.minutesByFloorPosition)).toEqual(
        POSITIONS.map(() => MINUTES_PER_POSITION),
      )
      expect(Object.values(rotation.minutesByPlayerId).every((minutes) =>
        minutes >= 0 && minutes <= MAX_PLAYER_MINUTES,
      )).toBe(true)
    },
  )

  it.each(['adjacent', 'secondary'] as const)(
    'never assigns a Player to an illegal diagnostic floor position for %s',
    (model) => {
      const rotation = generateFlexibleDiagnosticRotation(team, model)
      for (const player of team.roster) {
        for (const [floorPosition, minutes] of Object.entries(rotation.assignments[player.id] ?? {})) {
          expect(minutes).toBeGreaterThan(0)
          expect(eligibleFloorPositions(model, player.position)).toContain(floorPosition)
        }
      }
    },
  )

  it('does not mutate or alter the production natural-position Rotation', () => {
    const before = generateDefaultRotation(team)
    const teamBefore = structuredClone(team)
    generateFlexibleDiagnosticRotation(team, 'adjacent')
    generateFlexibleDiagnosticRotation(team, 'secondary')
    expect(team).toEqual(teamBefore)
    expect(generateDefaultRotation(team)).toEqual(before)
  })
})
