import { beforeAll, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import { deriveNationalPlayerLeaders, deriveSeasonPlayerStats } from '../season'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import { beginOffseason } from './dynastyState'
import { deriveDynastyRecordBook } from './seasonRecords'
import type { CompletedSeasonArchive, DynastyState } from './domain'

let dynasty: DynastyState
let archive: CompletedSeasonArchive

beforeAll(() => {
  const source = createRecruitingDynasty('records-test')
  const season = completeRounds(source.activeSeason!)
  let postseason = initializePostseason({ universe: source.universe, season })
  for (const round of TOURNAMENT_ROUNDS) postseason = simulatePendingGamesInTournamentRound({ postseason, round, simulationSeed: `records-${round}` })
  dynasty = beginOffseason({ ...source, activeSeason: season, activePostseason: postseason })
  archive = dynasty.history[0]!
})

describe('deriveDynastyRecordBook', () => {
  function activeSeasonWithOneGame() {
    const activeSeason = structuredClone(archive.season)
    const game = activeSeason.schedule.games[0]!
    const result = structuredClone(activeSeason.resultsByGameId[game.id]!)
    const scorer = result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    scorer.points = 999
    return {
      ...activeSeason,
      seasonNumber: 2,
      resultsByGameId: { [game.id]: result },
    }
  }

  it('returns an empty Record Book before any regular-season game completes', () => {
    const activeOnly = {
      ...dynasty,
      history: [],
      activeSeason: { ...archive.season, seasonNumber: 2, resultsByGameId: {} },
    }
    const book = deriveDynastyRecordBook(activeOnly)
    expect(book.points.singleGame).toEqual([])
    expect(book.points.singleSeason).toEqual([])
    expect(book.points.career).toEqual([])
  })

  it('overlays active regular-season Single Game, provisional Season, and Career facts', () => {
    const activeSeason = activeSeasonWithOneGame()
    const input = { ...dynasty, activeSeason }
    const book = deriveDynastyRecordBook(input)
    const liveGame = book.points.singleGame[0]!
    const liveSeason = book.points.singleSeason.find(
      (row) => row.playerId === liveGame.playerId && row.seasonNumber === 2,
    )!
    const historicalStats = deriveSeasonPlayerStats(archive.season).find(
      (row) => row.playerId === liveGame.playerId,
    )!
    const activeStats = deriveSeasonPlayerStats(activeSeason).find(
      (row) => row.playerId === liveGame.playerId,
    )!
    const liveCareer = book.points.career.find((row) => row.playerId === liveGame.playerId)!

    expect(liveGame).toMatchObject({ value: 999, seasonNumber: 2 })
    expect(liveGame.isLive).toBeUndefined()
    expect(liveSeason).toMatchObject({ value: 999, gamesPlayed: 1, isLive: true })
    expect(liveCareer.value).toBe(historicalStats.points + activeStats.points)
    expect(liveCareer.lastSeasonNumber).toBe(2)

    const programId = Object.entries(activeSeason.programStates).find(([, state]) =>
      state.team.roster.some(({ id }) => id === liveGame.playerId),
    )![0]
    const secondGame = activeSeason.schedule.games.find((game) =>
      game.id !== Object.keys(activeSeason.resultsByGameId)[0] &&
      (game.homeProgramId === programId || game.awayProgramId === programId),
    )!
    const secondResult = structuredClone(archive.season.resultsByGameId[secondGame.id]!)
    const secondStats = (secondGame.homeProgramId === programId
      ? secondResult.homePlayerStats
      : secondResult.awayPlayerStats).find(({ playerId }) => playerId === liveGame.playerId)!
    secondStats.points = 1
    const updated = deriveDynastyRecordBook({
      ...input,
      activeSeason: {
        ...activeSeason,
        resultsByGameId: {
          ...activeSeason.resultsByGameId,
          [secondGame.id]: secondResult,
        },
      },
    }).points.singleSeason.find(
      (row) => row.playerId === liveGame.playerId && row.seasonNumber === 2,
    )!
    expect(updated).toMatchObject({ value: 500, gamesPlayed: 2, isLive: true })
  })

  it('excludes postseason stats and avoids duplicate active/completed Season representation', () => {
    const postseason = structuredClone(archive.postseason)
    const postseasonResult = Object.values(postseason.resultsByGameId)[0]!
    postseasonResult.homePlayerStats[0]!.points = 9999
    const withPostseason = { ...dynasty, activePostseason: postseason }
    expect(deriveDynastyRecordBook(withPostseason)).toEqual(deriveDynastyRecordBook(dynasty))

    const duplicateActive = { ...dynasty, activeSeason: archive.season }
    expect(deriveDynastyRecordBook(duplicateActive)).toEqual(deriveDynastyRecordBook(dynasty))
  })

  it('derives regular-season game highs from archived box scores with deterministic context', () => {
    const rows = deriveDynastyRecordBook(dynasty).points.singleGame
    expect(rows).toHaveLength(10)
    expect(rows[0]!.value).toBeGreaterThanOrEqual(rows[1]!.value)
    expect(rows[0]).toMatchObject({ rank: 1, seasonNumber: 1 })
    expect(rows[0]!.opponentProgramName).toBeTruthy()
  })

  it('reuses qualified national Season rates and excludes nonqualifiers', () => {
    const expected = deriveNationalPlayerLeaders(archive.season).points
    const rows = deriveDynastyRecordBook(dynasty).points.singleSeason
    expect(rows.map((row) => [row.playerId, row.value, row.gamesPlayed]))
      .toEqual(expected.map((row) => [row.playerId, row.value, row.gamesPlayed]))
  })

  it('aggregates stable Player IDs across Seasons and is archive-order independent', () => {
    const second = structuredClone(archive)
    Object.assign(second, { seasonNumber: 2, season: { ...second.season, seasonNumber: 2 } })
    const forward = { ...dynasty, history: [archive, second] }
    const reverse = { ...dynasty, history: [second, archive] }
    const one = deriveDynastyRecordBook(dynasty)
    const two = deriveDynastyRecordBook(forward)
    expect(two.points.career[0]!.value).toBe(one.points.career[0]!.value * 2)
    expect(two.points.career[0]).toMatchObject({ firstSeasonNumber: 1, lastSeasonNumber: 2 })
    expect(deriveDynastyRecordBook(reverse)).toEqual(two)
  })

  it('limits Top 10, supports shorter lists, and does not mutate archives', () => {
    const before = structuredClone(dynasty.history)
    const limited = deriveDynastyRecordBook(dynasty, 3)
    expect(limited.rebounds.singleGame).toHaveLength(3)
    expect(limited.blocks.singleSeason).toHaveLength(3)
    expect(limited.blocks.career).toHaveLength(3)
    expect(dynasty.history).toEqual(before)
  })

  it('exposes every category with all three scopes from the same history', () => {
    const book = deriveDynastyRecordBook(dynasty)
    for (const category of ['points', 'rebounds', 'assists', 'steals', 'blocks'] as const) {
      expect(book[category].singleGame.length).toBeGreaterThan(0)
      expect(book[category].singleSeason.length).toBeGreaterThan(0)
      expect(book[category].career.length).toBeGreaterThan(0)
      expect(book[category].singleGame[0]!.seasonNumber).toBe(1)
      expect(book[category].singleSeason[0]!.seasonNumber).toBe(1)
      expect(book[category].career[0]!.firstSeasonNumber).toBe(1)
    }
  })
})
