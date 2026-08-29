import { describe, expect, it } from 'vitest'
import { advanceObserverDynastyOneSeason, deriveObserverMultiSeasonSummary } from '.'
import { createRecruitingDynasty } from './recruiting/testSupport'

describe('Observer multi-Season summary', () => {
  it('derives the bounded Viewed Program result from canonical archives', () => {
    const source = createRecruitingDynasty('observer-summary', null)
    const dynasty = advanceObserverDynastyOneSeason(source)
    const summary = deriveObserverMultiSeasonSummary(dynasty, {
      startSeasonNumber: 1,
      endSeasonNumber: 1,
      rolloverCount: 1,
      viewedProgramId: 'pine-valley',
    })
    expect(summary.viewedProgramName).toBe('Pine Valley')
    expect(summary.rows).toHaveLength(1)
    expect(summary.rows[0]).toMatchObject({ seasonNumber: 1 })
    expect(summary.rows[0]!.championProgramId).toBeTruthy()
    expect(summary.rows[0]!.nationalPlayerOfYear).not.toBeNull()
    expect(summary.rows[0]!.tournamentMop).not.toBeNull()
    expect(summary.bestSeason).toBe(summary.rows[0])
    expect(summary.endingReputation).not.toBeNull()
  }, 15_000)

  it('rejects an inconsistent range', () => {
    const dynasty = createRecruitingDynasty('observer-summary-invalid', null)
    expect(() => deriveObserverMultiSeasonSummary(dynasty, {
      startSeasonNumber: 1,
      endSeasonNumber: 2,
      rolloverCount: 1,
      viewedProgramId: 'pine-valley',
    })).toThrow(/range/)
  })
})
