import { beforeAll, describe, expect, it } from 'vitest'
import { calculateOverall, TEAM_ROSTER_SIZE } from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../season'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  type PostseasonState,
  type TournamentRound,
} from '../postseason'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import {
  beginOffseason,
  deriveOffseasonRosterOutlook,
  initializeDynastyState,
  type DynastyState,
} from './index'

let initialSeason: SeasonState
let completeSeason: SeasonState
let initialPostseason: PostseasonState
let completePostseason: PostseasonState

function completeRegularSeason(season: SeasonState): SeasonState {
  let current = season
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({
      season: current,
      round,
      simulationSeed: 'dynasty-transition-regular-season',
    })
  }
  return current
}

function completeTournament(postseason: PostseasonState): PostseasonState {
  return (['round-of-16', 'quarterfinals', 'semifinals', 'championship'] as TournamentRound[])
    .reduce(
      (current, round) => simulatePendingGamesInTournamentRound({
        postseason: current,
        round,
        simulationSeed: 'dynasty-transition-postseason',
      }),
      postseason,
    )
}

function dynasty(
  season = completeSeason,
  postseason: PostseasonState | null = completePostseason,
): DynastyState {
  return initializeDynastyState({
    dynastyId: 'dynasty-test',
    dynastySeed: 'dynasty-test-seed',
    controlledProgramId: UNIVERSE_V0.programs[0]!.id,
    universe: UNIVERSE_V0,
    activeSeason: season,
    activePostseason: postseason,
  })
}

beforeAll(() => {
  const initializedUniverse = initializeUniverse(
    UNIVERSE_V0,
    'dynasty-transition-universe',
  )
  initialSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: 'dynasty-transition-schedule',
    }),
    seasonNumber: 1,
  })
  completeSeason = completeRegularSeason(initialSeason)
  initialPostseason = initializePostseason({
    universe: UNIVERSE_V0,
    season: completeSeason,
  })
  completePostseason = completeTournament(initialPostseason)
})

describe('Dynasty offseason transition', () => {
  it('requires the regular season, Tournament, and National Champion', () => {
    expect(() => beginOffseason(dynasty(initialSeason, null))).toThrow(/regular season/)
    expect(() => beginOffseason(dynasty(completeSeason, initialPostseason))).toThrow(/Tournament/)
    const noChampionshipGame = {
      ...completePostseason,
      bracket: {
        ...completePostseason.bracket,
        games: completePostseason.bracket.games.filter(({ round }) => round !== 'championship'),
      },
    }
    expect(() => beginOffseason(dynasty(completeSeason, noChampionshipGame))).toThrow(/National Champion/)
  })

  it('archives canonical facts once, clears active competition, and remains serializable', () => {
    const source = dynasty()
    const sourceSnapshot = JSON.stringify(source)
    const next = beginOffseason(source)
    const archive = next.history[0]!

    expect(next.activeSeason).toBeNull()
    expect(next.activePostseason).toBeNull()
    expect(next.history).toHaveLength(1)
    expect(archive.seasonNumber).toBe(1)
    expect(archive.season.resultsByGameId).toEqual(completeSeason.resultsByGameId)
    expect(archive.postseason.resultsByGameId).toEqual(completePostseason.resultsByGameId)
    expect(archive.season.resultsByGameId).not.toBe(completeSeason.resultsByGameId)
    expect(archive.postseason.resultsByGameId).not.toBe(completePostseason.resultsByGameId)
    expect(deriveNationalChampion(archive.postseason)).toBeDefined()
    expect(JSON.stringify(source)).toBe(sourceSnapshot)
    expect(JSON.parse(JSON.stringify(next))).toEqual(next)
    expect(() => beginOffseason(next)).toThrow(/no active Season/)
  })

  it('graduates seniors and develops every Program into a non-Team offseason roster', () => {
    const next = beginOffseason(dynasty())
    expect(Object.keys(next.offseason!.programs)).toHaveLength(UNIVERSE_V0.programs.length)
    expect(next.offseason).toMatchObject({ completedSeasonNumber: 1, targetSeasonNumber: 2 })

    const returningIds = new Set<string>()
    for (const program of UNIVERSE_V0.programs) {
      const beforeTeam = completeSeason.programStates[program.id]!.team
      const postseasonTeam = completePostseason.programStates[program.id]?.team
      const sourceTeam = postseasonTeam ?? beforeTeam
      const offseason = next.offseason!.programs[program.id]!
      const expectedReturners = sourceTeam.roster.filter(({ classYear }) => classYear !== 'SR')

      expect(offseason.programId).toBe(program.id)
      expect(offseason.prestige).toBe(sourceTeam.prestige)
      expect(offseason.returningPlayers).toHaveLength(expectedReturners.length)
      expect(offseason.returningPlayers.length).toBeLessThanOrEqual(TEAM_ROSTER_SIZE)
      expect('rotation' in offseason).toBe(false)
      expect(deriveOffseasonRosterOutlook(offseason).openRosterSpots).toBe(
        TEAM_ROSTER_SIZE - expectedReturners.length,
      )

      for (const after of offseason.returningPlayers) {
        const before = expectedReturners.find(({ id }) => id === after.id)!
        expect(returningIds.has(after.id)).toBe(false)
        returningIds.add(after.id)
        expect(after).toMatchObject({
          id: before.id,
          firstName: before.firstName,
          lastName: before.lastName,
          height: before.height,
          position: before.position,
          potential: before.potential,
        })
        expect(after.classYear).not.toBe('FR')
        expect(calculateOverall(after)).toBeLessThanOrEqual(after.potential)
      }
    }
  })

  it('keeps archived Player snapshots unchanged when offseason Players evolve', () => {
    const next = beginOffseason(dynasty())
    const archiveBefore = structuredClone(next.history[0])
    const programId = UNIVERSE_V0.programs[0]!.id
    const offseasonPlayer = next.offseason!.programs[programId]!.returningPlayers[0]!
    const archivedPlayer = next.history[0]!.season.programStates[programId]!.team.roster
      .find(({ id }) => id === offseasonPlayer.id)!

    expect(offseasonPlayer).not.toBe(archivedPlayer)
    expect(next.history[0]).toEqual(archiveBefore)
  })

  it('prevents duplicate archival of the same season number', () => {
    const source = dynasty()
    const malformed: DynastyState = {
      ...source,
      history: [{
        seasonNumber: 1,
        season: completeSeason,
        postseason: completePostseason,
      }],
    }
    expect(() => beginOffseason(malformed)).toThrow(/already archived/)
  })

  it('is Program-order independent and gives controlled Programs no special path', () => {
    const reversedUniverse = {
      ...UNIVERSE_V0,
      programs: [...UNIVERSE_V0.programs].reverse(),
    }
    const normal = beginOffseason(dynasty())
    const reversed = beginOffseason({ ...dynasty(), universe: reversedUniverse })
    expect(reversed.offseason).toEqual(normal.offseason)

    const otherControlled = initializeDynastyState({
      dynastyId: 'dynasty-test',
      dynastySeed: 'dynasty-test-seed',
      controlledProgramId: UNIVERSE_V0.programs[1]!.id,
      universe: UNIVERSE_V0,
      activeSeason: completeSeason,
      activePostseason: completePostseason,
    })
    expect(beginOffseason(otherControlled).offseason).toEqual(normal.offseason)
  })
})
