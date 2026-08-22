import { describe, expect, it } from 'vitest'
import type { Player, PlayerAttributes, Position } from '../../engine'
import type { DynastyState } from '../domain'
import type { RecruitingCommitment } from './domain'
import { deriveRecruitPositionOutlook } from './positionOutlook'
import { createRecruitingDynasty } from './testSupport'

const ratings = (value: number): PlayerAttributes => ({
  finishing: value,
  shooting: value,
  playmaking: value,
  ballHandling: value,
  perimeterDefense: value,
  interiorDefense: value,
  rebounding: value,
  athleticism: value,
  stamina: value,
})

function fixture(seed = 'position-outlook') {
  const original = createRecruitingDynasty(seed)
  const playerId = original.recruiting!.programs[original.controlledProgramId]!.board[0]!.playerId
  const viewed = original.recruiting!.recruits.find(({ player }) => player.id === playerId)!
  const position = viewed.player.position
  const programId = original.controlledProgramId
  const team = original.activeSeason!.programStates[programId]!.team
  const roster = team.roster.map((player, index): Player => ({
    ...player,
    position: index < 3 ? position : player.position === position ? otherPosition(position) : player.position,
    classYear: index === 0 ? 'SR' : index === 1 ? 'SO' : index === 2 ? 'JR' : player.classYear,
    attributes: index === 0 ? ratings(80) : index === 1 ? ratings(76) : index === 2 ? ratings(69) : player.attributes,
    potential: index === 0 ? 80 : index === 1 ? 76 : index === 2 ? 95 : player.potential,
  }))
  const dynasty: DynastyState = {
    ...original,
    activeSeason: {
      ...original.activeSeason!,
      programStates: {
        ...original.activeSeason!.programStates,
        [programId]: {
          ...original.activeSeason!.programStates[programId]!,
          team: { ...team, roster },
        },
      },
    },
    recruiting: {
      ...original.recruiting!,
      recruits: original.recruiting!.recruits.map((recruit) =>
        recruit.player.id === playerId
          ? { ...recruit, player: { ...recruit.player, attributes: ratings(74), potential: 84 } }
          : recruit,
      ),
      programs: {
        ...original.recruiting!.programs,
        [programId]: {
          ...original.recruiting!.programs[programId]!,
          projectedOpeningsByPosition: {
            ...original.recruiting!.programs[programId]!.projectedOpeningsByPosition,
            [position]: 1,
          },
        },
      },
      commitmentsByPlayerId: {},
    },
  }
  return { dynasty, playerId, position, roster }
}

function otherPosition(position: Position): Position {
  return position === 'PG' ? 'SG' : 'PG'
}

function commit(dynasty: DynastyState, playerId: string, programId: string): DynastyState {
  const commitment: RecruitingCommitment = {
    playerId,
    programId,
    timing: { kind: 'period', period: 5 },
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

describe('Recruit position outlook', () => {
  it('projects natural-position returners, next classes, a senior departure, and a hypothetical Recruit', () => {
    const { dynasty, playerId, position, roster } = fixture()
    const outlook = deriveRecruitPositionOutlook(dynasty, playerId)

    expect(outlook.position).toBe(position)
    expect(outlook.rows.map(({ kind, projectedClassYear, currentOverall }) => ({
      kind,
      projectedClassYear,
      currentOverall,
    }))).toEqual([
      { kind: 'returner', projectedClassYear: 'JR', currentOverall: 76 },
      { kind: 'viewed-hypothetical', projectedClassYear: 'FR', currentOverall: 74 },
      { kind: 'returner', projectedClassYear: 'SR', currentOverall: 69 },
    ])
    expect(outlook.departures).toEqual([expect.objectContaining({
      playerId: roster[0]!.id,
      currentOverall: 80,
    })])
    expect(outlook).toMatchObject({
      returningCount: 2,
      viewedRecruitInclusion: 'hypothetical',
      viewedRecruitRank: 2,
      viewedRecruitIsTiedAtRank: false,
    })
  })

  it('keeps current OVR authoritative when lower-ranked Players have much higher POT', () => {
    const { dynasty, playerId } = fixture('position-outlook-pot')
    const outlook = deriveRecruitPositionOutlook(dynasty, playerId)

    expect(outlook.rows.map(({ currentOverall, potential }) => [currentOverall, potential])).toEqual([
      [76, 76],
      [74, 84],
      [69, 95],
    ])
    expect(outlook.viewedRecruitRank).toBe(2)
  })

  it('uses deterministic OVR tie ordering internally and competition rank externally', () => {
    const { dynasty, playerId } = fixture('position-outlook-tie')
    const recruits = dynasty.recruiting!.recruits.map((recruit) =>
      recruit.player.id === playerId
        ? { ...recruit, player: { ...recruit.player, attributes: ratings(76), potential: 90 } }
        : recruit,
    )
    const tied = { ...dynasty, recruiting: { ...dynasty.recruiting!, recruits } }
    const outlook = deriveRecruitPositionOutlook(tied, playerId)
    const tiedRows = outlook.rows.filter(({ currentOverall }) => currentOverall === 76)

    expect(tiedRows.map(({ playerId: id }) => id)).toEqual(
      tiedRows.map(({ playerId: id }) => id).sort(),
    )
    expect(tiedRows.map(({ rank }) => rank)).toEqual([1, 1])
    expect(outlook).toMatchObject({ viewedRecruitRank: 1, viewedRecruitIsTiedAtRank: true })
  })

  it('inserts an active off-Board Recruit because Board membership is not eligibility', () => {
    const { dynasty, playerId } = fixture('position-outlook-off-board')
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const offBoard = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [dynasty.controlledProgramId]: {
            ...program,
            board: program.board.filter((target) => target.playerId !== playerId),
          },
        },
      },
    }
    expect(deriveRecruitPositionOutlook(offBoard, playerId).viewedRecruitInclusion).toBe('hypothetical')
  })

  it('includes multiple controlled commitments and includes the viewed commitment exactly once', () => {
    const { dynasty, playerId, position } = fixture('position-outlook-commitments')
    const second = dynasty.recruiting!.recruits.find(
      ({ player }) => player.position === position && player.id !== playerId,
    )!
    let committed = commit(dynasty, playerId, dynasty.controlledProgramId)
    committed = commit(committed, second.player.id, dynasty.controlledProgramId)
    committed = {
      ...committed,
      recruiting: {
        ...committed.recruiting!,
        programs: {
          ...committed.recruiting!.programs,
          [committed.controlledProgramId]: {
            ...committed.recruiting!.programs[committed.controlledProgramId]!,
            projectedOpeningsByPosition: {
              ...committed.recruiting!.programs[committed.controlledProgramId]!.projectedOpeningsByPosition,
              [position]: 2,
            },
          },
        },
      },
    }
    const outlook = deriveRecruitPositionOutlook(committed, playerId)

    expect(outlook.rows.filter(({ kind }) => kind === 'incoming-commitment')).toHaveLength(2)
    expect(outlook.rows.filter(({ playerId: id }) => id === playerId)).toHaveLength(1)
    expect(outlook.viewedRecruitInclusion).toBe('committed')
  })

  it('excludes commitments elsewhere and Recruits at a filled position', () => {
    const { dynasty, playerId, position } = fixture('position-outlook-excluded')
    const otherProgramId = Object.keys(dynasty.recruiting!.programs).find(
      (id) => id !== dynasty.controlledProgramId,
    )!
    expect(deriveRecruitPositionOutlook(commit(dynasty, playerId, otherProgramId), playerId))
      .toMatchObject({ viewedRecruitInclusion: 'excluded-committed-elsewhere', viewedRecruitRank: null })

    const filled = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [dynasty.controlledProgramId]: {
            ...dynasty.recruiting!.programs[dynasty.controlledProgramId]!,
            projectedOpeningsByPosition: {
              ...dynasty.recruiting!.programs[dynasty.controlledProgramId]!.projectedOpeningsByPosition,
              [position]: 0,
            },
          },
        },
      },
    }
    expect(deriveRecruitPositionOutlook(filled, playerId))
      .toMatchObject({ viewedRecruitInclusion: 'excluded-position-filled', viewedRecruitRank: null })
  })

  it.each(['regular-season', 'postseason', 'late'] as const)(
    'uses the same active-candidate projection in the %s phase',
    (phase) => {
      const { dynasty, playerId } = fixture(`position-outlook-${phase}`)
      const phased = { ...dynasty, recruiting: { ...dynasty.recruiting!, phase } }
      expect(deriveRecruitPositionOutlook(phased, playerId).viewedRecruitInclusion).toBe('hypothetical')
    },
  )

  it('does not insert an unsigned Recruit after Recruiting is finalized', () => {
    const { dynasty, playerId } = fixture('position-outlook-finalized')
    const finalized = { ...dynasty, recruiting: { ...dynasty.recruiting!, phase: 'finalized' as const } }
    expect(deriveRecruitPositionOutlook(finalized, playerId).viewedRecruitInclusion)
      .toBe('excluded-position-filled')
  })

  it('supports no returners and no departures', () => {
    const { dynasty, playerId, position } = fixture('position-outlook-empty')
    const team = dynasty.activeSeason!.programStates[dynasty.controlledProgramId]!.team
    const empty = {
      ...dynasty,
      activeSeason: {
        ...dynasty.activeSeason!,
        programStates: {
          ...dynasty.activeSeason!.programStates,
          [dynasty.controlledProgramId]: {
            ...dynasty.activeSeason!.programStates[dynasty.controlledProgramId]!,
            team: {
              ...team,
              roster: team.roster.map((player) =>
                player.position === position ? { ...player, position: otherPosition(position) } : player,
              ),
            },
          },
        },
      },
    }
    const outlook = deriveRecruitPositionOutlook(empty, playerId)
    expect(outlook.returningCount).toBe(0)
    expect(outlook.departures).toEqual([])
    expect(outlook.rows).toHaveLength(1)
  })

  it('fails on dangling commitments and remains deterministic and mutation-free', () => {
    const { dynasty, playerId } = fixture('position-outlook-pure')
    const before = structuredClone(dynasty)
    expect(deriveRecruitPositionOutlook(dynasty, playerId)).toEqual(
      deriveRecruitPositionOutlook(dynasty, playerId),
    )
    expect(dynasty).toEqual(before)

    const dangling = commit(dynasty, 'missing-recruit', dynasty.controlledProgramId)
    expect(() => deriveRecruitPositionOutlook(dangling, playerId)).toThrow(
      'Commitment references unknown Recruit Player ID "missing-recruit".',
    )
  })
})
