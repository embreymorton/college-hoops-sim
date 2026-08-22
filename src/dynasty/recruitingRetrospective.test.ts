import { describe, expect, it } from 'vitest'
import { calculateOverall, type Player } from '../engine'
import type { PostseasonState } from '../postseason'
import type { SeasonState } from '../season'
import type { DynastyState } from './domain'
import type {
  CompletedRecruitingClass,
  Recruit,
  RecruitingCommitment,
} from './recruiting/domain'
import { createRecruitingDynasty } from './recruiting/testSupport'
import {
  deriveRecruitingClassIndex,
  deriveRecruitingClassRetrospective,
} from './recruitingRetrospective'

function withOverall(player: Player, overall: number): Player {
  return {
    ...player,
    attributes: Object.fromEntries(
      Object.keys(player.attributes).map((attribute) => [attribute, overall]),
    ) as unknown as Player['attributes'],
    potential: Math.max(player.potential, overall),
  }
}

function rosterSeason(
  source: SeasonState,
  seasonNumber: number,
  players: readonly { readonly programId: string; readonly player: Player }[],
): SeasonState {
  const season = structuredClone(source)
  const replacements = new Map<string, Player[]>()
  for (const { programId, player } of players) {
    replacements.set(programId, [...(replacements.get(programId) ?? []), player])
  }
  for (const [programId, roster] of replacements) {
    season.programStates[programId] = {
      ...season.programStates[programId]!,
      team: {
        ...season.programStates[programId]!.team,
        roster,
      },
    }
  }
  return { ...season, seasonNumber }
}

function fixture(): {
  dynasty: DynastyState
  recruits: readonly Recruit[]
  commitments: readonly RecruitingCommitment[]
} {
  const dynasty = createRecruitingDynasty('recruiting-retrospective')
  const otherProgramId = dynasty.universe.programs.find(
    ({ id }) => id !== dynasty.controlledProgramId,
  )!.id
  const generated = dynasty.recruiting!.recruits.slice(0, 4)
  const recruits = [
    { ...generated[0]!, nationalRank: 2, stars: 5 as const },
    { ...generated[1]!, nationalRank: 1, stars: 4 as const },
    { ...generated[2]!, nationalRank: 2, stars: 3 as const },
    { ...generated[3]!, nationalRank: 4, stars: 2 as const },
  ]
  const commitments: RecruitingCommitment[] = recruits.slice(0, 3).map((recruit, index) => ({
    playerId: recruit.player.id,
    programId: index < 2 ? dynasty.controlledProgramId : otherProgramId,
    timing: { kind: 'late' },
    targetSeasonNumber: 2,
  }))
  const completedClass: CompletedRecruitingClass = {
    targetSeasonNumber: 2,
    recruitingState: {
      ...dynasty.recruiting!,
      targetSeasonNumber: 2,
      phase: 'finalized',
      recruits,
      commitmentsByPlayerId: Object.fromEntries(
        commitments.map((commitment) => [commitment.playerId, commitment]),
      ),
    },
  }
  return {
    dynasty: { ...dynasty, completedRecruitingHistory: [completedClass] },
    recruits,
    commitments,
  }
}

describe('Recruiting Class Retrospective projection', () => {
  it('includes only signees and preserves archived Recruit-time facts', () => {
    const { dynasty, recruits } = fixture()
    const projection = deriveRecruitingClassRetrospective(dynasty, 2)

    expect(projection.signeeCount).toBe(3)
    expect(projection.controlledProgramSigneeCount).toBe(2)
    expect(projection.rows.some(({ playerId }) => playerId === recruits[3]!.player.id)).toBe(false)
    expect(projection.rows.map(({ nationalRank, playerId }) => [nationalRank, playerId])).toEqual([
      [1, recruits[1]!.player.id],
      [2, recruits[0]!.player.id],
      [2, recruits[2]!.player.id],
    ].sort((first, second) => Number(first[0]) - Number(second[0]) || String(first[1]).localeCompare(String(second[1]))))
    const row = projection.rows.find(({ playerId }) => playerId === recruits[0]!.player.id)!
    expect(row).toMatchObject({
      stars: 5,
      nationalRank: 2,
      entryOverall: calculateOverall(recruits[0]!.player),
      entryPotential: recruits[0]!.player.potential,
      signedProgramId: dynasty.controlledProgramId,
      outcome: { kind: 'incoming' },
    })
    expect(row).not.toHaveProperty('qualityScore')
    expect(row).not.toHaveProperty('relationshipProgress')
    expect(row).not.toHaveProperty('decisionReadyPeriod')
    expect(row).not.toHaveProperty('commitmentStandingThreshold')
  })

  it('is independent of Recruit, commitment, and class archive input order', () => {
    const { dynasty } = fixture()
    const completedClass = dynasty.completedRecruitingHistory[0]!
    const reversedClass = {
      ...completedClass,
      recruitingState: {
        ...completedClass.recruitingState,
        recruits: [...completedClass.recruitingState.recruits].reverse(),
        commitmentsByPlayerId: Object.fromEntries(
          Object.entries(completedClass.recruitingState.commitmentsByPlayerId).reverse(),
        ),
      },
    }
    const seasonThree = {
      ...structuredClone(completedClass),
      targetSeasonNumber: 3,
      recruitingState: {
        ...structuredClone(completedClass.recruitingState),
        targetSeasonNumber: 3,
        commitmentsByPlayerId: Object.fromEntries(
          Object.entries(completedClass.recruitingState.commitmentsByPlayerId).map(([id, commitment]) => [
            id,
            { ...commitment, targetSeasonNumber: 3 },
          ]),
        ),
      },
    }

    expect(deriveRecruitingClassRetrospective({
      ...dynasty,
      completedRecruitingHistory: [reversedClass],
    }, 2)).toEqual(deriveRecruitingClassRetrospective(dynasty, 2))
    expect(deriveRecruitingClassIndex({
      ...dynasty,
      completedRecruitingHistory: [completedClass, seasonThree],
    }).map(({ targetSeasonNumber }) => targetSeasonNumber)).toEqual([3, 2])
  })

  it('derives active and former outcomes with current and peak OVR', () => {
    const { dynasty, recruits, commitments } = fixture()
    const activeRecruit = recruits[0]!
    const formerRecruit = recruits[1]!
    const seasonTwo = rosterSeason(dynasty.activeSeason!, 2, [
      {
        programId: commitments[0]!.programId,
        player: { ...withOverall(activeRecruit.player, 84), classYear: 'SO' },
      },
    ])
    const seasonThree = rosterSeason(dynasty.activeSeason!, 3, [{
      programId: commitments[1]!.programId,
      player: { ...withOverall(formerRecruit.player, 91), classYear: 'JR' },
    }])
    const seasonFour = rosterSeason(dynasty.activeSeason!, 4, [{
      programId: commitments[1]!.programId,
      player: { ...withOverall(formerRecruit.player, 88), classYear: 'SR' },
    }])
    const resolved = {
      ...dynasty,
      activeSeason: seasonTwo,
      history: [
        { seasonNumber: 3, season: seasonThree, postseason: {} as PostseasonState },
        { seasonNumber: 4, season: seasonFour, postseason: {} as PostseasonState },
      ],
    }
    const projection = deriveRecruitingClassRetrospective(resolved, 2)

    expect(projection.rows.find(({ playerId }) => playerId === activeRecruit.player.id)!.outcome)
      .toEqual({
        kind: 'active',
        classYear: 'SO',
        currentOverall: 84,
        currentProgramId: commitments[0]!.programId,
      })
    expect(projection.rows.find(({ playerId }) => playerId === formerRecruit.player.id)!.outcome)
      .toEqual({
        kind: 'former',
        peakOverall: 91,
        finalOverall: 88,
        finalProgramId: commitments[1]!.programId,
      })
  })

  it('returns invariant fallbacks for missing identity and destination mismatch', () => {
    const { dynasty, recruits, commitments } = fixture()
    const missing = deriveRecruitingClassRetrospective({
      ...dynasty,
      activeSeason: { ...dynasty.activeSeason!, seasonNumber: 2 },
    }, 2)
    expect(missing.rows.every(({ outcome }) =>
      outcome.kind === 'unavailable' && outcome.reason === 'missing-player',
    )).toBe(true)

    const mismatchedSeason = rosterSeason(dynasty.activeSeason!, 2, [{
      programId: dynasty.universe.programs.find(
        ({ id }) => id !== commitments[0]!.programId,
      )!.id,
      player: recruits[0]!.player,
    }])
    const mismatch = deriveRecruitingClassRetrospective({
      ...dynasty,
      activeSeason: mismatchedSeason,
    }, 2).rows.find(({ playerId }) => playerId === commitments[0]!.playerId)!
    expect(mismatch.outcome).toEqual({ kind: 'unavailable', reason: 'destination-mismatch' })
  })
})
