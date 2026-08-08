import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateDefaultRotation, generateTeam } from '../generation'
import { createRng } from '../random'
import {
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculateTeamDefense,
  calculateTeamOffense,
  calculateTeamStrength,
  POSITIONS,
  validateRotation,
  type Player,
  type PlayerAttributes,
  type Position,
  type Rotation,
  type Team,
} from './index'

function makeAttributes(
  overrides: Partial<PlayerAttributes> = {},
): PlayerAttributes {
  return {
    finishing: 70,
    shooting: 70,
    playmaking: 70,
    ballHandling: 70,
    perimeterDefense: 70,
    interiorDefense: 70,
    rebounding: 70,
    athleticism: 70,
    stamina: 70,
    ...overrides,
  }
}

function makePlayer(
  id: string,
  position: Position,
  attributes: PlayerAttributes = makeAttributes(),
  overrides: Partial<Player> = {},
): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes,
    potential: 99,
    ...overrides,
  }
}

function makeTeam(roster: Player[]): Team {
  return {
    id: 'team-strength-fixture',
    name: 'Strength Fixture',
    abbreviation: 'STF',
    prestige: 60,
    roster,
  }
}

function baseLineup(excludedPosition?: Position): Player[] {
  return POSITIONS.filter((position) => position !== excludedPosition).map(
    (position) => makePlayer(`${position}-base`, position),
  )
}

function rotationForPlayers(players: readonly Player[]): Rotation {
  return {
    minutes: Object.fromEntries(players.map((player) => [player.id, 40])),
  }
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('derived player offense and defense', () => {
  it.each(POSITIONS)('preserves a uniform %s profile', (position) => {
    const player = makePlayer(
      `uniform-${position}`,
      position,
      makeAttributes({
        finishing: 76,
        shooting: 76,
        playmaking: 76,
        ballHandling: 76,
        perimeterDefense: 76,
        interiorDefense: 76,
        rebounding: 76,
        athleticism: 76,
        stamina: 76,
      }),
    )

    expect(calculatePlayerOffense(player)).toBeCloseTo(76, 10)
    expect(calculatePlayerDefense(player)).toBeCloseTo(76, 10)
  })

  it('is deterministic and preserves fractional precision', () => {
    const player = makePlayer(
      'precision-wing',
      'SF',
      makeAttributes({ shooting: 83, playmaking: 77, rebounding: 69 }),
    )

    expect(calculatePlayerOffense(player)).toBe(
      calculatePlayerOffense(player),
    )
    expect(calculatePlayerDefense(player)).toBe(
      calculatePlayerDefense(player),
    )
    expect(Number.isInteger(calculatePlayerOffense(player))).toBe(false)
  })

  it('does not use potential or class year', () => {
    const attributes = makeAttributes({ shooting: 88, perimeterDefense: 82 })
    const freshman = makePlayer('same-current-fr', 'SG', attributes, {
      classYear: 'FR',
      potential: 99,
    })
    const senior = makePlayer('same-current-sr', 'SG', attributes, {
      classYear: 'SR',
      potential: 80,
    })

    expect(calculatePlayerOffense(freshman)).toBe(
      calculatePlayerOffense(senior),
    )
    expect(calculatePlayerDefense(freshman)).toBe(
      calculatePlayerDefense(senior),
    )
  })

  it('does not double-count stamina as offensive or defensive skill', () => {
    const lowStamina = makePlayer(
      'low-stamina',
      'PF',
      makeAttributes({ stamina: 40 }),
    )
    const highStamina = makePlayer(
      'high-stamina',
      'PF',
      makeAttributes({ stamina: 99 }),
    )

    expect(calculatePlayerOffense(lowStamina)).toBe(
      calculatePlayerOffense(highStamina),
    )
    expect(calculatePlayerDefense(lowStamina)).toBe(
      calculatePlayerDefense(highStamina),
    )
  })

  it('separates offensive and defensive specialists', () => {
    const offensiveSpecialist = makePlayer(
      'offensive-specialist',
      'SG',
      makeAttributes({
        finishing: 92,
        shooting: 96,
        playmaking: 85,
        ballHandling: 91,
        perimeterDefense: 48,
        interiorDefense: 45,
        rebounding: 50,
        athleticism: 82,
      }),
    )
    const defensiveSpecialist = makePlayer(
      'defensive-specialist',
      'SG',
      makeAttributes({
        finishing: 48,
        shooting: 45,
        playmaking: 50,
        ballHandling: 52,
        perimeterDefense: 96,
        interiorDefense: 82,
        rebounding: 80,
        athleticism: 88,
      }),
    )

    expect(calculatePlayerOffense(offensiveSpecialist)).toBeGreaterThan(
      calculatePlayerOffense(defensiveSpecialist) + 25,
    )
    expect(calculatePlayerDefense(defensiveSpecialist)).toBeGreaterThan(
      calculatePlayerDefense(offensiveSpecialist) + 25,
    )
  })

  it('values perimeter creation more for guards and interior offense more for centers', () => {
    const perimeterAttributes = makeAttributes({
      finishing: 60,
      shooting: 95,
      playmaking: 95,
      ballHandling: 95,
      athleticism: 80,
      rebounding: 45,
    })
    const interiorAttributes = makeAttributes({
      finishing: 95,
      shooting: 45,
      playmaking: 45,
      ballHandling: 45,
      athleticism: 90,
      rebounding: 92,
    })

    expect(
      calculatePlayerOffense(makePlayer('creator-pg', 'PG', perimeterAttributes)),
    ).toBeGreaterThan(
      calculatePlayerOffense(makePlayer('creator-c', 'C', perimeterAttributes)) +
        20,
    )
    expect(
      calculatePlayerOffense(makePlayer('interior-c', 'C', interiorAttributes)),
    ).toBeGreaterThan(
      calculatePlayerOffense(makePlayer('interior-pg', 'PG', interiorAttributes)) +
        20,
    )
  })

  it('values perimeter defense for guards and interior defense for centers', () => {
    const perimeterAttributes = makeAttributes({
      perimeterDefense: 96,
      interiorDefense: 45,
      rebounding: 50,
      athleticism: 88,
    })
    const interiorAttributes = makeAttributes({
      perimeterDefense: 45,
      interiorDefense: 96,
      rebounding: 94,
      athleticism: 88,
    })

    expect(
      calculatePlayerDefense(makePlayer('stopper-pg', 'PG', perimeterAttributes)),
    ).toBeGreaterThan(
      calculatePlayerDefense(makePlayer('stopper-c', 'C', perimeterAttributes)) +
        20,
    )
    expect(
      calculatePlayerDefense(makePlayer('rim-c', 'C', interiorAttributes)),
    ).toBeGreaterThan(
      calculatePlayerDefense(makePlayer('rim-pg', 'PG', interiorAttributes)) +
        20,
    )
  })
})

describe('rotation-weighted team strength', () => {
  it('calculates uniform team strength from exactly 200 player-minutes', () => {
    const players = baseLineup()
    const team = makeTeam(players)
    const rotation = rotationForPlayers(players)

    expect(validateRotation(team, rotation).valid).toBe(true)
    expect(calculateTeamOffense(team, rotation)).toBeCloseTo(70, 10)
    expect(calculateTeamDefense(team, rotation)).toBeCloseTo(70, 10)
    expect(calculateTeamStrength(team, rotation)).toEqual({
      offense: 70,
      defense: 70,
      overall: 70,
    })
  })

  it('gives a zero-minute elite scorer no influence', () => {
    const eliteAttributes = makeAttributes({
      finishing: 99,
      shooting: 99,
      playmaking: 99,
      ballHandling: 99,
      athleticism: 99,
      rebounding: 99,
    })
    const weakAttributes = makeAttributes({
      finishing: 45,
      shooting: 45,
      playmaking: 45,
      ballHandling: 45,
      athleticism: 45,
      rebounding: 45,
    })
    const elite = makePlayer('elite-pg', 'PG', eliteAttributes)
    const weak = makePlayer('weak-pg', 'PG', weakAttributes)
    const otherPlayers = baseLineup('PG')
    const team = makeTeam([...otherPlayers, elite, weak])
    const rotation = {
      minutes: {
        ...rotationForPlayers(otherPlayers).minutes,
        [weak.id]: 40,
      },
    }
    const offenseWithElite = calculateTeamOffense(team, rotation)
    const teamWithoutEliteTalent = makeTeam(
      team.roster.map((player) =>
        player.id === elite.id
          ? { ...player, attributes: weakAttributes }
          : player,
      ),
    )

    expect(rotation.minutes[elite.id]).toBeUndefined()
    expect(calculateTeamOffense(teamWithoutEliteTalent, rotation)).toBe(
      offenseWithElite,
    )
  })

  it('materially increases influence when an elite scorer moves from 5 to 35 minutes', () => {
    const sharedDefense = {
      perimeterDefense: 70,
      interiorDefense: 70,
      athleticism: 70,
      rebounding: 70,
    }
    const elite = makePlayer(
      'elite-scorer',
      'PG',
      makeAttributes({
        ...sharedDefense,
        finishing: 95,
        shooting: 95,
        playmaking: 95,
        ballHandling: 95,
      }),
    )
    const backup = makePlayer(
      'limited-scorer',
      'PG',
      makeAttributes({
        ...sharedDefense,
        finishing: 45,
        shooting: 45,
        playmaking: 45,
        ballHandling: 45,
      }),
    )
    const otherPlayers = baseLineup('PG')
    const team = makeTeam([...otherPlayers, elite, backup])
    const otherMinutes = rotationForPlayers(otherPlayers).minutes
    const lowMinutes: Rotation = {
      minutes: { ...otherMinutes, [elite.id]: 5, [backup.id]: 35 },
    }
    const highMinutes: Rotation = {
      minutes: { ...otherMinutes, [elite.id]: 35, [backup.id]: 5 },
    }

    expect(
      calculateTeamOffense(team, highMinutes) -
        calculateTeamOffense(team, lowMinutes),
    ).toBeGreaterThan(6)
    expect(calculateTeamDefense(team, highMinutes)).toBeCloseTo(
      calculateTeamDefense(team, lowMinutes),
      10,
    )
  })

  it('improves defense without changing offense when a specialist replaces a weak defender', () => {
    const sharedOffense = {
      finishing: 70,
      shooting: 70,
      playmaking: 70,
      ballHandling: 70,
      athleticism: 75,
      rebounding: 70,
    }
    const specialist = makePlayer(
      'defensive-stop',
      'SG',
      makeAttributes({
        ...sharedOffense,
        perimeterDefense: 96,
        interiorDefense: 90,
      }),
    )
    const weakDefender = makePlayer(
      'defensive-liability',
      'SG',
      makeAttributes({
        ...sharedOffense,
        perimeterDefense: 45,
        interiorDefense: 45,
      }),
    )
    const otherPlayers = baseLineup('SG')
    const team = makeTeam([...otherPlayers, specialist, weakDefender])
    const otherMinutes = rotationForPlayers(otherPlayers).minutes
    const weakHeavy: Rotation = {
      minutes: {
        ...otherMinutes,
        [specialist.id]: 5,
        [weakDefender.id]: 35,
      },
    }
    const specialistHeavy: Rotation = {
      minutes: {
        ...otherMinutes,
        [specialist.id]: 35,
        [weakDefender.id]: 5,
      },
    }

    expect(calculateTeamOffense(team, specialistHeavy)).toBeCloseTo(
      calculateTeamOffense(team, weakHeavy),
      10,
    )
    expect(
      calculateTeamDefense(team, specialistHeavy) -
        calculateTeamDefense(team, weakHeavy),
    ).toBeGreaterThan(4)
  })

  it('rejects invalid rotations instead of normalizing them', () => {
    const players = baseLineup()
    const team = makeTeam(players)
    const invalidRotation = rotationForPlayers(players)
    invalidRotation.minutes[players[0]?.id ?? ''] = 39

    expect(() => calculateTeamStrength(team, invalidRotation)).toThrow(
      RangeError,
    )
  })

  it('does not mutate inputs and returns serializable derived data', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const team = generateTeam({
      name: 'Immutable Strength',
      abbreviation: 'IMS',
      prestige: 68,
      rng: createRng('immutable-strength-team'),
    })
    const rotation = generateDefaultRotation(team)
    const teamBefore = JSON.parse(JSON.stringify(team))
    const rotationBefore = JSON.parse(JSON.stringify(rotation))
    const strength = calculateTeamStrength(team, rotation)

    expect(JSON.parse(JSON.stringify(strength))).toEqual(strength)
    expect(team).toEqual(teamBefore)
    expect(rotation).toEqual(rotationBefore)
  })

  it('produces valid, distinct OFF/DEF ratings across a large generated sample', () => {
    const strengthsByPrestige = [30, 45, 60, 75, 90].map((prestige) => {
      const rng = createRng(`strength-test-sample-${prestige}`)
      const strengths = Array.from({ length: 200 }, (_, index) => {
        const team = generateTeam({
          name: `Strength Sample ${prestige}-${index}`,
          abbreviation: `P${prestige}`,
          prestige,
          rng,
        })
        const rotation = generateDefaultRotation(team)
        const strength = calculateTeamStrength(team, rotation)

        expect(validateRotation(team, rotation).valid).toBe(true)
        expect(strength.offense).toBeGreaterThanOrEqual(40)
        expect(strength.offense).toBeLessThanOrEqual(99)
        expect(strength.defense).toBeGreaterThanOrEqual(40)
        expect(strength.defense).toBeLessThanOrEqual(99)

        return strength
      })

      expect(
        average(
          strengths.map(({ offense, defense }) => Math.abs(offense - defense)),
        ),
      ).toBeGreaterThan(1)

      return {
        offense: average(strengths.map(({ offense }) => offense)),
        defense: average(strengths.map(({ defense }) => defense)),
        overall: average(strengths.map(({ overall }) => overall)),
      }
    })

    for (let index = 1; index < strengthsByPrestige.length; index += 1) {
      const lower = strengthsByPrestige[index - 1] as (typeof strengthsByPrestige)[number]
      const higher = strengthsByPrestige[index] as (typeof strengthsByPrestige)[number]

      expect(higher.offense - lower.offense).toBeGreaterThan(4)
      expect(higher.defense - lower.defense).toBeGreaterThan(4)
      expect(higher.overall - lower.overall).toBeGreaterThan(4)
    }
  })
})
