import { beforeAll, describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'
import { beginOffseason } from './dynastyState'
import type { CompletedSeasonArchive, DynastyState } from './domain'
import { deriveDynastyRecordBook, derivePlayerCareerHighs, deriveProgramPlayerRecords } from './seasonRecords'
import { derivePostgameMeaning } from './postgameMeaning'

let archived: DynastyState
let archive: CompletedSeasonArchive

beforeAll(() => {
  const source = createRecruitingDynasty('postgame-meaning-test')
  const season = completeRounds(source.activeSeason!)
  let postseason = initializePostseason({ universe: source.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `postgame-meaning:${round}`,
    })
  }
  archived = beginOffseason({ ...source, activeSeason: season, activePostseason: postseason })
  archive = archived.history[0]!
})

function regularDynasty(gameIndex = 0) {
  const season = structuredClone(archive.season)
  Object.assign(season, { seasonNumber: 2 })
  const game = season.schedule.games[gameIndex]!
  const result = structuredClone(archive.season.resultsByGameId[game.id]!)
  Object.assign(season, { resultsByGameId: { [game.id]: result } })
  return {
    dynasty: { ...archived, activeSeason: season, activePostseason: null },
    season,
    game,
    result,
  }
}

function tournamentDynasty(gameIndex = 0) {
  const season = structuredClone(archive.season)
  Object.assign(season, { seasonNumber: 2 })
  const postseason = structuredClone(archive.postseason)
  const game = postseason.bracket.games[gameIndex]!
  const result = structuredClone(postseason.resultsByGameId[game.id]!)
  Object.assign(postseason, { resultsByGameId: { [game.id]: result } })
  return {
    dynasty: { ...archived, activeSeason: season, activePostseason: postseason },
    postseason,
    game,
    result,
  }
}

function deriveRegular(input: ReturnType<typeof regularDynasty>, presentation: 'live' | 'historical' = 'live') {
  return derivePostgameMeaning({
    dynasty: input.dynasty,
    competition: 'regular-season',
    gameId: input.game.id,
    perspectiveProgramId: input.game.homeProgramId,
    presentation,
  })
}

function deriveTournament(input: ReturnType<typeof tournamentDynasty>, presentation: 'live' | 'historical' = 'live') {
  return derivePostgameMeaning({
    dynasty: input.dynasty,
    competition: 'tournament',
    gameId: input.game.id,
    perspectiveProgramId: input.result.homeTeamId,
    presentation,
  })
}

describe('regular-season Postgame Meaning', () => {
  it('returns only the combined updated-record fallback for an ordinary non-Conference game', () => {
    const input = regularDynasty(
      archive.season.schedule.games.findIndex(({ type }) => type === 'nonconference'),
    )
    for (const row of [...input.result.homePlayerStats, ...input.result.awayPlayerStats]) {
      Object.assign(row, { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })
    }
    const meaning = deriveRegular(input)
    expect(meaning.facts).toHaveLength(1)
    expect(meaning.facts[0]).toMatchObject({ kind: 'program-records', first: { conference: null } })
  })

  it('includes Conference records for a Conference game', () => {
    const input = regularDynasty(
      archive.season.schedule.games.findIndex(({ type }) => type === 'conference'),
    )
    for (const row of [...input.result.homePlayerStats, ...input.result.awayPlayerStats]) {
      Object.assign(row, { points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })
    }
    expect(deriveRegular(input).facts[0]).toMatchObject({
      kind: 'program-records',
      first: { conference: { wins: expect.any(Number), losses: expect.any(Number) } },
      second: { conference: { wins: expect.any(Number), losses: expect.any(Number) } },
    })
  })

  it('groups strict Dynasty single-game records and suppresses matching lower meanings', () => {
    const input = regularDynasty()
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    Object.assign(row, { points: 999, assists: 99 })
    const facts = deriveRegular(input).facts
    expect(facts[0]).toMatchObject({
      kind: 'statistical-record',
      scope: 'dynasty-single-game',
      player: { playerId: row.playerId },
      records: [{ category: 'points', value: 999 }, { category: 'assists', value: 99 }],
    })
    expect(facts.filter((fact) => fact.kind === 'career-high')).toHaveLength(0)
  })

  it('does not treat a tie with the accepted Dynasty high as a new record', () => {
    const input = regularDynasty()
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = deriveDynastyRecordBook(archived, 1).points.singleGame[0]!.value
    const matching = deriveRegular(input).facts.filter(
      (fact) => fact.kind === 'statistical-record' &&
        fact.scope === 'dynasty-single-game' &&
        fact.records.some(({ category }) => category === 'points'),
    )
    expect(matching).toHaveLength(0)
  })

  it('can emit a Program record without claiming a Dynasty record', () => {
    const input = regularDynasty()
    const programId = input.game.homeProgramId
    const programHigh = deriveProgramPlayerRecords(archived, programId).categories.points.singleGame!.value
    const dynastyHigh = deriveDynastyRecordBook(archived, 1).points.singleGame[0]!.value
    expect(programHigh).toBeLessThanOrEqual(dynastyHigh)
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = programHigh < dynastyHigh ? programHigh + 1 : dynastyHigh
    const record = deriveRegular(input).facts.find(
      (fact) => fact.kind === 'statistical-record' &&
        fact.records.some(({ category }) => category === 'points'),
    )
    if (programHigh < dynastyHigh) expect(record).toMatchObject({ scope: 'program-single-game' })
    else expect(record).toBeUndefined()
  })

  it('suppresses first-appearance and low-value highs but includes a threshold-qualified prior Player high', () => {
    const input = regularDynasty()
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    const prior = derivePlayerCareerHighs(archived, row.playerId).categories.points!.value
    const programHigh = deriveProgramPlayerRecords(archived, input.game.homeProgramId).categories.points.singleGame!.value
    row.points = Math.max(35, prior + 1)
    if (row.points <= programHigh) {
      expect(deriveRegular(input).facts).toContainEqual(expect.objectContaining({ kind: 'career-high' }))
    }

    const firstCareer = regularDynasty()
    firstCareer.dynasty = { ...firstCareer.dynasty, history: [] }
    const firstRow = firstCareer.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    firstRow.points = 60
    expect(deriveRegular(firstCareer).facts.some(({ kind }) => kind === 'career-high')).toBe(false)
  })

  it('uses canonical as-of-game cutoffs and caps deterministic output at three facts', () => {
    const input = regularDynasty()
    const later = input.season.schedule.games.find((game) => game.index > input.game.index)!
    const laterResult = structuredClone(archive.season.resultsByGameId[later.id]!)
    laterResult.homePlayerStats.find(({ minutes }) => minutes > 0)!.points = 5_000
    input.season.resultsByGameId[later.id] = laterResult
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = 999
    const historical = deriveRegular(input, 'historical')
    expect(historical.presentation).toBe('historical')
    expect(historical.facts).toHaveLength(2)
    expect(historical.facts[0]).toMatchObject({ kind: 'statistical-record' })
    expect(historical.facts.length).toBeLessThanOrEqual(3)
  })

  it('reuses the accepted 10-win and undefeated-run-ended streak meanings', () => {
    const season = structuredClone(archive.season)
    Object.assign(season, { seasonNumber: 2 })
    const programId = season.schedule.games[0]!.homeProgramId
    const programGames = season.schedule.games
      .filter((game) => game.homeProgramId === programId || game.awayProgramId === programId)
      .sort((a, b) => a.round - b.round || a.index - b.index)
    Object.assign(season, { resultsByGameId: Object.fromEntries(programGames.slice(0, 10).map((game) => {
      const result = structuredClone(archive.season.resultsByGameId[game.id]!)
      result.winnerId = programId
      return [game.id, result]
    })) })
    const tenth = programGames[9]!
    const winning = derivePostgameMeaning({
      dynasty: { ...archived, activeSeason: season, activePostseason: null },
      competition: 'regular-season', gameId: tenth.id,
      perspectiveProgramId: programId, presentation: 'live',
    })
    expect(winning.facts).toContainEqual(expect.objectContaining({
      kind: 'streak', streak: 'ten-wins', wins: 10,
    }))

    const losingProgramId = tenth.homeProgramId === programId
      ? tenth.awayProgramId
      : tenth.homeProgramId
    const losingGames = season.schedule.games
      .filter((game) => game.homeProgramId === losingProgramId || game.awayProgramId === losingProgramId)
      .sort((a, b) => a.round - b.round || a.index - b.index)
    const target = losingGames[8]!
    Object.assign(season, { resultsByGameId: Object.fromEntries(losingGames.slice(0, 9).map((game, index) => {
      const result = structuredClone(archive.season.resultsByGameId[game.id]!)
      result.winnerId = index < 8
        ? losingProgramId
        : game.homeProgramId === losingProgramId ? game.awayProgramId : game.homeProgramId
      return [game.id, result]
    })) })
    const ended = derivePostgameMeaning({
      dynasty: { ...archived, activeSeason: season, activePostseason: null },
      competition: 'regular-season', gameId: target.id,
      perspectiveProgramId: losingProgramId, presentation: 'live',
    })
    expect(ended.facts).toContainEqual(expect.objectContaining({
      kind: 'streak', streak: 'undefeated-run-ended', wins: 8,
    }))
  })

  it('throws consistently for unknown games and missing results', () => {
    const input = regularDynasty()
    expect(() => derivePostgameMeaning({
      dynasty: input.dynasty, competition: 'regular-season', gameId: 'unknown',
      perspectiveProgramId: input.game.homeProgramId, presentation: 'live',
    })).toThrow(/Unknown regular-season/)
    Object.assign(input.season, { resultsByGameId: {} })
    expect(() => deriveRegular(input)).toThrow(/no completed result/)
  })
})

describe('Tournament Postgame Meaning', () => {
  it('combines advancement and elimination and identifies any worse-seeded winner', () => {
    const input = tournamentDynasty()
    input.dynasty = { ...input.dynasty, history: [] }
    const winnerId = input.result.winnerId
    const loserId = winnerId === input.result.homeTeamId ? input.result.awayTeamId : input.result.homeTeamId
    const winnerEntry = input.postseason.field.find(({ programId }) => programId === winnerId)!
    const loserEntry = input.postseason.field.find(({ programId }) => programId === loserId)!
    if (winnerEntry.seed < loserEntry.seed) {
      const winnerSeed = winnerEntry.seed
      Object.assign(winnerEntry, { seed: loserEntry.seed })
      Object.assign(loserEntry, { seed: winnerSeed })
    }
    const facts = deriveTournament(input).facts
    expect(facts[0]).toMatchObject({ kind: 'competitive-outcome', outcome: 'advancement' })
    expect(facts).toContainEqual(expect.objectContaining({ kind: 'tournament-upset' }))
  })

  it('does not label a better-seeded winner as an upset', () => {
    const input = tournamentDynasty()
    input.dynasty = { ...input.dynasty, history: [] }
    const winnerId = input.result.winnerId
    const loserId = winnerId === input.result.homeTeamId ? input.result.awayTeamId : input.result.homeTeamId
    const winnerEntry = input.postseason.field.find(({ programId }) => programId === winnerId)!
    const loserEntry = input.postseason.field.find(({ programId }) => programId === loserId)!
    if (winnerEntry.seed > loserEntry.seed) {
      const winnerSeed = winnerEntry.seed
      Object.assign(winnerEntry, { seed: loserEntry.seed })
      Object.assign(loserEntry, { seed: winnerSeed })
    }
    expect(deriveTournament(input).facts.some(({ kind }) => kind === 'tournament-upset')).toBe(false)
  })

  it('makes the title result Champion/Runner-Up without a separate advancement fact', () => {
    const titleIndex = archive.postseason.bracket.games.findIndex(({ round }) => round === 'championship')
    const input = tournamentDynasty(titleIndex)
    Object.assign(input.postseason, {
      resultsByGameId: structuredClone(archive.postseason.resultsByGameId),
    })
    const facts = deriveTournament(input).facts
    expect(facts[0]).toMatchObject({
      kind: 'competitive-outcome', outcome: 'championship', completedRound: 'championship', nextRound: null,
    })
    expect(facts.filter((fact) => fact.kind === 'competitive-outcome')).toHaveLength(1)
  })

  it('supports game-excluded Single Game, Run, and Career record comparisons', () => {
    const input = tournamentDynasty()
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = 999
    const recordScopes = deriveTournament(input).facts
      .filter((fact) => fact.kind === 'statistical-record')
      .map((fact) => fact.scope)
    expect(recordScopes).toContain('tournament-single-game')
    expect(recordScopes).toContain('tournament-run')
  })

  it('uses Tournament-only prior appearances for meaningful career highs', () => {
    const input = tournamentDynasty()
    input.dynasty = { ...input.dynasty, history: [] }
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = 50
    expect(deriveTournament(input).facts.some(({ kind }) => kind === 'career-high')).toBe(false)
  })

  it('ignores later Tournament rounds in historical reconstruction and caps output', () => {
    const input = tournamentDynasty()
    const later = archive.postseason.bracket.games.find((game) =>
      TOURNAMENT_ROUNDS.indexOf(game.round) > TOURNAMENT_ROUNDS.indexOf(input.game.round),
    )!
    input.postseason.resultsByGameId[later.id] = structuredClone(archive.postseason.resultsByGameId[later.id]!)
    const row = input.result.homePlayerStats.find(({ minutes }) => minutes > 0)!
    row.points = 999
    const meaning = deriveTournament(input, 'historical')
    expect(meaning.presentation).toBe('historical')
    expect(meaning.facts[0]).toMatchObject({ kind: 'competitive-outcome' })
    expect(meaning.facts.length).toBeLessThanOrEqual(3)
  })
})
