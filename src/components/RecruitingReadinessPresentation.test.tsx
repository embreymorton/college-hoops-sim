import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Position } from '../engine'
import type { RecruitingBattleView, RecruitingReadiness, RecruitStarRating } from '../dynasty'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { RecruitingReadinessBadge } from './RecruitingBattleBadges'
import { RecruitingHubSummary } from './RecruitingHubSummary'
import { RecruitingBattlesGrid } from './RecruitingBattlesGrid'
import type { BattleCardSummary, FocusTargetSummary } from '../app/recruitingBattleFormatters'
import type { PositionCounts } from '../dynasty'

/**
 * Presentation-only checks for the accepted six-state Readiness contract
 * (6E.14B-B): every state renders distinct, consistent copy across Hub,
 * Board, and Battles, and the old five-state `Early Interest` label is gone.
 * These construct plain `RecruitingBattleView` view-models directly rather
 * than a full dynasty, since the presentation layer only ever consumes that
 * pure projection.
 */

const CONTROLLED_PROGRAM: ProgramDefinition = UNIVERSE_V0.programs.find(
  (program) => program.id === 'charlotte-tech',
)!
const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

const ALL_READINESS_STATES: readonly RecruitingReadiness[] = [
  'not-deciding',
  'decision-soon',
  'developing',
  'serious',
  'decision-imminent',
  'committed',
]

function battleView(readiness: RecruitingReadiness): RecruitingBattleView {
  return {
    playerId: 'rp-1',
    readiness,
    commitment: null,
    controlled: {
      isOnBoard: true,
      isFocused: true,
      hasActiveOffer: true,
      targetStatus: 'active',
      position: 'leading',
    },
    pursuingPrograms: [
      {
        programId: CONTROLLED_PROGRAM.id,
        pursuitRank: 1,
        hasActiveOffer: true,
        position: 'leading',
      },
    ],
  }
}

function focusTarget(readiness: RecruitingReadiness): FocusTargetSummary {
  return {
    playerId: 'rp-1',
    playerName: 'Test Recruit',
    position: 'SG' as Position,
    stars: 4 as RecruitStarRating,
    nationalRank: 12,
    battle: battleView(readiness),
  }
}

const EMPTY_POSITION_COUNTS: PositionCounts = { PG: 0, SG: 0, SF: 0, PF: 0, C: 0 }

function battleCard(readiness: RecruitingReadiness): BattleCardSummary {
  return {
    playerId: 'rp-1',
    playerName: 'Test Recruit',
    position: 'SG' as Position,
    stars: 4 as RecruitStarRating,
    nationalRank: 12,
    ovr: 78,
    pot: 88,
    isFocused: true,
    hasActiveOffer: true,
    status: 'active',
    battle: battleView(readiness),
  }
}

describe('Readiness presentation across surfaces (6E.14B-B)', () => {
  it('renders every accepted readiness state on the Board badge with distinct player-facing copy', () => {
    for (const readiness of ALL_READINESS_STATES) {
      const { unmount } = render(<RecruitingReadinessBadge readiness={readiness} />)
      const badge = document.querySelector('.recruiting-readiness-badge') as HTMLElement
      expect(badge).toHaveAttribute('data-readiness', readiness)
      expect(badge.textContent).not.toBe('Early Interest')
      unmount()
    }
  })

  it('gives Decision Soon and Not Yet Deciding distinct text and distinct data-readiness markers on the Board badge', () => {
    const { unmount: unmountA } = render(<RecruitingReadinessBadge readiness="not-deciding" />)
    const notDeciding = document.querySelector('.recruiting-readiness-badge') as HTMLElement
    const notDecidingText = notDeciding.textContent
    const notDecidingAttr = notDeciding.getAttribute('data-readiness')
    unmountA()

    render(<RecruitingReadinessBadge readiness="decision-soon" />)
    const decisionSoon = document.querySelector('.recruiting-readiness-badge') as HTMLElement

    expect(decisionSoon.textContent).not.toBe(notDecidingText)
    expect(decisionSoon.getAttribute('data-readiness')).not.toBe(notDecidingAttr)
    expect(notDecidingText).toBe('Not Yet Deciding')
    expect(decisionSoon.textContent).toBe('Decision Soon')
  })

  it('uses identical Readiness copy on the Hub Focus row and the Battles card for the same state', () => {
    for (const readiness of ALL_READINESS_STATES.filter((state) => state !== 'committed')) {
      const { unmount: unmountHub } = render(
        <RecruitingHubSummary
          targetSeasonNumber={2}
          phase="regular-season"
          lastResolvedPeriod={5}
          board={{
            programId: CONTROLLED_PROGRAM.id,
            projectedOpeningsByPosition: EMPTY_POSITION_COUNTS,
            remainingOpeningsByPosition: EMPTY_POSITION_COUNTS,
            activeOfferCountsByPosition: EMPTY_POSITION_COUNTS,
            availableOfferSlotsByPosition: EMPTY_POSITION_COUNTS,
            targets: [],
          }}
          focusTargets={[focusTarget(readiness)]}
          recentCommitment={undefined}
          onGenerateDraftBoard={() => {}}
          onBuildManually={() => {}}
        />,
      )
      const hubItem = document.querySelector('.recruiting-hub-focus__item') as HTMLElement
      expect(hubItem).toHaveAttribute('data-readiness', readiness)
      const hubReadinessText = within(hubItem).getByText(
        (_, element) => element?.className === 'recruiting-hub-focus__readiness',
      ).textContent
      unmountHub()

      const { unmount: unmountBattles } = render(
        <RecruitingBattlesGrid
          cards={[battleCard(readiness)]}
          controlledProgram={CONTROLLED_PROGRAM}
          programsById={PROGRAMS_BY_ID}
        />,
      )
      const card = document.querySelector('.recruiting-battle-card') as HTMLElement
      expect(card).toHaveAttribute('data-readiness', readiness)
      const cardReadinessText = within(card).getByText(
        (_, element) => element?.className === 'recruiting-battle-card__readiness',
      ).textContent
      unmountBattles()

      expect(hubReadinessText).toBe(cardReadinessText)
    }
  })

  it('never shows the retired Early Interest label anywhere', () => {
    render(<RecruitingReadinessBadge readiness="not-deciding" />)
    expect(screen.queryByText('Early Interest')).not.toBeInTheDocument()
  })
})
