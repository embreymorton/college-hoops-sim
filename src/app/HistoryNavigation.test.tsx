import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  beginOffseason,
  deriveCompletedSeasonIndex,
  deriveCompletedSeasonYearbook,
  type CompletedSeasonArchive,
} from '../dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'
import { completeRounds, createRecruitingDynasty } from '../dynasty/recruiting/testSupport'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
let archive: CompletedSeasonArchive

beforeAll(() => {
  const source = createRecruitingDynasty('history-navigation-archive')
  const season = completeRounds(source.activeSeason!)
  let postseason = initializePostseason({ universe: source.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `history-navigation-${round}`,
    })
  }
  archive = beginOffseason({
    ...source,
    activeSeason: season,
    activePostseason: postseason,
  }).history[0]!
})

function resetAndSelect(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore.getState().selectProgram(
    CONTROLLED_PROGRAM_ID,
    DEFAULT_INTERACTIVE_TEST_SEED,
  )
}

function setHistory(history: readonly CompletedSeasonArchive[]): void {
  const dynasty = useDynastyStore.getState().dynasty!
  useDynastyStore.setState({ dynasty: { ...dynasty, history } })
}

function seasonTwoArchive(): CompletedSeasonArchive {
  return {
    ...structuredClone(archive),
    seasonNumber: 2,
    season: { ...structuredClone(archive.season), seasonNumber: 2 },
  }
}

beforeEach(() => {
  resetAndSelect()
})

describe('History store navigation', () => {
  it('opens fresh History from the current League tab and clears stale selection', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('leaders')
    useDynastyStore.setState({ selectedArchivedSeasonNumber: 44 })

    useDynastyStore.getState().openHistory()

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'history',
      leagueTab: 'leaders',
      selectedArchivedSeasonNumber: null,
      explorationViewHistory: ['hub', 'league'],
    })
  })

  it('opens a valid Season and unwinds Yearbook → History → originating League tab', () => {
    setHistory([archive])
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('following')
    useDynastyStore.getState().openHistory()
    useDynastyStore.getState().openArchivedSeason(1)

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'seasonYearbook',
      selectedArchivedSeasonNumber: 1,
      explorationViewHistory: ['hub', 'league', 'history'],
    })

    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState().view).toBe('history')
    useDynastyStore.getState().goBackFromExploration()
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'league',
      leagueTab: 'following',
    })
  })

  it('recovers invalid selection and clears History state on primary navigation or Dynasty reset', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().openHistory()
    useDynastyStore.getState().openArchivedSeason(99)
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'history',
      selectedArchivedSeasonNumber: null,
    })

    useDynastyStore.setState({ selectedArchivedSeasonNumber: 1 })
    useDynastyStore.getState().goToHub()
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'hub',
      selectedArchivedSeasonNumber: null,
      explorationViewHistory: [],
    })

    useDynastyStore.setState({ selectedArchivedSeasonNumber: 1 })
    useDynastyStore.getState().selectProgram('northbridge', DEFAULT_INTERACTIVE_TEST_SEED)
    expect(useDynastyStore.getState().selectedArchivedSeasonNumber).toBeNull()
  })
})

describe('League History entry and index', () => {
  it('keeps exactly four League tabs and presents History as a separate action', () => {
    useDynastyStore.getState().goToLeague()
    render(<App />)

    const tabs = within(screen.getByRole('group', { name: 'League section' }))
      .getAllByRole('button')
    expect(tabs.map((button) => button.textContent)).toEqual([
      'News',
      'Leaders',
      'Teams',
      'Following',
    ])
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
    expect(tabs).not.toContain(screen.getByRole('button', { name: 'History' }))
  })

  it('opens from a representative League tab and shows the zero-history state', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('leaders')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText(/completed seasons will appear here after/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))
    expect(screen.getByRole('button', { name: 'Leaders' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders canonical summaries newest-first and opens the intended Season', () => {
    const second = seasonTwoArchive()
    setHistory([archive, second])
    const expected = deriveCompletedSeasonIndex(useDynastyStore.getState().dynasty!)
    useDynastyStore.getState().goToLeague()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    const entries = screen.getAllByRole('button', { name: /Season [12]/ })
    expect(entries[0]).toHaveTextContent(`Season ${expected[0]!.seasonNumber}`)
    expect(entries[0]).toHaveTextContent(`Champion: ${expected[0]!.nationalChampion.name}`)
    expect(entries[0]).toHaveTextContent(
      `Your Program: ${expected[0]!.controlledProgramRecord.wins}-${expected[0]!.controlledProgramRecord.losses}`,
    )

    fireEvent.click(screen.getByRole('button', { name: /Season 1/ }))
    expect(screen.getByRole('heading', { name: 'Season 1 Yearbook' })).toBeInTheDocument()
  })
})

describe('Yearbook shell', () => {
  it('shows projection-derived headlines and returns to History', () => {
    setHistory([archive])
    const expected = deriveCompletedSeasonYearbook(useDynastyStore.getState().dynasty!, 1)
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().openHistory()
    useDynastyStore.getState().openArchivedSeason(1)
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Season 1 Yearbook' })).toBeInTheDocument()
    expect(screen.getByText(`National Champion: ${expected.championship.nationalChampion.name}`))
      .toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Your Program: ${expected.controlledProgramSeason.program.name}`)))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Back to History' }))
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
  })

  it('offers safe recovery when transient selection is stale', () => {
    setHistory([archive])
    useDynastyStore.setState({
      view: 'seasonYearbook',
      selectedArchivedSeasonNumber: 99,
      explorationViewHistory: ['league', 'history'],
    })
    render(<App />)

    expect(screen.getByRole('heading', { name: 'Yearbook unavailable' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Return to History' }))
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'history',
      selectedArchivedSeasonNumber: null,
      explorationViewHistory: ['league'],
    })
  })
})
