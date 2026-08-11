import { describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { derivePlayerSeasonStats } from '../season'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  derivePlayerCareerHistory,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({
    ...source,
    activeSeason: season,
  })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `career-history-test-postseason-${season.seasonNumber}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

/** Completes `seasonCount` full Seasons and returns the Dynasty active in Season `seasonCount + 1`. */
function playSeasons(seed: string, seasonCount: number): DynastyState {
  let dynasty = createRecruitingDynasty(seed)
  for (let i = 0; i < seasonCount; i += 1) {
    dynasty = completeSeasonAndBeginOffseason(dynasty)
    dynasty = rolloverDynastyToNextSeason(dynasty)
  }
  return dynasty
}

describe('derivePlayerCareerHistory', () => {
  it('produces one career row with no development gain for a current freshman', () => {
    const dynasty = createRecruitingDynasty('career-history-freshman')
    const roster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const freshman = roster.find(({ classYear }) => classYear === 'FR')!

    const history = derivePlayerCareerHistory(dynasty, freshman.id)

    expect(history.playerId).toBe(freshman.id)
    expect(history.seasons).toHaveLength(1)
    expect(history.seasons[0]).toMatchObject({
      seasonNumber: 1,
      classYear: 'FR',
      overall: calculateOverall(freshman),
      developmentGain: null,
      isActive: true,
    })
  })

  it('keeps active partial-Season stats partial rather than a full projection', () => {
    const dynasty = createRecruitingDynasty('career-history-partial')
    const partialSeason = completeRounds(dynasty.activeSeason!, 3)
    const withPartial = { ...dynasty, activeSeason: partialSeason }
    const roster =
      partialSeason.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const player = roster[0]!

    const history = derivePlayerCareerHistory(withPartial, player.id)
    const expectedStats = derivePlayerSeasonStats(
      partialSeason,
      CONTROLLED_PROGRAM_ID,
      player.id,
    )

    expect(history.seasons).toHaveLength(1)
    expect(history.seasons[0]!.stats).toEqual(expectedStats)
    expect(history.seasons[0]!.stats.gamesPlayed).toBeLessThan(24)
    expect(history.seasons[0]!.stats.gamesPlayed).toBeGreaterThan(0)
  })

  it('derives archived FR plus active SO Season rows with the correct development gain', () => {
    const dynasty = playSeasons('career-history-sophomore', 1)
    const archive = dynasty.history[0]!
    const archivedRoster =
      archive.season.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const activeRoster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const archivedPlayer = archivedRoster.find(
      ({ classYear }) => classYear === 'FR',
    )!
    const activePlayer = activeRoster.find(
      (candidate) => candidate.id === archivedPlayer.id,
    )!
    expect(activePlayer.classYear).toBe('SO')

    const history = derivePlayerCareerHistory(dynasty, archivedPlayer.id)

    expect(history.seasons).toHaveLength(2)
    const [freshmanRow, sophomoreRow] = history.seasons

    expect(freshmanRow).toMatchObject({
      seasonNumber: 1,
      classYear: 'FR',
      overall: calculateOverall(archivedPlayer),
      developmentGain: null,
      isActive: false,
    })
    expect(sophomoreRow).toMatchObject({
      seasonNumber: 2,
      classYear: 'SO',
      overall: calculateOverall(activePlayer),
      isActive: true,
    })
    expect(sophomoreRow!.developmentGain).toBe(
      calculateOverall(activePlayer) - calculateOverall(archivedPlayer),
    )
    expect(sophomoreRow!.stats).toEqual(
      derivePlayerSeasonStats(
        dynasty.activeSeason!,
        CONTROLLED_PROGRAM_ID,
        activePlayer.id,
      ),
    )
  })

  it('produces four chronological rows for a senior, reusing the canonical archived stats projection', () => {
    const start = createRecruitingDynasty('career-history-senior')
    const startRoster =
      start.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const freshman = startRoster.find(({ classYear }) => classYear === 'FR')!

    let dynasty = start
    for (let season = 0; season < 3; season += 1) {
      dynasty = completeSeasonAndBeginOffseason(dynasty)
      dynasty = rolloverDynastyToNextSeason(dynasty)
    }

    const seniorRoster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const senior = seniorRoster.find((candidate) => candidate.id === freshman.id)
    expect(senior?.classYear).toBe('SR')

    const history = derivePlayerCareerHistory(dynasty, freshman.id)

    expect(history.seasons.map(({ seasonNumber }) => seasonNumber)).toEqual([
      1, 2, 3, 4,
    ])
    expect(history.seasons.map(({ classYear }) => classYear)).toEqual([
      'FR',
      'SO',
      'JR',
      'SR',
    ])
    expect(history.seasons[0]!.developmentGain).toBeNull()
    for (let index = 1; index < history.seasons.length; index += 1) {
      expect(history.seasons[index]!.developmentGain).toBe(
        history.seasons[index]!.overall - history.seasons[index - 1]!.overall,
      )
    }
    expect(history.seasons.at(-1)!.isActive).toBe(true)
    expect(history.seasons.slice(0, 3).every((row) => !row.isActive)).toBe(true)

    const archivedSeason3 = dynasty.history[2]!
    expect(history.seasons[2]!.stats).toEqual(
      derivePlayerSeasonStats(
        archivedSeason3.season,
        CONTROLLED_PROGRAM_ID,
        freshman.id,
      ),
    )
  }, 20000)

  it('resolves recruiting origin for a Player who entered through finalized Recruiting', () => {
    const dynasty = playSeasons('career-history-recruit', 1)
    const completedClass = dynasty.completedRecruitingHistory[0]!
    const recruit = completedClass.recruitingState.recruits.find(
      (candidate) =>
        completedClass.recruitingState.commitmentsByPlayerId[
          candidate.player.id
        ] !== undefined,
    )!
    const commitment =
      completedClass.recruitingState.commitmentsByPlayerId[recruit.player.id]!

    const history = derivePlayerCareerHistory(dynasty, recruit.player.id)

    expect(history.recruitingOrigin).toEqual({
      targetSeasonNumber: completedClass.targetSeasonNumber,
      stars: recruit.stars,
      nationalRank: recruit.nationalRank,
      positionRank: recruit.positionRank,
      entryOverall: calculateOverall(recruit.player),
      entryPotential: recruit.player.potential,
      committedProgramId: commitment.programId,
    })
    expect(history.seasons[0]!.programId).toBe(commitment.programId)
    expect(history.seasons[0]!.classYear).toBe('FR')
  })

  it('omits recruiting origin cleanly for an original Universe Player', () => {
    const dynasty = createRecruitingDynasty('career-history-universe-player')
    const roster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const player = roster[0]!

    const history = derivePlayerCareerHistory(dynasty, player.id)

    expect(history.recruitingOrigin).toBeNull()
    expect(history.seasons).toHaveLength(1)
  })

  it('throws for an unknown Player ID', () => {
    const dynasty = createRecruitingDynasty('career-history-unknown')

    expect(() =>
      derivePlayerCareerHistory(dynasty, 'not-a-real-player-id'),
    ).toThrow(/Unknown Player ID/)
  })
})
