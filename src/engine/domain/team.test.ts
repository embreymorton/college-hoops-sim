import { describe, expect, it } from 'vitest'
import { createRng } from '../random'
import { generateTeam } from '../generation'
import {
  calculateOverall,
  calculateRosterAverage,
  calculateTopPlayersAverage,
  TEAM_ROSTER_SIZE,
  type Team,
} from './index'

function makeTeam(): Team {
  return generateTeam({
    name: 'Test State',
    abbreviation: 'TST',
    prestige: 60,
    rng: createRng('team-domain'),
  })
}

describe('Team domain model', () => {
  it('is JSON serializable and stores no mutable derived rating', () => {
    const team = makeTeam()
    const roundTripped = JSON.parse(JSON.stringify(team)) as Team

    expect(roundTripped).toEqual(team)
    expect(roundTripped.roster).toHaveLength(TEAM_ROSTER_SIZE)
    expect('overall' in roundTripped).toBe(false)
  })

  it('derives roster and top-player averages without mutating the roster', () => {
    const team = makeTeam()
    const before = JSON.parse(JSON.stringify(team.roster)) as Team['roster']
    const overalls = team.roster.map(calculateOverall)
    const expectedRosterAverage =
      overalls.reduce((sum, overall) => sum + overall, 0) / overalls.length
    const expectedTopFiveAverage =
      [...overalls]
        .sort((first, second) => second - first)
        .slice(0, 5)
        .reduce((sum, overall) => sum + overall, 0) / 5

    expect(calculateRosterAverage(team.roster)).toBe(expectedRosterAverage)
    expect(calculateTopPlayersAverage(team.roster)).toBe(
      expectedTopFiveAverage,
    )
    expect(team.roster).toEqual(before)
  })

  it('validates derived-average inputs', () => {
    const roster = makeTeam().roster

    expect(() => calculateRosterAverage([])).toThrow(RangeError)
    expect(() => calculateTopPlayersAverage(roster, 0)).toThrow(RangeError)
    expect(() => calculateTopPlayersAverage(roster, 1.5)).toThrow(RangeError)
    expect(() =>
      calculateTopPlayersAverage(roster, roster.length + 1),
    ).toThrow(RangeError)
  })
})
