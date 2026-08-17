import { beforeAll, describe, expect, it } from 'vitest'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { deriveProgramRecord } from '../season'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveProgramLegacy,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `program-legacy:${season.seasonNumber}:${round}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

function completedDynasty(): DynastyState {
  return completeSeasonAndBeginOffseason(
    createRecruitingDynasty('program-legacy-foundation'),
  )
}

let canonical: DynastyState

beforeAll(() => {
  canonical = completedDynasty()
})

describe('deriveProgramLegacy', () => {
  it('returns an intentional zero-history résumé for every valid Program', () => {
    const programId = canonical.universe.programs[0]!.id
    expect(deriveProgramLegacy({ ...canonical, history: [] }, programId)).toEqual({
      programId,
      completedSeasons: 0,
      wins: 0,
      losses: 0,
      tournamentAppearances: 0,
      championships: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: null,
      bestRegularSeason: null,
      recentSeasons: [],
    })
  })

  it('derives one completed Season for controlled and non-controlled Programs independently', () => {
    const controlled = deriveProgramLegacy(canonical, canonical.controlledProgramId)
    const otherId = canonical.universe.programs.find(
      ({ id }) => id !== canonical.controlledProgramId,
    )!.id
    const other = deriveProgramLegacy(canonical, otherId)

    expect(controlled.completedSeasons).toBe(1)
    expect(controlled.recentSeasons[0]!.record).toEqual(
      deriveProgramRecord(canonical.history[0]!.season, canonical.controlledProgramId),
    )
    expect(other.completedSeasons).toBe(1)
    expect(other.programId).toBe(otherId)
    expect(other.recentSeasons[0]!.record).toEqual(
      deriveProgramRecord(canonical.history[0]!.season, otherId),
    )
  })

  it('counts appearances, titles, runner-up finishes, and missed Tournaments from canonical outcomes', () => {
    const archive = canonical.history[0]!
    const championId = deriveNationalChampion(archive.postseason)!
    const championship = archive.postseason.bracket.games.find(
      ({ round }) => round === 'championship',
    )!
    const result = archive.postseason.resultsByGameId[championship.id]!
    const runnerUpId = result.homeTeamId === championId ? result.awayTeamId : result.homeTeamId
    const missedId = canonical.universe.programs.find(
      ({ id }) => !archive.postseason.field.some(({ programId }) => programId === id),
    )!.id

    expect(deriveProgramLegacy(canonical, championId)).toMatchObject({
      tournamentAppearances: 1,
      championships: 1,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'national-champion' },
    })
    expect(deriveProgramLegacy(canonical, runnerUpId)).toMatchObject({
      tournamentAppearances: 1,
      championships: 0,
      runnerUpFinishes: 1,
      bestTournamentOutcome: { status: 'runner-up' },
    })
    expect(deriveProgramLegacy(canonical, missedId)).toMatchObject({
      tournamentAppearances: 0,
      championships: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'did-not-qualify' },
    })
  })

  it('aggregates records and caps recent Seasons newest-first', () => {
    const source = canonical.history[0]!
    const history = Array.from({ length: 7 }, (_, index) => ({
      ...structuredClone(source),
      seasonNumber: index + 1,
      season: { ...structuredClone(source.season), seasonNumber: index + 1 },
    })).reverse()
    const record = deriveProgramRecord(source.season, canonical.controlledProgramId)
    const legacy = deriveProgramLegacy({ ...canonical, history }, canonical.controlledProgramId)

    expect(legacy.completedSeasons).toBe(7)
    expect(legacy.wins).toBe(record.wins * 7)
    expect(legacy.losses).toBe(record.losses * 7)
    expect(legacy.recentSeasons.map(({ seasonNumber }) => seasonNumber)).toEqual([7, 6, 5, 4, 3])
    expect(legacy.bestRegularSeason?.seasonNumber).toBe(7)
  })

  it('remains derived and stable after multiple real Dynasty rollovers', () => {
    let dynasty = createRecruitingDynasty('program-legacy-rollovers')
    for (let count = 0; count < 2; count += 1) {
      dynasty = rolloverDynastyToNextSeason(completeSeasonAndBeginOffseason(dynasty))
    }

    const legacy = deriveProgramLegacy(dynasty, dynasty.controlledProgramId)
    expect(legacy.completedSeasons).toBe(2)
    expect(legacy.recentSeasons.map(({ seasonNumber }) => seasonNumber)).toEqual([2, 1])
    expect(legacy.wins + legacy.losses).toBe(48)
  }, 30000)
})
