import { describe, expect, it } from 'vitest'
import { createRng, generateTeam, TEAM_ROSTER_SIZE, type ClassYear } from '../engine'
import { deriveProjectedRosterOutlook } from './index'

function teamWithClasses(classes: readonly ClassYear[]) {
  const team = generateTeam({
    name: 'Outlook State',
    abbreviation: 'OUT',
    prestige: 60,
    rng: createRng('projected-roster-outlook'),
  })
  return {
    ...team,
    roster: team.roster.map((player, index) => ({
      ...player,
      classYear: classes[index] ?? 'FR',
    })),
  }
}

describe('projected roster outlook', () => {
  it.each([0, 1, 3])('projects %i senior departure(s) as matching openings', (seniorCount) => {
    const classes = Array.from({ length: TEAM_ROSTER_SIZE }, (_, index) =>
      index < seniorCount ? 'SR' : (['FR', 'SO', 'JR'][index % 3] as ClassYear),
    )
    const team = teamWithClasses(classes)
    const before = structuredClone(team)
    const outlook = deriveProjectedRosterOutlook(team)

    expect(outlook.projectedDepartingPlayerIds).toEqual(
      team.roster.filter(({ classYear }) => classYear === 'SR').map(({ id }) => id),
    )
    expect(outlook.projectedReturningPlayerIds).toEqual(
      team.roster.filter(({ classYear }) => classYear !== 'SR').map(({ id }) => id),
    )
    expect(outlook.projectedOpenings).toBe(seniorCount)
    expect(Object.values(outlook.projectedOpeningsByPosition).reduce(
      (sum, openings) => sum + openings,
      0,
    )).toBe(seniorCount)
    for (const player of team.roster.filter(({ classYear }) => classYear === 'SR')) {
      expect(outlook.projectedOpeningsByPosition[player.position]).toBeGreaterThan(0)
    }
    expect(outlook.currentRosterSize).toBe(TEAM_ROSTER_SIZE)
    expect(team).toEqual(before)
  })

  it('depends only on the supplied current roster, not ownership or season completion', () => {
    const team = teamWithClasses(['FR', 'SO', 'JR', 'SR'])
    expect(deriveProjectedRosterOutlook(team)).toEqual(
      deriveProjectedRosterOutlook(structuredClone(team)),
    )
  })
})
