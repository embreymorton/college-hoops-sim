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
import { useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
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
})

describe('Late Recruiting presentation', () => {
  it('shows the Late Recruiting banner with needs, board, and a Finalize CTA', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Late Recruiting' }))

    expect(screen.getByText('Late Recruiting — Final Signing Window')).toBeInTheDocument()
    expect(document.querySelector('.recruiting-needs__table')).toBeInTheDocument()
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
