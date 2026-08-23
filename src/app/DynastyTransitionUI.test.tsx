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

function championshipBoundary(syncPostseasonRecruiting = true): DynastyState {
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
  const boundary = {
    ...dynasty,
    activePostseason: postseason,
  }
  return syncPostseasonRecruiting
    ? syncRecruitingThroughCompletedPostseasonRounds(boundary)
    : boundary
}

beforeEach(resetStore)

describe('Season-complete handoff', () => {
  it('shows the shared progression action without auto-transitioning, then advances on click', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('postseason')
    const continueButton = screen.getByRole('button', {
      name: 'Begin Offseason',
    })
    expect(continueButton).toBeInTheDocument()
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('postseason')

    fireEvent.click(continueButton)

    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('offseason')
  })

  it('places exactly one shared Season Complete bar below Tournament navigation', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    const sectionNav = screen.getByRole('group', { name: 'Section' })
    const progressionBar = screen.getByRole('complementary', {
      name: 'Dynasty progression',
    })
    expect(
      sectionNav.compareDocumentPosition(progressionBar) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Begin Offseason' }),
    ).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: 'Continue to Late Recruiting' }),
    ).not.toBeInTheDocument()

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
      screen.queryByRole('button', { name: 'Begin Offseason' }),
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
      screen.getByRole('button', { name: 'Begin Offseason' }),
    ).toBeInTheDocument()

    for (const section of ['League', 'Coaching', 'Recruiting']) {
      fireEvent.click(screen.getByRole('button', { name: section }))
      expect(useDynastyStore.getState().dynasty).toBe(boundary)
      expect(useDynastyStore.getState().dynasty!.activePostseason).toBe(
        boundary.activePostseason,
      )

      expect(screen.getByRole('button', {
        name: 'Begin Offseason',
      })).toBeInTheDocument()
      const sectionNav = screen.getByRole('group', { name: 'Section' })
      const progressionBar = screen.getByRole('complementary', {
        name: 'Dynasty progression',
      })
      expect(
        sectionNav.compareDocumentPosition(progressionBar) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()

      fireEvent.click(screen.getByRole('button', { name: 'Tournament' }))
      expect(
        screen.getByRole('button', { name: 'Begin Offseason' }),
      ).toBeInTheDocument()
    }

    fireEvent.click(
      screen.getByRole('button', { name: 'Begin Offseason' }),
    )
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('offseason')
    expect(screen.queryByRole('button', { name: 'Begin Offseason' })).not.toBeInTheDocument()
  })

  it('reconstructs the canonical handoff after Tournament → League → Tournament even if Recruiting synchronization lagged', () => {
    const boundary = championshipBoundary()
    const lagged = {
      ...boundary,
      recruiting: {
        ...boundary.recruiting!,
        phase: 'postseason' as const,
        lastResolvedPeriod: 27,
      },
    }
    useDynastyStore.setState({ dynasty: lagged, view: 'postseasonHub' })
    render(<App />)

    expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
    for (let pass = 0; pass < 2; pass += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'League' }))
      expect(useDynastyStore.getState().dynasty!.recruiting!.lastResolvedPeriod).toBe(27)
      fireEvent.click(screen.getByRole('button', { name: 'Tournament' }))
      expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
    expect(useDynastyStore.getState().dynasty!.recruiting).toMatchObject({
      phase: 'late',
      lastResolvedPeriod: 28,
    })
    expect(useDynastyStore.getState().view).toBe('offseason')
    useDynastyStore.getState().enterLateRecruiting()
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
  })

  it('keeps the screenshot-state handoff actionable from Period 24 through navigation', () => {
    const lagged = championshipBoundary(false)
    const nonQualifier = Object.keys(lagged.activeSeason!.programStates).find(
      (programId) => !lagged.activePostseason!.field.some((entry) => entry.programId === programId),
    )!
    const screenshotState = { ...lagged, controlledProgramId: nonQualifier }
    const before = structuredClone(screenshotState)
    useDynastyStore.setState({ dynasty: screenshotState, view: 'postseasonHub' })
    render(<App />)

    expect(screen.getByText('Tournament complete. Continue when you are ready.')).toBeInTheDocument()
    expect(screen.getByText(/late recruiting is next/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
    const tournamentSummary = document.querySelector('.season-header') as HTMLElement
    expect(within(tournamentSummary).getByText('Finish')).toBeInTheDocument()
    expect(within(tournamentSummary).getByText('Did Not Qualify')).toBeInTheDocument()
    expect(
      screen.queryByText(/did not qualify this season/i),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'League' }))
    expect(useDynastyStore.getState().dynasty).toEqual(before)
    const shellAction = screen.getByRole('button', { name: 'Begin Offseason' })
    expect(shellAction).toBeInTheDocument()

    fireEvent.click(shellAction)
    expect(useDynastyStore.getState().dynasty!.recruiting).toMatchObject({
      phase: 'late',
      lastResolvedPeriod: 28,
    })
    expect(useDynastyStore.getState().view).toBe('offseason')
    expect(screen.queryByRole('button', { name: 'Begin Offseason' })).not.toBeInTheDocument()
  })

  it('renders the canonical championship recap regardless of session game history and reuses box-score navigation', () => {
    const boundary = championshipBoundary()
    const postseason = boundary.activePostseason!
    const final = postseason.bracket.games.find(({ round }) => round === 'championship')!
    const finalResult = postseason.resultsByGameId[final.id]!
    const championName = boundary.universe.programs.find(
      ({ id }) => id === finalResult.winnerId,
    )!.name
    const earlierGame = postseason.bracket.games.find(
      ({ round }) => round === 'round-of-16',
    )!
    useDynastyStore.setState({
      dynasty: boundary,
      view: 'postseasonHub',
      lastPlayedTournamentGameId: earlierGame.id,
    })
    const rendered = render(<App />)

    const recap = screen.getByText('National Championship').closest(
      '.national-championship-recap',
    ) as HTMLElement
    expect(recap).not.toBeNull()
    expect(recap).toHaveTextContent(`${championName} is your National Champion.`)
    expect(recap).toHaveTextContent(String(finalResult.homeScore))
    expect(recap).toHaveTextContent(String(finalResult.awayScore))
    const recapText = recap.textContent

    useDynastyStore.setState({ lastPlayedTournamentGameId: final.id })
    rendered.rerender(<App />)
    expect(
      screen.getByText('National Championship').closest(
        '.national-championship-recap',
      ),
    ).toHaveTextContent(recapText!)

    const before = useDynastyStore.getState().dynasty
    fireEvent.click(screen.getByRole('button', { name: 'View Box Score' }))
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'postseasonGameHistory',
      viewedTournamentGameId: final.id,
    })
    expect(useDynastyStore.getState().dynasty).toBe(before)
    expect(screen.getByRole('heading', { name: 'Player Box Score' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Tournament Hub' }))
    expect(useDynastyStore.getState().view).toBe('postseasonHub')
    expect(screen.getByText('National Championship')).toBeInTheDocument()
  })

  it('keeps the route-independent progression fallback on Team and Player Details', () => {
    const boundary = championshipBoundary()
    const team = boundary.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team
    const player = team.roster[0]!
    useDynastyStore.setState({
      dynasty: boundary,
      view: 'teamDetails',
      selectedTeamProgramId: CONTROLLED_PROGRAM_ID,
      explorationViewHistory: ['league'],
    })
    const rendered = render(<App />)

    expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
    useDynastyStore.setState({
      view: 'playerDetails',
      selectedPlayerProgramId: CONTROLLED_PROGRAM_ID,
      selectedPlayerId: player.id,
      explorationViewHistory: ['league', 'teamDetails'],
    })
    rendered.rerender(<App />)
    expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()

    for (const view of ['history', 'seasonYearbook'] as const) {
      useDynastyStore.setState({
        view,
        selectedArchivedSeasonNumber: null,
        explorationViewHistory: ['league'],
      })
      rendered.rerender(<App />)
      expect(screen.getByRole('button', { name: 'Begin Offseason' })).toBeInTheDocument()
    }
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
      screen.getByRole('button', { name: 'Begin Offseason' }),
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Begin Offseason' }),
    )
    expect(useDynastyStore.getState().dynasty!.recruiting!.phase).toBe('late')
    expect(useDynastyStore.getState().view).toBe('offseason')
  })
})

describe('Late Recruiting presentation', () => {
  it('shows the compact needs/board snapshot and a Finalize CTA in the Offseason header', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
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
    expect(screen.getByRole('heading', { name: 'Recruiting Class' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to Departures' })).toBeInTheDocument()
  })

  it('keeps the canonical Begin Offseason action recoverable through League navigation', () => {
    enterLateRecruiting()
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)

    const finalizedDynasty = useDynastyStore.getState().dynasty
    fireEvent.click(screen.getByRole('button', { name: 'View League' }))
    expect(useDynastyStore.getState().dynasty).toBe(finalizedDynasty)

    fireEvent.click(screen.getByRole('button', { name: 'Return to Offseason' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Departures' }))

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
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Departures' }))
  }

  it('renders departures, development, incoming class, and next roster from canonical Offseason data', () => {
    reachOffseason()

    expect(useDynastyStore.getState().view).toBe('offseason')
    expect(screen.getByRole('heading', { name: 'Departures' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue to Development' })).toBeInTheDocument()
    expect(screen.getAllByText(/\d+ seasons? with Charlotte Tech · \d+\.\d PPG · \d+\.\d RPG · \d+\.\d APG · Peak \d+ OVR/).length).toBeGreaterThan(1)

    fireEvent.click(screen.getByRole('button', { name: 'Continue to Development' }))
    expect(screen.getByRole('heading', { name: 'Development' })).toBeInTheDocument()
    expect(screen.getByLabelText('Biggest Leap')).toHaveTextContent(/OVR \(\+\d+\)/)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Roster Review' }))
    expect(screen.getByRole('heading', { name: 'Roster Review' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Incoming Class' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Season 2 Roster/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ready for Season' })).toBeInTheDocument()
  })
})

describe('Begin next Season', () => {
  it('rolls over to the normal Season Hub with a fresh roster and Recruiting cycle', () => {
    const boundary = championshipBoundary()
    useDynastyStore.setState({ dynasty: boundary, view: 'postseasonHub' })
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Begin Offseason' }))
    fireEvent.click(screen.getByRole('button', { name: 'Finalize Recruiting Class' }))
    fireEvent.click(screen.getByRole('alertdialog').querySelector('.button--primary') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Departures' }))

    const targetSeasonNumber = useDynastyStore.getState().dynasty!.offseason!.targetSeasonNumber
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Development' }))
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Roster Review' }))
    fireEvent.click(screen.getByRole('button', { name: 'Ready for Season' }))
    fireEvent.click(screen.getByRole('button', { name: `Start Season ${targetSeasonNumber}` }))

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
