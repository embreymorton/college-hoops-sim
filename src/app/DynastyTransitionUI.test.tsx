import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import {
  completeRounds,
  createRecruitingDynasty,
} from '../dynasty/recruiting/testSupport'
import {
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../dynasty'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function selectProgram(programId = CONTROLLED_PROGRAM_ID): void {
  useDynastyStore.getState().selectProgram(programId, DEFAULT_INTERACTIVE_TEST_SEED)
}

function championshipBoundary(): DynastyState {
  let dynasty = createRecruitingDynasty('dynasty-transition-ui-v0')
  const season = completeRounds(dynasty.activeSeason!)
  dynasty = syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season })

  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: 'dynasty-transition-ui-v0:postseason',
    })
  }
  return syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
}

beforeEach(resetStore)

describe('Season-complete handoff', () => {
  it('shows Continue to Late Recruiting without auto-transitioning, then advances on click', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('postseason')
    const continueButton = screen.getByRole('button', {
      name: 'Continue to Late Recruiting',
    })
    expect(continueButton).toBeInTheDocument()
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('postseason')

    fireEvent.click(continueButton)

    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('recruiting')
  })

  it('composes the Season Complete checkpoint inside the Tournament lifecycle column, not as an isolated full-width panel', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    const gameColumn = document.querySelector('.hub-primary-grid__game') as HTMLElement
    expect(gameColumn).not.toBeNull()
    expect(
      within(gameColumn).getByRole('button', { name: 'Continue to Late Recruiting' }),
    ).toBeInTheDocument()
    expect(within(gameColumn).getByText('Season Complete')).toBeInTheDocument()

    // Recruiting composes naturally alongside the checkpoint rather than as a detached sidebar.
    const recruitingColumn = document.querySelector(
      '.hub-primary-grid__recruiting',
    ) as HTMLElement
    expect(recruitingColumn).not.toBeNull()
    expect(
      within(recruitingColumn).getByText(/late recruiting is next/i),
    ).toBeInTheDocument()
  })

  it('does not show the Season Complete handoff or its Recruiting hint while the Tournament is still in progress', () => {
    selectProgram()
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().requestSuperSim('endOfRegularSeason')
    useDynastyStore.getState().confirmSuperSim()
    useDynastyStore.getState().dismissSuperSimSummary()
    useDynastyStore.getState().enterPostseason()
    render(<App />)

    expect(
      screen.queryByRole('button', { name: 'Continue to Late Recruiting' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Season Complete')).not.toBeInTheDocument()
    expect(screen.queryByText(/late recruiting is next/i)).not.toBeInTheDocument()
  })

  it('remains recoverable after navigating through League, Coaching, and Recruiting', () => {
    const boundary = championshipBoundary()
    const controlledRotation =
      boundary.activePostseason!.programStates[CONTROLLED_PROGRAM_ID]!.rotation
    useDynastyStore.setState({
      dynasty: boundary,
      postseasonControlledDefaultRotation: controlledRotation,
      postseasonDraftRotation: controlledRotation,
      view: 'postseasonHub',
    })
    render(<App />)

    expect(
      screen.getByRole('button', { name: 'Continue to Late Recruiting' }),
    ).toBeInTheDocument()

    for (const section of ['League', 'Coaching', 'Recruiting']) {
      fireEvent.click(screen.getByRole('button', { name: section }))
      expect(useDynastyStore.getState().dynasty).toBe(boundary)
      expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(
        boundary.activePostseason,
      )

      fireEvent.click(screen.getByRole('button', { name: 'Tournament' }))
      expect(
        screen.getByRole('button', { name: 'Continue to Late Recruiting' }),
      ).toBeInTheDocument()
    }

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to Late Recruiting' }),
    )
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('recruiting')
  })

  it('keeps the Late Recruiting progression control available after viewing the final regular season', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'View Final Regular Season' }))

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.dynasty).toBe(boundary)
    expect(state.dynasty!.activePostseason).toBe(boundary.activePostseason)
    expect(state.dynasty!.recruiting!.phase).toBe('postseason')
    expect(
      screen.getByRole('button', { name: 'Continue to Late Recruiting' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to Late Recruiting' }),
    )
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('recruiting')
  })
})

describe('Late Recruiting presentation', () => {
  it('shows the Late Recruiting banner with needs, board, and a Finalize CTA', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))

    expect(screen.getByText('Late Recruiting — Final Signing Window')).toBeInTheDocument()
    expect(document.querySelector('.recruiting-overview')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Finalize Recruiting Class' }),
    ).toBeInTheDocument()
  })
})

describe('Recruiting finalization', () => {
  function enterLateRecruiting(): void {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))
  }

  it('requires confirmation and leaves the Dynasty unchanged on Cancel', () => {
    enterLateRecruiting()
    const beforeFinalize = useDynastyStore.getState().dynasty!

    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    expect(screen.getByRole('heading', { name: 'Finalize Recruiting Class?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Finalize Recruiting Class?' })).not.toBeInTheDocument()
    expect(useDynastyStore.getState().dynasty).toBe(beforeFinalize)
  })

  it('confirming invokes finalization and shows the class summary without starting Offseason', () => {
    enterLateRecruiting()

    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)

    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('finalized')
    expect(useDynastyStore.getState().dynasty!.offseason).toBeNull()
    expect(screen.getByText('Recruiting Class Complete')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
  })

  it('keeps the canonical Begin Offseason action recoverable through League navigation', () => {
    enterLateRecruiting()
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)

    const finalizedDynasty = useDynastyStore.getState().dynasty
    fireEvent.click(screen.getByRole('button', { name: 'League' }))
    expect(useDynastyStore.getState().dynasty).toBe(finalizedDynasty)

    fireEvent.click(screen.getByRole('button', { name: 'Recruiting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))

    expect(useDynastyStore.getState().view).toBe('offseason')
    expect(useDynastyStore.getState().dynasty!.offseason).not.toBeNull()
    expect(useDynastyStore.getState().dynasty!.activePostseason).toBeNull()
  })
})

describe('Recruiting Class Complete summary', () => {
  it('renders canonical signees with rank, position, stars, ovr, and pot', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)

    const finalized = useDynastyStore.getState().dynasty!.recruiting!
    const signedCount = Object.values(finalized.commitmentsByPlayerId).filter(
      (commitment) => commitment.programId === CONTROLLED_PROGRAM_ID,
    ).length

    const table = document.querySelector('.recruiting-class-summary__table')
    if (signedCount === 0) {
      expect(table).not.toBeInTheDocument()
    } else {
      expect(within(table as HTMLElement).getAllByRole('row')).toHaveLength(signedCount + 1)
    }
  })
})

describe('Offseason', () => {
  function reachOffseason(): void {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
  }

  it('renders departures, development, incoming class, and next roster from canonical Offseason data', () => {
    reachOffseason()

    expect(useDynastyStore.getState().view).toBe('offseason')
    expect(screen.getByRole('heading', { name: 'Departures' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Player Development' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Incoming Class' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Next Season Roster' })).toBeInTheDocument()

    const offseason = useDynastyStore.getState().dynasty!.offseason!
    expect(
      screen.getByRole('button', { name: `Begin Season ${offseason.targetSeasonNumber}` }),
    ).toBeInTheDocument()
  })
})

describe('Begin next Season', () => {
  it('rolls over to the normal Season Hub with a fresh roster and Recruiting cycle', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))

    const targetSeasonNumber = useDynastyStore.getState().dynasty!.offseason!.targetSeasonNumber
    fireEvent.click(
      screen.getByRole('button', { name: `Begin Season ${targetSeasonNumber}` }),
    )

    const state = useDynastyStore.getState()
    expect(state.view).toBe('hub')
    expect(state.dynasty!.activeSeason!.seasonNumber).toBe(targetSeasonNumber)
    expect(state.dynasty!.offseason).toBeNull()
    expect(state.dynasty!.recruiting!.lastResolvedPeriod).toBe(0)
    expect(
      state.dynasty!.recruiting!.programs[CONTROLLED_PROGRAM_ID]!.board,
    ).toEqual([])
  })
})
