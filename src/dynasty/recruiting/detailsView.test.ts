import { describe, expect, it } from 'vitest'
import { calculateOverall } from '../../engine'
import type { DynastyState } from '../domain'
import { deriveRecruitingBattleView } from './battleView'
import { deriveRecruitDetailsView } from './detailsView'
import type { RecruitingCommitment } from './domain'
import { getRecruit } from './queries'
import { createRecruitingDynasty } from './testSupport'

function fixture(seed = 'recruit-details') {
  const dynasty = createRecruitingDynasty(seed)
  const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board[0]!
  return { dynasty, playerId: target.playerId }
}

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

describe('Recruit Details projection', () => {
  it('resolves canonical identity, ratings, class context, OVR, and POT by stable Player ID', () => {
    const { dynasty, playerId } = fixture()
    const recruiting = dynasty.recruiting!
    const recruit = getRecruit(recruiting, playerId)!

    expect(deriveRecruitDetailsView(dynasty, playerId)).toMatchObject({
      playerId: recruit.player.id,
      firstName: recruit.player.firstName,
      lastName: recruit.player.lastName,
      position: recruit.player.position,
      classYear: recruit.player.classYear,
      height: recruit.player.height,
      ratings: recruit.player.attributes,
      overall: calculateOverall(recruit.player),
      potential: recruit.player.potential,
      targetSeasonNumber: recruiting.targetSeasonNumber,
      nationalRank: recruit.nationalRank,
      positionRank: recruit.positionRank,
      stars: recruit.stars,
    })
  })

  it('reuses the accepted player-safe battle semantics for an unresolved Recruit', () => {
    const { dynasty, playerId } = fixture('recruit-details-unresolved')
    const details = deriveRecruitDetailsView(dynasty, playerId)

    expect(details.battle).toEqual(deriveRecruitingBattleView(dynasty, playerId))
    expect(details.battle.commitment).toBeNull()
    expect(details.battle.controlled).toMatchObject({
      isOnBoard: true,
      targetStatus: 'active',
    })
    expect(details.battle.pursuingPrograms.map(({ pursuitRank }) => pursuitRank)).toEqual(
      details.battle.pursuingPrograms.map((_, index) => index + 1),
    )
  })

  it('represents a commitment to the controlled Program', () => {
    const { dynasty, playerId } = fixture('recruit-details-ours')
    const committed = withCommitment(dynasty, playerId, dynasty.controlledProgramId)
    const battle = deriveRecruitDetailsView(committed, playerId).battle

    expect(battle.readiness).toBe('committed')
    expect(battle.controlled.position).toBe('committed-to-us')
    expect(battle.controlled.targetStatus).toBe('committed')
    expect(battle.commitment).toMatchObject({
      programId: dynasty.controlledProgramId,
      timing: { kind: 'period', period: 7 },
    })
  })

  it('represents a commitment elsewhere', () => {
    const { dynasty, playerId } = fixture('recruit-details-theirs')
    const otherProgramId = Object.keys(dynasty.recruiting!.programs)
      .sort()
      .find((programId) => programId !== dynasty.controlledProgramId)!
    const battle = deriveRecruitDetailsView(
      withCommitment(dynasty, playerId, otherProgramId),
      playerId,
    ).battle

    expect(battle.readiness).toBe('committed')
    expect(battle.controlled.position).toBe('committed-elsewhere')
    expect(battle.controlled.targetStatus).toBe('committed-elsewhere')
    expect(battle.commitment?.programId).toBe(otherProgramId)
  })

  it('represents a Recruit outside the controlled Program Board', () => {
    const { dynasty } = fixture('recruit-details-off-board')
    const controlledBoardIds = new Set(
      dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.map(
        ({ playerId }) => playerId,
      ),
    )
    const playerId = dynasty.recruiting!.recruits.find(
      ({ player }) => !controlledBoardIds.has(player.id),
    )!.player.id
    const controlled = deriveRecruitDetailsView(dynasty, playerId).battle.controlled

    expect(controlled).toEqual({
      isOnBoard: false,
      isFocused: false,
      hasActiveOffer: false,
      targetStatus: 'not-on-board',
      position: 'not-pursuing',
    })
  })

  it('fails explicitly for stale IDs and missing active Recruiting state', () => {
    const { dynasty } = fixture('recruit-details-errors')
    expect(() => deriveRecruitDetailsView(dynasty, 'stale-recruit-id')).toThrow(
      new RangeError('Unknown Recruit Player ID "stale-recruit-id".'),
    )
    expect(() =>
      deriveRecruitDetailsView({ ...dynasty, recruiting: null }, 'any-id'),
    ).toThrow(new RangeError('Dynasty Recruiting is not initialized.'))
  })

  it('does not mutate Dynasty or Recruiting state', () => {
    const { dynasty, playerId } = fixture('recruit-details-pure')
    const before = structuredClone(dynasty)

    deriveRecruitDetailsView(dynasty, playerId)

    expect(dynasty).toEqual(before)
  })
})
