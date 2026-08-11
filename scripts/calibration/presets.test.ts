import { describe, expect, it } from 'vitest'
import {
  CALIBRATION_PRESETS,
  resolveLongRunCliConfig,
} from './presets'
import { runOrderedParallel } from './parallel'

describe('calibration presets', () => {
  it('resolves presets and lets explicit flags override them', () => {
    expect(resolveLongRunCliConfig(['--preset', 'standard', '--seasons', '12', '--workers', '1']))
      .toMatchObject({
        preset: 'standard',
        seeds: CALIBRATION_PRESETS.standard.seeds,
        seasons: 12,
        audit: 'light',
        workers: 1,
      })
    expect(resolveLongRunCliConfig(['--preset', 'acceptance', '--audit', 'light']))
      .toMatchObject({ audit: 'light', seeds: 5, seasons: 10 })
  })

  it('rejects invalid preset and numeric arguments', () => {
    expect(() => resolveLongRunCliConfig(['--preset', 'unknown'])).toThrow(/Unknown preset/)
    expect(() => resolveLongRunCliConfig(['--workers', '0'])).toThrow(/positive integer/)
    expect(() => resolveLongRunCliConfig(['--audit', 'fast'])).toThrow(/light or full/)
  })
})

describe('stable parallel orchestration', () => {
  it('preserves input order even when work completes out of order', async () => {
    const results = await runOrderedParallel([1, 2, 3], 3, async (value) => {
      await new Promise((resolve) => setTimeout(resolve, (4 - value) * 5))
      return value * 10
    })
    expect(results).toEqual([10, 20, 30])
  })
})
