import { beforeAll, describe, expect, it } from 'vitest'
import {
  TOURNAMENT_ROUNDS,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
} from '../postseason'
import { derivePlayerSeasonStats } from '../season'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import { beginOffseason } from './dynastyState'
import { derivePlayerCareerSummary, resolveDynastyPlayer } from './playerLegacy'
import { derivePlayerCareerHighs, deriveDynastyRecordBook, RECORD_CATEGORIES } from './seasonRecords'
import { derivePlayerTournamentCareer } from './tournamentLegacy'
import {
  derivePlayerTournamentCareerHighs,
  deriveTournamentRecordBook,
} from './tournamentRecords'
import type { CompletedSeasonArchive, DynastyState } from './domain'

let completedActive: DynastyState
let archived: DynastyState
let archive: CompletedSeasonArchive

beforeAll(() => {
  const source = createRecruitingDynasty('tournament-legacy-test')
  const season = completeRounds(source.activeSeason!)
  let postseason = initializePostseason({ universe: source.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `tournament-legacy-${round}`,
    })
  }
  completedActive = { ...source, activeSeason: season, activePostseason: postseason }
  archived = beginOffseason(completedActive)
  archive = archived.history[0]!
})

function firstTournamentPlayer() {
  const result = Object.values(archive.postseason.resultsByGameId)[0]!
  const row = [...result.homePlayerStats, ...result.awayPlayerStats]
    .find(({ minutes }) => minutes > 0)!
  return row.playerId
}

describe('derivePlayerTournamentCareer', () => {
  it('returns an empty Tournament-scoped career before any Tournament history', () => {
    const playerId = completedActive.activeSeason!.programStates[
      Object.keys(completedActive.activeSeason!.programStates)[0]!
    ]!.team.roster[0]!.id
    const career = derivePlayerTournamentCareer({
      history: [], activeSeason: completedActive.activeSeason, activePostseason: null,
    }, playerId)
    expect(career).toMatchObject({
      playerId,
      gameScope: 'tournament',
      runs: [],
      tournamentAppearances: 0,
    })
    expect(career.stats.gamesPlayed).toBe(0)
  })

  it('derives full totals, aggregate rates, game context, and achievements', () => {
    const playerId = firstTournamentPlayer()
    const career = derivePlayerTournamentCareer(archived, playerId)
    const run = career.runs[0]!
    const played = run.games.filter(({ didPlay }) => didPlay)
    expect(run.seed).toBeGreaterThan(0)
    expect(run.stats.gamesPlayed).toBe(played.length)
    expect(run.stats.points).toBe(played.reduce((sum, game) => sum + game.stats.points, 0))
    expect(run.stats.pointsPerGame).toBe(run.stats.points / run.stats.gamesPlayed)
    expect(run.stats.fieldGoalPercentage).toBe(
      run.stats.fieldGoalsAttempted === 0
        ? 0
        : run.stats.fieldGoalsMade / run.stats.fieldGoalsAttempted,
    )
    expect(run.games[0]).toMatchObject({ seasonNumber: 1, gameId: expect.any(String) })
    expect(run.games.every(({ overtimePeriods }) => overtimePeriods >= 0)).toBe(true)
    expect(career.tournamentAppearances).toBe(1)
  })

  it('keeps roster finish association but gives zero-minute Players no GP or appearance', () => {
    const postseason = structuredClone(archive.postseason)
    const programId = postseason.field[0]!.programId
    const playerId = postseason.programStates[programId]!.team.roster[0]!.id
    for (const result of Object.values(postseason.resultsByGameId)) {
      const row = [...result.homePlayerStats, ...result.awayPlayerStats]
        .find(({ playerId: id }) => id === playerId)
      if (row) Object.assign(row, { minutes: 0, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })
    }
    const dynasty = {
      ...archived,
      history: [{ ...archive, postseason }],
    }
    const career = derivePlayerTournamentCareer(dynasty, playerId)
    expect(career.runs).toHaveLength(1)
    expect(career.runs[0]!.games.length).toBeGreaterThan(0)
    expect(career.runs[0]!.games.every(({ didPlay }) => !didPlay)).toBe(true)
    expect(career.stats.gamesPlayed).toBe(0)
    expect(career.tournamentAppearances).toBe(0)
  })

  it('is equivalent before and after archive and prevents duplicate active/archive sources', () => {
    const playerId = firstTournamentPlayer()
    const activeCareer = derivePlayerTournamentCareer(completedActive, playerId)
    const archivedCareer = derivePlayerTournamentCareer(archived, playerId)
    expect(activeCareer).toEqual(archivedCareer)

    const duplicate = derivePlayerTournamentCareer({
      ...completedActive,
      history: [archive],
    }, playerId)
    expect(duplicate).toEqual(archivedCareer)
  })

  it('uses only completed games during an active incomplete Tournament', () => {
    const postseason = structuredClone(archive.postseason)
    const firstGame = postseason.bracket.games[0]!
    const firstResult = postseason.resultsByGameId[firstGame.id]!
    const playerId = (firstResult.winnerId === firstResult.homeTeamId
      ? firstResult.homePlayerStats
      : firstResult.awayPlayerStats).find(({ minutes }) => minutes > 0)!.playerId
    const partialPostseason = {
      ...postseason,
      resultsByGameId: { [firstGame.id]: firstResult },
    }
    const career = derivePlayerTournamentCareer({
      history: [], activeSeason: archive.season, activePostseason: partialPostseason,
    }, playerId)
    expect(career.runs).toHaveLength(1)
    expect(career.runs[0]).toMatchObject({ isInProgress: true, finish: { status: 'in-progress' } })
    expect(career.runs[0]!.games.map(({ gameId }) => gameId)).toEqual([firstGame.id])
  })

  it('retains explicit overtime and DNP game-log context', () => {
    const postseason = structuredClone(archive.postseason)
    const firstGame = postseason.bracket.games[0]!
    const result = postseason.resultsByGameId[firstGame.id]!
    result.overtimePeriods = 2
    const programId = result.homeTeamId
    const row = result.homePlayerStats[0]!
    row.minutes = 0
    const dynasty = { ...archived, history: [{ ...archive, postseason }] }
    const game = derivePlayerTournamentCareer(dynasty, row.playerId).runs
      .find((run) => run.programId === programId)!.games
      .find(({ gameId }) => gameId === firstGame.id)!
    expect(game).toMatchObject({ overtimePeriods: 2, didPlay: false })
  })

  it('aggregates stable identity across Seasons and retains former Player resolution', () => {
    const playerId = firstTournamentPlayer()
    const second = structuredClone(archive)
    Object.assign(second, {
      seasonNumber: 2,
      season: { ...second.season, seasonNumber: 2 },
    })
    const dynasty = { ...archived, history: [archive, second] }
    const career = derivePlayerTournamentCareer(dynasty, playerId)
    expect(career.runs.map(({ seasonNumber }) => seasonNumber)).toEqual([1, 2])
    expect(career.stats.points).toBe(career.runs[0]!.stats.points * 2)
    expect(resolveDynastyPlayer(dynasty, playerId).status).toBe('former')
  })

  it('associates the persisted MOP with exactly the correct run', () => {
    const mop = archive.awards.honors.find(
      ({ type }) => type === 'tournament-most-outstanding-player',
    )!
    const career = derivePlayerTournamentCareer(archived, mop.playerId)
    expect(career.runs.filter(({ isMop }) => isMop).map(({ seasonNumber }) => seasonNumber)).toEqual([1])
  })
})

describe('Tournament career highs and Record Book', () => {
  it('exposes all five Tournament career-high categories with deterministic context', () => {
    const playerId = firstTournamentPlayer()
    const highs = derivePlayerTournamentCareerHighs(archived, playerId)
    expect(highs.gameScope).toBe('tournament')
    expect(highs.hasAppearances).toBe(true)
    for (const category of RECORD_CATEGORIES) {
      expect(highs.categories[category]).toMatchObject({
        gameId: expect.any(String),
        seasonNumber: 1,
        opponentProgramName: expect.any(String),
        occurrenceCount: expect.any(Number),
      })
    }
  })

  it('builds Single Game, Tournament Run, and Career counting records for every category', () => {
    const book = deriveTournamentRecordBook(archived)
    for (const category of RECORD_CATEGORIES) {
      expect(book[category].singleGame[0]).toMatchObject({ rank: 1, seasonNumber: 1 })
      expect(book[category].tournamentRun[0]).toMatchObject({ rank: 1, seasonNumber: 1 })
      expect(book[category].career[0]).toMatchObject({ rank: 1, firstSeasonNumber: 1 })
    }
  })

  it('is archive-order independent and accumulates career totals across Seasons', () => {
    const second = structuredClone(archive)
    Object.assign(second, { seasonNumber: 2, season: { ...second.season, seasonNumber: 2 } })
    const forward = deriveTournamentRecordBook({ ...archived, history: [archive, second] })
    const reverse = deriveTournamentRecordBook({ ...archived, history: [second, archive] })
    const one = deriveTournamentRecordBook(archived)
    expect(forward).toEqual(reverse)
    expect(forward.points.career[0]!.value).toBe(one.points.career[0]!.value * 2)
  })

  it('breaks equal-value Single Game ties deterministically by stable source order', () => {
    const postseason = structuredClone(archive.postseason)
    const result = postseason.resultsByGameId[postseason.bracket.games[0]!.id]!
    const rows = [...result.homePlayerStats, ...result.awayPlayerStats]
      .filter(({ minutes }) => minutes > 0)
      .slice(0, 2)
    rows[0]!.points = 999
    rows[1]!.points = 999
    const book = deriveTournamentRecordBook({
      ...archived,
      history: [{ ...archive, postseason }],
    })
    const tied = book.points.singleGame.filter(({ value }) => value === 999)
    expect(tied.map(({ rank }) => rank)).toEqual([1, 2])
    expect(tied.map(({ playerId }) => playerId)).toEqual(
      rows.map(({ playerId }) => playerId).sort(),
    )
  })

  it('preserves every regular-season statistical projection when Tournament facts change', () => {
    const playerId = firstTournamentPlayer()
    const beforeStats = derivePlayerSeasonStats(archive.season,
      Object.entries(archive.season.programStates).find(([, state]) => state.team.roster.some(({ id }) => id === playerId))![0], playerId)
    const beforeResolution = resolveDynastyPlayer(archived, playerId)
    if (beforeResolution.status === 'unknown') throw new Error('unresolved player')
    const beforeSummary = derivePlayerCareerSummary(beforeResolution.careerHistory)
    const beforeHighs = derivePlayerCareerHighs(archived, playerId)
    const beforeRecords = deriveDynastyRecordBook(archived)
    const postseason = structuredClone(archive.postseason)
    for (const result of Object.values(postseason.resultsByGameId)) {
      const row = [...result.homePlayerStats, ...result.awayPlayerStats].find(({ playerId: id }) => id === playerId)
      if (row) row.points += 10_000
    }
    const changed = { ...archived, history: [{ ...archive, postseason }] }
    expect(derivePlayerSeasonStats(changed.history[0]!.season, beforeStats.programId, playerId)).toEqual(beforeStats)
    const resolution = resolveDynastyPlayer(changed, playerId)
    if (resolution.status === 'unknown') throw new Error('unresolved player')
    expect(derivePlayerCareerSummary(resolution.careerHistory)).toEqual(beforeSummary)
    expect(derivePlayerCareerHighs(changed, playerId)).toEqual(beforeHighs)
    expect(deriveDynastyRecordBook(changed)).toEqual(beforeRecords)
  })
})
