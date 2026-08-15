import { describe, expect, it } from 'vitest'
import { calculateOverall } from '../src/engine/domain/overall'
import type { Player, PlayerAttributes, Position } from '../src/engine/domain/player'
import { calculateOverallCandidateB, explainOverallCandidateB } from './overallCandidateB'

const attrs = (finishing: number, shooting: number, playmaking: number, ballHandling: number, perimeterDefense: number, interiorDefense: number, rebounding: number, athleticism: number, stamina: number): PlayerAttributes => ({ finishing, shooting, playmaking, ballHandling, perimeterDefense, interiorDefense, rebounding, athleticism, stamina })
const make = (id: string, position: Position, attributes: PlayerAttributes): Player => ({ id, firstName: 'OVR', lastName: 'Probe', position, classYear: 'JR', height: 79, attributes, potential: 99 })
const probes = {
  offenseSg: make('offense-sg', 'SG', attrs(97, 98, 85, 94, 60, 45, 48, 94, 90)),
  twoWaySg: make('two-way-sg', 'SG', attrs(95, 96, 83, 92, 94, 55, 65, 92, 90)),
  playmakingSg: make('play-sg', 'SG', attrs(91, 92, 97, 97, 65, 48, 52, 91, 90)),
  defenseSg: make('def-sg', 'SG', attrs(82, 80, 70, 78, 98, 65, 62, 96, 91)),
  traditionalC: make('traditional-c', 'C', attrs(98, 45, 48, 45, 55, 98, 99, 94, 91)),
  rimC: make('rim-c', 'C', attrs(88, 43, 45, 44, 55, 99, 99, 98, 92)),
  stretchC: make('stretch-c', 'C', attrs(88, 94, 62, 60, 65, 88, 86, 86, 90)),
  playmakingC: make('play-c', 'C', attrs(88, 72, 97, 90, 70, 86, 84, 88, 91)),
  offensePg: make('offense-pg', 'PG', attrs(92, 98, 98, 98, 58, 42, 48, 92, 91)),
  pointSf: make('point-sf', 'SF', attrs(88, 85, 97, 94, 78, 70, 78, 90, 91)),
  pointPf: make('point-pf', 'PF', attrs(90, 78, 96, 91, 78, 82, 82, 90, 91)),
  defenseSf: make('def-sf', 'SF', attrs(82, 72, 68, 70, 92, 92, 96, 93, 90)),
  complete: make('complete', 'SF', attrs(95, 95, 94, 94, 95, 93, 94, 95, 93)),
}

describe('experimental OVR Candidate B', () => {
  it('is deterministic and pure', () => { const before = structuredClone(probes.offenseSg); expect(calculateOverallCandidateB(probes.offenseSg)).toBe(calculateOverallCandidateB(probes.offenseSg)); expect(probes.offenseSg).toEqual(before) })
  it('keeps a complete superstar highly valued', () => expect(calculateOverallCandidateB(probes.complete)).toBeGreaterThanOrEqual(calculateOverall(probes.complete)))
  it('improves an offense-first SG', () => expect(calculateOverallCandidateB(probes.offenseSg)).toBeGreaterThan(calculateOverall(probes.offenseSg)))
  it('keeps a two-way SG above a comparable offense-first SG', () => expect(calculateOverallCandidateB(probes.twoWaySg)).toBeGreaterThanOrEqual(calculateOverallCandidateB(probes.offenseSg)))
  it('improves a playmaking SG', () => expect(calculateOverallCandidateB(probes.playmakingSg)).toBeGreaterThan(calculateOverall(probes.playmakingSg)))
  it('does not demote or over-promote the one-dimensional defensive SG', () => { expect(calculateOverallCandidateB(probes.defenseSg)).toBeGreaterThanOrEqual(calculateOverall(probes.defenseSg)); expect(calculateOverallCandidateB(probes.defenseSg)).toBeLessThan(95) })
  it('improves the traditional Center', () => expect(calculateOverallCandidateB(probes.traditionalC)).toBeGreaterThan(calculateOverall(probes.traditionalC)))
  it('improves the rim-running defensive Center', () => expect(calculateOverallCandidateB(probes.rimC)).toBeGreaterThan(calculateOverall(probes.rimC)))
  it('does not over-reward the stretch Center', () => expect(calculateOverallCandidateB(probes.stretchC)).toBeLessThan(95))
  it('improves the playmaking Center without granting 95', () => { expect(calculateOverallCandidateB(probes.playmakingC)).toBeGreaterThan(calculateOverall(probes.playmakingC)); expect(calculateOverallCandidateB(probes.playmakingC)).toBeLessThan(95) })
  it('improves the offense-first PG', () => expect(calculateOverallCandidateB(probes.offensePg)).toBeGreaterThan(calculateOverall(probes.offensePg)))
  it('recognizes point-forward SF and PF profiles', () => { expect(calculateOverallCandidateB(probes.pointSf)).toBeGreaterThan(calculateOverall(probes.pointSf)); expect(calculateOverallCandidateB(probes.pointPf)).toBeGreaterThan(calculateOverall(probes.pointPf)) })
  it('keeps one-skill extremes below elite at every position', () => { for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) { const values = attrs(65, 65, 65, 65, 65, 65, 65, 65, 65); values.shooting = 99; expect(calculateOverallCandidateB(make(`one-${position}`, position, values))).toBeLessThan(90) } })
  it('requires three core strengths', () => { const values = attrs(65, 99, 99, 65, 65, 65, 65, 65, 65); expect(explainOverallCandidateB(make('two-only', 'SG', values)).specializationPremium).toBe(0) })
  it('bounds weakness penalties', () => expect(explainOverallCandidateB(make('weak', 'SG', attrs(40, 99, 99, 99, 40, 40, 40, 99, 40))).weaknessPenalty).toBe(2))
  it('makes an extreme support weakness matter', () => { const high = make('high', 'SG', attrs(95, 96, 90, 94, 80, 60, 60, 92, 90)); const low = { ...high, attributes: { ...high.attributes, perimeterDefense: 50 } }; expect(calculateOverallCandidateB(low)).toBeLessThan(calculateOverallCandidateB(high)) })
  it('uses position-specific support behavior', () => { const player = make('position', 'PG', attrs(90, 90, 90, 90, 60, 99, 99, 90, 90)); const center = { ...player, position: 'C' as const }; expect(explainOverallCandidateB(player).weaknessPenalty).toBeGreaterThan(explainOverallCandidateB(center).weaknessPenalty) })
  it('always returns a 0–99 rating', () => { expect(calculateOverallCandidateB(make('low', 'C', attrs(40,40,40,40,40,40,40,40,40)))).toBeGreaterThanOrEqual(0); expect(calculateOverallCandidateB(probes.complete)).toBeLessThanOrEqual(99) })
  it('requires no archetype or role field', () => { expect('archetype' in probes.pointPf).toBe(false); expect('role' in probes.pointPf).toBe(false) })
  it('returns transparent additive components', () => { const result = explainOverallCandidateB(probes.offenseSg); expect(result.rawCandidateValue).toBeCloseTo(result.rawCurrentValue + result.specializationPremium + result.completenessBonus - result.weaknessPenalty) })
})
