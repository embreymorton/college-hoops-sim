import { describe, expect, it } from 'vitest'
import { generateDefaultRotation, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  calculatePositionMinutes,
  calculateTotalMinutes,
  getPlayersByMinutes,
  POSITIONS,
  TOTAL_ROTATION_MINUTES,
  validateRotation,
  type Rotation,
} from './index'

function makeTeam() {
  return generateTeam({
    name: 'Rotation State',
    abbreviation: 'RST',
    prestige: 60,
    rng: createRng('rotation-domain-team'),
  })
}

function cloneRotation(rotation: Rotation): Rotation {
  return JSON.parse(JSON.stringify(rotation)) as Rotation
}

describe('Rotation domain model', () => {
  it('is JSON serializable and treats omitted player IDs as zero minutes', () => {
    const team = makeTeam()
    const rotation = generateDefaultRotation(team)
    const zeroMinutePlayer = team.roster.find(
      (player) => rotation.minutes[player.id] === undefined,
    )
    const roundTripped = JSON.parse(JSON.stringify(rotation)) as Rotation

    expect(roundTripped).toEqual(rotation)
    if (zeroMinutePlayer) {
      expect(
        getPlayersByMinutes(team, rotation).find(
          ({ player }) => player.id === zeroMinutePlayer.id,
        )?.minutes,
      ).toBe(0)
    }
  })

  it('calculates total, positional, and player-minute summaries', () => {
    const team = makeTeam()
    const rotation = generateDefaultRotation(team)
    const playersByMinutes = getPlayersByMinutes(team, rotation)

    expect(calculateTotalMinutes(rotation)).toBe(TOTAL_ROTATION_MINUTES)
    for (const position of POSITIONS) {
      expect(calculatePositionMinutes(team, rotation, position)).toBe(40)
    }
    expect(playersByMinutes).toHaveLength(team.roster.length)
    expect(playersByMinutes[0]?.minutes).toBeGreaterThanOrEqual(
      playersByMinutes.at(-1)?.minutes ?? 0,
    )
  })

  it('returns no issues for a valid rotation', () => {
    const team = makeTeam()
    const rotation = generateDefaultRotation(team)
    const teamBefore = JSON.parse(JSON.stringify(team))
    const rotationBefore = JSON.parse(JSON.stringify(rotation))
    const result = validateRotation(team, rotation)

    expect(result).toEqual({ valid: true, issues: [] })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
    expect(team).toEqual(teamBefore)
    expect(rotation).toEqual(rotationBefore)
  })

  it('rejects an unknown player ID even when it has zero minutes', () => {
    const team = makeTeam()
    const rotation = generateDefaultRotation(team)
    rotation.minutes['player-not-on-roster'] = 0

    const result = validateRotation(team, rotation)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'UNKNOWN_PLAYER',
        playerId: 'player-not-on-roster',
      }),
    )
    expect(result.issues.map(({ message }) => message).join(' ')).toContain(
      'Unknown player ID',
    )
  })

  it('reports invalid total and positional minutes', () => {
    const team = makeTeam()
    const rotation = cloneRotation(generateDefaultRotation(team))
    const pointGuard = team.roster.find(
      (player) =>
        player.position === 'PG' && (rotation.minutes[player.id] ?? 0) > 0,
    )

    expect(pointGuard).toBeDefined()
    rotation.minutes[pointGuard?.id ?? ''] =
      (rotation.minutes[pointGuard?.id ?? ''] ?? 0) - 1

    const result = validateRotation(team, rotation)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_POSITION_TOTAL',
        position: 'PG',
        actual: 39,
        expected: 40,
      }),
    )
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_TOTAL_MINUTES',
        actual: 199,
        expected: 200,
      }),
    )
  })

  it('rejects positional imbalance even when total minutes remain 200', () => {
    const team = makeTeam()
    const rotation = cloneRotation(generateDefaultRotation(team))
    const pointGuard = team.roster.find(
      (player) =>
        player.position === 'PG' && (rotation.minutes[player.id] ?? 0) > 0,
    )
    const shootingGuard = team.roster.find(
      (player) =>
        player.position === 'SG' &&
        (rotation.minutes[player.id] ?? 0) < 40,
    )

    expect(pointGuard).toBeDefined()
    expect(shootingGuard).toBeDefined()
    rotation.minutes[pointGuard?.id ?? ''] =
      (rotation.minutes[pointGuard?.id ?? ''] ?? 0) - 1
    rotation.minutes[shootingGuard?.id ?? ''] =
      (rotation.minutes[shootingGuard?.id ?? ''] ?? 0) + 1

    const result = validateRotation(team, rotation)
    const positionIssues = result.issues.filter(
      ({ code }) => code === 'INVALID_POSITION_TOTAL',
    )

    expect(calculateTotalMinutes(rotation)).toBe(200)
    expect(positionIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ position: 'PG', actual: 39 }),
        expect.objectContaining({ position: 'SG', actual: 41 }),
      ]),
    )
    expect(
      result.issues.some(({ code }) => code === 'INVALID_TOTAL_MINUTES'),
    ).toBe(false)
  })

  it.each([
    ['negative', -1],
    ['above 40', 41],
    ['not finite', Number.POSITIVE_INFINITY],
  ])('rejects %s player minutes', (_label, invalidMinutes) => {
    const team = makeTeam()
    const rotation = cloneRotation(generateDefaultRotation(team))
    const player = team.roster[0]

    expect(player).toBeDefined()
    rotation.minutes[player?.id ?? ''] = invalidMinutes

    const result = validateRotation(team, rotation)

    expect(result.valid).toBe(false)
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PLAYER_MINUTES',
        playerId: player?.id,
      }),
    )
  })
})
