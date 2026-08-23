import { describe, expect, it } from 'vitest'
import type { Player } from '../engine'
import {
  deriveBiggestLeap,
  deriveVisibleDevelopmentGains,
  formatDevelopmentGains,
  formatSeniorCareerContext,
  type DevelopmentRow,
} from './offseasonFormatters'

function player(id: string, attributes: Player['attributes']): Player {
  return {
    id,
    firstName: 'Test',
    lastName: id,
    position: 'PG',
    classYear: 'FR',
    height: 74,
    potential: 95,
    attributes,
  }
}

const baseAttributes: Player['attributes'] = {
  finishing: 70,
  shooting: 70,
  playmaking: 70,
  ballHandling: 70,
  perimeterDefense: 70,
  interiorDefense: 70,
  rebounding: 70,
  athleticism: 70,
  stamina: 70,
}

describe('Offseason Development storytelling projections', () => {
  it('uses canonical before/after attributes, keeps positive gains, orders them, and caps at three', () => {
    const before = player('gains', baseAttributes)
    const after = player('gains', {
      ...baseAttributes,
      finishing: 69,
      shooting: 75,
      playmaking: 72,
      ballHandling: 73,
      perimeterDefense: 71,
    })

    const gains = deriveVisibleDevelopmentGains(before, after)

    expect(gains).toEqual([
      { attribute: 'shooting', change: 5 },
      { attribute: 'ballHandling', change: 3 },
      { attribute: 'playmaking', change: 2 },
    ])
    expect(formatDevelopmentGains(gains)).toBe(
      'Shooting +5 · Ball Handling +3 · Playmaking +2',
    )
  })

  it('returns no gains for an unchanged Player', () => {
    const before = player('same', baseAttributes)
    expect(deriveVisibleDevelopmentGains(before, before)).toEqual([])
    expect(formatDevelopmentGains([])).toBe('')
  })

  it('selects the largest OVR increase with a deterministic tie, regardless of final OVR', () => {
    const makeRow = (
      id: string,
      overallChange: number,
      previousOverall = 70,
    ): DevelopmentRow => ({
      player: { ...player(id, baseAttributes), lastName: id },
      gains: [],
      explosion: null,
      workEthicReveal: null,
      summary: {
        programId: 'program',
        playerId: id,
        completedClass: 'FR',
        nextClass: 'SO',
        previousOverall,
        currentOverall: previousOverall + overallChange,
        overallChange,
        potentialHeadroom: 25,
      },
    })
    const rows = [
      makeRow('zeta-tie', 4),
      makeRow('high-final-lower-gain', 3, 90),
      makeRow('alpha-tie', 4),
    ]

    expect(deriveBiggestLeap(rows)?.player.id).toBe('alpha-tie')
    expect(deriveBiggestLeap([makeRow('unchanged', 0)])).toBeNull()
    expect(deriveBiggestLeap([])).toBeNull()
  })

  it('labels senior tenure as the seasons observed with the Program', () => {
    expect(formatSeniorCareerContext({
      seasonsPlayed: 2,
      pointsPerGame: 4.74,
      reboundsPerGame: 1.26,
      assistsPerGame: 1.15,
      peakOverall: 81,
    }, 'Northbridge')).toBe(
      '2 seasons with Northbridge · 4.7 PPG · 1.3 RPG · 1.1 APG · Peak 81 OVR',
    )
  })
})
