import { beforeAll, describe, expect, it } from 'vitest'
import { initializePostseason, simulatePendingGamesInTournamentRound, TOURNAMENT_ROUNDS } from '../postseason'
import { deriveNationalPlayerLeaders } from '../season'
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
  it('returns empty history cleanly and never reads the active Season', () => {
    const activeOnly = { ...dynasty, history: [], activeSeason: archive.season }
    const book = deriveDynastyRecordBook(activeOnly)
    expect(book.points.singleGame).toEqual([])
    expect(book.points.singleSeason).toEqual([])
    expect(book.points.career).toEqual([])
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
