import { beforeAll, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveSeasonPreview,
  rolloverDynastyToNextSeason,
  shouldPromoteSeasonPreview,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function rollover(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: 'season-preview-postseason' })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({ ...dynasty, activePostseason: postseason })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return rolloverDynastyToNextSeason(beginOffseason(dynasty))
}

describe('Season Preview', () => {
  it('derives deterministic initial-season cast lists and preserves followed order', () => {
    const dynasty = createRecruitingDynasty('season-preview-initial')
    const roster = Object.values(dynasty.activeSeason!.programStates).flatMap(({ team }) => team.roster)
    const followed = [roster[8]!.id, roster[2]!.id]
    const first = deriveSeasonPreview(dynasty, followed)

    expect(first.kind).toBe('initial')
    if (first.kind !== 'initial') return
    expect(first.establishedPlayers).toHaveLength(3)
    expect(first.freshmenToKnow).toHaveLength(3)
    expect(first.followedPlayers.map(({ playerId }) => playerId)).toEqual(followed)
    expect(deriveSeasonPreview(dynasty, followed)).toEqual(first)
  })

  it('promotes only in canonical rounds 1 and 2', () => {
    const dynasty = createRecruitingDynasty('season-preview-promotion')
    expect(shouldPromoteSeasonPreview(dynasty.activeSeason!)).toBe(true)
    expect(shouldPromoteSeasonPreview(completeRounds(dynasty.activeSeason!, 1))).toBe(true)
    expect(shouldPromoteSeasonPreview(completeRounds(dynasty.activeSeason!, 2))).toBe(false)
  })

  let secondSeason: DynastyState
  beforeAll(() => { secondSeason = rollover(createRecruitingDynasty('season-preview-rollover')) })

  it('derives returners, positive non-star leaps, and canonical incoming freshmen', () => {
    const preview = deriveSeasonPreview(secondSeason, [])
    expect(preview.kind).toBe('rollover')
    if (preview.kind !== 'rollover') return
    expect(preview.returningStars).toHaveLength(3)
    expect(preview.biggestLeaps.length).toBeLessThanOrEqual(3)
    expect(preview.biggestLeaps.every(({ overallChange }) => overallChange > 0)).toBe(true)
    expect(preview.biggestLeaps.every(({ playerId }) => !preview.returningStars.some((star) => star.playerId === playerId))).toBe(true)
    expect(preview.freshFaces).toHaveLength(3)
    expect(preview.freshFaces.map(({ nationalRank }) => nationalRank)).toEqual([...preview.freshFaces.map(({ nationalRank }) => nationalRank)].sort((a, b) => a - b))
  })

  it('fails loudly when exact prior-season facts are unavailable', () => {
    expect(() => deriveSeasonPreview({ ...secondSeason, history: [] }, [])).toThrow(/exactly one Season 1 archive/)
    expect(() => deriveSeasonPreview({ ...secondSeason, completedRecruitingHistory: [] }, [])).toThrow(/exactly one Recruiting class/)
  })
})
