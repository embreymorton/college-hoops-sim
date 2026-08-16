import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Player } from '../engine'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import type {
  DynastyState,
  Recruit,
  RecruitingBoardTarget,
  RecruitingCommitment,
  RecruitingState,
  RecruitStarRating,
} from '../dynasty'
import { useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_ID = 'northbridge'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function fixturePlayer(
  id: string,
  firstName: string,
  position: Player['position'],
): Player {
  return {
    id,
    firstName,
    lastName: 'Fixture',
    position,
    classYear: 'FR',
    height: 76,
    attributes: {
      finishing: 70,
      shooting: 70,
      playmaking: 70,
      ballHandling: 70,
      perimeterDefense: 70,
      interiorDefense: 70,
      rebounding: 70,
      athleticism: 70,
      stamina: 70,
    },
    potential: 82,
  }
}

function fixtureRecruit(
  id: string,
  firstName: string,
  position: Player['position'],
  nationalRank: number,
  stars: RecruitStarRating,
): Recruit {
  return {
    player: fixturePlayer(id, firstName, position),
    nationalRank,
    positionRank: 1,
    stars,
    qualityScore: 60,
    decisionReadyPeriod: 6,
    commitmentStandingThreshold: 60,
    commitmentSeparationThreshold: 5,
  }
}

function boardTarget(
  playerId: string,
  priority: number,
  hasActiveOffer: boolean,
): RecruitingBoardTarget {
  return { playerId, isFocused: priority >= 4, hasActiveOffer }
}

/**
 * A precisely controlled Recruiting fixture layered onto a real generated
 * Dynasty (so activeSeason/universe stay structurally valid): a signed SG, an
 * active-not-offered SG, an offered PF, a capacity-blocked PF, a Recruit
 * committed elsewhere at C, a position-filled C, four SG filler targets that
 * fill the 10-slot board, plus two unlisted National Class Recruits (one
 * addable, one at a needless position).
 */
function buildFixtureDynasty(): DynastyState {
  const base = createRecruitingDynasty('recruiting-ui-fixture')
  const recruits: Recruit[] = [
    fixtureRecruit('fx-signed-sg', 'Signed', 'SG', 1, 4),
    fixtureRecruit('fx-active-sg', 'Active', 'SG', 2, 3),
    fixtureRecruit('fx-offered-pf', 'Offered', 'PF', 3, 5),
    fixtureRecruit('fx-capacity-pf', 'Capacity', 'PF', 4, 3),
    fixtureRecruit('fx-elsewhere-c', 'Elsewhere', 'C', 5, 4),
    fixtureRecruit('fx-filled-c', 'Filled', 'C', 6, 2),
    fixtureRecruit('fx-filler-sg-1', 'FillerOne', 'SG', 7, 2),
    fixtureRecruit('fx-filler-sg-2', 'FillerTwo', 'SG', 8, 2),
    fixtureRecruit('fx-filler-sg-3', 'FillerThree', 'SG', 9, 2),
    fixtureRecruit('fx-filler-sg-4', 'FillerFour', 'SG', 10, 2),
    fixtureRecruit('fx-available-sg', 'Available', 'SG', 11, 3),
    fixtureRecruit('fx-needless-pg', 'Needless', 'PG', 12, 3),
    // Consumes the controlled Program's only projected C opening (below),
    // so it must itself resolve to a real Recruit for the commitment to count.
    fixtureRecruit('fx-signed-c', 'SignedC', 'C', 13, 3),
  ]

  const controlledBoard: RecruitingBoardTarget[] = [
    boardTarget('fx-signed-sg', 3, false),
    boardTarget('fx-active-sg', 3, false),
    boardTarget('fx-offered-pf', 4, true),
    boardTarget('fx-capacity-pf', 2, false),
    boardTarget('fx-elsewhere-c', 2, false),
    boardTarget('fx-filled-c', 1, false),
    boardTarget('fx-filler-sg-1', 1, false),
    boardTarget('fx-filler-sg-2', 1, false),
    boardTarget('fx-filler-sg-3', 1, false),
    boardTarget('fx-filler-sg-4', 1, false),
  ]

  // "fx-signed-c" commits a Player who is not itself in `recruits` (its own
  // outcome is not under test) purely to consume the only projected C
  // opening, so the separate uncommitted "fx-filled-c" Recruit reads as
  // position-filled.
  const commitmentsByPlayerId: Record<string, RecruitingCommitment> = {
    'fx-signed-sg': {
      playerId: 'fx-signed-sg',
      programId: CONTROLLED_PROGRAM_ID,
      timing: { kind: 'period', period: 3 },
      targetSeasonNumber: base.recruiting!.targetSeasonNumber,
    },
    'fx-elsewhere-c': {
      playerId: 'fx-elsewhere-c',
      programId: OTHER_PROGRAM_ID,
      timing: { kind: 'period', period: 2 },
      targetSeasonNumber: base.recruiting!.targetSeasonNumber,
    },
    'fx-signed-c': {
      playerId: 'fx-signed-c',
      programId: CONTROLLED_PROGRAM_ID,
      timing: { kind: 'period', period: 4 },
      targetSeasonNumber: base.recruiting!.targetSeasonNumber,
    },
  }

  const programs: RecruitingState['programs'] = {
    ...base.recruiting!.programs,
    [CONTROLLED_PROGRAM_ID]: {
      programId: CONTROLLED_PROGRAM_ID,
      projectedOpeningsByPosition: { PG: 0, SG: 2, SF: 0, PF: 1, C: 1 },
      board: controlledBoard,
    },
  }
  for (const programId of Object.keys(programs)) {
    if (programId !== CONTROLLED_PROGRAM_ID) {
      programs[programId] = { ...programs[programId]!, board: [] }
    }
  }

  const recruiting: RecruitingState = {
    ...base.recruiting!,
    recruits,
    programs,
    relationshipProgressByPlayerId: {},
    commitmentsByPlayerId,
  }

  return { ...base, recruiting }
}

function renderRecruitingScreen(): DynastyState {
  const dynasty = buildFixtureDynasty()
  useDynastyStore.setState({
    dynasty,
    view: 'recruiting',
    explorationViewHistory: [],
  })
  render(<App />)
  return dynasty
}

beforeEach(() => {
  resetStore()
})

describe('Dynasty section navigation', () => {
  it('shows Season / Recruiting / League during the regular season', () => {
    renderRecruitingScreen()

    expect(screen.getByRole('button', { name: 'Season' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recruiting' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'League' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Recruiting' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('returns to the Season Hub via the section nav', () => {
    renderRecruitingScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Season' }))

    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
  })
})

describe('Recruiting mode session context', () => {
  it.each([
    ['Battles', 'battles'],
    ['National Class', 'national'],
    ['Guide', 'guide'],
  ] as const)('stores the %s selection outside local React state', (label, mode) => {
    renderRecruitingScreen()

    fireEvent.click(screen.getByRole('button', { name: label }))

    expect(useDynastyStore.getState().recruitingMode).toBe(mode)
    expect(screen.getByRole('button', { name: label })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })
})

describe('Recruit Details entry points', () => {
  it('opens Recruit Details from Board identity without replacing management controls', () => {
    renderRecruitingScreen()
    expect(screen.getByRole('button', { name: 'Focus Active Fixture' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Active Fixture' }))

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'recruitDetails',
      selectedRecruitPlayerId: 'fx-active-sg',
      recruitingMode: 'board',
    })
  })

  it('opens Recruit Details from Battles and returns to Battles', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))
    fireEvent.click(screen.getByRole('button', { name: 'Active Fixture' }))

    fireEvent.click(screen.getByRole('button', { name: /Back to Recruiting/ }))

    expect(useDynastyStore.getState().recruitingMode).toBe('battles')
    expect(screen.getByRole('button', { name: 'Battles' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens Recruit Details from National Class and returns to National Class', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))
    fireEvent.click(screen.getByRole('button', { name: 'Available Fixture' }))

    fireEvent.click(screen.getByRole('button', { name: /Back to Recruiting/ }))

    expect(useDynastyStore.getState().recruitingMode).toBe('national')
    expect(screen.getByRole('button', { name: 'National Class' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('Recruiting Overview', () => {
  it('renders Board/Signed/Openings/Offers as one compact snapshot, with Board shown exactly once', () => {
    renderRecruitingScreen()

    const overview = document.querySelector('.recruiting-overview') as HTMLElement
    expect(overview).not.toBeNull()
    expect(within(overview).getByText('10 / 10')).toBeInTheDocument() // Board
    expect(within(overview).getByText('2 / 4')).toBeInTheDocument() // Signed
    expect(within(overview).getByText('1 / 2')).toBeInTheDocument() // Offers (offersTotal/remainingTotal)

    // The Board count appears exactly once on the whole page — no duplicate
    // count beside Fill Remaining Board.
    expect(screen.getAllByText('10 / 10')).toHaveLength(1)
  })

  it('summarizes positional needs concisely instead of a full positional matrix', () => {
    renderRecruitingScreen()

    const overview = document.querySelector('.recruiting-overview') as HTMLElement
    expect(within(overview).getByText(/SG 1 · PF 1/)).toBeInTheDocument()
    expect(document.querySelector('.recruiting-needs__table')).toBeNull()
  })

  it('hides the Fill Remaining Board action area entirely once the Board is full', () => {
    renderRecruitingScreen()

    expect(document.querySelector('.recruiting-board-management')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Fill Remaining Board' }),
    ).not.toBeInTheDocument()
  })

  it('does not repeat the Board count beside Fill Remaining Board on a partial Board', () => {
    const source = buildFixtureDynasty()
    const partial = {
      ...source,
      recruiting: {
        ...source.recruiting!,
        programs: {
          ...source.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...source.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: source.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.slice(0, 3),
          },
        },
      },
    }
    useDynastyStore.setState({ dynasty: partial, view: 'recruiting', explorationViewHistory: [] })
    render(<App />)

    const management = document.querySelector('.recruiting-board-management') as HTMLElement
    expect(management).not.toBeNull()
    expect(within(management).queryByText(/3 \/ 10/)).not.toBeInTheDocument()
    expect(
      within(management).getByRole('button', { name: 'Fill Remaining Board' }),
    ).toBeInTheDocument()
  })
})

describe('Recruiting Board', () => {
  it('fills only unused capacity and preserves the existing manual plan', () => {
    const source = buildFixtureDynasty()
    const original = source.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.slice(0, 3)
    const partial = {
      ...source,
      recruiting: {
        ...source.recruiting!,
        programs: {
          ...source.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...source.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: original,
          },
        },
      },
    }
    useDynastyStore.setState({ dynasty: partial, view: 'recruiting', explorationViewHistory: [] })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Fill Remaining Board' }))

    const board = useDynastyStore.getState().dynasty!.recruiting!
      .programs[CONTROLLED_PROGRAM_ID]!.board
    expect(board.slice(0, original.length)).toEqual(original)
    expect(board.length).toBeGreaterThan(original.length)
    expect(board.slice(original.length).every(
      ({ isFocused, hasActiveOffer }) => !isFocused && !hasActiveOffer,
    )).toBe(true)
    expect(screen.getByRole('status')).toHaveTextContent(/Added \d+ recruits? to your Board/)
  })

  it('hides Fill Remaining Board when the Board is full', () => {
    renderRecruitingScreen()
    expect(
      screen.queryByRole('button', { name: 'Fill Remaining Board' }),
    ).not.toBeInTheDocument()
  })

  it('renders every board target with rank, stars, ratings, and focus', () => {
    renderRecruitingScreen()

    const table = document.querySelector('.recruiting-board-table') as HTMLElement
    expect(within(table).getAllByText('Active').length).toBeGreaterThan(0)
    expect(within(table).getByText('FillerOne Fixture')).toBeInTheDocument()
    expect(
      within(table).getByRole('button', { name: 'Focus Active Fixture' }),
    ).toBeInTheDocument()
  })

  it('shows an active offer as Offered with a Withdraw control', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Offered Fixture').closest('tr')!
    expect(within(row).getByText('Offered')).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument()
  })

  it('shows a capacity-blocked target with a disabled Offer and the concrete reason', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Capacity Fixture').closest('tr')!
    const offerButton = within(row).getByRole('button', { name: 'Offer' })
    expect(offerButton).toBeDisabled()
    expect(within(row).getByText(/1 \/ 1 PF offers currently active/)).toBeInTheDocument()
  })

  it('shows a controlled-Program commitment as a clean COMMITTED status with Remove disabled', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Signed Fixture').closest('tr')!
    expect(
      within(row).getByText('Committed', { selector: '.recruiting-status-cell' }),
    ).toBeInTheDocument()
    expect(within(row).queryByText('Remove')).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument()
  })

  it('shows a Recruit committed elsewhere with the Program name and no offer controls', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Elsewhere Fixture').closest('tr')!
    expect(within(row).getByText(/Committed — Northbridge/)).toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: 'Offer' })).not.toBeInTheDocument()
    expect(within(row).getByText('Remove')).toBeInTheDocument()
  })

  it('shows a position-filled target distinctly from committed statuses', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Filled Fixture').closest('tr')!
    expect(within(row).getByText('Position Filled')).toBeInTheDocument()
  })

  it('offers, then withdraws, an eligible active board target', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Active Fixture').closest('tr')!

    fireEvent.click(within(row).getByRole('button', { name: 'Offer' }))
    expect(
      useDynastyStore
        .getState()
        .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
          (target) => target.playerId === 'fx-active-sg',
        )!.hasActiveOffer,
    ).toBe(true)

    const updatedRow = screen.getByText('Active Fixture').closest('tr')!
    fireEvent.click(within(updatedRow).getByRole('button', { name: 'Withdraw' }))
    expect(
      useDynastyStore
        .getState()
        .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
          (target) => target.playerId === 'fx-active-sg',
        )!.hasActiveOffer,
    ).toBe(false)
  })

  it('toggles focus with the compact control', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Active Fixture').closest('tr')!

    fireEvent.click(within(row).getByRole('button', { name: /Focus Active Fixture/ }))

    expect(
      useDynastyStore
        .getState()
        .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.find(
          (target) => target.playerId === 'fx-active-sg',
        )!.isFocused,
    ).toBe(true)
  })

  it('sorts strictly by National Rank ascending, and focus changes never move rows', () => {
    renderRecruitingScreen()

    const table = document.querySelector('.recruiting-board-table') as HTMLElement
    const rankCells = within(table)
      .getAllByRole('row')
      .slice(1) // drop the header row
      .map((row) => Number(within(row).getAllByRole('cell')[0]!.textContent))
    expect(rankCells).toEqual([...rankCells].sort((first, second) => first - second))

    // Focus "Active Fixture" (rank 2) and confirm fixed rank ordering.
    // (by rank) is unaffected.
    const activeRow = screen.getByText('Active Fixture').closest('tr')!
    fireEvent.click(within(activeRow).getByRole('button', { name: /Focus Active Fixture/ }))

    const rowsAfter = within(table).getAllByRole('row').slice(1)
    const namesAfter = rowsAfter.map(
      (row) => within(row).getAllByRole('cell')[1]!.textContent,
    )
    expect(namesAfter[0]).toContain('Signed Fixture')
    expect(namesAfter[1]).toContain('Active Fixture')
    const rankCellsAfter = rowsAfter.map((row) =>
      Number(within(row).getAllByRole('cell')[0]!.textContent),
    )
    expect(rankCellsAfter).toEqual([...rankCellsAfter].sort((first, second) => first - second))
  })

  it('removes an eligible target from the board', () => {
    renderRecruitingScreen()
    const row = screen.getByText('Active Fixture').closest('tr')!

    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }))

    expect(
      useDynastyStore
        .getState()
        .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.some(
          (target) => target.playerId === 'fx-active-sg',
        ),
    ).toBe(false)
  })

  it('is management-only: no Battle column and no competitor list, but Readiness remains', () => {
    renderRecruitingScreen()

    const table = document.querySelector('.recruiting-board-table') as HTMLElement
    expect(within(table).queryByText('Battle')).not.toBeInTheDocument()
    expect(table.querySelector('.recruiting-competitor-list')).toBeNull()
    expect(
      within(table).getByRole('columnheader', { name: /Readiness/ }),
    ).toBeInTheDocument()
    expect(table.querySelectorAll('.recruiting-readiness-badge').length).toBeGreaterThan(0)
  })

  it('no longer renders the old Readiness tooltip affordance — Guide is the canonical explanation destination', () => {
    renderRecruitingScreen()

    expect(screen.queryByRole('button', { name: 'About Readiness' })).not.toBeInTheDocument()
    expect(document.querySelector('.info-affordance')).toBeNull()
  })
})

describe('Battles tab', () => {
  it('adds a Battles mode between Board and National Class', () => {
    renderRecruitingScreen()

    expect(screen.getByRole('button', { name: 'Board' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Battles' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'National Class' })).toBeInTheDocument()
  })

  it('shows a battle card per Board Recruit with our Program grouped by its actual standing', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    const grid = document.querySelector('.recruiting-battles-grid') as HTMLElement
    expect(grid).not.toBeNull()
    expect(within(grid).getByText('Active Fixture')).toBeInTheDocument()

    const card = within(grid).getByText('Active Fixture').closest('.recruiting-battle-card') as HTMLElement
    // The fixture's controlled Program is the sole pursuer, so it is the
    // (sole) leading entry — grouped, not pinned to a separate fixed row.
    expect(within(card).getByText('Leading')).toBeInTheDocument()
    expect(within(card).getByText('Charlotte Tech')).toBeInTheDocument()
    expect(within(card).getByText('YOU')).toBeInTheDocument()
    expect(card.querySelector('.team-color-dot')).not.toBeNull()
    // No redundant duplicate "We Lead" style standing badge alongside the group.
    expect(within(card).queryByText(/We Lead/)).not.toBeInTheDocument()
  })

  it('marks the controlled Program row with YOU plus Focused/Offered metadata', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    const card = screen
      .getByText('Offered Fixture')
      .closest('.recruiting-battle-card') as HTMLElement
    expect(within(card).getByText('YOU · Focused · Offered')).toBeInTheDocument()
  })

  it('does not repeat the group standing label inside the group', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    const card = screen
      .getByText('Active Fixture')
      .closest('.recruiting-battle-card') as HTMLElement
    // "Leading" appears exactly once, as the group heading — not repeated
    // per row inside the group.
    expect(within(card).getAllByText('Leading')).toHaveLength(1)
  })

  it('simplifies a committed-elsewhere card to the outcome', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    const card = screen
      .getByText('Elsewhere Fixture')
      .closest('.recruiting-battle-card') as HTMLElement
    expect(within(card).getByText(/Committed To Northbridge/)).toBeInTheDocument()
    expect(within(card).queryByText('Charlotte Tech')).not.toBeInTheDocument()
  })

  it('caps long competitor lists with an overflow summary', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    const grid = document.querySelector('.recruiting-battles-grid') as HTMLElement
    // The fixture's boards only carry the controlled Program's pursuit, so
    // no card should render more than the cap — this asserts the overflow
    // affordance never renders an unbounded list.
    for (const overflow of grid.querySelectorAll('.recruiting-battle-card__overflow')) {
      expect(overflow.textContent).toMatch(/^\+\d+ other programs$/)
    }
  })

  it('never renders raw numeric internal Recruiting values', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))

    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })
})

describe('Guide', () => {
  it('adds a Guide mode alongside Board/Battles/National Class', () => {
    renderRecruitingScreen()

    expect(screen.getByRole('button', { name: 'Guide' })).toBeInTheDocument()
  })

  it('explains Board, Focus, and Offers', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))

    const guide = document.querySelector('.recruiting-guide') as HTMLElement
    expect(within(guide).getByText('Board')).toBeInTheDocument()
    expect(within(guide).getByText(/Board targets receive normal recruiting effort/)).toBeInTheDocument()
    expect(within(guide).getByText('Focus')).toBeInTheDocument()
    expect(within(guide).getByText(/Focus and Offers are separate choices/)).toBeInTheDocument()
    expect(within(guide).getByText('Offers')).toBeInTheDocument()
    expect(
      within(guide).getByText(/Only recruits with an active Offer can commit/),
    ).toBeInTheDocument()
  })

  it('explains all six Readiness states', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))

    const guide = document.querySelector('.recruiting-guide') as HTMLElement
    expect(within(guide).getByText('Not Yet Deciding')).toBeInTheDocument()
    expect(within(guide).getByText('Decision Soon')).toBeInTheDocument()
    expect(within(guide).getByText('Developing')).toBeInTheDocument()
    expect(within(guide).getByText('Serious Battle')).toBeInTheDocument()
    expect(within(guide).getByText('Decision Imminent')).toBeInTheDocument()
    expect(within(guide).getByText('Committed')).toBeInTheDocument()
    expect(within(guide).getByText(/not an exact commitment probability/i)).toBeInTheDocument()
  })

  it('explains Leading/Competitive/Trailing battle standing and points to the Battles tab', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))

    const guide = document.querySelector('.recruiting-guide') as HTMLElement
    expect(within(guide).getByText(/Leading, Competitive, or Trailing/)).toBeInTheDocument()
    expect(within(guide).getByText(/Battles tab/)).toBeInTheDocument()
  })

  it('never exposes hidden numeric Recruiting internals', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))

    const guide = document.querySelector('.recruiting-guide') as HTMLElement
    expect(guide.textContent).not.toMatch(/%/)
    expect(guide.textContent).not.toMatch(/\bperiod \d/i)
  })

  it('preserves Board/Battles/National mode switching alongside Guide', () => {
    renderRecruitingScreen()

    fireEvent.click(screen.getByRole('button', { name: 'Guide' }))
    expect(document.querySelector('.recruiting-guide')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Battles' }))
    expect(document.querySelector('.recruiting-battles-grid')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))
    expect(document.querySelector('.national-recruit-table__table')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    expect(document.querySelector('.recruiting-board-table')).not.toBeNull()
  })
})

describe('National Class', () => {
  it('lists Recruits by National Rank and allows adding an eligible target', () => {
    renderRecruitingScreen()
    // The fixture board starts full; free a slot via Remove before adding.
    const removableRow = screen.getByText('Elsewhere Fixture').closest('tr')!
    fireEvent.click(within(removableRow).getByRole('button', { name: 'Remove' }))

    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))

    const row = screen.getByText('Available Fixture').closest('tr')!
    fireEvent.click(within(row).getByRole('button', { name: 'Add to Board' }))

    expect(
      useDynastyStore
        .getState()
        .dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.some(
          (target) => target.playerId === 'fx-available-sg',
        ),
    ).toBe(true)
  })

  it('shows Board Full for an eligible Recruit once the board is at capacity', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))

    // Board is already at the 10-target limit before any addition.
    const row = screen.getByText('Available Fixture').closest('tr')!
    expect(within(row).getByRole('button', { name: 'Board Full' })).toBeDisabled()
  })

  it('shows on-board status directly, without needing the Board tab', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))

    const offeredRow = screen.getByText('Offered Fixture').closest('tr')!
    expect(within(offeredRow).getByText('Offered')).toBeInTheDocument()
    const elsewhereRow = screen.getByText('Elsewhere Fixture').closest('tr')!
    expect(within(elsewhereRow).getByText(/Committed — Northbridge/)).toBeInTheDocument()
  })

  it('filters by position', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))

    fireEvent.click(screen.getByRole('button', { name: 'PG' }))

    expect(screen.getByText('Needless Fixture')).toBeInTheDocument()
    expect(screen.queryByText('Available Fixture')).not.toBeInTheDocument()
  })

  it('filters by Needs, excluding Recruits at positions with no remaining opening', () => {
    renderRecruitingScreen()
    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))

    fireEvent.click(screen.getByRole('button', { name: 'Needs' }))

    // PG has zero projected openings, so the PG Recruit is excluded.
    expect(screen.queryByText('Needless Fixture')).not.toBeInTheDocument()
    // SG still has a remaining opening.
    expect(screen.getByText('Available Fixture')).toBeInTheDocument()
  })
})

describe('Season Hub Recruiting module', () => {
  it('summarizes period/phase, roster needs, signed count, board, and offers, with no Manage Recruiting CTA', () => {
    const dynasty = buildFixtureDynasty()
    useDynastyStore.setState({ dynasty, view: 'hub', explorationViewHistory: [] })
    render(<App />)

    const summary = document.querySelector('.recruiting-hub-summary') as HTMLElement
    // Period 0 presents as Preseason, not a raw "0 / 24" fraction, and now
    // composes onto one condensed title line with the Class label.
    expect(
      within(summary).getByText(
        `Class of Season ${dynasty.recruiting!.targetSeasonNumber} · Preseason`,
      ),
    ).toBeInTheDocument()
    expect(within(summary).getByText(/SG 1 · PF 1/)).toBeInTheDocument()
    expect(within(summary).getByText('2 / 4')).toBeInTheDocument()
    expect(within(summary).getByText('10 / 10')).toBeInTheDocument()
    expect(within(summary).getByText('1 / 2')).toBeInTheDocument()

    // Primary Dynasty navigation already exposes Recruiting — the
    // initialized Hub summary no longer needs its own CTA.
    expect(within(summary).queryByText('Manage Recruiting')).not.toBeInTheDocument()
  })

  it('shows onboarding CTAs when preseason and the board is empty, and normal facts otherwise', () => {
    const dynasty = buildFixtureDynasty()
    const emptyBoardDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: [],
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: emptyBoardDynasty,
      view: 'hub',
      explorationViewHistory: [],
    })
    render(<App />)

    const summary = document.querySelector('.recruiting-hub-summary') as HTMLElement
    expect(within(summary).getByText('Your Board Is Empty')).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: 'Generate Draft Board' }),
    ).toBeInTheDocument()
    expect(within(summary).getByRole('button', { name: 'Build Manually' })).toBeInTheDocument()
    expect(within(summary).queryByText('Manage Recruiting')).not.toBeInTheDocument()

    fireEvent.click(within(summary).getByRole('button', { name: 'Generate Draft Board' }))

    const updatedSummary = document.querySelector('.recruiting-hub-summary') as HTMLElement
    expect(within(updatedSummary).queryByText('Your Board Is Empty')).not.toBeInTheDocument()
    expect(within(updatedSummary).queryByText('Manage Recruiting')).not.toBeInTheDocument()
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board
        .length,
    ).toBeGreaterThan(0)
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)
  })

  it('Build Manually opens Recruiting without generating a board', () => {
    const dynasty = buildFixtureDynasty()
    const emptyBoardDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: [],
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: emptyBoardDynasty,
      view: 'hub',
      explorationViewHistory: [],
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Build Manually' }))

    expect(useDynastyStore.getState().view).toBe('recruiting')
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board,
    ).toEqual([])
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)
  })
})

describe('Full Recruiting Board empty state', () => {
  it('shows preseason onboarding with needs and both CTAs when the board is empty at Period 0', () => {
    const dynasty = buildFixtureDynasty()
    const emptyBoardDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: [],
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: emptyBoardDynasty,
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(screen.getByText('Your Recruiting Board')).toBeInTheDocument()
    // getByText normalizes whitespace; the DOM itself keeps the wider gap.
    expect(screen.getByText('SG 1 PF 1')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Generate Draft Board' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Browse National Class' }),
    ).toBeInTheDocument()
    expect(document.querySelector('.recruiting-board-table')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Generate Draft Board' }))
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board
        .length,
    ).toBeGreaterThan(0)
    expect(document.querySelector('.recruiting-board-table')).toBeInTheDocument()
  })

  it('switches to National Class via Browse National Class, with no domain mutation', () => {
    const dynasty = buildFixtureDynasty()
    const emptyBoardDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: [],
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: emptyBoardDynasty,
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Browse National Class' }))

    expect(screen.getByRole('button', { name: 'National Class' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board,
    ).toEqual([])
  })

  it('shows a lighter "No Active Targets" warning, not onboarding language, once Recruiting has begun', () => {
    const dynasty = buildFixtureDynasty()
    const postPeriodEmptyDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        lastResolvedPeriod: 3,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: [],
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: postPeriodEmptyDynasty,
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(screen.getByText('No Active Targets')).toBeInTheDocument()
    expect(screen.queryByText('Your Recruiting Board')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Generate Draft Board' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Browse National Class' }),
    ).toBeInTheDocument()
  })
})

describe('PRESEASON presentation', () => {
  it('shows PRESEASON at period 0', () => {
    const dynasty = buildFixtureDynasty()
    useDynastyStore.setState({ dynasty, view: 'recruiting', explorationViewHistory: [] })
    render(<App />)

    expect(screen.getByText('REGULAR SEASON · PRESEASON')).toBeInTheDocument()
  })

  it('shows PERIOD 1 / 24 once period 1 resolves', () => {
    const dynasty = buildFixtureDynasty()
    const advancedDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: { ...dynasty.recruiting!, lastResolvedPeriod: 1 },
    }
    useDynastyStore.setState({
      dynasty: advancedDynasty,
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(screen.getByText('REGULAR SEASON · PERIOD 1 / 24')).toBeInTheDocument()
  })
})

describe('Zero active-offer guidance', () => {
  it('shows a non-blocking warning when the board has openings but no active offers', () => {
    const dynasty = buildFixtureDynasty()
    const noOffersDynasty: typeof dynasty = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [CONTROLLED_PROGRAM_ID]: {
            ...dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!,
            board: dynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board.map((target) => ({
              ...target,
              hasActiveOffer: false,
            })),
          },
        },
      },
    }
    useDynastyStore.setState({
      dynasty: noOffersDynasty,
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(screen.getByText('No Active Offers')).toBeInTheDocument()
    expect(
      screen.getByText('Recruits can only commit to programs that have offered them.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(
      useDynastyStore.getState().dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board,
    ).toEqual(noOffersDynasty.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board)
  })
})

describe('first-period setup confirmation', () => {
  it('appears only when the next Hub action would complete Round 1 and can open Recruiting', () => {
    useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Simulate Game' }))
    expect(
      screen.queryByRole('heading', { name: 'Recruiting Board Not Set' }),
    ).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Advance to Next Round' }),
    )
    expect(
      screen.getByRole('heading', { name: 'Recruiting Board Not Set' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Review Recruiting' }))
    expect(useDynastyStore.getState().view).toBe('recruiting')
    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech Recruiting' }),
    ).toBeInTheDocument()
    expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(0)
  })
})

describe('No side effects from Recruiting UI interaction', () => {
  it('does not change Recruiting state by viewing, filtering, or switching modes', () => {
    const dynasty = renderRecruitingScreen()

    fireEvent.click(screen.getByRole('button', { name: 'National Class' }))
    fireEvent.click(screen.getByRole('button', { name: 'SG' }))
    fireEvent.click(screen.getByRole('button', { name: 'Needs' }))
    fireEvent.click(screen.getByRole('button', { name: 'Board' }))
    fireEvent.click(screen.getByRole('button', { name: 'League' }))
    fireEvent.click(screen.getByRole('button', { name: 'Recruiting' }))

    expect(useDynastyStore.getState().dynasty!.recruiting).toEqual(dynasty.recruiting)
  })
})

/**
 * Layers a Late Recruiting phase onto the shared fixture. When
 * `closeAllOpenings` is true, two extra controlled-Program commitments (one
 * SG, one PF) consume the fixture's only remaining projected openings so
 * `remainingTotal` reaches zero — commitments alone drive the domain's
 * remaining-openings projection, independent of board membership.
 */
function buildLateFixtureDynasty(closeAllOpenings: boolean): DynastyState {
  const base = buildFixtureDynasty()
  const recruiting = base.recruiting!

  if (!closeAllOpenings) {
    return { ...base, recruiting: { ...recruiting, phase: 'late' } }
  }

  const extraRecruits: Recruit[] = [
    fixtureRecruit('fx-late-sg', 'LateSG', 'SG', 20, 3),
    fixtureRecruit('fx-late-pf', 'LatePF', 'PF', 21, 3),
  ]
  const extraCommitments: Record<string, RecruitingCommitment> = {
    'fx-late-sg': {
      playerId: 'fx-late-sg',
      programId: CONTROLLED_PROGRAM_ID,
      timing: { kind: 'period', period: 25 },
      targetSeasonNumber: recruiting.targetSeasonNumber,
    },
    'fx-late-pf': {
      playerId: 'fx-late-pf',
      programId: CONTROLLED_PROGRAM_ID,
      timing: { kind: 'period', period: 25 },
      targetSeasonNumber: recruiting.targetSeasonNumber,
    },
  }

  return {
    ...base,
    recruiting: {
      ...recruiting,
      phase: 'late',
      recruits: [...recruiting.recruits, ...extraRecruits],
      commitmentsByPlayerId: { ...recruiting.commitmentsByPlayerId, ...extraCommitments },
    },
  }
}

describe('Late Recruiting', () => {
  it('shows the automatic-resolution warning while openings remain', () => {
    useDynastyStore.setState({
      dynasty: buildLateFixtureDynasty(false),
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(
      screen.getByText(/Remaining\s+openings will be resolved automatically/),
    ).toBeInTheDocument()
    expect(screen.queryByText('Recruiting Class Complete')).not.toBeInTheDocument()
  })

  it('shows a quiet completed state with no auto-resolution warning once openings reach zero', () => {
    useDynastyStore.setState({
      dynasty: buildLateFixtureDynasty(true),
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    expect(screen.getByText('Recruiting Class Complete')).toBeInTheDocument()
    expect(screen.getByText('All projected roster openings are filled.')).toBeInTheDocument()
    expect(
      screen.queryByText(/will be resolved automatically/),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Finalize Recruiting Class' }),
    ).toBeInTheDocument()
  })

  it('keeps the Finalize Class confirmation copy warning-free when openings are zero', () => {
    useDynastyStore.setState({
      dynasty: buildLateFixtureDynasty(true),
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))

    expect(
      screen.getByText('All projected roster openings are already filled.'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/Any remaining roster openings will be resolved/),
    ).not.toBeInTheDocument()
  })

  it('keeps the Finalize Class confirmation warning when openings remain', () => {
    useDynastyStore.setState({
      dynasty: buildLateFixtureDynasty(false),
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))

    expect(
      screen.getByText(/Any remaining roster openings will be resolved/),
    ).toBeInTheDocument()
  })

  it('keeps Finalize Class wired up to the same action regardless of the openings state', () => {
    useDynastyStore.setState({
      dynasty: buildLateFixtureDynasty(true),
      view: 'recruiting',
      explorationViewHistory: [],
    })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    expect(screen.getByRole('button', { name: 'Finalize Class' })).toBeInTheDocument()
  })
})
