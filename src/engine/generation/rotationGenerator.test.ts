import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  calculateOverall,
  calculatePositionMinutes,
  calculateTotalMinutes,
  MAX_PLAYER_MINUTES,
  POSITIONS,
  TOTAL_ROTATION_MINUTES,
  validateRotation,
  type Player,
  type PlayerAttributes,
  type Position,
  type Team,
} from '../domain'
import { createRng } from '../random'
import { generateDefaultRotation } from './rotationGenerator'
import { generateTeam } from './teamGenerator'

function attributesAt(rating: number): PlayerAttributes {
  return {
    finishing: rating,
    shooting: rating,
    playmaking: rating,
    ballHandling: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    rebounding: rating,
    athleticism: rating,
    stamina: rating,
  }
}

function makePlayer(id: string, position: Position, overall: number): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes: attributesAt(overall),
    potential: Math.max(overall, 90),
  }
}

function makeFixtureTeam(
  replacements: Partial<Record<Position, Player[]>> = {},
): Team {
  return {
    id: 'team-rotation-fixture',
    name: 'Rotation Fixture',
    abbreviation: 'RTF',
    prestige: 60,
    roster: POSITIONS.flatMap(
      (position) =>
        replacements[position] ?? [makePlayer(`${position}-only`, position, 75)],
    ),
  }
}

function assignedMinutes(team: Team, playerId: string): number {
  return generateDefaultRotation(team).minutes[playerId] ?? 0
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateDefaultRotation', () => {
  it('is deterministic for the same team state', () => {
    const team = generateTeam({
      name: 'Deterministic College',
      abbreviation: 'DTC',
      prestige: 70,
      rng: createRng('deterministic-rotation-team'),
    })

    expect(generateDefaultRotation(team)).toEqual(generateDefaultRotation(team))
  })

  it('assigns exactly 200 valid minutes and 40 at every position', () => {
    const team = generateTeam({
      name: 'Minute State',
      abbreviation: 'MST',
      prestige: 55,
      rng: createRng('valid-rotation-team'),
    })
    const rotation = generateDefaultRotation(team)

    expect(calculateTotalMinutes(rotation)).toBe(TOTAL_ROTATION_MINUTES)
    expect(validateRotation(team, rotation).valid).toBe(true)
    for (const position of POSITIONS) {
      expect(calculatePositionMinutes(team, rotation, position)).toBe(40)
    }
    for (const minutes of Object.values(rotation.minutes)) {
      expect(minutes).toBeGreaterThanOrEqual(0)
      expect(minutes).toBeLessThanOrEqual(MAX_PLAYER_MINUTES)
      expect(Number.isInteger(minutes)).toBe(true)
    }
  })

  it('gives substantially better players more minutes at the same position', () => {
    const star = makePlayer('star-pg', 'PG', 88)
    const backup = makePlayer('backup-pg', 'PG', 68)
    const team = makeFixtureTeam({ PG: [star, backup] })
    const rotation = generateDefaultRotation(team)

    expect(calculateOverall(star)).toBe(88)
    expect(rotation.minutes[star.id]).toBeGreaterThan(
      rotation.minutes[backup.id] ?? 0,
    )
    expect((rotation.minutes[star.id] ?? 0) - (rotation.minutes[backup.id] ?? 0)).toBeGreaterThan(
      20,
    )
  })

  it('allocates similar players more evenly than an extreme talent gap', () => {
    const extremeTeam = makeFixtureTeam({
      PG: [makePlayer('extreme-high', 'PG', 88), makePlayer('extreme-low', 'PG', 68)],
    })
    const similarTeam = makeFixtureTeam({
      PG: [makePlayer('similar-high', 'PG', 78), makePlayer('similar-low', 'PG', 77)],
    })
    const extremeGap =
      assignedMinutes(extremeTeam, 'extreme-high') -
      assignedMinutes(extremeTeam, 'extreme-low')
    const similarGap =
      assignedMinutes(similarTeam, 'similar-high') -
      assignedMinutes(similarTeam, 'similar-low')

    expect(similarGap).toBeLessThanOrEqual(6)
    expect(extremeGap).toBeGreaterThan(similarGap + 20)
  })

  it('splits three similarly rated players without benching one arbitrarily', () => {
    const players = [
      makePlayer('balanced-one', 'SF', 79),
      makePlayer('balanced-two', 'SF', 78),
      makePlayer('balanced-three', 'SF', 78),
    ]
    const team = makeFixtureTeam({ SF: players })
    const rotation = generateDefaultRotation(team)
    const minutes = players.map((player) => rotation.minutes[player.id] ?? 0)

    expect(Math.max(...minutes) - Math.min(...minutes)).toBeLessThanOrEqual(3)
    expect(minutes.every((assignedMinutes) => assignedMinutes > 0)).toBe(true)
  })

  it('gives a sole player at a position all 40 minutes', () => {
    const team = makeFixtureTeam()
    const rotation = generateDefaultRotation(team)

    for (const position of POSITIONS) {
      expect(rotation.minutes[`${position}-only`]).toBe(40)
    }
  })

  it('handles more than three players and can omit a deep bench player', () => {
    const team = makeFixtureTeam({
      C: [
        makePlayer('center-star', 'C', 95),
        makePlayer('center-backup', 'C', 72),
        makePlayer('center-depth', 'C', 55),
        makePlayer('center-deep-bench', 'C', 40),
      ],
    })
    const rotation = generateDefaultRotation(team)

    expect(calculatePositionMinutes(team, rotation, 'C')).toBe(40)
    expect(rotation.minutes['center-star']).toBeLessThanOrEqual(36)
    expect(rotation.minutes['center-deep-bench']).toBeUndefined()
  })

  it('works across a large deterministic sample of generated teams', () => {
    let generatedTeamCount = 0

    for (const prestige of [30, 60, 90]) {
      const rng = createRng(`large-rotation-sample-${prestige}`)

      for (let index = 0; index < 250; index += 1) {
        const team = generateTeam({
          name: `Rotation Sample ${prestige}-${index}`,
          abbreviation: `P${prestige}`,
          prestige,
          rng,
        })
        const rotation = generateDefaultRotation(team)

        expect(validateRotation(team, rotation).valid).toBe(true)
        expect(calculateTotalMinutes(rotation)).toBe(200)
        generatedTeamCount += 1
      }
    }

    expect(generatedTeamCount).toBe(750)
  })

  it('does not use randomness or mutate the team', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const team = generateTeam({
      name: 'Immutable State',
      abbreviation: 'IMS',
      prestige: 65,
      rng: createRng('immutable-rotation-team'),
    })
    const before = JSON.parse(JSON.stringify(team)) as Team

    expect(() => generateDefaultRotation(team)).not.toThrow()
    expect(team).toEqual(before)
  })

  it('rejects a team with no natural player at a position', () => {
    const team = makeFixtureTeam()
    team.roster = team.roster.filter((player) => player.position !== 'SF')

    expect(() => generateDefaultRotation(team)).toThrow(RangeError)
  })
})
