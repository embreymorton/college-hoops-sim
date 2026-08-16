import { describe, expect, it } from 'vitest'
import { calculateOverall } from '../../engine'
import type { DynastyState } from '../domain'
import { deriveFollowingRecruitsView } from './followingView'
import type { RecruitingCommitment } from './domain'
import { createRecruitingDynasty } from './testSupport'

function withCommitment(
  dynasty: DynastyState,
  playerId: string,
  programId: string,
): DynastyState {
  const commitment: RecruitingCommitment = {
    playerId,
    programId,
    timing: { kind: 'period', period: 7 },
    targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
  }
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      commitmentsByPlayerId: {
        ...dynasty.recruiting!.commitmentsByPlayerId,
        [playerId]: commitment,
      },
    },
  }
}

describe('Following Recruits projection', () => {
  it('resolves current canonical details and safe battle state in first-followed order', () => {
    const dynasty = createRecruitingDynasty('following-recruits:resolved')
    const recruiting = dynasty.recruiting!
    const boardIds = new Set(
      recruiting.programs[dynasty.controlledProgramId]!.board.map(({ playerId }) => playerId),
    )
    const offBoard = recruiting.recruits.find(({ player }) => !boardIds.has(player.id))!
    const onBoard = recruiting.recruits.find(({ player }) => boardIds.has(player.id))!
    const before = structuredClone(dynasty)
    const followedIds = [offBoard.player.id, onBoard.player.id, offBoard.player.id]

    const view = deriveFollowingRecruitsView(dynasty, followedIds)

    expect(view.totalFollowed).toBe(2)
    expect(view.unresolvedRecruitIds).toEqual([])
    expect(view.recruits.map(({ playerId }) => playerId)).toEqual([
      offBoard.player.id,
      onBoard.player.id,
    ])
    expect(view.recruits[0]).toMatchObject({
      firstName: offBoard.player.firstName,
      lastName: offBoard.player.lastName,
      position: offBoard.player.position,
      stars: offBoard.stars,
      nationalRank: offBoard.nationalRank,
      overall: calculateOverall(offBoard.player),
      potential: offBoard.player.potential,
      battle: {
        controlled: { isOnBoard: false, position: 'not-pursuing' },
      },
    })
    expect(view.recruits[1]!.battle.readiness).toBeTruthy()
    expect(dynasty).toEqual(before)
    expect(followedIds).toEqual([offBoard.player.id, onBoard.player.id, offBoard.player.id])
  })

  it.each([
    ['controlled Program', true],
    ['another Program', false],
  ] as const)('reflects a commitment to %s', (_, commitsToControlled) => {
    const dynasty = createRecruitingDynasty(`following-recruits:commit:${commitsToControlled}`)
    const playerId = dynasty.recruiting!.recruits[0]!.player.id
    const programId = commitsToControlled
      ? dynasty.controlledProgramId
      : Object.keys(dynasty.recruiting!.programs).find(
          (candidate) => candidate !== dynasty.controlledProgramId,
        )!
    const row = deriveFollowingRecruitsView(
      withCommitment(dynasty, playerId, programId),
      [playerId],
    ).recruits[0]!

    expect(row.battle).toMatchObject({
      readiness: 'committed',
      commitment: { programId },
      controlled: {
        position: commitsToControlled ? 'committed-to-us' : 'committed-elsewhere',
      },
    })
  })

  it('reports stale IDs explicitly and resolves none without active Recruiting', () => {
    const dynasty = createRecruitingDynasty('following-recruits:stale')
    const playerId = dynasty.recruiting!.recruits[0]!.player.id

    expect(
      deriveFollowingRecruitsView(dynasty, ['missing-recruit', playerId]),
    ).toMatchObject({
      totalFollowed: 2,
      unresolvedRecruitIds: ['missing-recruit'],
      recruits: [{ playerId }],
    })
    expect(
      deriveFollowingRecruitsView(
        { ...dynasty, recruiting: null },
        [playerId, 'missing-recruit'],
      ),
    ).toEqual({
      totalFollowed: 2,
      recruits: [],
      unresolvedRecruitIds: [playerId, 'missing-recruit'],
    })
  })
})
