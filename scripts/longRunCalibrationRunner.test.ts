import { describe, expect, it } from 'vitest'
import { runLongRunCalibration } from './inspectDynastyLongRun'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'

function basketballFacts(result: Awaited<ReturnType<typeof runLongRunCalibration>>) {
  return result.runs.map((run) => ({
    seed: run.seed,
    seasons: run.seasons,
    developments: run.developments,
    signedRecruits: run.signedRecruits,
    recruitingCycles: run.recruitingCycles,
    graduating: run.graduating,
    champions: run.champions,
    semifinalAppearances: run.semifinalAppearances,
    rotationMinutes: run.rotationMinutes,
    rollovers: run.rollovers,
  }))
}

describe('long-run calibration execution', () => {
  it('keeps light and full audits basketball-equivalent', () => {
    const options = { seasonsPerSeed: 2, seeds: ['audit-equivalence'] }
    const light = runLongRunCalibration({ ...options, auditLevel: 'light' })
    const full = runLongRunCalibration({ ...options, auditLevel: 'full' })

    expect(basketballFacts(light)).toEqual(basketballFacts(full))
    expect(light.runs[0]!.stateGrowth).toEqual([])
    expect(full.runs[0]!.stateGrowth).not.toEqual([])
  }, 20_000)

  it('matches sequential production runs while retaining requested seed order', async () => {
    const options = {
      seasonsPerSeed: 1,
      seeds: ['parallel-equivalence-a', 'parallel-equivalence-b'],
      auditLevel: 'light' as const,
    }
    const sequential = runLongRunCalibration(options)
    const parallel = await runLongRunCalibrationParallel({ ...options, workers: 2 })

    expect(parallel.seeds).toEqual(options.seeds)
    expect(basketballFacts(parallel)).toEqual(basketballFacts(sequential))
  }, 30_000)
})
