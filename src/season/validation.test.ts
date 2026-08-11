import { describe, expect, it } from 'vitest'
import { simulateGame, type GameResult } from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  initializeSeason,
  recordGameResult,
  validateSeasonState,
  type SeasonProgramState,
  type SeasonState,
} from './index'

function validSeason(): SeasonState {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'season-validation-universe',
  )
  const schedule = generateRegularSeasonSchedule({
    universe: UNIVERSE_V0,
    seed: 'season-validation-schedule',
  })

  return initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule,
    seasonNumber: 1,
  })
}

function cloneSeason(season: SeasonState): SeasonState {
  return JSON.parse(JSON.stringify(season)) as SeasonState
}

function resultForFirstGame(season: SeasonState): GameResult {
  const game = season.schedule.games[0]!
  const home = season.programStates[game.homeProgramId]!
  const away = season.programStates[game.awayProgramId]!

  return simulateGame({
    homeTeam: home.team,
    awayTeam: away.team,
    homeRotation: home.rotation,
    awayRotation: away.rotation,
    seed: 'season-validation-result',
  })
}

describe('Season State validation', () => {
  it('accepts valid initialized and result-bearing Season State', () => {
    const season = validSeason()
    const game = season.schedule.games[0]!
    const withResult = recordGameResult(
      season,
      game.id,
      resultForFirstGame(season),
    )

    const validation = validateSeasonState(UNIVERSE_V0, withResult)

    expect(validateSeasonState(UNIVERSE_V0, season)).toEqual({
      valid: true,
      issues: [],
    })
    expect(validation).toEqual({
      valid: true,
      issues: [],
    })
    expect(JSON.parse(JSON.stringify(validation))).toEqual(validation)
    expect(JSON.parse(JSON.stringify(withResult))).toEqual(withResult)
  })

  it('reports invalid identity, Season number, and Schedule', () => {
    const season = cloneSeason(validSeason())
    const malformed: SeasonState = {
      ...season,
      id: '',
      seasonNumber: 0,
      universeId: 'wrong-universe',
      schedule: {
        ...season.schedule,
        games: season.schedule.games.slice(1),
      },
    }
    const codes = new Set(
      validateSeasonState(UNIVERSE_V0, malformed).issues.map(
        ({ code }) => code,
      ),
    )

    expect(codes.has('INVALID_SEASON_ID')).toBe(true)
    expect(codes.has('INVALID_SEASON_NUMBER')).toBe(true)
    expect(codes.has('SEASON_UNIVERSE_MISMATCH')).toBe(true)
    expect(codes.has('INVALID_SCHEDULE')).toBe(true)
  })

  it('reports missing, unknown, and mismatched Program state', () => {
    const season = cloneSeason(validSeason())
    const missingProgramId = UNIVERSE_V0.programs[0]!.id
    const sourceProgramId = UNIVERSE_V0.programs[1]!.id
    const sourceState = season.programStates[sourceProgramId]!
    delete season.programStates[missingProgramId]
    season.programStates['unknown-program'] = sourceState
    season.programStates[sourceProgramId] = {
      ...sourceState,
      team: { ...sourceState.team, id: 'wrong-team-id' },
    }
    const codes = new Set(
      validateSeasonState(UNIVERSE_V0, season).issues.map(({ code }) => code),
    )

    expect(codes.has('MISSING_PROGRAM_STATE')).toBe(true)
    expect(codes.has('UNKNOWN_PROGRAM_STATE')).toBe(true)
    expect(codes.has('TEAM_ID_MISMATCH')).toBe(true)
  })

  it('reports invalid stored Rotations', () => {
    const season = cloneSeason(validSeason())
    const programId = UNIVERSE_V0.programs[0]!.id
    const state = season.programStates[programId] as SeasonProgramState
    season.programStates[programId] = {
      ...state,
      rotation: { minutesByPosition: { PG: {}, SG: {}, SF: {}, PF: {}, C: {} } },
    }
    const validation = validateSeasonState(UNIVERSE_V0, season)

    expect(validation.issues).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_ROTATION',
        programId,
      }),
    )
  })

  it('reports unknown results, participant mismatches, and invalid winners', () => {
    const valid = validSeason()
    const season = cloneSeason(valid)
    const game = season.schedule.games[0]!
    const result = resultForFirstGame(valid)
    season.resultsByGameId['unknown-game'] = result
    season.resultsByGameId[game.id] = {
      ...result,
      homeTeamId: 'wrong-home-team',
      winnerId:
        result.winnerId === result.homeTeamId
          ? result.awayTeamId
          : result.homeTeamId,
    }
    const codes = new Set(
      validateSeasonState(UNIVERSE_V0, season).issues.map(({ code }) => code),
    )

    expect(codes.has('UNKNOWN_RESULT_GAME')).toBe(true)
    expect(codes.has('RESULT_PARTICIPANT_MISMATCH')).toBe(true)
    expect(codes.has('INVALID_GAME_RESULT')).toBe(true)
  })
})
