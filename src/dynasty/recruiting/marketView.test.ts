import { describe, expect, it } from 'vitest'
import { createRecruitingDynasty } from './testSupport'
import {
  deriveRecruitMarketView,
  deriveRecruitingMarketTier,
  deriveRecruitingPulse,
  deriveRecruitingPulseSnapshot,
  type RecruitingPulseSnapshot,
} from './marketView'

function initialized(seed = 'market-view-test') {
  return createRecruitingDynasty(seed)
}

function withPopulatedControlled(dynasty: ReturnType<typeof initialized>) {
  const program = Object.values(dynasty.recruiting!.programs).find(({ board }) => board.length > 0)!
  return { ...dynasty, controlledProgramId: program.programId }
}

describe('Recruiting market visibility', () => {
  it('uses stable presentation-only tier thresholds', () => {
    expect([0, 1, 2, 4, 5, 12].map(deriveRecruitingMarketTier)).toEqual([
      'open', 'open', 'active', 'active', 'crowded', 'crowded',
    ])
  })

  it('conceals the external P0 market without changing the controlled Offer fact', () => {
    const dynasty = initialized()
    const recruiting = dynasty.recruiting!
    const controlled = recruiting.programs[dynasty.controlledProgramId!]!
    const offered = controlled.board.find(({ hasActiveOffer }) => hasActiveOffer)
      ?? Object.values(recruiting.programs).flatMap(({ board }) => board).find(({ hasActiveOffer }) => hasActiveOffer)!
    const programId = controlled.board.some(({ playerId }) => playerId === offered.playerId)
      ? dynasty.controlledProgramId!
      : Object.values(recruiting.programs).find(({ board }) => board.some(({ playerId }) => playerId === offered.playerId && offered.hasActiveOffer))!.programId
    const withControlledOffer = programId === dynasty.controlledProgramId! ? dynasty : {
      ...dynasty,
      controlledProgramId: programId,
    }
    const view = deriveRecruitMarketView(withControlledOffer, offered.playerId)
    expect(view).toMatchObject({ tier: 'forming', isForming: true, activeProgramCount: null, activeOfferCount: null })
    expect(view.controlledHasActiveOffer).toBe(true)
    expect(withControlledOffer.recruiting!.programs[programId]!.board.find(({ playerId }) => playerId === offered.playerId)!.hasActiveOffer).toBe(true)
  })

  it('reveals exact current Program and Offer counts after P0', () => {
    const dynasty = initialized('market-reveal')
    const playerId = dynasty.recruiting!.recruits[0]!.player.id
    const revealed = { ...dynasty, recruiting: { ...dynasty.recruiting!, lastResolvedPeriod: 1 } }
    const view = deriveRecruitMarketView(revealed, playerId)
    expect(view.isForming).toBe(false)
    expect(view.activeProgramCount).toBeGreaterThanOrEqual(0)
    expect(view.activeOfferCount).toBeGreaterThanOrEqual(0)
    expect(view.tier).toBe(deriveRecruitingMarketTier(view.activeProgramCount!))
  })
})

describe('Recruiting Pulse', () => {
  it('is deterministic, quiet for identical state, and capped at three facts', () => {
    const dynasty = initialized('pulse-determinism')
    const baseline = deriveRecruitingPulseSnapshot(dynasty)!
    expect(deriveRecruitingPulse(baseline, dynasty)).toEqual([])
    expect(deriveRecruitingPulse(baseline, dynasty)).toEqual(deriveRecruitingPulse(baseline, dynasty))
  })

  it('ranks a controlled commitment first and suppresses obsolete movement', () => {
    const dynasty = withPopulatedControlled(initialized('pulse-commitment'))
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId!]!
    const target = program.board[0]!
    const baseline = deriveRecruitingPulseSnapshot(dynasty)!
    const committed = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        lastResolvedPeriod: 1,
        commitmentsByPlayerId: {
          [target.playerId]: {
            playerId: target.playerId,
            programId: dynasty.controlledProgramId!,
            timing: { kind: 'period' as const, period: 1 },
            targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
          },
        },
      },
    }
    const facts = deriveRecruitingPulse(baseline, committed)
    expect(facts).toEqual([expect.objectContaining({ kind: 'committed-to-controlled', playerId: target.playerId })])
  })

  it('suppresses same-tier participant churn', () => {
    const dynasty = initialized('pulse-churn')
    const playerId = dynasty.recruiting!.recruits[0]!.player.id
    const current = { ...dynasty, recruiting: { ...dynasty.recruiting!, lastResolvedPeriod: 1 } }
    const actual = deriveRecruitingPulseSnapshot(current, [playerId])!.recruits.find((row) => row.playerId === playerId)!
    const baseline: RecruitingPulseSnapshot = {
      baselinePeriod: 1,
      recruits: [{
        ...actual,
        activeProgramIds: actual.activeProgramIds.map((_, index) => `former-${index}`),
      }],
    }
    const facts = deriveRecruitingPulse(baseline, current)
    expect(facts.filter(({ kind }) => kind === 'market-tier-changed')).toEqual([])
  })

  it('tracks followed Recruits and ranks material Offer/tier changes deterministically', () => {
    const dynasty = withPopulatedControlled(initialized('pulse-material'))
    const revealed = { ...dynasty, recruiting: { ...dynasty.recruiting!, lastResolvedPeriod: 1 } }
    const followedId = revealed.recruiting!.recruits.find(({ player }) =>
      !revealed.recruiting!.programs[revealed.controlledProgramId!]!.board.some(({ playerId }) => playerId === player.id))!.player.id
    const snapshot = deriveRecruitingPulseSnapshot(revealed, [followedId])!
    expect(snapshot.recruits.some(({ playerId }) => playerId === followedId)).toBe(true)
    const offered = snapshot.recruits.find(({ activeOfferProgramIds }) => activeOfferProgramIds.some((id) => id !== revealed.controlledProgramId!))
    expect(offered).toBeDefined()
    const baseline: RecruitingPulseSnapshot = {
      ...snapshot,
      recruits: snapshot.recruits.map((row) => row.playerId === offered!.playerId ? {
        ...row,
        activeOfferProgramIds: row.activeOfferProgramIds.filter((id) => id === revealed.controlledProgramId!),
        marketTier: row.marketTier === 'open' ? 'active' : 'open',
      } : row),
    }
    const first = deriveRecruitingPulse(baseline, revealed)
    expect(first.some(({ kind }) => kind === 'new-offer')).toBe(true)
    expect(first.some(({ kind }) => kind === 'market-tier-changed')).toBe(true)
    expect(first.length).toBeLessThanOrEqual(3)
    expect(first).toEqual(deriveRecruitingPulse(baseline, revealed))
  })
})
