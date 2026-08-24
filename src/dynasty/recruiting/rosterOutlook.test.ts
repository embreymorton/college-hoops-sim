import { describe, expect, it } from 'vitest'
import { POSITIONS, TEAM_ROSTER_SIZE, calculateOverall } from '../../engine'
import type { DynastyState } from '../domain'
import { deriveProjectedRosterOutlook } from '../rosterOutlook'
import type { RecruitingCommitment } from './domain'
import { deriveNextSeasonRosterOutlook } from './rosterOutlook'
import { createRecruitingDynasty } from './testSupport'

function commit(dynasty: DynastyState, playerId: string, programId = dynasty.controlledProgramId) {
  const commitment: RecruitingCommitment = {
    playerId, programId, timing: { kind: 'period', period: 1 },
    targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
  }
  return { ...dynasty, recruiting: { ...dynasty.recruiting!, commitmentsByPlayerId: {
    ...dynasty.recruiting!.commitmentsByPlayerId, [playerId]: commitment,
  } } }
}

function recruitForNeed(dynasty: DynastyState) {
  const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
  return dynasty.recruiting!.recruits.find(({ player }) =>
    program.projectedOpeningsByPosition[player.position] > 0)!
}

describe('next season roster outlook', () => {
  it('promotes returners, separates seniors, preserves ratings, and follows position order', () => {
    const dynasty = createRecruitingDynasty('next-roster-membership')
    const team = dynasty.activeSeason!.programStates[dynasty.controlledProgramId]!.team
    const outlook = deriveNextSeasonRosterOutlook(dynasty)
    const rows = outlook.positionGroups.flatMap(({ players }) => players)
    expect(outlook.positionGroups.map(({ position }) => position)).toEqual(POSITIONS)
    expect(outlook.projectedPlayerCount + outlook.remainingOpeningCount).toBe(TEAM_ROSTER_SIZE)
    for (const player of team.roster) {
      const row = rows.find(({ playerId }) => playerId === player.id)
      if (player.classYear === 'SR') {
        expect(row).toBeUndefined()
        expect(outlook.departures).toContainEqual(expect.objectContaining({ playerId: player.id }))
      } else {
        expect(row).toMatchObject({
          status: 'returning',
          projectedClassYear: player.classYear === 'FR' ? 'SO' : player.classYear === 'SO' ? 'JR' : 'SR',
          currentOverall: calculateOverall(player), potential: player.potential,
        })
      }
    }
  })

  it('includes only controlled commitments and consumes their exact-position opening', () => {
    const dynasty = createRecruitingDynasty('next-roster-commitments')
    const recruit = recruitForNeed(dynasty)
    const before = deriveNextSeasonRosterOutlook(dynasty)
    const outlook = deriveNextSeasonRosterOutlook(commit(dynasty, recruit.player.id))
    expect(outlook.positionGroups.flatMap(({ players }) => players)).toContainEqual(expect.objectContaining({
      playerId: recruit.player.id, status: 'incoming', projectedClassYear: 'FR',
      currentOverall: calculateOverall(recruit.player), potential: recruit.player.potential,
    }))
    expect(outlook.remainingOpeningCount).toBe(before.remainingOpeningCount - 1)

    const otherProgram = Object.keys(dynasty.recruiting!.programs).find((id) => id !== dynasty.controlledProgramId)!
    const elsewhere = deriveNextSeasonRosterOutlook(commit(dynasty, recruit.player.id, otherProgram))
    expect(elsewhere.positionGroups.flatMap(({ players }) => players.map(({ playerId }) => playerId)))
      .not.toContain(recruit.player.id)
  })

  it('ignores unsigned Board/Offer/Focus rows and is deterministic and mutation-free', () => {
    const dynasty = createRecruitingDynasty('next-roster-pure')
    const before = structuredClone(dynasty)
    const first = deriveNextSeasonRosterOutlook(dynasty)
    expect(deriveNextSeasonRosterOutlook(dynasty)).toEqual(first)
    expect(dynasty).toEqual(before)
    const boardIds = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.map(({ playerId }) => playerId)
    const projectedIds = first.positionGroups.flatMap(({ players }) => players.map(({ playerId }) => playerId))
    expect(projectedIds.filter((id) => boardIds.includes(id))).toEqual([])
    for (const group of first.positionGroups) {
      const statuses = group.players.map(({ status }) => status)
      expect(statuses).toEqual([...statuses].sort((a, b) => a === b ? 0 : a === 'returning' ? -1 : 1))
    }
  })

  it('supports no seniors as a complete all-filled roster', () => {
    const dynasty = createRecruitingDynasty('next-roster-full')
    const id = dynasty.controlledProgramId
    const state = dynasty.activeSeason!.programStates[id]!
    const noSeniors: DynastyState = {
      ...dynasty,
      activeSeason: { ...dynasty.activeSeason!, programStates: { ...dynasty.activeSeason!.programStates,
        [id]: { ...state, team: { ...state.team, roster: state.team.roster.map((player) => ({ ...player, classYear: 'JR' as const })) } },
      } },
      recruiting: { ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs,
        [id]: { ...dynasty.recruiting!.programs[id]!, projectedOpeningsByPosition: { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 } },
      } },
    }
    expect(deriveNextSeasonRosterOutlook(noSeniors)).toMatchObject({
      projectedPlayerCount: TEAM_ROSTER_SIZE, remainingOpeningCount: 0, departures: [],
    })
  })

  it('keeps multiple same-position openings tangible with zero returners, then fills every opening', () => {
    const dynasty = createRecruitingDynasty('next-roster-openings')
    const id = dynasty.controlledProgramId
    const state = dynasty.activeSeason!.programStates[id]!
    const roster = state.team.roster.map((player) => ({
      ...player,
      classYear: player.position === 'PG' ? 'SR' as const : player.classYear,
    }))
    const team = { ...state.team, roster }
    const projectedOpeningsByPosition = deriveProjectedRosterOutlook(team).projectedOpeningsByPosition
    let current: DynastyState = {
      ...dynasty,
      activeSeason: { ...dynasty.activeSeason!, programStates: {
        ...dynasty.activeSeason!.programStates, [id]: { ...state, team },
      } },
      recruiting: { ...dynasty.recruiting!, programs: {
        ...dynasty.recruiting!.programs, [id]: { ...dynasty.recruiting!.programs[id]!, projectedOpeningsByPosition },
      } },
    }
    const open = deriveNextSeasonRosterOutlook(current)
    const pg = open.positionGroups.find(({ position }) => position === 'PG')!
    expect(pg.players).toHaveLength(0)
    expect(pg.remainingOpenings).toBeGreaterThan(1)

    for (const position of POSITIONS) {
      const recruits = current.recruiting!.recruits.filter(({ player }) => player.position === position)
      for (let index = 0; index < projectedOpeningsByPosition[position]; index += 1) {
        current = commit(current, recruits[index]!.player.id)
      }
    }
    expect(deriveNextSeasonRosterOutlook(current)).toMatchObject({
      projectedPlayerCount: TEAM_ROSTER_SIZE,
      remainingOpeningCount: 0,
    })
  })

  it('rejects lifecycle, identity, opening, dangling, and over-capacity corruption', () => {
    const dynasty = createRecruitingDynasty('next-roster-invalid')
    expect(() => deriveNextSeasonRosterOutlook({ ...dynasty, activeSeason: null })).toThrow(/active Season/)
    expect(() => deriveNextSeasonRosterOutlook({ ...dynasty, recruiting: null })).toThrow(/not initialized/)
    expect(() => deriveNextSeasonRosterOutlook({ ...dynasty, recruiting: {
      ...dynasty.recruiting!, targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber + 1,
    } })).toThrow(/different lifecycle years/)
    expect(() => deriveNextSeasonRosterOutlook(commit(dynasty, 'missing'))).toThrow(/unknown Recruit/)

    const id = dynasty.controlledProgramId
    const state = dynasty.activeSeason!.programStates[id]!
    const duplicate = [...state.team.roster]
    duplicate[1] = { ...duplicate[1]!, id: duplicate[0]!.id }
    expect(() => deriveNextSeasonRosterOutlook({ ...dynasty, activeSeason: {
      ...dynasty.activeSeason!, programStates: { ...dynasty.activeSeason!.programStates,
        [id]: { ...state, team: { ...state.team, roster: duplicate } },
      },
    } })).toThrow(/duplicate Player ID/)

    const program = dynasty.recruiting!.programs[id]!
    expect(() => deriveNextSeasonRosterOutlook({ ...dynasty, recruiting: {
      ...dynasty.recruiting!, programs: { ...dynasty.recruiting!.programs,
        [id]: { ...program, projectedOpeningsByPosition: { ...program.projectedOpeningsByPosition, PG: program.projectedOpeningsByPosition.PG + 1 } },
      },
    } })).toThrow(/opening facts/)

    const recruit = recruitForNeed(dynasty)
    const candidates = dynasty.recruiting!.recruits.filter(({ player }) => player.position === recruit.player.position)
    let over = dynasty
    for (let index = 0; index <= program.projectedOpeningsByPosition[recruit.player.position]; index += 1) {
      over = commit(over, candidates[index]!.player.id)
    }
    expect(() => deriveNextSeasonRosterOutlook(over)).toThrow(/exceed projected/)
  })
})
