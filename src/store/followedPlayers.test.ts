import { beforeEach, describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../universe'
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'
import { deriveFollowedPlayers } from './followedPlayers'

const PROGRAM_ID = 'charlotte-tech'

beforeEach(() => {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore
    .getState()
    .selectProgram(PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED)
})

describe('Followed Players foundation', () => {
  it('follows idempotently, queries status, and unfollows an active Player', () => {
    const beforeDynasty = useDynastyStore.getState().dynasty!
    const beforeSeason = beforeDynasty.activeSeason!
    const player = beforeSeason.programStates[PROGRAM_ID]!.team.roster[0]!

    useDynastyStore.getState().followPlayer(player.id)
    useDynastyStore.getState().followPlayer(player.id)

    expect(useDynastyStore.getState().followedPlayerIds).toEqual([player.id])
    expect(useDynastyStore.getState().isPlayerFollowed(player.id)).toBe(true)
    expect(useDynastyStore.getState().dynasty).toBe(beforeDynasty)
    expect(useDynastyStore.getState().dynasty!.activeSeason).toBe(beforeSeason)

    useDynastyStore.getState().unfollowPlayer(player.id)

    expect(useDynastyStore.getState().followedPlayerIds).toEqual([])
    expect(useDynastyStore.getState().isPlayerFollowed(player.id)).toBe(false)
    expect(useDynastyStore.getState().dynasty).toBe(beforeDynasty)
  })

  it('derives current Player, Program, and Team facts and tolerates unresolved IDs', () => {
    const season = useDynastyStore.getState().dynasty!.activeSeason!
    const player = season.programStates[PROGRAM_ID]!.team.roster[0]!

    const resolved = deriveFollowedPlayers(
      [player.id, 'departed-player'],
      season,
      UNIVERSE_V0,
    )

    expect(resolved[0]).toMatchObject({
      playerId: player.id,
      player,
      program: { id: PROGRAM_ID },
      team: season.programStates[PROGRAM_ID]!.team,
      resolves: true,
    })
    expect(resolved[1]).toEqual({
      playerId: 'departed-player',
      player: null,
      program: null,
      team: null,
      resolves: false,
    })
  })

  it('clears follow intent when a genuinely new Dynasty starts', () => {
    const playerId = useDynastyStore.getState().dynasty!.activeSeason!
      .programStates[PROGRAM_ID]!.team.roster[0]!.id
    useDynastyStore.getState().followPlayer(playerId)

    useDynastyStore
      .getState()
      .selectProgram('northbridge', 'followed-players:new-dynasty')

    expect(useDynastyStore.getState().followedPlayerIds).toEqual([])
    expect(useDynastyStore.getState().isPlayerFollowed(playerId)).toBe(false)
  })
})
