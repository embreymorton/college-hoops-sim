import { beforeAll, describe, expect, it } from 'vitest'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { deriveProgramRecord } from '../season'
import { calculateOverall, calculateTeamStrength } from '../engine'
import { deriveConferenceStandings } from '../season'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  deriveProgramLegacy,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function completeSeasonAndBeginOffseason(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `program-legacy:${season.seasonNumber}:${round}`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  dynasty = autoFinalizeRecruiting(dynasty).dynasty
  return beginOffseason(dynasty)
}

function completedDynasty(): DynastyState {
  return completeSeasonAndBeginOffseason(
    createRecruitingDynasty('program-legacy-foundation'),
  )
}

let canonical: DynastyState

beforeAll(() => {
  canonical = completedDynasty()
})

describe('deriveProgramLegacy', () => {
  it('returns an intentional zero-history résumé for every valid Program', () => {
    const programId = canonical.universe.programs[0]!.id
    expect(deriveProgramLegacy({ ...canonical, history: [] }, programId)).toEqual({
      programId,
      completedSeasons: 0,
      wins: 0,
      losses: 0,
      tournamentAppearances: 0,
      championships: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: null,
      bestRegularSeason: null,
      trajectorySeasons: [],
    })
  })

  it('derives one completed Season for controlled and non-controlled Programs independently', () => {
    const controlled = deriveProgramLegacy(canonical, canonical.controlledProgramId!)
    const otherId = canonical.universe.programs.find(
      ({ id }) => id !== canonical.controlledProgramId!,
    )!.id
    const other = deriveProgramLegacy(canonical, otherId)

    expect(controlled.completedSeasons).toBe(1)
    expect(controlled.trajectorySeasons[0]!.record).toEqual(
      deriveProgramRecord(canonical.history[0]!.season, canonical.controlledProgramId!),
    )
    expect(other.completedSeasons).toBe(1)
    expect(other.programId).toBe(otherId)
    expect(other.trajectorySeasons[0]!.record).toEqual(
      deriveProgramRecord(canonical.history[0]!.season, otherId),
    )
  })

  it('counts appearances, titles, runner-up finishes, and missed Tournaments from canonical outcomes', () => {
    const archive = canonical.history[0]!
    const championId = deriveNationalChampion(archive.postseason)!
    const championship = archive.postseason.bracket.games.find(
      ({ round }) => round === 'championship',
    )!
    const result = archive.postseason.resultsByGameId[championship.id]!
    const runnerUpId = result.homeTeamId === championId ? result.awayTeamId : result.homeTeamId
    const missedId = canonical.universe.programs.find(
      ({ id }) => !archive.postseason.field.some(({ programId }) => programId === id),
    )!.id

    expect(deriveProgramLegacy(canonical, championId)).toMatchObject({
      tournamentAppearances: 1,
      championships: 1,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'national-champion' },
    })
    expect(deriveProgramLegacy(canonical, runnerUpId)).toMatchObject({
      tournamentAppearances: 1,
      championships: 0,
      runnerUpFinishes: 1,
      bestTournamentOutcome: { status: 'runner-up' },
    })
    expect(deriveProgramLegacy(canonical, missedId)).toMatchObject({
      tournamentAppearances: 0,
      championships: 0,
      runnerUpFinishes: 0,
      bestTournamentOutcome: { status: 'did-not-qualify' },
    })
  })

  it('aggregates records and returns every Season newest-first', () => {
    const source = canonical.history[0]!
    const history = Array.from({ length: 7 }, (_, index) => ({
      ...structuredClone(source),
      seasonNumber: index + 1,
      season: { ...structuredClone(source.season), seasonNumber: index + 1 },
    })).reverse()
    const record = deriveProgramRecord(source.season, canonical.controlledProgramId!)
    const legacy = deriveProgramLegacy({ ...canonical, history }, canonical.controlledProgramId!)

    expect(legacy.completedSeasons).toBe(7)
    expect(legacy.wins).toBe(record.wins * 7)
    expect(legacy.losses).toBe(record.losses * 7)
    expect(legacy.trajectorySeasons.map(({ seasonNumber }) => seasonNumber)).toEqual([7, 6, 5, 4, 3, 2, 1])
    expect(legacy.bestRegularSeason?.seasonNumber).toBe(7)
  })

  it('remains derived and stable after multiple real Dynasty rollovers', () => {
    let dynasty = createRecruitingDynasty('program-legacy-rollovers')
    for (let count = 0; count < 2; count += 1) {
      dynasty = rolloverDynastyToNextSeason(completeSeasonAndBeginOffseason(dynasty))
    }

    const legacy = deriveProgramLegacy(dynasty, dynasty.controlledProgramId!)
    expect(legacy.completedSeasons).toBe(2)
    expect(legacy.trajectorySeasons.map(({ seasonNumber }) => seasonNumber)).toEqual([2, 1])
    expect(legacy.wins + legacy.losses).toBe(48)
    expect(legacy.trajectorySeasons[1]!.incomingClass).toBeNull()
    const incoming = legacy.trajectorySeasons[0]!.incomingClass
    expect(incoming).not.toBeNull()
    const completedClass = dynasty.completedRecruitingHistory.find(
      ({ targetSeasonNumber }) => targetSeasonNumber === 2,
    )!
    const signedRecruits = Object.values(completedClass.recruitingState.commitmentsByPlayerId)
      .filter(({ programId }) => programId === dynasty.controlledProgramId!)
      .map(({ playerId }) => completedClass.recruitingState.recruits.find(
        ({ player }) => player.id === playerId,
      )!)
    expect(incoming).toEqual({
      signeeCount: signedRecruits.length,
      averageOverall: signedRecruits.reduce(
        (total, recruit) => total + calculateOverall(recruit.player),
        0,
      ) / signedRecruits.length,
    })
  }, 30000)

  it('uses canonical archived Team Strength, Conference standings, and Tournament seed', () => {
    const programId = canonical.controlledProgramId!
    const archive = canonical.history[0]!
    const trajectory = deriveProgramLegacy(canonical, programId).trajectorySeasons[0]!
    const programState = archive.season.programStates[programId]!
    const conferenceId = canonical.universe.programs.find(({ id }) => id === programId)!.conferenceId

    expect(trajectory.teamOverall).toBe(
      calculateTeamStrength(programState.team, programState.rotation).overall,
    )
    expect(trajectory.conferencePlace).toBe(
      deriveConferenceStandings(canonical.universe, archive.season, conferenceId)
        .findIndex(({ programId: candidateId }) => candidateId === programId) + 1,
    )
    if (trajectory.tournamentOutcome.status !== 'did-not-qualify') {
      expect(trajectory.tournamentOutcome.seed).toBe(
        archive.postseason.field.find(({ programId: candidateId }) => candidateId === programId)!.seed,
      )
    }
  })

  it('distinguishes unavailable incoming history from a finalized zero-signee class', () => {
    const programId = canonical.controlledProgramId!
    const targetSeasonNumber = canonical.history[0]!.seasonNumber
    const sourceClass = canonical.completedRecruitingHistory[0]!
    const completedClass = {
      ...structuredClone(sourceClass),
      targetSeasonNumber,
      recruitingState: {
        ...structuredClone(sourceClass.recruitingState),
        targetSeasonNumber,
        commitmentsByPlayerId: Object.fromEntries(
          Object.entries(sourceClass.recruitingState.commitmentsByPlayerId)
        .filter(([, commitment]) => commitment.programId !== programId),
        ),
      },
    }

    expect(deriveProgramLegacy(canonical, programId).trajectorySeasons[0]!.incomingClass).toBeNull()
    expect(deriveProgramLegacy({
      ...canonical,
      completedRecruitingHistory: [completedClass],
    }, programId).trajectorySeasons[0]!.incomingClass).toEqual({
      signeeCount: 0,
      averageOverall: null,
    })
  })

  it('fails when finalized Recruiting history ambiguously targets one Season', () => {
    const completedClass = canonical.completedRecruitingHistory[0]!
    expect(() => deriveProgramLegacy({
      ...canonical,
      completedRecruitingHistory: [completedClass, structuredClone(completedClass)],
    }, canonical.controlledProgramId!)).toThrow(/Multiple finalized Recruiting classes/)
  })
})
