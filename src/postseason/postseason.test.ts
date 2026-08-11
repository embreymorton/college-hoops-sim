import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  simulateGame,
  cloneRotationV1,
  validateRotationV1,
  type GameResult,
  type PlayerGameStats,
  type RotationV1,
} from '../engine'
import { generateRegularSeasonSchedule, type ScheduledGame } from '../schedule'
import {
  deriveConferenceStandings,
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../season'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  createNationalTournamentBracket,
  deriveNationalChampion,
  getCompletedGamesForTournamentRound,
  getCurrentTournamentRound,
  getGamesForTournamentRound,
  getPendingGamesForTournamentRound,
  getReadyGamesForTournamentRound,
  getTournamentGameForProgram,
  initializePostseason,
  isTournamentComplete,
  rankAutomaticQualifiers,
  rankAtLargeCandidates,
  recordTournamentGameResult,
  resolveTournamentGameParticipantSlots,
  resolveTournamentGameParticipants,
  selectNationalTournamentField,
  simulatePendingGamesInTournamentRound,
  simulateTournamentGame,
  updatePostseasonProgramRotation,
  validateNationalTournamentBracket,
  validatePostseasonState,
  validateTournamentSelection,
  type PostseasonState,
} from './index'

const SIMULATION_SEED = 'postseason-test-simulation-v0'
let initialSeason: SeasonState
let completeSeason: SeasonState
let initialPostseason: PostseasonState

function completeRegularSeason(season: SeasonState): SeasonState {
  let current = season
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: 'postseason-test-regular-season',
    })
  }
  return current
}

function completeTournament(
  postseason: PostseasonState,
  seed: string | number = SIMULATION_SEED,
): PostseasonState {
  let current = postseason
  for (const round of [
    'round-of-16',
    'quarterfinals',
    'semifinals',
    'championship',
  ] as const) {
    current = simulatePendingGamesInTournamentRound({
      postseason: current,
      round,
      simulationSeed: seed,
    })
  }
  return current
}

function stat(playerId: string, points: number): PlayerGameStats {
  return {
    playerId,
    minutes: 40,
    points,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }
}

function manualResult(
  participants: { homeProgramId: string; awayProgramId: string },
  winnerId: string,
): GameResult {
  const homeScore = winnerId === participants.homeProgramId ? 71 : 65
  const awayScore = winnerId === participants.awayProgramId ? 71 : 65
  return {
    homeTeamId: participants.homeProgramId,
    awayTeamId: participants.awayProgramId,
    homeScore,
    awayScore,
    winnerId,
    overtimePeriods: 0,
    seed: 'constructed-upset',
    homePlayerStats: [stat(`${participants.homeProgramId}:player`, homeScore)],
    awayPlayerStats: [stat(`${participants.awayProgramId}:player`, awayScore)],
  }
}

function alternativeRotation(postseason: PostseasonState, programId: string): RotationV1 {
  const state = postseason.programStates[programId]!
  const rotation = cloneRotationV1(state.rotation)
  for (const player of state.team.roster) {
    const teammate = state.team.roster.find(
      (candidate) =>
        candidate.id !== player.id &&
        candidate.position === player.position &&
        (rotation.minutesByPosition[player.position][candidate.id] ?? 0) < 40,
    )
    const assignments = rotation.minutesByPosition[player.position]
    const minutes = assignments[player.id] ?? 0
    if (!teammate || minutes < 1) continue
    assignments[player.id] = minutes - 1
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) + 1
    if (validateRotationV1(state.team, rotation).valid) return rotation
    assignments[player.id] = minutes
    assignments[teammate.id] = (assignments[teammate.id] ?? 0) - 1
  }
  throw new Error(`Could not alter Rotation for ${programId}.`)
}

function rankingSeason(
  fixtures: readonly {
    home: string
    away: string
    winner: string
    type?: 'conference' | 'nonconference'
  }[],
): SeasonState {
  const games: ScheduledGame[] = fixtures.map((fixture, index) => ({
    id: `ranking-${index}`,
    index,
    round: index + 1,
    homeProgramId: fixture.home,
    awayProgramId: fixture.away,
    type: fixture.type ?? 'nonconference',
  }))
  const resultsByGameId = Object.fromEntries(
    games.map((game, index) => [
      game.id,
      manualResult(
        {
          homeProgramId: game.homeProgramId,
          awayProgramId: game.awayProgramId,
        },
        fixtures[index]!.winner,
      ),
    ]),
  )
  return {
    id: 'ranking-season',
    seasonNumber: 1,
    universeId: 'ranking-universe',
    universeVersion: 'v0',
    schedule: {
      version: 'v0',
      universeId: 'ranking-universe',
      universeVersion: 'v0',
      seed: 'ranking',
      configuration: {
        conferenceFormat: 'double-round-robin',
        nonConferenceGamesPerProgram: 0,
        targetHomeGamesPerProgram: 0,
        targetAwayGamesPerProgram: 0,
      },
      roundCount: Math.max(1, games.length),
      games,
    },
    programStates: {},
    resultsByGameId,
  }
}

beforeAll(() => {
  const initialized = initializeUniverse(UNIVERSE_V0, 'postseason-test-universe')
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'postseason-test-schedule',
  })
  initialSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse: initialized,
    schedule,
    seasonNumber: 1,
  })
  completeSeason = completeRegularSeason(initialSeason)
  initialPostseason = initializePostseason({
    universe: UNIVERSE_V0,
    season: completeSeason,
  })
})

describe('national tournament selection', () => {
  it('rejects incomplete Seasons through initialization and structured validation', () => {
    expect(() =>
      initializePostseason({ universe: UNIVERSE_V0, season: initialSeason }),
    ).toThrow(/regular season is complete/)
    expect(
      validateTournamentSelection(UNIVERSE_V0, initialSeason, []),
    ).toMatchObject({
      valid: false,
      issues: [{ code: 'INCOMPLETE_REGULAR_SEASON' }],
    })
  })

  it('selects one champion per conference, 12 distinct at-larges, and seeds 1-16', () => {
    const selection = selectNationalTournamentField(UNIVERSE_V0, completeSeason)
    const automatic = selection.field.filter(({ bidType }) => bidType === 'automatic')
    const atLarge = selection.field.filter(({ bidType }) => bidType === 'at-large')
    const champions = UNIVERSE_V0.conferences.map(
      ({ id }) => deriveConferenceStandings(UNIVERSE_V0, completeSeason, id)[0]!.programId,
    )

    expect(selection.field).toHaveLength(16)
    expect(automatic).toHaveLength(4)
    expect(atLarge).toHaveLength(12)
    expect(new Set(selection.field.map(({ programId }) => programId)).size).toBe(16)
    expect(automatic.map(({ programId }) => programId).sort()).toEqual(champions.sort())
    expect(automatic.map(({ seed }) => seed)).toEqual([1, 2, 3, 4])
    expect(atLarge.map(({ seed }) => seed)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 5),
    )
    expect(selection.firstFourOutProgramIds).toHaveLength(4)
    expect(validateTournamentSelection(UNIVERSE_V0, completeSeason, selection.field).valid).toBe(true)
  })

  it('uses decisive two-team head-to-head before conference percentage', () => {
    const season = rankingSeason([
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'alpha', away: 'charlie', winner: 'charlie', type: 'conference' },
      { home: 'bravo', away: 'delta', winner: 'bravo', type: 'conference' },
    ])
    expect(rankAtLargeCandidates(season, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])
  })

  it('orders different overall percentages before any tie breakers', () => {
    const season = rankingSeason([
      { home: 'alpha', away: 'x', winner: 'alpha' },
      { home: 'alpha', away: 'y', winner: 'alpha' },
      { home: 'bravo', away: 'x', winner: 'bravo' },
      { home: 'bravo', away: 'y', winner: 'y' },
    ])
    expect(rankAtLargeCandidates(season, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])
  })

  it('falls through split head-to-head to conference percentage and then Program ID', () => {
    const season = rankingSeason([
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'bravo', away: 'alpha', winner: 'bravo' },
      { home: 'alpha', away: 'charlie', winner: 'charlie', type: 'conference' },
      { home: 'alpha', away: 'echo', winner: 'alpha' },
      { home: 'bravo', away: 'delta', winner: 'bravo', type: 'conference' },
      { home: 'bravo', away: 'foxtrot', winner: 'foxtrot' },
    ])
    expect(rankAtLargeCandidates(season, ['alpha', 'bravo'])).toEqual([
      'bravo',
      'alpha',
    ])

    const idFallback = rankingSeason([
      { home: 'alpha', away: 'x', winner: 'alpha' },
      { home: 'alpha', away: 'y', winner: 'y' },
      { home: 'bravo', away: 'x', winner: 'bravo' },
      { home: 'bravo', away: 'y', winner: 'y' },
    ])
    expect(rankAtLargeCandidates(idFallback, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])
  })

  it('skips unsafe pairwise head-to-head for three-program ties', () => {
    const season = rankingSeason([
      { home: 'alpha', away: 'bravo', winner: 'alpha' },
      { home: 'bravo', away: 'charlie', winner: 'bravo' },
      { home: 'charlie', away: 'alpha', winner: 'charlie' },
    ])
    expect(rankAtLargeCandidates(season, ['charlie', 'bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
      'charlie',
    ])
  })

  it('is unaffected by prestige and current Team ratings', () => {
    const baseline = selectNationalTournamentField(UNIVERSE_V0, completeSeason)
    const altered: SeasonState = {
      ...completeSeason,
      programStates: Object.fromEntries(
        Object.entries(completeSeason.programStates).map(([id, state], index) => [
          id,
          {
            ...state,
            team: {
              ...state.team,
              prestige: index % 2 === 0 ? 0 : 100,
              roster: state.team.roster.map((player) => ({
                ...player,
                attributes: Object.fromEntries(
                  Object.keys(player.attributes).map((key) => [key, index % 2 === 0 ? 40 : 99]),
                ) as unknown as typeof player.attributes,
              })),
            },
          },
        ]),
      ),
    }
    expect(selectNationalTournamentField(UNIVERSE_V0, altered)).toEqual(baseline)
  })

  it('orders protected champions by overall percentage, Conference percentage, then ID', () => {
    const overall = rankingSeason([
      { home: 'alpha', away: 'x', winner: 'alpha' },
      { home: 'alpha', away: 'y', winner: 'alpha' },
      { home: 'bravo', away: 'x', winner: 'bravo' },
      { home: 'bravo', away: 'y', winner: 'y' },
    ])
    expect(rankAutomaticQualifiers(overall, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])

    const conference = rankingSeason([
      { home: 'alpha', away: 'x', winner: 'alpha', type: 'conference' },
      { home: 'alpha', away: 'y', winner: 'y' },
      { home: 'bravo', away: 'x', winner: 'bravo' },
      { home: 'bravo', away: 'y', winner: 'y', type: 'conference' },
    ])
    expect(rankAutomaticQualifiers(conference, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])

    const fallback = rankingSeason([
      { home: 'alpha', away: 'x', winner: 'alpha' },
      { home: 'alpha', away: 'y', winner: 'y' },
      { home: 'bravo', away: 'x', winner: 'bravo' },
      { home: 'bravo', away: 'y', winner: 'y' },
    ])
    expect(rankAutomaticQualifiers(fallback, ['bravo', 'alpha'])).toEqual([
      'alpha',
      'bravo',
    ])
  })
})

describe('fixed bracket', () => {
  it('contains all accepted pairings and winner pathways with stable IDs', () => {
    const bracket = createNationalTournamentBracket()
    const roundOf16 = bracket.games.slice(0, 8)
    expect(roundOf16.map(({ participantSources }) => participantSources)).toEqual(
      [[1, 16], [8, 9], [5, 12], [4, 13], [3, 14], [6, 11], [7, 10], [2, 15]].map(
        ([first, second]) => [
          { type: 'seed', seed: first },
          { type: 'seed', seed: second },
        ],
      ),
    )
    expect(bracket.games.slice(8).map(({ participantSources }) => participantSources)).toEqual([
      [{ type: 'winner', gameId: 'national-r16-g1' }, { type: 'winner', gameId: 'national-r16-g2' }],
      [{ type: 'winner', gameId: 'national-r16-g3' }, { type: 'winner', gameId: 'national-r16-g4' }],
      [{ type: 'winner', gameId: 'national-r16-g5' }, { type: 'winner', gameId: 'national-r16-g6' }],
      [{ type: 'winner', gameId: 'national-r16-g7' }, { type: 'winner', gameId: 'national-r16-g8' }],
      [{ type: 'winner', gameId: 'national-qf-g1' }, { type: 'winner', gameId: 'national-qf-g2' }],
      [{ type: 'winner', gameId: 'national-qf-g3' }, { type: 'winner', gameId: 'national-qf-g4' }],
      [{ type: 'winner', gameId: 'national-sf-g1' }, { type: 'winner', gameId: 'national-sf-g2' }],
    ])
    expect(new Set(bracket.games.map(({ id }) => id)).size).toBe(15)
    expect(JSON.parse(JSON.stringify(bracket))).toEqual(bracket)
    expect(validateNationalTournamentBracket(bracket).valid).toBe(true)
  })

  it('permits any conference combination because placement is seed-only', () => {
    const games = getGamesForTournamentRound(initialPostseason, 'round-of-16')
    expect(games).toHaveLength(8)
    expect(
      games.every((game) => resolveTournamentGameParticipants(initialPostseason, game.id)),
    ).toBe(true)
    expect(
      games.some((game) => {
        const participants = resolveTournamentGameParticipants(initialPostseason, game.id)!
        const conference = (programId: string) =>
          UNIVERSE_V0.programs.find(({ id }) => id === programId)!.conferenceId
        return conference(participants.homeProgramId) === conference(participants.awayProgramId)
      }),
    ).toBe(true)
  })

  it('rejects malformed pathways and duplicate IDs', () => {
    const duplicate = createNationalTournamentBracket()
    const malformed = {
      ...duplicate,
      games: duplicate.games.map((game, index) =>
        index === 1 ? { ...game, id: duplicate.games[0]!.id } : game,
      ),
    }
    expect(validateNationalTournamentBracket(malformed).issues.some(({ code }) => code === 'DUPLICATE_GAME_ID')).toBe(true)
    const badPath = {
      ...duplicate,
      games: duplicate.games.map((game) =>
        game.id === 'national-qf-g1'
          ? {
              ...game,
              participantSources: [
                { type: 'winner' as const, gameId: 'national-final' },
                game.participantSources[1],
              ] as const,
            }
          : game,
      ),
    }
    expect(validateNationalTournamentBracket(badPath).valid).toBe(false)
  })
})

describe('postseason state and progression', () => {
  it('copies exact qualified Team/Rotation state without mutating the Season', () => {
    const seasonBefore = JSON.stringify(completeSeason)
    initializePostseason({ universe: UNIVERSE_V0, season: completeSeason })
    for (const entry of initialPostseason.field) {
      expect(initialPostseason.programStates[entry.programId]).toEqual(
        completeSeason.programStates[entry.programId],
      )
      expect(initialPostseason.programStates[entry.programId]).not.toBe(
        completeSeason.programStates[entry.programId],
      )
    }
    expect(validatePostseasonState(UNIVERSE_V0, initialPostseason).valid).toBe(true)
    expect(JSON.parse(JSON.stringify(initialPostseason))).toEqual(initialPostseason)
    expect(JSON.stringify(completeSeason)).toBe(seasonBefore)
  })

  it('keeps future participants unresolved and advances actual upset winners without reseeding', () => {
    expect(resolveTournamentGameParticipants(initialPostseason, 'national-qf-g1')).toBeUndefined()
    expect(() =>
      simulateTournamentGame({
        postseason: initialPostseason,
        tournamentGameId: 'national-qf-g1',
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/not resolved/)

    let current = initialPostseason
    for (const gameId of ['national-r16-g1', 'national-r16-g2']) {
      const participants = resolveTournamentGameParticipants(current, gameId)!
      current = recordTournamentGameResult(
        current,
        gameId,
        manualResult(participants, participants.awayProgramId),
      )
    }
    const quarterfinal = resolveTournamentGameParticipants(current, 'national-qf-g1')!
    const seeds = quarterfinal
      ? [quarterfinal.homeProgramId, quarterfinal.awayProgramId].map(
          (id) => current.field.find(({ programId }) => programId === id)!.seed,
        )
      : []
    expect(seeds).toEqual([9, 16])
  })

  it('projects future bracket sources independently without making the game ready early', () => {
    const futureGameId = 'national-qf-g1'
    expect(
      resolveTournamentGameParticipantSlots(initialPostseason, futureGameId),
    ).toEqual([undefined, undefined])
    expect(
      resolveTournamentGameParticipants(initialPostseason, futureGameId),
    ).toBeUndefined()

    let current = initialPostseason
    const firstFeeder = resolveTournamentGameParticipants(
      current,
      'national-r16-g1',
    )!
    current = recordTournamentGameResult(
      current,
      'national-r16-g1',
      manualResult(firstFeeder, firstFeeder.awayProgramId),
    )

    expect(
      resolveTournamentGameParticipantSlots(current, futureGameId),
    ).toEqual([firstFeeder.awayProgramId, undefined])
    expect(
      resolveTournamentGameParticipants(current, futureGameId),
    ).toBeUndefined()

    const secondFeeder = resolveTournamentGameParticipants(
      current,
      'national-r16-g2',
    )!
    current = recordTournamentGameResult(
      current,
      'national-r16-g2',
      manualResult(secondFeeder, secondFeeder.homeProgramId),
    )

    expect(
      resolveTournamentGameParticipantSlots(current, futureGameId),
    ).toEqual([
      firstFeeder.awayProgramId,
      secondFeeder.homeProgramId,
    ])
    expect(resolveTournamentGameParticipants(current, futureGameId)).toEqual({
      homeProgramId: secondFeeder.homeProgramId,
      awayProgramId: firstFeeder.awayProgramId,
    })
  })

  it('bulk-simulates only ready pending games, preserves results, and respects exclusions', () => {
    const firstGame = getGamesForTournamentRound(initialPostseason, 'round-of-16')[0]!
    const partial = simulateTournamentGame({
      postseason: initialPostseason,
      tournamentGameId: firstGame.id,
      simulationSeed: SIMULATION_SEED,
    })
    const stored = partial.resultsByGameId[firstGame.id]
    const excluded = resolveTournamentGameParticipants(
      partial,
      'national-r16-g2',
    )!.homeProgramId
    const next = simulatePendingGamesInTournamentRound({
      postseason: partial,
      round: 'round-of-16',
      simulationSeed: SIMULATION_SEED,
      excludedProgramIds: [excluded],
    })

    expect(next.resultsByGameId[firstGame.id]).toBe(stored)
    expect(getCompletedGamesForTournamentRound(next, 'round-of-16')).toHaveLength(7)
    expect(getPendingGamesForTournamentRound(next, 'round-of-16')).toHaveLength(1)
    expect(getReadyGamesForTournamentRound(next, 'quarterfinals')).toHaveLength(3)
    expect(getCurrentTournamentRound(next)).toBe('round-of-16')
  })

  it('completes all 15 games, derives rounds and champion, and retains box scores', () => {
    const completed = completeTournament(initialPostseason)
    const champion = deriveNationalChampion(completed)

    expect(Object.keys(completed.resultsByGameId)).toHaveLength(15)
    expect(isTournamentComplete(completed)).toBe(true)
    expect(getCurrentTournamentRound(completed)).toBeUndefined()
    expect(champion).toBeTruthy()
    expect(completed.field.some(({ programId }) => programId === champion)).toBe(true)
    for (const result of Object.values(completed.resultsByGameId)) {
      expect(result.homePlayerStats.reduce((sum, row) => sum + row.points, 0)).toBe(result.homeScore)
      expect(result.awayPlayerStats.reduce((sum, row) => sum + row.points, 0)).toBe(result.awayScore)
    }
    expect(validatePostseasonState(UNIVERSE_V0, completed).valid).toBe(true)
  })

  it('rejects duplicate simulation and validates result orientation', () => {
    const game = initialPostseason.bracket.games[0]!
    const completed = simulateTournamentGame({
      postseason: initialPostseason,
      tournamentGameId: game.id,
      simulationSeed: SIMULATION_SEED,
    })
    expect(() =>
      simulateTournamentGame({
        postseason: completed,
        tournamentGameId: game.id,
        simulationSeed: SIMULATION_SEED,
      }),
    ).toThrow(/already has/)
  })

  it('reports structured field, state, and unresolved-result validation issues', () => {
    const first = initialPostseason.field[0]!
    const second = initialPostseason.field[1]!
    const sourceResult = simulateTournamentGame({
      postseason: initialPostseason,
      tournamentGameId: 'national-r16-g1',
      simulationSeed: SIMULATION_SEED,
    }).resultsByGameId['national-r16-g1']!
    const invalid: PostseasonState = {
      ...initialPostseason,
      field: initialPostseason.field.map((entry) =>
        entry.programId === second.programId
          ? { ...entry, programId: first.programId, seed: first.seed }
          : entry,
      ),
      programStates: {
        ...initialPostseason.programStates,
        [first.programId]: {
          ...initialPostseason.programStates[first.programId]!,
          rotation: { minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} } },
        },
      },
      resultsByGameId: {
        'national-qf-g1': sourceResult,
        unknown: sourceResult,
      },
    }
    const codes = validatePostseasonState(UNIVERSE_V0, invalid).issues.map(
      ({ code }) => code,
    )
    expect(codes).toEqual(
      expect.arrayContaining([
        'DUPLICATE_FIELD_PROGRAM',
        'DUPLICATE_SEED',
        'INVALID_ROTATION',
        'UNRESOLVED_RESULT_PARTICIPANTS',
        'UNKNOWN_RESULT_GAME',
      ]),
    )
  })
})

describe('getTournamentGameForProgram', () => {
  it("resolves every fielded Program's Round-of-16 slot immediately from its seed", () => {
    for (const entry of initialPostseason.field) {
      const game = getTournamentGameForProgram(
        initialPostseason,
        entry.programId,
        'round-of-16',
      )
      expect(game).toBeDefined()
      expect(
        game!.participantSources.some(
          (source) => source.type === 'seed' && source.seed === entry.seed,
        ),
      ).toBe(true)
    }
  })

  it('is undefined for a Program outside the 16-team field', () => {
    const outsider = UNIVERSE_V0.programs.find(
      (program) =>
        !initialPostseason.field.some(
          (entry) => entry.programId === program.id,
        ),
    )!
    expect(
      getTournamentGameForProgram(
        initialPostseason,
        outsider.id,
        'round-of-16',
      ),
    ).toBeUndefined()
  })

  it('traces a winner forward to its next-round slot before that slot is otherwise resolvable', () => {
    const r16Game = getGamesForTournamentRound(initialPostseason, 'round-of-16')[0]!
    const participants = resolveTournamentGameParticipants(
      initialPostseason,
      r16Game.id,
    )!
    const winnerId = participants.awayProgramId
    const current = recordTournamentGameResult(
      initialPostseason,
      r16Game.id,
      manualResult(participants, winnerId),
    )

    // The quarterfinal's other feeder game has not been played, so its
    // participants are not fully resolved — yet the winner's own forward
    // slot is still knowable from the static bracket structure.
    expect(
      resolveTournamentGameParticipants(current, 'national-qf-g1'),
    ).toBeUndefined()
    const qfGame = getTournamentGameForProgram(current, winnerId, 'quarterfinals')
    expect(qfGame?.id).toBe('national-qf-g1')
  })

  it('returns undefined at and beyond the round where a Program was eliminated', () => {
    const r16Game = getGamesForTournamentRound(initialPostseason, 'round-of-16')[0]!
    const participants = resolveTournamentGameParticipants(
      initialPostseason,
      r16Game.id,
    )!
    const loserId = participants.homeProgramId
    const current = recordTournamentGameResult(
      initialPostseason,
      r16Game.id,
      manualResult(participants, participants.awayProgramId),
    )

    expect(
      getTournamentGameForProgram(current, loserId, 'quarterfinals'),
    ).toBeUndefined()
    expect(
      getTournamentGameForProgram(current, loserId, 'semifinals'),
    ).toBeUndefined()
    expect(
      getTournamentGameForProgram(current, loserId, 'championship'),
    ).toBeUndefined()
    // Its own completed Round-of-16 game itself remains a valid lookup.
    expect(
      getTournamentGameForProgram(current, loserId, 'round-of-16')?.id,
    ).toBe(r16Game.id)
  })

  it('follows a champion all the way to the championship slot', () => {
    const completed = completeTournament(initialPostseason)
    const champion = deriveNationalChampion(completed)!
    expect(
      getTournamentGameForProgram(completed, champion, 'championship')?.id,
    ).toBe('national-final')
  })
})

describe('determinism and Rotation state', () => {
  it('is deterministic, seed-sensitive, order-independent, pure, and never uses Math.random', () => {
    const before = JSON.stringify(initialPostseason)
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })
    const first = simulateTournamentGame({
      postseason: initialPostseason,
      tournamentGameId: 'national-r16-g1',
      simulationSeed: 'same',
    })
    const second = simulateTournamentGame({
      postseason: initialPostseason,
      tournamentGameId: 'national-r16-g1',
      simulationSeed: 'same',
    })
    expect(second.resultsByGameId['national-r16-g1']).toEqual(
      first.resultsByGameId['national-r16-g1'],
    )

    const order = (ids: readonly string[]) =>
      ids.reduce(
        (state, id) =>
          simulateTournamentGame({
            postseason: state,
            tournamentGameId: id,
            simulationSeed: SIMULATION_SEED,
          }),
        initialPostseason,
      )
    const forward = order(['national-r16-g1', 'national-r16-g2'])
    const reverse = order(['national-r16-g2', 'national-r16-g1'])
    expect(reverse.resultsByGameId).toEqual(forward.resultsByGameId)

    const outcomes = new Set(
      Array.from({ length: 10 }, (_, index) => {
        const result = simulateTournamentGame({
          postseason: initialPostseason,
          tournamentGameId: 'national-r16-g1',
          simulationSeed: `different-${index}`,
        }).resultsByGameId['national-r16-g1']!
        return `${result.homeScore}-${result.awayScore}`
      }),
    )
    expect(outcomes.size).toBeGreaterThan(1)
    expect(JSON.stringify(initialPostseason)).toBe(before)
    vi.restoreAllMocks()
  })

  it('updates only legal field Rotations and uses the current Rotation in simulation', () => {
    const gameId = 'national-r16-g1'
    const participants = resolveTournamentGameParticipants(initialPostseason, gameId)!
    const programId = participants.homeProgramId
    const rotation = alternativeRotation(initialPostseason, programId)
    const updated = updatePostseasonProgramRotation(initialPostseason, programId, rotation)
    const simulated = simulateTournamentGame({
      postseason: updated,
      tournamentGameId: gameId,
      simulationSeed: SIMULATION_SEED,
    })
    const result = simulated.resultsByGameId[gameId]!
    const home = updated.programStates[participants.homeProgramId]!
    const away = updated.programStates[participants.awayProgramId]!
    expect(result).toEqual(
      simulateGame({
        homeTeam: home.team,
        awayTeam: away.team,
        homeRotation: home.rotation,
        awayRotation: away.rotation,
        seed: result.seed,
        site: 'neutral',
      }),
    )
    expect(updated.programStates[programId]!.rotation).toEqual(rotation)
    expect(updated.programStates[programId]!.team).toBe(
      initialPostseason.programStates[programId]!.team,
    )
    expect(() =>
      updatePostseasonProgramRotation(initialPostseason, 'not-in-field', rotation),
    ).toThrow(/Unknown Postseason Program/)
    expect(() =>
      updatePostseasonProgramRotation(initialPostseason, programId, {
        minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} },
      }),
    ).toThrow(/invalid Rotation/)
  })
})
