import { describe, expect, it } from 'vitest'
import {
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculateTeamDefense,
  calculateTeamOffense,
  calculateTeamStrength,
  convertRotationV0ToV1,
  createRng,
  derivePlayerMinutes,
  generateDefaultRotation,
  generateTeam,
  simulateGame,
  validateRotationV1,
  type RotationV1,
  type Team,
} from '../index'

function makeTeam(id: string, prestige: number): Team {
  const team = generateTeam({
    name: id,
    abbreviation: id.slice(0, 3).toUpperCase(),
    prestige,
    rng: createRng(`rotation-input-${id}`),
  })

  return { ...team, id }
}

function makeMatchup(homePrestige = 60, awayPrestige = 60) {
  const homeTeam = makeTeam(`home-${homePrestige}`, homePrestige)
  const awayTeam = makeTeam(`away-${awayPrestige}`, awayPrestige)
  const homeV0 = generateDefaultRotation(homeTeam)
  const awayV0 = generateDefaultRotation(awayTeam)

  return {
    homeTeam,
    awayTeam,
    homeV0,
    awayV0,
    homeV1: convertRotationV0ToV1(homeTeam, homeV0),
    awayV1: convertRotationV0ToV1(awayTeam, awayV0),
  }
}

function makeTrueSecondaryRotation(
  team: Team,
  rotation: RotationV1,
): RotationV1 {
  const result = JSON.parse(JSON.stringify(rotation)) as RotationV1
  const powerForward = team.roster.find(
    (player) =>
      player.position === 'PF' &&
      (result.minutesByPosition.PF[player.id] ?? 0) > 0,
  )!
  const center = team.roster.find(
    (player) =>
      player.position === 'C' &&
      (result.minutesByPosition.C[player.id] ?? 0) > 0,
  )!

  result.minutesByPosition.PF[powerForward.id] =
    (result.minutesByPosition.PF[powerForward.id] ?? 0) - 1
  result.minutesByPosition.C[center.id] =
    (result.minutesByPosition.C[center.id] ?? 0) - 1
  result.minutesByPosition.PF[center.id] =
    (result.minutesByPosition.PF[center.id] ?? 0) + 1
  result.minutesByPosition.C[powerForward.id] =
    (result.minutesByPosition.C[powerForward.id] ?? 0) + 1

  return result
}

describe('Rotation V0/V1 engine read equivalence', () => {
  it.each([
    ['balanced', 60, 60],
    ['material strength gap', 90, 30],
  ])('produces identical Team Strength for %s Teams', (_name, home, away) => {
    const matchup = makeMatchup(home, away)

    for (const [team, v0, v1] of [
      [matchup.homeTeam, matchup.homeV0, matchup.homeV1],
      [matchup.awayTeam, matchup.awayV0, matchup.awayV1],
    ] as const) {
      expect(calculateTeamOffense(team, v1)).toBe(
        calculateTeamOffense(team, v0),
      )
      expect(calculateTeamDefense(team, v1)).toBe(
        calculateTeamDefense(team, v0),
      )
      expect(calculateTeamStrength(team, v1)).toEqual(
        calculateTeamStrength(team, v0),
      )
    }
  })

  it.each([
    ['normal close game', 60, 60, 'equivalence-normal', 'home'],
    ['material strength gap', 90, 30, 'equivalence-gap', 'home'],
    ['known overtime game', 60, 60, 'equivalence-overtime-3', 'neutral'],
  ] as const)(
    'produces a deeply identical %s result',
    (_name, homePrestige, awayPrestige, seed, site) => {
      const matchup = makeMatchup(homePrestige, awayPrestige)
      const v0Result = simulateGame({
        homeTeam: matchup.homeTeam,
        awayTeam: matchup.awayTeam,
        homeRotation: matchup.homeV0,
        awayRotation: matchup.awayV0,
        seed,
        site,
      })
      const v1Result = simulateGame({
        homeTeam: matchup.homeTeam,
        awayTeam: matchup.awayTeam,
        homeRotation: matchup.homeV1,
        awayRotation: matchup.awayV1,
        seed,
        site,
      })

      expect(v1Result).toEqual(v0Result)
      if (seed === 'equivalence-overtime-3') {
        expect(v1Result.overtimePeriods).toBeGreaterThan(0)
      }
    },
  )

  it('supports deeply equivalent mixed V0/V1 matchups in both directions', () => {
    const matchup = makeMatchup(70, 55)
    const options = {
      homeTeam: matchup.homeTeam,
      awayTeam: matchup.awayTeam,
      seed: 'equivalence-mixed',
      site: 'neutral',
    } as const
    const baseline = simulateGame({
      ...options,
      homeRotation: matchup.homeV0,
      awayRotation: matchup.awayV0,
    })

    expect(
      simulateGame({
        ...options,
        homeRotation: matchup.homeV0,
        awayRotation: matchup.awayV1,
      }),
    ).toEqual(baseline)
    expect(
      simulateGame({
        ...options,
        homeRotation: matchup.homeV1,
        awayRotation: matchup.awayV0,
      }),
    ).toEqual(baseline)
  })

  it('consumes legal true-secondary minutes through natural Player roles', () => {
    const matchup = makeMatchup(65, 60)
    const secondaryV1 = makeTrueSecondaryRotation(
      matchup.homeTeam,
      matchup.homeV1,
    )
    const aggregateMinutes = derivePlayerMinutes(secondaryV1)
    const powerForward = matchup.homeTeam.roster.find(
      (player) =>
        player.position === 'PF' &&
        (secondaryV1.minutesByPosition.C[player.id] ?? 0) > 0,
    )!
    const center = matchup.homeTeam.roster.find(
      (player) =>
        player.position === 'C' &&
        (secondaryV1.minutesByPosition.PF[player.id] ?? 0) > 0,
    )!

    expect(validateRotationV1(matchup.homeTeam, secondaryV1)).toEqual({
      valid: true,
      issues: [],
    })
    expect(aggregateMinutes).toEqual(matchup.homeV0.minutes)
    expect(calculateTeamStrength(matchup.homeTeam, secondaryV1)).toEqual(
      calculateTeamStrength(matchup.homeTeam, matchup.homeV0),
    )

    const secondaryResult = simulateGame({
      homeTeam: matchup.homeTeam,
      awayTeam: matchup.awayTeam,
      homeRotation: secondaryV1,
      awayRotation: matchup.awayV1,
      seed: 'true-secondary-game',
    })
    const aggregateResult = simulateGame({
      homeTeam: matchup.homeTeam,
      awayTeam: matchup.awayTeam,
      homeRotation: matchup.homeV0,
      awayRotation: matchup.awayV0,
      seed: 'true-secondary-game',
    })

    expect(secondaryResult).toEqual(aggregateResult)
    expect(powerForward.position).toBe('PF')
    expect(center.position).toBe('C')
    expect(calculatePlayerOffense(powerForward)).toBeGreaterThan(0)
    expect(calculatePlayerDefense(center)).toBeGreaterThan(0)
    expect(
      secondaryResult.homePlayerStats.find(
        ({ playerId }) => playerId === powerForward.id,
      )?.minutes,
    ).toBe(aggregateMinutes[powerForward.id])
    expect(
      secondaryResult.homePlayerStats.find(
        ({ playerId }) => playerId === center.id,
      )?.minutes,
    ).toBe(aggregateMinutes[center.id])
  })
})
