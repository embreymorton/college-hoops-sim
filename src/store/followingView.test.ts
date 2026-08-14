import { beforeEach, describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import {
  derivePlayerSeasonStats,
  getNextGameForProgram,
  simulateScheduledGame,
  type SeasonState,
} from '../season'
import { UNIVERSE_V0 } from '../universe'
import { deriveFollowingView } from './followedPlayers'
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

beforeEach(() => {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore
    .getState()
    .selectProgram(CONTROLLED_PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED)
})

function activeSeason(): SeasonState {
  return useDynastyStore.getState().dynasty!.activeSeason!
}

describe('Following view projection', () => {
  it('returns safe, distinguishable empty results', () => {
    expect(deriveFollowingView([], activeSeason(), UNIVERSE_V0)).toEqual({
      totalFollowed: 0,
      activePlayers: [],
      unresolvedPlayerIds: [],
    })

    expect(
      deriveFollowingView(['departed-player'], activeSeason(), UNIVERSE_V0),
    ).toEqual({
      totalFollowed: 1,
      activePlayers: [],
      unresolvedPlayerIds: ['departed-player'],
    })
  })

  it('projects active current facts in first-followed order without duplicates', () => {
    const season = activeSeason()
    const firstProgramId = 'northbridge'
    const secondProgramId = CONTROLLED_PROGRAM_ID
    const first = season.programStates[firstProgramId]!.team.roster[1]!
    const second = season.programStates[secondProgramId]!.team.roster[0]!
    const before = structuredClone(season)
    const beforeUniverse = structuredClone(UNIVERSE_V0)
    const followedPlayerIds = [first.id, second.id, first.id]

    const projection = deriveFollowingView(
      followedPlayerIds,
      season,
      UNIVERSE_V0,
    )

    expect(projection.totalFollowed).toBe(2)
    expect(projection.unresolvedPlayerIds).toEqual([])
    expect(projection.activePlayers.map(({ playerId }) => playerId)).toEqual([
      first.id,
      second.id,
    ])
    expect(projection.activePlayers[0]).toMatchObject({
      playerId: first.id,
      player: {
        position: first.position,
        classYear: first.classYear,
      },
      program: { id: firstProgramId },
      team: { id: firstProgramId },
      overall: calculateOverall(first),
      seasonStats: {
        gamesPlayed: 0,
        pointsPerGame: 0,
        reboundsPerGame: 0,
        assistsPerGame: 0,
      },
    })
    expect(season).toEqual(before)
    expect(UNIVERSE_V0).toEqual(beforeUniverse)
    expect(followedPlayerIds).toEqual([first.id, second.id, first.id])
  })

  it('uses canonical current-season Player statistics', () => {
    const initial = activeSeason()
    const game = getNextGameForProgram(initial, CONTROLLED_PROGRAM_ID)!
    const season = simulateScheduledGame({
      season: initial,
      scheduledGameId: game.id,
      simulationSeed: 'following-view:stats',
    })
    const player = season.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    const canonical = derivePlayerSeasonStats(
      season,
      CONTROLLED_PROGRAM_ID,
      player.id,
    )

    const row = deriveFollowingView([player.id], season, UNIVERSE_V0)
      .activePlayers[0]!

    expect(row.seasonStats).toEqual({
      gamesPlayed: canonical.gamesPlayed,
      pointsPerGame: canonical.pointsPerGame,
      reboundsPerGame: canonical.reboundsPerGame,
      assistsPerGame: canonical.assistsPerGame,
    })
  })

  it('re-resolves changed canonical Player and Program facts without stale copies', () => {
    const initial = activeSeason()
    const sourceProgramId = CONTROLLED_PROGRAM_ID
    const destinationProgramId = 'northbridge'
    const player = initial.programStates[sourceProgramId]!.team.roster[0]!
    const initialRow = deriveFollowingView([player.id], initial, UNIVERSE_V0)
      .activePlayers[0]!
    const changedPlayer = {
      ...player,
      classYear: 'SO' as const,
      attributes: { ...player.attributes, shooting: 99 },
    }
    const nextSeason: SeasonState = {
      ...initial,
      resultsByGameId: {},
      programStates: {
        ...initial.programStates,
        [sourceProgramId]: {
          ...initial.programStates[sourceProgramId]!,
          team: {
            ...initial.programStates[sourceProgramId]!.team,
            roster: initial.programStates[sourceProgramId]!.team.roster.filter(
              ({ id }) => id !== player.id,
            ),
          },
        },
        [destinationProgramId]: {
          ...initial.programStates[destinationProgramId]!,
          team: {
            ...initial.programStates[destinationProgramId]!.team,
            roster: [
              ...initial.programStates[destinationProgramId]!.team.roster,
              changedPlayer,
            ],
          },
        },
      },
    }

    const currentRow = deriveFollowingView(
      [player.id],
      nextSeason,
      UNIVERSE_V0,
    ).activePlayers[0]!

    expect(currentRow.program.id).toBe(destinationProgramId)
    expect(currentRow.team.id).toBe(destinationProgramId)
    expect(currentRow.player).toBe(changedPlayer)
    expect(currentRow.player.classYear).toBe('SO')
    expect(currentRow.overall).toBe(calculateOverall(changedPlayer))
    expect(currentRow.overall).not.toBe(initialRow.overall)
  })
})
