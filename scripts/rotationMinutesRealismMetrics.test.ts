import { describe, expect, it } from 'vitest'
import {
  classifyExact40Origin,
  minuteBand,
  partitionRotationMinuteObservations,
  summarizeRotationMinutes,
  type RotationMinuteObservation,
} from './rotationMinutesRealismMetrics'

function observation(
  overrides: Partial<RotationMinuteObservation> = {},
): RotationMinuteObservation {
  return {
    seed: 'seed-a',
    seasonNumber: 1,
    programId: 'team-a',
    playerId: 'player-a',
    position: 'PG',
    overall: 90,
    teamOverall: 80,
    assignedMinutes: 40,
    naturalMinutes: 36,
    naturalPositionMinutes: 36,
    secondaryMinutes: 4,
    secondaryByPath: { 'PG→SG': 4 },
    minutesPerGame: 40,
    isTeamHighestOverall: true,
    isTeamTopThreeOverall: true,
    isTopTenPpg: true,
    isTopTenApg: false,
    isTopTenRpg: false,
    ...overrides,
  }
}

describe('rotation-minute realism metrics', () => {
  it('classifies every requested minute-band boundary', () => {
    expect([40, 39, 36, 35, 32, 31, 20, 19, 0].map(minuteBand)).toEqual([
      '40', '36–39', '36–39', '32–35', '32–35',
      '20–31', '20–31', 'below 20', 'below 20',
    ])
  })

  it('separates natural 40 and natural 36 to flexible 40 origins', () => {
    expect(classifyExact40Origin(40, 40)).toBe('naturalAlready40')
    expect(classifyExact40Origin(36, 40)).toBe('natural36ToFlexible40')
    expect(classifyExact40Origin(32, 40)).toBe('naturalBelow36ToFlexible40')
    expect(classifyExact40Origin(36, 39)).toBe('other')
  })

  it('aggregates secondary paths, elite rates, leaders, and canonical MPG', () => {
    const summary = summarizeRotationMinutes([
      observation(),
      observation({
        playerId: 'player-b',
        position: 'C',
        overall: 85,
        naturalMinutes: 40,
        naturalPositionMinutes: 40,
        secondaryMinutes: 0,
        secondaryByPath: {},
        minutesPerGame: 39.875,
        isTeamHighestOverall: false,
        isTopTenPpg: false,
        isTopTenRpg: true,
      }),
      observation({
        playerId: 'player-c',
        assignedMinutes: 36,
        naturalMinutes: 36,
        naturalPositionMinutes: 36,
        secondaryMinutes: 0,
        secondaryByPath: {},
        minutesPerGame: 36,
        isTeamHighestOverall: false,
        isTeamTopThreeOverall: true,
        isTopTenPpg: false,
        isTopTenApg: true,
      }),
    ])

    expect(summary.minuteBands['40'].count).toBe(2)
    expect(summary.teams.atLeastTwo.count).toBe(1)
    expect(summary.exact40Origins.natural36ToFlexible40.count).toBe(1)
    expect(summary.exact40Origins.naturalAlready40.count).toBe(1)
    expect(summary.exact40SecondaryPaths['PG→SG']).toEqual({ players: 1, minutes: 4 })
    expect(summary.exact40NaturalMinutes).toBe(76)
    expect(summary.exact40SecondaryMinutes).toBe(4)
    expect(summary.eliteRates.teamHighestOverall).toMatchObject({ count: 1, total: 1 })
    expect(summary.eliteRates.topTenPpg).toMatchObject({ count: 1, total: 1 })
    expect(summary.eliteRates.topTenApg).toMatchObject({ count: 0, total: 1 })
    expect(summary.eliteRates.topTenRpg).toMatchObject({ count: 1, total: 1 })
    expect(summary.assigned40ActualMpg).toMatchObject({
      players: 2,
      average: 39.9375,
      minimum: 39.875,
      maximum: 40,
      approximately40: 1,
    })
  })

  it('partitions Season 1 and Season 5+ while retaining all observations', () => {
    const values = [
      observation({ seasonNumber: 1, playerId: 'one' }),
      observation({ seasonNumber: 4, playerId: 'four' }),
      observation({ seasonNumber: 5, playerId: 'five' }),
      observation({ seasonNumber: 10, playerId: 'ten' }),
    ]
    const partitions = partitionRotationMinuteObservations(values)
    expect(partitions.all).toHaveLength(4)
    expect(partitions.season1.map(({ playerId }) => playerId)).toEqual(['one'])
    expect(partitions.season5plus.map(({ playerId }) => playerId)).toEqual(['five', 'ten'])
  })

  it('keeps same-season Teams from different Dynasty seeds distinct', () => {
    const summary = summarizeRotationMinutes([
      observation({ seed: 'seed-a' }),
      observation({ seed: 'seed-b' }),
    ])
    expect(summary.teams.total).toBe(2)
    expect(summary.teams.atLeastOne).toMatchObject({ count: 2, total: 2 })
  })
})
