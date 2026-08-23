import { beforeAll, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import {
  deriveNationalPlayerLeaders,
  deriveProgramPlayerSeasonStats,
  deriveSeasonPlayerStats,
} from '../season'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import { beginOffseason } from './dynastyState'
import {
  deriveDynastyRecordBook,
  derivePlayerCareerHighs,
  deriveProgramPlayerRecords,
  RECORD_CATEGORIES,
} from './seasonRecords'
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

  it('keeps deterministic ordinal ordering when equal values tie', () => {
    const activeSeason = activeSeasonWithOneGame()
    const game = activeSeason.schedule.games[0]!
    const result = activeSeason.resultsByGameId[game.id]!
    const players = [...result.homePlayerStats, ...result.awayPlayerStats]
      .filter(({ minutes }) => minutes > 0)
      .slice(0, 2)
    players[0]!.points = 777
    players[1]!.points = 777

    const tied = deriveDynastyRecordBook({ ...dynasty, activeSeason }).points.singleGame
      .filter(({ value }) => value === 777)
    expect(tied).toHaveLength(2)
    expect(tied.map(({ rank }) => rank)).toEqual([1, 2])
    expect(tied.map(({ playerId }) => playerId)).toEqual(
      players.map(({ playerId }) => playerId).sort(),
    )
  })
})

describe('derivePlayerCareerHighs', () => {
  it('combines archived and active games, exposes all categories, and counts repeated highs', () => {
    const sourceSeason = structuredClone(archive.season)
    const activeSeason = { ...sourceSeason, seasonNumber: 2 }
    const player = activeSeason.programStates[Object.keys(activeSeason.programStates)[0]!]!
      .team.roster[0]!
    const games = activeSeason.schedule.games
      .filter((game) => game.homeProgramId === Object.keys(activeSeason.programStates)[0] || game.awayProgramId === Object.keys(activeSeason.programStates)[0])
      .slice(0, 2)
    const resultsByGameId = Object.fromEntries(games.map((game) => {
      const result = structuredClone(archive.season.resultsByGameId[game.id]!)
      const row = [...result.homePlayerStats, ...result.awayPlayerStats]
        .find(({ playerId }) => playerId === player.id)!
      Object.assign(row, { points: 500, rebounds: 0, assists: 40, steals: 20, blocks: 10 })
      return [game.id, result]
    }))

    const highs = derivePlayerCareerHighs({
      ...dynasty,
      activeSeason: { ...activeSeason, resultsByGameId },
    }, player.id)
    expect(highs.gameScope).toBe('regular-season')
    expect(highs.hasAppearances).toBe(true)
    expect(highs.categories.points).toMatchObject({ value: 500, seasonNumber: 2, occurrenceCount: 2 })
    expect(highs.categories.points?.gameId).toBe(games[0]!.id)
    expect(highs.categories.rebounds?.value).toBeGreaterThanOrEqual(0)
    expect(highs.categories.assists?.value).toBe(40)
    expect(highs.categories.steals?.value).toBe(20)
    expect(highs.categories.blocks?.value).toBe(10)
    expect(highs.categories.points?.opponentProgramName).toBeTruthy()
  })

  it('returns one empty state before an appearance and ignores DNP and postseason rows', () => {
    const player = archive.season.programStates[Object.keys(archive.season.programStates)[0]!]!
      .team.roster[0]!
    const activeSeason = { ...archive.season, seasonNumber: 2, resultsByGameId: {} }
    const empty = derivePlayerCareerHighs({ ...dynasty, history: [], activeSeason }, player.id)
    expect(empty.hasAppearances).toBe(false)
    expect(Object.values(empty.categories).every((entry) => entry === null)).toBe(true)

    const game = activeSeason.schedule.games.find((candidate) => {
      const state = archive.season.programStates[candidate.homeProgramId]
      return state?.team.roster.some(({ id }) => id === player.id)
    })!
    const result = structuredClone(archive.season.resultsByGameId[game.id]!)
    const row = result.homePlayerStats.find(({ playerId }) => playerId === player.id)!
    row.minutes = 0
    const dnp = derivePlayerCareerHighs({
      ...dynasty,
      history: [],
      activeSeason: { ...activeSeason, resultsByGameId: { [game.id]: result } },
    }, player.id)
    expect(dnp.hasAppearances).toBe(false)

    Object.assign(row, {
      minutes: 1,
      points: 0,
      rebounds: 0,
      assists: 0,
      steals: 0,
      blocks: 0,
    })
    const zeroHighs = derivePlayerCareerHighs({
      ...dynasty,
      history: [],
      activeSeason: { ...activeSeason, resultsByGameId: { [game.id]: result } },
    }, player.id)
    expect(zeroHighs.hasAppearances).toBe(true)
    expect(zeroHighs.categories.rebounds?.value).toBe(0)

    const postseason = structuredClone(archive.postseason)
    for (const postseasonResult of Object.values(postseason.resultsByGameId)) {
      const postseasonRow = [...postseasonResult.homePlayerStats, ...postseasonResult.awayPlayerStats]
        .find(({ playerId }) => playerId === player.id)
      if (postseasonRow) postseasonRow.points = 9999
    }
    const withPostseason: DynastyState = { ...dynasty, activePostseason: postseason }
    expect(derivePlayerCareerHighs(withPostseason, player.id))
      .toEqual(derivePlayerCareerHighs(dynasty, player.id))
  })

  it('is archive-order independent and supports former Players', () => {
    const player = archive.season.programStates[Object.keys(archive.season.programStates)[0]!]!
      .team.roster[0]!
    const second = structuredClone(archive)
    Object.assign(second, { seasonNumber: 2, season: { ...second.season, seasonNumber: 2 } })
    const forward = derivePlayerCareerHighs({ ...dynasty, history: [archive, second], activeSeason: null }, player.id)
    const reverse = derivePlayerCareerHighs({ ...dynasty, history: [second, archive], activeSeason: null }, player.id)
    expect(reverse).toEqual(forward)
    expect(forward.hasAppearances).toBe(true)
  })
})

describe('deriveProgramPlayerRecords', () => {
  it('returns all categories and three Program-filtered record scopes', () => {
    const programId = Object.keys(archive.season.programStates)[0]!
    const records = deriveProgramPlayerRecords(dynasty, programId)
    expect(records.gameScope).toBe('regular-season')
    expect(records.hasAppearances).toBe(true)
    for (const category of RECORD_CATEGORIES) {
      expect(records.categories[category].singleGame?.programId).toBe(programId)
      expect(records.categories[category].singleSeason?.programId).toBe(programId)
      expect(records.categories[category].career?.programId).toBe(programId)
    }
  })

  it('uses Program-attributed Career totals', () => {
    const programId = Object.keys(archive.season.programStates)[0]!
    const records = deriveProgramPlayerRecords(dynasty, programId)
    const holder = records.categories.points.career!
    const expected = deriveProgramPlayerSeasonStats(archive.season, programId)
      .find(({ playerId }) => playerId === holder.playerId)!
    expect(holder.value).toBe(expected.points)
    expect(holder.gamesPlayed).toBe(expected.gamesPlayed)
  })

  it('marks only a qualified active Season rate Live and deduplicates rollover', () => {
    const sourceSeason = structuredClone(archive.season)
    const activeSeason = { ...sourceSeason, seasonNumber: 2 }
    const game = activeSeason.schedule.games[0]!
    const partialActiveSeason = {
      ...activeSeason,
      resultsByGameId: { [game.id]: activeSeason.resultsByGameId[game.id]! },
    }
    const programId = game.homeProgramId
    const live = deriveProgramPlayerRecords({ ...dynasty, activeSeason: partialActiveSeason }, programId)
    expect(live.categories.points.singleSeason?.isLive).toBe(true)
    expect(live.categories.points.singleGame?.isLive).toBeUndefined()
    expect(live.categories.points.career?.isLive).toBeUndefined()

    expect(deriveProgramPlayerRecords({ ...dynasty, activeSeason: archive.season }, programId))
      .toEqual(deriveProgramPlayerRecords(dynasty, programId))
  })

  it('has a no-data state, rejects unknown Programs, and ignores Tournament results', () => {
    const programId = Object.keys(archive.season.programStates)[0]!
    const empty = deriveProgramPlayerRecords({
      ...dynasty,
      history: [],
      activeSeason: { ...archive.season, seasonNumber: 2, resultsByGameId: {} },
    }, programId)
    expect(empty.hasAppearances).toBe(false)
    expect(empty.categories.points).toEqual({ singleGame: null, singleSeason: null, career: null })
    expect(() => deriveProgramPlayerRecords(dynasty, 'unknown-program')).toThrow(RangeError)

    const postseason = structuredClone(archive.postseason)
    Object.values(postseason.resultsByGameId)[0]!.homePlayerStats[0]!.points = 9999
    const withPostseason: DynastyState = { ...dynasty, activePostseason: postseason }
    expect(deriveProgramPlayerRecords(withPostseason, programId))
      .toEqual(deriveProgramPlayerRecords(dynasty, programId))
  })
})
