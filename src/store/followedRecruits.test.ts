import { beforeEach, describe, expect, it } from 'vitest'
import type { DynastyState } from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from './seasonStore'

function withCommitment(
  dynasty: DynastyState,
  playerId: string,
  programId: string,
): DynastyState {
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      commitmentsByPlayerId: {
        ...dynasty.recruiting!.commitmentsByPlayerId,
        [playerId]: {
          playerId,
          programId,
          timing: { kind: 'period', period: 7 },
          targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
        },
      },
    },
  }
}

beforeEach(() => {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore.setState({ dynasty: createRecruitingDynasty('followed-recruits') })
})

describe('Followed Recruits foundation', () => {
  it('follows idempotently in first-followed order, queries status, and unfollows', () => {
    const recruits = useDynastyStore.getState().dynasty!.recruiting!.recruits
    const firstId = recruits[2]!.player.id
    const secondId = recruits[0]!.player.id

    useDynastyStore.getState().followRecruit(firstId)
    useDynastyStore.getState().followRecruit(secondId)
    useDynastyStore.getState().followRecruit(firstId)

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([firstId, secondId])
    expect(useDynastyStore.getState().isRecruitFollowed(firstId)).toBe(true)

    useDynastyStore.getState().unfollowRecruit(firstId)

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([secondId])
    expect(useDynastyStore.getState().isRecruitFollowed(firstId)).toBe(false)
  })

  it('clears Recruit follows when a genuinely new Dynasty starts', () => {
    const playerId = useDynastyStore.getState().dynasty!.recruiting!.recruits[0]!.player.id
    useDynastyStore.getState().followRecruit(playerId)

    useDynastyStore.getState().selectProgram('northbridge', 'followed-recruits:new')

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([])
    expect(useDynastyStore.getState().isRecruitFollowed(playerId)).toBe(false)
  })

  it('survives Recruiting updates and commitment without changing Player follows', () => {
    const dynasty = useDynastyStore.getState().dynasty!
    const playerId = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board[0]!.playerId
    useDynastyStore.getState().followRecruit(playerId)
    useDynastyStore.getState().setRecruitingFocus(playerId, true)

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([playerId])

    useDynastyStore.setState({
      dynasty: withCommitment(
        useDynastyStore.getState().dynasty!,
        playerId,
        dynasty.controlledProgramId,
      ),
    })

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([playerId])
    expect(useDynastyStore.getState().followedPlayerIds).toEqual([])
    expect(useDynastyStore.getState().isPlayerFollowed(playerId)).toBe(false)
  })
})
