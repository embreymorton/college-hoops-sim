import { beforeAll, describe, expect, it } from 'vitest'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveNationalPlayerLeaders,
  deriveProgramRecord,
} from '../season'
import {
  beginOffseason,
  deriveCompletedSeasonIndex,
  deriveCompletedSeasonYearbook,
  YEARBOOK_STATISTICAL_SCOPE,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function completedDynasty(): DynastyState {
  const source = createRecruitingDynasty('season-yearbook-foundation')
  const season = completeRounds(source.activeSeason!)
  let postseason = initializePostseason({ universe: source.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `season-yearbook-${round}`,
    })
  }
  return beginOffseason({ ...source, activeSeason: season, activePostseason: postseason })
}

let canonical: DynastyState

beforeAll(() => {
  canonical = completedDynasty()
})

describe('Completed Season History index projection', () => {
  it('returns an empty index without completed history', () => {
    expect(deriveCompletedSeasonIndex({ ...canonical, history: [] })).toEqual([])
  })

  it('derives champion, controlled record, and Tournament finish', () => {
    const archive = canonical.history[0]!
    const [summary] = deriveCompletedSeasonIndex(canonical)

    expect(summary).toMatchObject({
      seasonNumber: 1,
      nationalChampion: { programId: deriveNationalChampion(archive.postseason) },
      controlledProgram: { programId: canonical.controlledProgramId! },
      controlledProgramRecord: deriveProgramRecord(archive.season, canonical.controlledProgramId!),
    })
    expect(summary!.controlledTournamentOutcome.status).not.toBe('qualified')
  })

  it('orders multiple archives newest-first independent of input order', () => {
    const first = canonical.history[0]!
    const second = {
      ...structuredClone(first),
      seasonNumber: 2,
      season: { ...structuredClone(first.season), seasonNumber: 2 },
    }
    const forward = deriveCompletedSeasonIndex({ ...canonical, history: [first, second] })
    const reverse = deriveCompletedSeasonIndex({ ...canonical, history: [second, first] })

    expect(forward.map(({ seasonNumber }) => seasonNumber)).toEqual([2, 1])
    expect(reverse).toEqual(forward)
  })

  it('represents missed, eliminated, runner-up, and champion outcomes', () => {
    const archive = canonical.history[0]!
    const championId = deriveNationalChampion(archive.postseason)!
    const final = archive.postseason.bracket.games.find(({ round }) => round === 'championship')!
    const finalResult = archive.postseason.resultsByGameId[final.id]!
    const runnerUpId = finalResult.homeTeamId === championId
      ? finalResult.awayTeamId
      : finalResult.homeTeamId
    const eliminatedId = archive.postseason.field.find(
      ({ programId }) => programId !== championId && programId !== runnerUpId,
    )!.programId
    const missedId = canonical.universe.programs.find(
      ({ id }) => !archive.postseason.field.some(({ programId }) => programId === id),
    )!.id

    expect(deriveCompletedSeasonIndex({ ...canonical, controlledProgramId: missedId })[0]!
      .controlledTournamentOutcome.status).toBe('did-not-qualify')
    expect(deriveCompletedSeasonIndex({ ...canonical, controlledProgramId: eliminatedId })[0]!
      .controlledTournamentOutcome.status).toBe('eliminated')
    expect(deriveCompletedSeasonIndex({ ...canonical, controlledProgramId: runnerUpId })[0]!
      .controlledTournamentOutcome.status).toBe('runner-up')
    expect(deriveCompletedSeasonIndex({ ...canonical, controlledProgramId: championId })[0]!
      .controlledTournamentOutcome.status).toBe('national-champion')
  })
})

describe('Completed Season Yearbook projection', () => {
  it('derives championship identity, participants, and final score', () => {
    const yearbook = deriveCompletedSeasonYearbook(canonical, 1)
    const game = yearbook.championship.game

    expect(yearbook.championship.nationalChampion.programId).toBe(game.result.winnerId)
    expect([
      game.homeProgram.programId,
      game.awayProgram.programId,
    ]).toContain(yearbook.championship.runnerUp.programId)
    expect(game.result.homeScore).toBeGreaterThan(0)
    expect(game.result.awayScore).toBeGreaterThan(0)
  })

  it('reuses canonical records and conference ordering for the controlled Program', () => {
    const archive = canonical.history[0]!
    const yearbook = deriveCompletedSeasonYearbook(canonical, 1)
    const conference = canonical.universe.conferences.find(
      ({ id }) => id === yearbook.controlledProgramSeason.program.conferenceId,
    )!
    const expectedStandings = deriveConferenceStandings(
      canonical.universe,
      archive.season,
      conference.id,
    )

    expect(yearbook.controlledProgramSeason.overallRecord).toEqual(
      deriveProgramRecord(archive.season, canonical.controlledProgramId!),
    )
    expect(yearbook.controlledProgramSeason.conferenceRecord).toEqual(
      deriveConferenceRecord(archive.season, canonical.controlledProgramId!),
    )
    expect(yearbook.controlledProgramSeason.conferencePlace).toBe(
      expectedStandings.findIndex(({ programId }) => programId === canonical.controlledProgramId!) + 1,
    )
    expect(
      yearbook.conferenceStandings.find(({ conference: row }) => row.id === conference.id)!
        .rows.map(({ program }) => program.programId),
    ).toEqual(expectedStandings.map(({ programId }) => programId))
  })

  it('resolves all 15 archived Tournament games and the controlled run', () => {
    const yearbook = deriveCompletedSeasonYearbook(canonical, 1)

    expect(yearbook.tournament.games).toHaveLength(15)
    expect(yearbook.tournament.games.every(({ result }) => result.winnerId.length > 0)).toBe(true)
    expect(yearbook.controlledProgramSeason.tournamentGames.every((game) =>
      game.homeProgram.programId === canonical.controlledProgramId! ||
      game.awayProgram.programId === canonical.controlledProgramId!,
    )).toBe(true)
  })

  it('exposes regular-season-only national and controlled leaders with stable Player IDs', () => {
    const archive = canonical.history[0]!
    const yearbook = deriveCompletedSeasonYearbook(canonical, 1)
    const expected = deriveNationalPlayerLeaders(archive.season)

    expect(yearbook.statisticalLeaders.scope).toBe(YEARBOOK_STATISTICAL_SCOPE)
    expect(yearbook.statisticalLeaders.scope).toBe('regular-season')
    for (const category of ['points', 'rebounds', 'assists', 'steals', 'blocks'] as const) {
      expect(yearbook.statisticalLeaders.national[category].map(({ player, value }) => ({
        playerId: player.playerId,
        value,
      }))).toEqual(expected[category].map(({ playerId, value }) => ({ playerId, value })))
      expect(yearbook.statisticalLeaders.controlledProgram[category]).toHaveLength(1)
      expect(yearbook.statisticalLeaders.controlledProgram[category][0]!.player.playerId).toBeTruthy()
    }
  })

  it('is deterministic, preserves accepted tie ordering, and does not mutate history', () => {
    const before = structuredClone(canonical)
    const first = deriveCompletedSeasonYearbook(canonical, 1)
    const second = deriveCompletedSeasonYearbook(canonical, 1)

    expect(second).toEqual(first)
    for (const rows of Object.values(first.statisticalLeaders.national)) {
      for (let index = 1; index < rows.length; index += 1) {
        if (rows[index - 1]!.value === rows[index]!.value) {
          expect(rows[index - 1]!.player.playerId.localeCompare(rows[index]!.player.playerId))
            .toBeLessThan(0)
        }
      }
    }
    expect(canonical).toEqual(before)
  })

  it('fails explicitly for missing selections, duplicates, and incomplete Tournament data', () => {
    const archive = canonical.history[0]!
    expect(() => deriveCompletedSeasonYearbook(canonical, 99)).toThrow(/No completed Season 99/)
    expect(() => deriveCompletedSeasonYearbook({ ...canonical, history: [archive, archive] }, 1))
      .toThrow(/duplicate Season 1/)
    expect(() => deriveCompletedSeasonIndex({
      ...canonical,
      history: [{
        ...archive,
        postseason: { ...archive.postseason, resultsByGameId: {} },
      }],
    })).toThrow(/incomplete Tournament/)
  })
})
