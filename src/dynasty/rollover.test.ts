import { beforeAll, describe, expect, it } from 'vitest'
import {
  generateDefaultRotationV1,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  TOTAL_ROTATION_MINUTES,
  calculateTotalMinutesV1,
  validateRotationV1,
} from '../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import {
  getGamesForProgram,
  validateRegularSeasonSchedule,
} from '../schedule'
import {
  deriveProgramRecord,
  isRegularSeasonComplete,
} from '../season'
import { UNIVERSE_V0 } from '../universe'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveBaseRecruitAttraction,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function finishCompetitionAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({
    ...source,
    activeSeason: season,
  })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `rollover-test-postseason-${season.seasonNumber}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

let canonical: DynastyState

beforeAll(() => {
  canonical = finishCompetitionAndBeginOffseason(
    createRecruitingDynasty('dynasty-rollover-v0'),
  )
})

describe('Dynasty Season Rollover V0', () => {
  it('atomically starts a fresh next Season while preserving lifecycle history', () => {
    const before = structuredClone(canonical)
    const next = rolloverDynastyToNextSeason(canonical)

    expect(next.controlledProgramId).toBe(canonical.controlledProgramId)
    expect(next.activeSeason?.seasonNumber).toBe(2)
    expect(next.activePostseason).toBeNull()
    expect(next.offseason).toBeNull()
    expect(next.history).toEqual(canonical.history)
    expect(next.completedRecruitingHistory).toEqual(canonical.completedRecruitingHistory)
    expect(next.recruiting).toMatchObject({ targetSeasonNumber: 3, lastResolvedPeriod: 0 })
    expect(canonical).toEqual(before)
    expect(JSON.parse(JSON.stringify(next))).toEqual(next)
  })

  it('creates 32 fresh Teams with preserved identity/prestige and valid default Rotations', () => {
    const next = rolloverDynastyToNextSeason(canonical)
    const priorArchive = canonical.history[0]!
    const archivedBefore = structuredClone(priorArchive)
    let teamsWithSecondaryMinutes = 0

    expect(Object.keys(next.activeSeason!.programStates)).toHaveLength(32)
    for (const definition of UNIVERSE_V0.programs) {
      const state = next.activeSeason!.programStates[definition.id]!
      const offseason = canonical.offseason!.programs[definition.id]!
      expect(state.team).toMatchObject({
        id: definition.id,
        name: definition.name,
        abbreviation: definition.abbreviation,
        prestige: offseason.prestige,
      })
      expect(state.team.roster).toHaveLength(TEAM_ROSTER_SIZE)
      expect(validateRotationV1(state.team, state.rotation).valid).toBe(true)
      expect(state.rotation).toEqual(generateDefaultRotationV1(state.team))
      expect(calculateTotalMinutesV1(state.rotation)).toBe(TOTAL_ROTATION_MINUTES)
      if (
        POSITIONS.some((position) =>
          Object.entries(state.rotation.minutesByPosition[position]).some(
            ([playerId, minutes]) =>
              minutes > 0 &&
              state.team.roster.find((player) => player.id === playerId)
                ?.position !== position,
          ),
        )
      ) {
        teamsWithSecondaryMinutes += 1
      }
    }
    expect(teamsWithSecondaryMinutes).toBeGreaterThan(0)
    expect(priorArchive).toEqual(archivedBefore)
  })

  it('generates a valid season-specific Schedule with unique cross-season IDs', () => {
    const first = rolloverDynastyToNextSeason(canonical)
    const second = rolloverDynastyToNextSeason(canonical)
    const schedule = first.activeSeason!.schedule
    const priorSchedule = canonical.history[0]!.season.schedule

    expect(schedule).toEqual(second.activeSeason!.schedule)
    expect(validateRegularSeasonSchedule(UNIVERSE_V0, schedule).valid).toBe(true)
    expect(schedule.games).toHaveLength(384)
    expect(schedule.roundCount).toBe(24)
    expect(schedule.games).not.toEqual(priorSchedule.games)
    const priorIds = new Set(priorSchedule.games.map(({ id }) => id))
    expect(schedule.games.some(({ id }) => priorIds.has(id))).toBe(false)
    for (const program of UNIVERSE_V0.programs) {
      const games = getGamesForProgram(schedule, program.id)
      expect(games).toHaveLength(24)
      expect(games.filter(({ type }) => type === 'conference')).toHaveLength(14)
      expect(games.filter(({ type }) => type === 'nonconference')).toHaveLength(10)
      expect(games.filter(({ homeProgramId }) => homeProgramId === program.id)).toHaveLength(12)
      expect(games.filter(({ awayProgramId }) => awayProgramId === program.id)).toHaveLength(12)
    }
  })

  it('starts with zero results, zero records, and no copied prior results', () => {
    const next = rolloverDynastyToNextSeason(canonical)
    const season = next.activeSeason!
    expect(season.resultsByGameId).toEqual({})
    expect(isRegularSeasonComplete(season)).toBe(false)
    expect(Object.keys(canonical.history[0]!.season.resultsByGameId)).toHaveLength(384)
    for (const program of UNIVERSE_V0.programs) {
      expect(deriveProgramRecord(season, program.id)).toEqual({ wins: 0, losses: 0 })
    }
  })

  it('initializes Recruiting N+2 from new roster senior needs without advancing it', () => {
    const first = rolloverDynastyToNextSeason(canonical)
    const second = rolloverDynastyToNextSeason(canonical)
    const recruiting = first.recruiting!
    expect(recruiting).toEqual(second.recruiting)
    expect(recruiting.targetSeasonNumber).toBe(3)
    expect(recruiting.lastResolvedPeriod).toBe(0)
    expect(Object.keys(recruiting.programs)).toHaveLength(32)
    expect(recruiting.programs[first.controlledProgramId]!.board.length).toBeGreaterThan(0)
    expect(recruiting.recruits).not.toEqual(
      canonical.completedRecruitingHistory[0]!.recruitingState.recruits,
    )
    const programId = first.controlledProgramId
    const recruit = recruiting.recruits[0]!
    const baselineAttraction = deriveBaseRecruitAttraction(first, recruit, programId)
    const higherPrestige = {
      ...first,
      activeSeason: {
        ...first.activeSeason!,
        programStates: {
          ...first.activeSeason!.programStates,
          [programId]: {
            ...first.activeSeason!.programStates[programId]!,
            team: {
              ...first.activeSeason!.programStates[programId]!.team,
              prestige: first.activeSeason!.programStates[programId]!.team.prestige + 1,
            },
          },
        },
      },
    }
    expect(deriveBaseRecruitAttraction(higherPrestige, recruit, programId))
      .toBeGreaterThan(baselineAttraction)
    for (const [programId, program] of Object.entries(recruiting.programs)) {
      const seniors = first.activeSeason!.programStates[programId]!.team.roster
        .filter(({ classYear }) => classYear === 'SR')
      for (const position of ['PG', 'SG', 'SF', 'PF', 'C'] as const) {
        expect(program.projectedOpeningsByPosition[position]).toBe(
          seniors.filter((player) => player.position === position).length,
        )
      }
    }
  })

  it('keeps new Recruit identities disjoint from active and historical people', () => {
    const next = rolloverDynastyToNextSeason(canonical)
    const existingIds = new Set([
      ...canonical.history.flatMap(({ season }) =>
        Object.values(season.programStates).flatMap(({ team }) =>
          team.roster.map(({ id }) => id),
        ),
      ),
      ...canonical.completedRecruitingHistory.flatMap(({ recruitingState }) =>
        recruitingState.recruits.map(({ player }) => player.id),
      ),
      ...Object.values(next.activeSeason!.programStates).flatMap(({ team }) =>
        team.roster.map(({ id }) => id),
      ),
    ])
    const newIds = next.recruiting!.recruits.map(({ player }) => player.id)
    expect(new Set(newIds)).toHaveLength(newIds.length)
    expect(newIds.some((id) => existingIds.has(id))).toBe(false)
  })

  it('rejects missing or incompatible transition state without mutating input', () => {
    const source = structuredClone(canonical)
    expect(() => rolloverDynastyToNextSeason({ ...canonical, offseason: null })).toThrow(/OffseasonState/)
    expect(() => rolloverDynastyToNextSeason({
      ...canonical,
      activeSeason: canonical.history[0]!.season,
    })).toThrow(/no active Season/)

    const wrongTargetSource = structuredClone(canonical)
    const wrongTarget = {
      ...wrongTargetSource,
      offseason: {
        ...wrongTargetSource.offseason!,
        targetSeasonNumber: wrongTargetSource.offseason!.targetSeasonNumber + 1,
      },
    }
    expect(() => rolloverDynastyToNextSeason(wrongTarget)).toThrow(/matching finalized Recruiting class/)

    const unfinalizedSource = structuredClone(canonical)
    const unfinalized = {
      ...unfinalizedSource,
      recruiting: { ...unfinalizedSource.recruiting!, phase: 'late' as const },
    }
    expect(() => rolloverDynastyToNextSeason(unfinalized)).toThrow(/do not match finalized/)
    expect(canonical).toEqual(source)
  })

  it('rejects malformed roster and Program membership upstream of transition', () => {
    const malformedSource = structuredClone(canonical)
    const program = malformedSource.offseason!.programs['charlotte-tech']!
    const malformedRoster = {
      ...malformedSource,
      offseason: {
        ...malformedSource.offseason!,
        programs: {
          ...malformedSource.offseason!.programs,
          'charlotte-tech': {
            ...program,
            returningPlayers: program.returningPlayers.slice(1),
          },
        },
      },
    }
    expect(() => rolloverDynastyToNextSeason(malformedRoster)).toThrow(/11 Players/)

    const missingProgram = structuredClone(canonical)
    delete missingProgram.offseason!.programs['charlotte-tech']
    expect(() => rolloverDynastyToNextSeason(missingProgram)).toThrow(/membership/)
  })

  it('is Program-order independent for generated competition and Recruiting facts', () => {
    const reversed = {
      ...canonical,
      universe: {
        ...canonical.universe,
        programs: [...canonical.universe.programs].reverse(),
      },
    }
    const normalNext = rolloverDynastyToNextSeason(canonical)
    const reversedNext = rolloverDynastyToNextSeason(reversed)
    expect(reversedNext.activeSeason).toEqual(normalNext.activeSeason)
    expect(reversedNext.recruiting).toEqual(normalNext.recruiting)
  })

  it('repeats the complete lifecycle for several consecutive Seasons', () => {
    let dynasty = rolloverDynastyToNextSeason(canonical)
    for (let seasonNumber = 2; seasonNumber <= 3; seasonNumber += 1) {
      dynasty = finishCompetitionAndBeginOffseason(dynasty)
      expect(dynasty.history.at(-1)!.seasonNumber).toBe(seasonNumber)
      expect(dynasty.completedRecruitingHistory.at(-1)!.targetSeasonNumber).toBe(
        seasonNumber + 1,
      )
      dynasty = rolloverDynastyToNextSeason(dynasty)
      expect(dynasty.activeSeason!.seasonNumber).toBe(seasonNumber + 1)
    }
    expect(dynasty.history.map(({ seasonNumber }) => seasonNumber)).toEqual([1, 2, 3])
    expect(dynasty.completedRecruitingHistory.map(({ targetSeasonNumber }) => targetSeasonNumber)).toEqual([2, 3, 4])
    expect(JSON.parse(JSON.stringify(dynasty))).toEqual(dynasty)
  })
})
