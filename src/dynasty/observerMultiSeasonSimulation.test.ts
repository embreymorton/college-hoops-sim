import { describe, expect, it } from 'vitest'
import {
  advanceObserverDynastyOneSeason,
  autoFinalizeRecruiting,
  beginOffseason,
  simulateDynastyToSeasonComplete,
} from '.'
import { rolloverDynastyToNextSeason } from './rollover'
import { createRecruitingDynasty } from './recruiting/testSupport'

function observer(seed: string) {
  return createRecruitingDynasty(seed, null)
}

describe('Observer one-Season lifecycle orchestration', () => {
  it('matches the normal canonical lifecycle exactly', () => {
    const source = observer('observer-one-season-equivalence')
    const automatic = advanceObserverDynastyOneSeason(structuredClone(source))
    let manual = simulateDynastyToSeasonComplete(structuredClone(source))
    manual = autoFinalizeRecruiting(manual).dynasty
    manual = beginOffseason(manual)
    manual = rolloverDynastyToNextSeason(manual)
    expect(automatic).toEqual(manual)
    expect(automatic.activeSeason?.seasonNumber).toBe(source.activeSeason!.seasonNumber + 1)
    expect(automatic.activeSeason?.resultsByGameId).toEqual({})
    expect(automatic.recruiting?.lastResolvedPeriod).toBe(0)
    expect(automatic.activePostseason).toBeNull()
    expect(automatic.offseason).toBeNull()
  }, 15_000)

  it('rejects Coach Mode and non-regular-Season states', () => {
    const source = observer('observer-guard')
    expect(() => advanceObserverDynastyOneSeason({ ...source, controlledProgramId: 'charlotte-tech' })).toThrow(/Observer Dynasty/)
    expect(() => advanceObserverDynastyOneSeason({ ...source, offseason: {} as never })).toThrow(/active regular Season/)
  })

  it('is deterministic across replay', () => {
    const source = observer('observer-deterministic-replay')
    expect(advanceObserverDynastyOneSeason(structuredClone(source)))
      .toEqual(advanceObserverDynastyOneSeason(structuredClone(source)))
  }, 15_000)

  it('matches repeated normal lifecycle progression across five Seasons', () => {
    const source = observer('observer-five-season-equivalence')
    let automatic = structuredClone(source)
    let manual = structuredClone(source)
    for (let index = 0; index < 5; index += 1) {
      automatic = advanceObserverDynastyOneSeason(automatic)
      manual = simulateDynastyToSeasonComplete(manual)
      manual = autoFinalizeRecruiting(manual).dynasty
      manual = beginOffseason(manual)
      manual = rolloverDynastyToNextSeason(manual)
    }
    expect(automatic).toEqual(manual)
  }, 35_000)
})
