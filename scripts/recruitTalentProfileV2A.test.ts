import { describe, expect, it } from 'vitest'
import { CALIBRATION_WEIGHTS, classifyV2AReadiness, collectPairedProfiles, generateV2ARawCeiling } from './recruitTalentProfileV2A'

describe('diagnostic Recruit Talent Profile V2A', () => {
  it('uses complete conditional rows and explicit legal ceiling tiers', () => {
    for (const candidate of Object.values(CALIBRATION_WEIGHTS)) {
      for (const weights of Object.values(candidate)) {
        expect(weights.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10)
        expect(weights.every((weight) => weight > 0)).toBe(true)
      }
    }
    for (const readiness of [47, 59, 60, 70, 71, 77, 78, 85, 86, 92]) {
      for (let sample = 0; sample < 100; sample += 1) {
        const result = generateV2ARawCeiling(readiness, `${readiness}:${sample}`)
        expect(result.ceiling).toBeGreaterThanOrEqual(60)
        expect(result.ceiling).toBeLessThanOrEqual(99)
        if (result.tier === 'elite') expect(result.ceiling).toBeGreaterThanOrEqual(95)
        if (result.tier === 'exceptional') expect(result.ceiling).toBeGreaterThanOrEqual(97)
      }
    }
  })

  it('is deterministic, seed-sensitive, and classifies realized readiness boundaries', () => {
    expect(generateV2ARawCeiling(82, 'repeat')).toEqual(generateV2ARawCeiling(82, 'repeat'))
    expect(new Set(Array.from({ length: 20 }, (_, index) => generateV2ARawCeiling(82, `seed:${index}`).ceiling)).size).toBeGreaterThan(1)
    expect([59, 60, 71, 78, 86].map(classifyV2AReadiness)).toEqual(['raw/depth', 'developmental', 'good', 'ready-now', 'exceptional'])
  })

  it('keeps every sweep arm paired on frozen freshman facts', () => {
    const first = collectPairedProfiles(1, 'sweep-pairing')
    const repeat = collectPairedProfiles(1, 'sweep-pairing')
    expect(repeat).toEqual(first)
    const baseline = new Map(first.arms.V1.map((row) => [row.playerId, row]))
    for (const rows of Object.values(first.arms)) for (const row of rows) {
      const v1 = baseline.get(row.playerId)!
      expect([row.position, row.readiness, row.startingOverall]).toEqual([v1.position, v1.readiness, v1.startingOverall])
    }
    expect(first.seasonZero.length).toBeGreaterThan(0)
  })

  it('runs the frozen Development lifecycle deterministically with valid POT', () => {
    const first = collectPairedProfiles(1, 'lifecycle-pairing', true)
    const repeat = collectPairedProfiles(1, 'lifecycle-pairing', true)
    expect(repeat.lifecycle).toEqual(first.lifecycle)
    expect(first.lifecycle).toBeDefined()
    for (const name of ['V1', 'Refined', 'Final'] as const) {
      expect(first.lifecycle!.recruited[name]).toHaveLength(4)
      for (const stage of first.lifecycle!.recruited[name]) {
        expect(stage).toHaveLength(first.arms.V1.length)
        expect(stage.every((row) => row.finalPotential >= row.startingOverall && row.finalPotential <= 99)).toBe(true)
      }
    }
  })
})
