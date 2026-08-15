import { describe, expect, it } from 'vitest'
import type { Player, Position } from '../src/engine/domain/player'
import { calculateOverall } from '../src/engine/domain/overall'
import { applyPlayerProfileRedistributionCandidateA } from './playerProfileRedistributionCandidateA'
import { applyPlayerProfileRedistributionCandidateAV2, CANDIDATE_A_V2_NAMESPACE } from './playerProfileRedistributionCandidateAV2'

function player(id: string, position: Position = 'SF', rating = 82): Player {
  return { id, firstName: 'V2', lastName: 'Fixture', position, classYear: 'JR', height: 79, potential: 94, attributes: { finishing: rating, shooting: rating, playmaking: rating, ballHandling: rating, perimeterDefense: rating, interiorDefense: rating, rebounding: rating, athleticism: rating, stamina: rating } }
}

function applied(position: Position = 'SF', unusual = false) {
  for (let index = 0; index < 200_000; index += 1) {
    const input = player(`v2-${position}-${unusual}-${index}`, position)
    const result = applyPlayerProfileRedistributionCandidateAV2(input)
    if (result.applied && (unusual ? result.kind === 'unusual-secondary' : result.kind === 'conventional')) return { input, result }
  }
  throw new Error('No applied deterministic V2 fixture found')
}

describe('Profile Generation Candidate A V2 weakness strategy', () => {
  it('is deterministic under an explicit isolated V2 namespace', () => {
    const { input } = applied()
    expect(CANDIDATE_A_V2_NAMESPACE).toBe('player-profile-redistribution-candidate-a-v2')
    expect(applyPlayerProfileRedistributionCandidateAV2(input)).toEqual(applyPlayerProfileRedistributionCandidateAV2(input))
  })

  it('preserves V1 selection, kind, and path', () => {
    const { input, result } = applied('SG')
    const v1 = applyPlayerProfileRedistributionCandidateA(input)
    expect({ selected: result.selected, kind: result.kind, path: result.path }).toEqual({ selected: v1.selected, kind: v1.kind, path: v1.path })
  })

  it('leaves non-selected Players byte-identical', () => {
    for (let index = 0; index < 100; index += 1) {
      const input = player(`v2-non-selected-${index}`)
      const result = applyPlayerProfileRedistributionCandidateAV2(input)
      if (!result.selected) { expect(result.player).toBe(input); expect(JSON.stringify(result.player)).toBe(JSON.stringify(input)); return }
    }
    throw new Error('No non-selected fixture found')
  })

  it('uses no more than two weakness channels', () => {
    const { result } = applied()
    expect(result.changedWeaknesses.length).toBeGreaterThanOrEqual(1)
    expect(result.changedWeaknesses.length).toBeLessThanOrEqual(2)
  })

  it('uses position- and path-plausible conventional sacrifices', () => {
    const { result } = applied('C')
    if (result.path === 'rim-protector') expect(result.changedWeaknesses).toEqual(expect.arrayContaining(['finishing']))
    else expect(result.changedWeaknesses).toEqual(expect.arrayContaining(['interiorDefense']))
  })

  it('makes unusual-secondary bigs trade traditional big value', () => {
    const { result } = applied('C', true)
    expect(result.path).toBe('playmaking-big')
    expect(result.changedWeaknesses).toEqual(expect.arrayContaining(['rebounding']))
  })

  it('shrinks instead of adding unrelated weakness channels', () => {
    const { result } = applied('C')
    expect(result.weightedRemoved).toBeLessThanOrEqual(4 + 1e-9)
    expect(result.changedWeaknesses.length).toBeLessThanOrEqual(2)
  })

  it('never adds more weighted value than it removes', () => {
    const { result } = applied('PF')
    expect(result.weightedAdded).toBeLessThanOrEqual(result.weightedRemoved + 1e-9)
  })

  it('keeps selected Players within ±1 canonical OVR', () => {
    for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
      const { result } = applied(position)
      expect(Math.abs(result.candidateOverall - result.baselineOverall)).toBeLessThanOrEqual(1)
      expect(calculateOverall(result.player)).toBe(result.candidateOverall)
    }
  })

  it('respects floor, cap, and V2 operational weakness limits', () => {
    const { input, result } = applied()
    for (const key of Object.keys(input.attributes) as (keyof Player['attributes'])[]) {
      expect(result.player.attributes[key]).toBeGreaterThanOrEqual(45)
      expect(result.player.attributes[key]).toBeLessThanOrEqual(99)
    }
    const drops = result.changedWeaknesses.map((key) => input.attributes[key] - result.player.attributes[key])
    expect(Math.max(...drops)).toBeLessThanOrEqual(14)
  })

  it('avoids the V1 three-floor pattern on a bounded fixture', () => {
    const { input } = applied('C')
    const result = applyPlayerProfileRedistributionCandidateAV2(input)
    expect(Object.values(result.player.attributes).filter((value) => value === 45).length).toBeLessThanOrEqual(2)
  })

  it('persists no archetype or diagnostic fields to Player', () => {
    const { result } = applied()
    expect('archetype' in result.player).toBe(false)
    expect('weaknessChannels' in result.player).toBe(false)
  })

  it('does not mutate its input', () => {
    const { input } = applied()
    const snapshot = structuredClone(input)
    applyPlayerProfileRedistributionCandidateAV2(input)
    expect(input).toEqual(snapshot)
  })
})
