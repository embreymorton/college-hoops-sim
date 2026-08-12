import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RecruitingBattleView } from '../dynasty'
import type { FocusTargetSummary } from '../app/recruitingBattleFormatters'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { SeasonHubFocusTargets } from './SeasonHubFocusTargets'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)
const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_IDS = UNIVERSE_V0.programs
  .map((program) => program.id)
  .filter((id) => id !== CONTROLLED_PROGRAM_ID)
const RIVAL_A = OTHER_PROGRAM_IDS[0]!
const RIVAL_B = OTHER_PROGRAM_IDS[1]!

function battleView(overrides: Partial<RecruitingBattleView> = {}): RecruitingBattleView {
  return {
    playerId: 'recruit-1',
    readiness: 'serious',
    commitment: null,
    controlled: {
      isOnBoard: true,
      isFocused: true,
      hasActiveOffer: true,
      targetStatus: 'active',
      position: 'competitive',
    },
    pursuingPrograms: [
      { programId: CONTROLLED_PROGRAM_ID, pursuitRank: 1, hasActiveOffer: true, position: 'leading' },
      { programId: RIVAL_A, pursuitRank: 2, hasActiveOffer: true, position: 'competitive' },
      { programId: RIVAL_B, pursuitRank: 3, hasActiveOffer: false, position: 'trailing' },
    ],
    ...overrides,
  }
}

function focusTarget(overrides: Partial<FocusTargetSummary> = {}): FocusTargetSummary {
  return {
    playerId: 'recruit-1',
    playerName: 'Jamal Carter',
    position: 'SG',
    stars: 4,
    nationalRank: 12,
    battle: battleView(),
    ...overrides,
  }
}

describe('SeasonHubFocusTargets', () => {
  it('renders nothing when there are no Focus targets', () => {
    const { container } = render(
      <SeasonHubFocusTargets
        focusTargets={[]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('surfaces readiness, standing, and Offer state for a leading Focus target', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget({ battle: battleView({ controlled: {
          isOnBoard: true,
          isFocused: true,
          hasActiveOffer: true,
          targetStatus: 'active',
          position: 'leading',
        } }) })]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(screen.getByText('Jamal Carter')).toBeInTheDocument()
    expect(screen.getByText('Serious Battle')).toBeInTheDocument()
    expect(screen.getByText('We Lead')).toBeInTheDocument()
    expect(screen.getByText('Offered')).toBeInTheDocument()
  })

  it('surfaces a trailing standing distinctly from leading', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget({ battle: battleView({ controlled: {
          isOnBoard: true,
          isFocused: true,
          hasActiveOffer: true,
          targetStatus: 'active',
          position: 'trailing',
        } }) })]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(screen.getByText('We Trail')).toBeInTheDocument()
  })

  it('surfaces decision-imminent readiness distinctly', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget({ battle: battleView({ readiness: 'decision-imminent' }) })]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(screen.getByText('Decision Imminent')).toBeInTheDocument()
  })

  it('surfaces a committed-to-us Focus target as a clear outcome', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget({
          battle: battleView({
            readiness: 'committed',
            commitment: {
              playerId: 'recruit-1',
              programId: CONTROLLED_PROGRAM_ID,
              timing: { kind: 'period', period: 5 },
              targetSeasonNumber: 2,
            },
            controlled: {
              isOnBoard: true,
              isFocused: true,
              hasActiveOffer: true,
              targetStatus: 'committed',
              position: 'committed-to-us',
            },
          }),
        })]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(screen.getByText('Committed To Us')).toBeInTheDocument()
  })

  it('surfaces a committed-elsewhere Focus target as a meaningful loss, not a silent disappearance', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget({
          battle: battleView({
            readiness: 'committed',
            commitment: {
              playerId: 'recruit-1',
              programId: RIVAL_A,
              timing: { kind: 'period', period: 5 },
              targetSeasonNumber: 2,
            },
            controlled: {
              isOnBoard: true,
              isFocused: true,
              hasActiveOffer: true,
              targetStatus: 'committed-elsewhere',
              position: 'committed-elsewhere',
            },
          }),
        })]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    expect(screen.getByText('Committed Elsewhere')).toBeInTheDocument()
  })

  it('stays compact with three populated Focus slots and shows competing Programs by name', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[
          focusTarget({ playerId: 'a', playerName: 'Player A', nationalRank: 1 }),
          focusTarget({ playerId: 'b', playerName: 'Player B', nationalRank: 2 }),
          focusTarget({ playerId: 'c', playerName: 'Player C', nationalRank: 3 }),
        ]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    const items = screen.getAllByText(/^Player /)
    expect(items).toHaveLength(3)
    expect(screen.getAllByText(PROGRAMS_BY_ID.get(RIVAL_A)!.name).length).toBeGreaterThan(0)
  })

  it('never renders raw numeric internal Recruiting values', () => {
    render(
      <SeasonHubFocusTargets
        focusTargets={[focusTarget()]}
        controlledProgramId={CONTROLLED_PROGRAM_ID}
        programsById={PROGRAMS_BY_ID}
        onManageRecruiting={vi.fn()}
      />,
    )
    // Only the National Rank ("#12") and star glyphs should render as
    // number-like content — no attraction/standing totals or percentages.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })
})
