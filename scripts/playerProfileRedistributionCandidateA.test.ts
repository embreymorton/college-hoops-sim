import { describe, expect, it } from 'vitest'
import type { Player, Position } from '../src/engine/domain/player'
import { calculateOverall } from '../src/engine/domain/overall'
import {
  applyPlayerProfileRedistributionCandidateA,
  candidateASelectionProbability,
  CANDIDATE_A_CONFIG,
  type CandidateAProfileKind,
} from './playerProfileRedistributionCandidateA'

function player(id: string, position: Position = 'SF', rating = 82): Player {
  return {
    id, firstName: 'Test', lastName: 'Player', position, classYear: 'JR', height: 78,
    potential: 92,
    attributes: { finishing: rating, shooting: rating, playmaking: rating, ballHandling: rating, perimeterDefense: rating, interiorDefense: rating, rebounding: rating, athleticism: rating, stamina: rating },
  }
}

function selected(kind?: CandidateAProfileKind, position: Position = 'SF'): ReturnType<typeof applyPlayerProfileRedistributionCandidateA> {
  for (let index = 0; index < 100_000; index += 1) {
    const result = applyPlayerProfileRedistributionCandidateA(player(`candidate-a-${kind ?? 'any'}-${position}-${index}`, position))
    if (result.applied && (!kind || result.kind === kind)) return result
  }
  throw new Error('Unable to locate deterministic selected fixture')
}

describe('Profile Generation Candidate A experimental transform', () => {
  it('is deterministic and isolated by stable Player ID', () => {
    const fixture = selected().player
    expect(applyPlayerProfileRedistributionCandidateA(fixture)).toEqual(applyPlayerProfileRedistributionCandidateA(fixture))
    applyPlayerProfileRedistributionCandidateA(player('irrelevant-call'))
    expect(applyPlayerProfileRedistributionCandidateA(fixture)).toEqual(applyPlayerProfileRedistributionCandidateA(fixture))
  })

  it('leaves non-selected Players exactly unchanged', () => {
    let fixture = player('non-selection-0')
    let result = applyPlayerProfileRedistributionCandidateA(fixture)
    for (let index = 1; result.selected; index += 1) {
      fixture = player(`non-selection-${index}`)
      result = applyPlayerProfileRedistributionCandidateA(fixture)
    }
    expect(result.selected).toBe(false)
    expect(result.player).toBe(fixture)
  })

  it('applies the frozen OVR eligibility and rising capped selection curve', () => {
    expect(candidateASelectionProbability(69)).toBe(0)
    expect(candidateASelectionProbability(70)).toBe(.02)
    expect(candidateASelectionProbability(80)).toBe(.07)
    expect(candidateASelectionProbability(99)).toBe(.15)
  })

  it('supports conventional profiles with multiple strengths and weaknesses', () => {
    const result = selected('conventional')
    const deltas = Object.keys(result.player.attributes).map((key) => result.player.attributes[key as keyof Player['attributes']] - 82)
    expect(result.applied).toBe(true)
    expect(deltas.filter((value) => value > 0).length).toBeGreaterThanOrEqual(2)
    expect(deltas.filter((value) => value < 0).length).toBeGreaterThanOrEqual(2)
  })

  it('supports unusual-secondary profiles', () => {
    const result = selected('unusual-secondary', 'C')
    expect(result.applied).toBe(true)
    expect(result.path).toBe('playmaking-big')
  })

  it('conserves weighted value without free talent', () => {
    const result = selected()
    expect(result.weightedAdded).toBeLessThanOrEqual(result.weightedRemoved + 1e-9)
    expect(result.weightedRemoved).toBeGreaterThan(0)
  })

  it('preserves canonical OVR within the hard tolerance', () => {
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      const result = selected(undefined, position)
      expect(Math.abs(result.candidateOverall - result.baselineOverall)).toBeLessThanOrEqual(CANDIDATE_A_CONFIG.maximumOverallDelta)
      expect(calculateOverall(result.player)).toBe(result.candidateOverall)
    }
  })

  it('respects attribute floors, caps, and per-attribute deltas', () => {
    const result = selected()
    for (const [name, value] of Object.entries(result.player.attributes)) {
      expect(value).toBeGreaterThanOrEqual(CANDIDATE_A_CONFIG.attributeFloor)
      expect(value).toBeLessThanOrEqual(CANDIDATE_A_CONFIG.attributeCap)
      expect(value - player('baseline').attributes[name as keyof Player['attributes']]).toBeLessThanOrEqual(CANDIDATE_A_CONFIG.maximumAttributeIncrease)
      expect(value - 82).toBeGreaterThanOrEqual(-CANDIDATE_A_CONFIG.maximumAttributeDecrease)
    }
  })

  it('skips safely when bounds make a valid profile impossible', () => {
    let found = false
    for (let index = 0; index < 100_000 && !found; index += 1) {
      const fixture = player(`bounded-${index}`)
      for (const key of Object.keys(fixture.attributes) as (keyof Player['attributes'])[]) fixture.attributes[key] = 99
      const result = applyPlayerProfileRedistributionCandidateA(fixture)
      if (result.selected) {
        found = true
        expect(result.applied).toBe(false)
        expect(result.player).toBe(fixture)
        expect(result.skipReason).toBe('bounds')
      }
    }
    expect(found).toBe(true)
  })

  it('does not mutate input records or persist an archetype field', () => {
    const result = selected()
    const input = player('immutability')
    const snapshot = structuredClone(input)
    applyPlayerProfileRedistributionCandidateA(input)
    expect(input).toEqual(snapshot)
    expect('archetype' in result.player).toBe(false)
  })

  it('does not modify potential, identity, position, class, or height', () => {
    const result = selected()
    expect({ ...result.player, attributes: undefined }).toEqual({ ...player(result.player.id), attributes: undefined })
  })
})
