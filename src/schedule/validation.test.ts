import { describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../universe'
import {
  generateRegularSeasonSchedule,
  validateRegularSeasonSchedule,
  type RegularSeasonSchedule,
  type ScheduledGame,
} from './index'

function mutableSchedule(): RegularSeasonSchedule {
  return JSON.parse(
    JSON.stringify(
      generateRegularSeasonSchedule({
        universe: UNIVERSE_V0,
        seed: 'schedule-validation',
      }),
    ),
  ) as RegularSeasonSchedule
}

function replaceGame(
  schedule: RegularSeasonSchedule,
  index: number,
  changes: Partial<ScheduledGame>,
): void {
  schedule.games[index] = {
    ...(schedule.games[index] as ScheduledGame),
    ...changes,
  }
}

describe('regular-season schedule validation', () => {
  it('accepts the generated Universe V0 schedule with serializable output', () => {
    const schedule = mutableSchedule()
    const result = validateRegularSeasonSchedule(UNIVERSE_V0, schedule)

    expect(result).toEqual({ valid: true, issues: [] })
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })

  it('reports malformed IDs, indexes, rounds, and Universe identity', () => {
    const schedule = mutableSchedule()
    const firstGame = schedule.games[0] as ScheduledGame
    const secondGame = schedule.games[1] as ScheduledGame

    replaceGame(schedule, 0, { id: secondGame.id, index: 99, round: 25 })
    const malformed: RegularSeasonSchedule = {
      ...schedule,
      universeId: 'another-universe',
    }
    const validation = validateRegularSeasonSchedule(
      UNIVERSE_V0,
      malformed,
    )
    const codes = new Set(validation.issues.map(({ code }) => code))

    expect(firstGame.id).not.toBe(secondGame.id)
    expect(codes.has('SCHEDULE_UNIVERSE_MISMATCH')).toBe(true)
    expect(codes.has('DUPLICATE_GAME_ID')).toBe(true)
    expect(codes.has('INVALID_GAME_INDEX')).toBe(true)
    expect(codes.has('INVALID_ROUND')).toBe(true)
  })

  it('reports unknown Programs, self-games, and invalid classification', () => {
    const schedule = mutableSchedule()
    const conferenceGameIndex = schedule.games.findIndex(
      ({ type }) => type === 'conference',
    )
    const nonConferenceGameIndex = schedule.games.findIndex(
      ({ type }) => type === 'nonconference',
    )
    const anotherNonConferenceGameIndex = schedule.games.findIndex(
      ({ type }, index) =>
        type === 'nonconference' && index !== nonConferenceGameIndex,
    )
    const conferenceGame = schedule.games[
      conferenceGameIndex
    ] as ScheduledGame

    replaceGame(schedule, conferenceGameIndex, {
      awayProgramId: conferenceGame.homeProgramId,
    })
    replaceGame(schedule, nonConferenceGameIndex, {
      homeProgramId: 'unknown-program',
    })
    replaceGame(schedule, anotherNonConferenceGameIndex, {
      type: 'conference',
    })
    const codes = new Set(
      validateRegularSeasonSchedule(UNIVERSE_V0, schedule).issues.map(
        ({ code }) => code,
      ),
    )

    expect(codes.has('SELF_MATCHUP')).toBe(true)
    expect(codes.has('UNKNOWN_PROGRAM')).toBe(true)
    expect(codes.has('INVALID_GAME_CLASSIFICATION')).toBe(true)
  })

  it('reports invalid runtime game types and round counts', () => {
    const schedule = mutableSchedule()
    replaceGame(schedule, 0, {
      type: 'exhibition' as ScheduledGame['type'],
    })
    const malformed: RegularSeasonSchedule = {
      ...schedule,
      roundCount: 23,
    }
    const codes = new Set(
      validateRegularSeasonSchedule(UNIVERSE_V0, malformed).issues.map(
        ({ code }) => code,
      ),
    )

    expect(codes.has('INVALID_GAME_TYPE')).toBe(true)
    expect(codes.has('INVALID_ROUND_COUNT')).toBe(true)
  })

  it('reports duplicate non-conference opponents and broken reciprocal conference hosting', () => {
    const schedule = mutableSchedule()
    const nonConferenceGames = schedule.games.filter(
      ({ type }) => type === 'nonconference',
    )
    const firstNonConferenceGame = nonConferenceGames[0] as ScheduledGame
    const secondNonConferenceGame = nonConferenceGames[1] as ScheduledGame
    const secondNonConferenceIndex = schedule.games.findIndex(
      ({ id }) => id === secondNonConferenceGame.id,
    )
    const conferenceGames = schedule.games.filter(
      ({ type }) => type === 'conference',
    )
    const firstConferenceGame = conferenceGames[0] as ScheduledGame
    const reciprocalConferenceGame = conferenceGames.find(
      ({ homeProgramId, awayProgramId }) =>
        homeProgramId === firstConferenceGame.awayProgramId &&
        awayProgramId === firstConferenceGame.homeProgramId,
    ) as ScheduledGame
    const reciprocalIndex = schedule.games.findIndex(
      ({ id }) => id === reciprocalConferenceGame.id,
    )

    replaceGame(schedule, secondNonConferenceIndex, {
      homeProgramId: firstNonConferenceGame.homeProgramId,
      awayProgramId: firstNonConferenceGame.awayProgramId,
    })
    replaceGame(schedule, reciprocalIndex, {
      homeProgramId: firstConferenceGame.homeProgramId,
      awayProgramId: firstConferenceGame.awayProgramId,
    })
    const codes = new Set(
      validateRegularSeasonSchedule(UNIVERSE_V0, schedule).issues.map(
        ({ code }) => code,
      ),
    )

    expect(codes.has('DUPLICATE_NONCONFERENCE_MATCHUP')).toBe(true)
    expect(codes.has('INVALID_CONFERENCE_PAIRING')).toBe(true)
  })

  it('reports schedule-wide and per-Program count failures', () => {
    const schedule = mutableSchedule()
    const conferenceGameIndex = schedule.games.findIndex(
      ({ type }) => type === 'conference',
    )
    schedule.games.splice(conferenceGameIndex, 1)
    const validation = validateRegularSeasonSchedule(UNIVERSE_V0, schedule)
    const codes = new Set(validation.issues.map(({ code }) => code))

    expect(codes.has('INVALID_GAME_COUNT')).toBe(true)
    expect(codes.has('INVALID_PROGRAM_GAME_COUNT')).toBe(true)
    expect(codes.has('INVALID_PROGRAM_CONFERENCE_COUNT')).toBe(true)
    expect(
      codes.has('INVALID_PROGRAM_HOME_COUNT') ||
        codes.has('INVALID_PROGRAM_AWAY_COUNT'),
    ).toBe(true)
    expect(codes.has('INVALID_ROUND_PARTICIPATION')).toBe(true)
  })
})
