import { beforeAll, describe, expect, it } from 'vitest'
import { POSITIONS, TEAM_ROSTER_SIZE, calculateOverall } from '../engine'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { UNIVERSE_V0 } from '../universe'
import {
  assembleNextSeasonRosters,
  autoFinalizeRecruiting,
  beginOffseason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  validateNextSeasonRosterAssembly,
  type AssembleNextSeasonRostersOptions,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

let canonical: AssembleNextSeasonRostersOptions

function createCanonicalSources(): AssembleNextSeasonRostersOptions {
  let dynasty = createRecruitingDynasty('roster-assembly-v0')
  const completedSeason = completeRounds(dynasty.activeSeason!)
  dynasty = syncRecruitingThroughCompletedRounds({
    ...dynasty,
    activeSeason: completedSeason,
  })
  let postseason = initializePostseason({
    universe: UNIVERSE_V0,
    season: completedSeason,
  })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'roster-assembly-postseason-v0',
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  dynasty = beginOffseason(dynasty)
  return {
    universe: dynasty.universe,
    offseason: dynasty.offseason!,
    completedRecruitingClass: dynasty.completedRecruitingHistory[0]!,
    completedSeasonArchive: dynasty.history[0]!,
  }
}

function cloneSources(): AssembleNextSeasonRostersOptions {
  return structuredClone(canonical)
}

function allPlayers(options: AssembleNextSeasonRostersOptions) {
  return Object.values(assembleNextSeasonRosters(options).programs)
    .flatMap(({ players }) => players)
}

beforeAll(() => {
  canonical = createCanonicalSources()
})

describe('Next-Season Roster Assembly V0', () => {
  it('assembles all 32 Programs with 12 unique Players and valid positional composition', () => {
    const assembly = assembleNextSeasonRosters(canonical)
    const players = Object.values(assembly.programs).flatMap(({ players }) => players)

    expect(Object.keys(assembly.programs)).toHaveLength(UNIVERSE_V0.programs.length)
    expect(players).toHaveLength(UNIVERSE_V0.programs.length * TEAM_ROSTER_SIZE)
    expect(new Set(players.map(({ id }) => id))).toHaveLength(players.length)
    expect(validateNextSeasonRosterAssembly(canonical)).toEqual({ valid: true, issues: [] })
    for (const program of Object.values(assembly.programs)) {
      expect(program.players).toHaveLength(TEAM_ROSTER_SIZE)
      expect(new Set(program.players.map(({ id }) => id))).toHaveLength(TEAM_ROSTER_SIZE)
      expect(POSITIONS.every((position) =>
        program.players.some((player) => player.position === position),
      )).toBe(true)
    }
  })

  it('preserves every returner at the same Program and excludes archived graduates', () => {
    const assembly = assembleNextSeasonRosters(canonical)
    for (const program of UNIVERSE_V0.programs) {
      const roster = assembly.programs[program.id]!.players
      const returners = canonical.offseason.programs[program.id]!.returningPlayers
      const archived = canonical.completedSeasonArchive.postseason.programStates[program.id]?.team.roster
        ?? canonical.completedSeasonArchive.season.programStates[program.id]!.team.roster
      for (const returner of returners) {
        const enrolled = roster.find(({ id }) => id === returner.id)
        expect(enrolled).toEqual(returner)
        expect(enrolled).not.toBe(returner)
      }
      for (const graduate of archived.filter(({ classYear }) => classYear === 'SR')) {
        expect(roster.some(({ id }) => id === graduate.id)).toBe(false)
      }
    }
  })

  it('enrolls every commitment once as an unchanged FR Player and excludes unsigned Recruits', () => {
    const assembly = assembleNextSeasonRosters(canonical)
    const recruiting = canonical.completedRecruitingClass.recruitingState
    const players = Object.values(assembly.programs).flatMap(({ players }) => players)
    const commitments = Object.values(recruiting.commitmentsByPlayerId)

    expect(players.filter(({ classYear }) => classYear === 'FR')).toHaveLength(commitments.length)
    for (const recruit of recruiting.recruits) {
      const commitment = recruiting.commitmentsByPlayerId[recruit.player.id]
      const appearances = Object.entries(assembly.programs).flatMap(([programId, program]) =>
        program.players.filter(({ id }) => id === recruit.player.id).map((player) => ({ programId, player })),
      )
      if (!commitment) {
        expect(appearances).toHaveLength(0)
        continue
      }
      expect(appearances).toHaveLength(1)
      expect(appearances[0]!.programId).toBe(commitment.programId)
      expect(appearances[0]!.player).toEqual({ ...recruit.player, classYear: 'FR' })
      expect(appearances[0]!.player).not.toBe(recruit.player)
      expect(calculateOverall(appearances[0]!.player)).toBe(calculateOverall(recruit.player))
    }
  })

  it('does not mutate Offseason, Recruiting, or completed Season history', () => {
    const source = cloneSources()
    const before = structuredClone(source)
    assembleNextSeasonRosters(source)
    expect(source).toEqual(before)
  })

  it('preserves archived and developed returning snapshots independently', () => {
    const assembly = assembleNextSeasonRosters(canonical)
    const programId = 'charlotte-tech'
    const returner = canonical.offseason.programs[programId]!.returningPlayers[0]!
    const archived = canonical.completedSeasonArchive.season.programStates[programId]!.team.roster
      .find(({ id }) => id === returner.id)!
    const enrolled = assembly.programs[programId]!.players.find(({ id }) => id === returner.id)!

    expect(archived.id).toBe(returner.id)
    expect(enrolled).toEqual(returner)
    expect(archived).not.toBe(returner)
    expect(enrolled).not.toBe(returner)
  })

  it('rejects 11- and 13-Player rosters instead of repairing them', () => {
    const tooSmall = cloneSources()
    const programId = UNIVERSE_V0.programs[0]!.id
    const program = tooSmall.offseason.programs[programId]!
    tooSmall.offseason.programs[programId] = {
      ...program,
      returningPlayers: program.returningPlayers.slice(1),
    }
    expect(() => assembleNextSeasonRosters(tooSmall)).toThrow(/11 Players/)

    const tooLarge = cloneSources()
    const unsigned = tooLarge.completedRecruitingClass.recruitingState.recruits.find(
      ({ player }) => !tooLarge.completedRecruitingClass.recruitingState.commitmentsByPlayerId[player.id],
    )!
    tooLarge.completedRecruitingClass.recruitingState.commitmentsByPlayerId[unsigned.player.id] = {
      playerId: unsigned.player.id,
      programId,
      targetSeasonNumber: tooLarge.offseason.targetSeasonNumber,
      timing: { kind: 'late' },
    }
    expect(() => assembleNextSeasonRosters(tooLarge)).toThrow(/13 Players/)
  })

  it('rejects target-season incompatibility and non-final Recruiting state', () => {
    const source = cloneSources()
    const wrongSeason = {
      ...source,
      completedRecruitingClass: {
        ...source.completedRecruitingClass,
        targetSeasonNumber: source.completedRecruitingClass.targetSeasonNumber + 1,
      },
    }
    expect(() => assembleNextSeasonRosters(wrongSeason)).toThrow(/different lifecycle years/)

    const notFinalSource = cloneSources()
    const notFinal = {
      ...notFinalSource,
      completedRecruitingClass: {
        ...notFinalSource.completedRecruitingClass,
        recruitingState: {
          ...notFinalSource.completedRecruitingClass.recruitingState,
          phase: 'late' as const,
        },
      },
    }
    expect(() => assembleNextSeasonRosters(notFinal)).toThrow(/finalized Recruiting class/)
  })

  it('rejects missing, unknown, duplicate, and mismatched Program records', () => {
    const missing = cloneSources()
    delete missing.offseason.programs['charlotte-tech']
    expect(() => assembleNextSeasonRosters(missing)).toThrow(/membership/)

    const unknown = cloneSources()
    unknown.offseason.programs.unknown = {
      ...unknown.offseason.programs['charlotte-tech']!,
      programId: 'unknown',
    }
    expect(() => assembleNextSeasonRosters(unknown)).toThrow(/membership/)

    const duplicate = cloneSources()
    duplicate.offseason.programs['charlotte-tech'] = {
      ...duplicate.offseason.programs['charlotte-tech']!,
      programId: UNIVERSE_V0.programs[1]!.id,
    }
    expect(validateNextSeasonRosterAssembly(duplicate).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_PROGRAM' })]),
    )
  })

  it('routes commitments only to their authoritative destination and rejects malformed reassignment', () => {
    const malformed = cloneSources()
    const recruiting = malformed.completedRecruitingClass.recruitingState
    const commitment = Object.values(recruiting.commitmentsByPlayerId)[0]!
    const wrongProgramId = UNIVERSE_V0.programs.find(({ id }) => id !== commitment.programId)!.id
    recruiting.commitmentsByPlayerId[commitment.playerId] = {
      ...commitment,
      programId: wrongProgramId,
    }
    expect(() => assembleNextSeasonRosters(malformed)).toThrow(/Players instead of 12/)
  })

  it('rejects duplicate active identity and unrelated archived/Recruit collisions', () => {
    const duplicateSource = cloneSources()
    const firstId = UNIVERSE_V0.programs[0]!.id
    const secondId = UNIVERSE_V0.programs[1]!.id
    const firstProgram = duplicateSource.offseason.programs[firstId]!
    const secondProgram = duplicateSource.offseason.programs[secondId]!
    const duplicate = {
      ...duplicateSource,
      offseason: {
        ...duplicateSource.offseason,
        programs: {
          ...duplicateSource.offseason.programs,
          [secondId]: {
            ...secondProgram,
            returningPlayers: [
      firstProgram.returningPlayers[0]!,
      ...secondProgram.returningPlayers.slice(1),
            ],
          },
        },
      },
    }
    expect(validateNextSeasonRosterAssembly(duplicate).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DUPLICATE_PLAYER_ID' })]),
    )

    const collision = cloneSources()
    const archivedId = collision.completedSeasonArchive.season
      .programStates['charlotte-tech']!.team.roster[0]!.id
    collision.completedRecruitingClass.recruitingState.recruits[0]!.player.id = archivedId
    expect(validateNextSeasonRosterAssembly(collision).issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'INVALID_IDENTITY_CONTINUITY' })]),
    )
  })

  it('canonicalizes Program, Recruit, and returner order without changing output', () => {
    const expected = assembleNextSeasonRosters(canonical)
    const source = cloneSources()
    const reversed = {
      ...source,
      universe: { ...source.universe, programs: [...source.universe.programs].reverse() },
      offseason: {
        ...source.offseason,
        programs: Object.fromEntries(Object.entries(source.offseason.programs).reverse().map(
          ([programId, program]) => [
            programId,
            { ...program, returningPlayers: [...program.returningPlayers].reverse() },
          ],
        )),
      },
      completedRecruitingClass: {
        ...source.completedRecruitingClass,
        recruitingState: {
          ...source.completedRecruitingClass.recruitingState,
          programs: Object.fromEntries(
            Object.entries(source.completedRecruitingClass.recruitingState.programs).reverse(),
          ),
          recruits: [...source.completedRecruitingClass.recruitingState.recruits].reverse(),
        },
      },
    }
    expect(assembleNextSeasonRosters(reversed)).toEqual(expected)
  })

  it('returns plain JSON-serializable data deterministically', () => {
    const first = assembleNextSeasonRosters(canonical)
    const second = assembleNextSeasonRosters(canonical)
    expect(second).toEqual(first)
    expect(JSON.parse(JSON.stringify(first))).toEqual(first)
    expect(allPlayers(canonical)).toHaveLength(384)
  })
})
