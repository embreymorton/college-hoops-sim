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
    expect(deriveDynastyRecordBook(activeOnly, 'game', 'points').entries).toEqual([])
    expect(deriveDynastyRecordBook(activeOnly, 'season', 'points').entries).toEqual([])
    expect(deriveDynastyRecordBook(activeOnly, 'career', 'points').entries).toEqual([])
  })

  it('derives regular-season game highs from archived box scores with deterministic context', () => {
    const book = deriveDynastyRecordBook(dynasty, 'game', 'points')
    expect(book.entries).toHaveLength(10)
    expect(book.entries[0]!.value).toBeGreaterThanOrEqual(book.entries[1]!.value)
    expect(book.entries[0]).toMatchObject({ rank: 1, seasonNumber: 1 })
    expect(book.entries[0]!.opponentProgramName).toBeTruthy()
  })

  it('reuses qualified national Season rates and excludes nonqualifiers', () => {
    const expected = deriveNationalPlayerLeaders(archive.season).points
    const book = deriveDynastyRecordBook(dynasty, 'season', 'points')
    expect(book.entries.map((row) => [row.playerId, row.value, row.gamesPlayed]))
      .toEqual(expected.map((row) => [row.playerId, row.value, row.gamesPlayed]))
  })

  it('aggregates stable Player IDs across Seasons and is archive-order independent', () => {
    const second = structuredClone(archive)
    Object.assign(second, { seasonNumber: 2, season: { ...second.season, seasonNumber: 2 } })
    const forward = { ...dynasty, history: [archive, second] }
    const reverse = { ...dynasty, history: [second, archive] }
    const one = deriveDynastyRecordBook(dynasty, 'career', 'points')
    const two = deriveDynastyRecordBook(forward, 'career', 'points')
    expect(two.entries[0]!.value).toBe(one.entries[0]!.value * 2)
    expect(two.entries[0]).toMatchObject({ firstSeasonNumber: 1, lastSeasonNumber: 2 })
    expect(deriveDynastyRecordBook(reverse, 'career', 'points')).toEqual(two)
  })

  it('limits Top 10, supports shorter lists, and does not mutate archives', () => {
    const before = structuredClone(dynasty.history)
    expect(deriveDynastyRecordBook(dynasty, 'game', 'rebounds', 3).entries).toHaveLength(3)
    expect(deriveDynastyRecordBook(dynasty, 'career', 'blocks', 100).entries.length).toBeLessThanOrEqual(100)
    expect(dynasty.history).toEqual(before)
  })
})
