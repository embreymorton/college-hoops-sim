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
  it('presents History as the fifth first-class League tab', () => {
    useDynastyStore.getState().goToLeague()
    render(<App />)

    const tabs = within(screen.getByRole('group', { name: 'League section' }))
      .getAllByRole('button')
    expect(tabs.map((button) => button.textContent)).toEqual([
      'News',
      'Leaders',
      'Teams',
      'Following',
      'History',
    ])
    expect(tabs).toContain(screen.getByRole('button', { name: 'History' }))
  })

  it('opens from a representative League tab and shows the zero-history state', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('leaders')
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'History' }))

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()
    expect(screen.getByText(/completed seasons will appear here after/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Yearbooks' })).toHaveAttribute('aria-pressed', 'true')
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
    expect(screen.getByText('Season 1 · Completed')).toBeInTheDocument()
  })

  it('preserves Records selectors through former Player Details and Back', () => {
    setHistory([archive])
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('records')
    useDynastyStore.getState().setRecordCategory('assists')
    render(<App />)

    const table = screen.getByRole('table', { name: /top ten career ast records/i })
    fireEvent.click(within(table).getAllByRole('button')[0]!)
    expect(screen.getByText(/former player/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Career' }))
    fireEvent.click(within(screen.getByRole('group', { name: 'Career statistical context' })).getByRole('button', { name: 'Tournament' }))
    expect(screen.getByRole('heading', { name: 'Tournament Legacy' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))

    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Records' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: 'Statistical category' })).getByRole('button', { name: 'AST' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('opens an active record Player in normal Player Details', () => {
    setHistory([archive])
    const current = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({ dynasty: { ...current, activeSeason: { ...structuredClone(archive.season), seasonNumber: 2 } } })
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('records')
    render(<App />)

    const table = screen.getByRole('table', { name: /top ten single game pts records/i })
    fireEvent.click(within(table).getAllByRole('button')[0]!)
    expect(screen.queryByText('Former Player')).not.toBeInTheDocument()
    expect(document.querySelector('.season-header__name')).toBeInTheDocument()
  })

  it('shows all three record scopes together and changes them with one category control', () => {
    setHistory([archive])
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('records')
    render(<App />)

    expect(screen.getByRole('group', { name: 'Record scope' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten single game pts records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten single season ppg records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten career pts records/i })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('group', { name: 'Statistical category' })).getByRole('button', { name: 'BLK' }))
    expect(screen.getByRole('table', { name: /top ten single game blk records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten single season bpg records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten career blk records/i })).toBeInTheDocument()

    fireEvent.click(within(screen.getByRole('group', { name: 'Record scope' })).getByRole('button', { name: 'Tournament' }))
    expect(screen.getByRole('table', { name: /top ten single game blk records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten tournament run blk records/i })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /top ten career blk records/i })).toBeInTheDocument()
  })

  it('renders a clean empty state in all three record panels', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('records')
    render(<App />)

    expect(screen.getAllByText('No completed Season records yet.')).toHaveLength(3)
    expect(screen.queryByRole('table', { name: /records/i })).not.toBeInTheDocument()
  })

  it('marks active Single Season entries Live while completed entries remain final', () => {
    setHistory([archive])
    const current = useDynastyStore.getState().dynasty!
    const activeSeason = structuredClone(archive.season)
    const game = activeSeason.schedule.games[0]!
    const result = structuredClone(activeSeason.resultsByGameId[game.id]!)
    result.homePlayerStats.find(({ minutes }) => minutes > 0)!.points = 999
    useDynastyStore.setState({
      dynasty: {
        ...current,
        activeSeason: {
          ...activeSeason,
          seasonNumber: 2,
          resultsByGameId: { [game.id]: result },
        },
      },
    })
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('records')
    render(<App />)

    const seasonTable = screen.getByRole('table', { name: /top ten single season ppg records/i })
    const liveRow = within(seasonTable).getAllByText('Live')[0]!.closest('tr')!
    expect(liveRow).toHaveTextContent('S2 · 1 GP')
    const completedRow = within(seasonTable).getAllByRole('row').find((row) => row.textContent?.includes('S1'))!
    expect(within(completedRow).queryByText('Live')).not.toBeInTheDocument()
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

    expect(screen.getByRole('heading', { name: expected.championship.nationalChampion.name }))
      .toBeInTheDocument()
    expect(screen.getByText(expected.controlledProgramSeason.program.name, { selector: '.eyebrow-tag' }))
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

describe('Core Yearbook UI', () => {
  function renderYearbook(programId: string) {
    setHistory([archive])
    const dynasty = useDynastyStore.getState().dynasty!
    const historicalDynasty = { ...dynasty, controlledProgramId: programId }
    useDynastyStore.setState({
      dynasty: historicalDynasty,
      view: 'seasonYearbook',
      selectedArchivedSeasonNumber: 1,
      explorationViewHistory: ['league', 'history'],
    })
    const expected = deriveCompletedSeasonYearbook(historicalDynasty, 1)
    const rendered = render(<App />)
    return { expected, rendered }
  }

  it('makes the Champion, opponent, championship score, and controlled Season prominent', () => {
    const { expected } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const titleGame = expected.championship.game

    expect(screen.getByRole('heading', { name: expected.championship.nationalChampion.name }))
      .toBeInTheDocument()
    expect(screen.getByText(new RegExp(
      `National Champion.*${expected.championship.runnerUp.name}`,
    ))).toHaveTextContent(String(titleGame.result.homeScore))
    const yourSeason = screen.getByRole('heading', { name: 'Your Season' }).closest('section')!
    expect(within(yourSeason).getByText(`${expected.controlledProgramSeason.overallRecord.wins}-${expected.controlledProgramSeason.overallRecord.losses}`, { selector: '.stat-trio__value' }))
      .toBeInTheDocument()
    expect(within(yourSeason).getByText(`${expected.controlledProgramSeason.conferenceRecord.wins}-${expected.controlledProgramSeason.conferenceRecord.losses}`, { selector: '.stat-trio__value' }))
      .toBeInTheDocument()
    expect(within(yourSeason).getByText(`${expected.controlledProgramSeason.conferencePlace}${
      expected.controlledProgramSeason.conferencePlace === 1 ? 'st' :
      expected.controlledProgramSeason.conferencePlace === 2 ? 'nd' :
      expected.controlledProgramSeason.conferencePlace === 3 ? 'rd' : 'th'
    }`)).toBeInTheDocument()
  })

  it('presents non-qualification normally and omits a Tournament run', () => {
    const missedId = archive.season.programStates && Object.keys(archive.season.programStates).find(
      (programId) => !archive.postseason.field.some((entry) => entry.programId === programId),
    )!
    renderYearbook(missedId)

    expect(screen.getByText('Did Not Qualify')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Your Tournament Run' })).not.toBeInTheDocument()
  })

  it('handles eliminated and National Champion outcomes with canonical seed/bid context', () => {
    const championId = archive.postseason.resultsByGameId[
      archive.postseason.bracket.games.find(({ round }) => round === 'championship')!.id
    ]!.winnerId
    const eliminatedId = archive.postseason.field.find(({ programId }) => {
      if (programId === championId) return false
      const projection = deriveCompletedSeasonYearbook(
        { ...useDynastyStore.getState().dynasty!, history: [archive], controlledProgramId: programId },
        1,
      )
      return projection.controlledProgramSeason.tournamentOutcome.status === 'eliminated'
    })!.programId

    const eliminatedRender = renderYearbook(eliminatedId)
    const eliminated = eliminatedRender.expected.controlledProgramSeason
    expect(screen.getByText(new RegExp(`#${eliminated.tournamentOutcome.status === 'eliminated' ? eliminated.tournamentOutcome.seed : ''} Seed`)))
      .toBeInTheDocument()

    eliminatedRender.rendered.unmount()
    useDynastyStore.setState(useDynastyStore.getInitialState())
    resetAndSelect()
    const champion = renderYearbook(championId).expected.controlledProgramSeason
    expect(screen.getByText('National Champion', { selector: '.stat-trio__value--text' }))
      .toBeInTheDocument()
    expect(champion.tournamentOutcome.status).toBe('national-champion')
  })

  it('renders the controlled Tournament run in round order with opponent, scores, and W/L', () => {
    const participantId = archive.postseason.field[0]!.programId
    const { expected } = renderYearbook(participantId)
    const run = screen.getByRole('region', { name: 'Your Tournament Run' })
    const games = within(run).getAllByRole('listitem')

    expect(games).toHaveLength(expected.controlledProgramSeason.tournamentGames.length)
    expected.controlledProgramSeason.tournamentGames.forEach((game, index) => {
      expect(games[index]).toHaveTextContent(game.opponent.name)
      expect(games[index]).toHaveTextContent(game.resultForControlledProgram === 'win' ? 'W' : 'L')
      expect(games[index]).toHaveTextContent(String(game.result.homeScore))
      expect(games[index]).toHaveTextContent(String(game.result.awayScore))
    })
  })

  it('renders all 15 resolved Tournament games as a read-only bracket', () => {
    const { expected, rendered } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const bracket = screen.getByRole('region', { name: 'Archived Tournament Bracket' })
    const gameSlots = rendered.container.querySelectorAll('[data-game-id]')

    expect(gameSlots).toHaveLength(expected.tournament.games.length)
    expect(gameSlots).toHaveLength(15)
    expect(within(bracket).queryAllByRole('button')).toHaveLength(0)
    expect(bracket).toHaveTextContent(expected.championship.nationalChampion.name)
    expect(bracket).toHaveTextContent(expected.championship.runnerUp.name)
  })

  it('defaults standings to the controlled Program conference, switches via tabs, and preserves canonical rows/highlighting', () => {
    const { expected, rendered } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const standingsCard = screen.getByRole('heading', { name: 'Final Standings' }).closest('article')!
    const controlled = expected.controlledProgramSeason
    const defaultConference = expected.conferenceStandings.find(
      ({ conference }) => conference.id === controlled.program.conferenceId,
    )!

    const renderedProgramNames = () =>
      Array.from(standingsCard.querySelectorAll('tbody tr td:nth-child(2)'))
        .map((cell) => cell.textContent?.replace(' · You', ''))

    expect(renderedProgramNames()).toEqual(defaultConference.rows.map((row) => row.program.name))
    expect(rendered.container.querySelectorAll('tr[data-controlled="true"]')).toHaveLength(1)
    expect(within(standingsCard).getByText(/· You/)).toBeInTheDocument()
    // One standings table, one leaderboard, and the condensed All-America table.
    expect(screen.getAllByRole('table')).toHaveLength(3)

    for (const { conference, rows } of expected.conferenceStandings) {
      fireEvent.click(within(standingsCard).getByRole('button', {
        name: conference.name.replace(/ Conference$/, ''),
      }))

      expect(renderedProgramNames()).toEqual(rows.map((row) => row.program.name))
      const isControlledHere = rows.some(
        (row) => row.program.programId === controlled.program.programId,
      )
      expect(rendered.container.querySelectorAll('tr[data-controlled="true"]')).toHaveLength(
        isControlledHere ? 1 : 0,
      )
    }
  })

  it('keeps Yearbook Awards to national majors and a compact All-America summary', () => {
    renderYearbook(CONTROLLED_PROGRAM_ID)
    const awardsSection = screen.getByRole('heading', { name: 'Awards & Honors' }).closest('section')!

    expect(within(awardsSection).getByText('National Player of the Year')).toBeInTheDocument()
    expect(within(awardsSection).getByText('National Freshman of the Year')).toBeInTheDocument()
    expect(within(awardsSection).getByText('Tournament Most Outstanding Player')).toBeInTheDocument()
    expect(within(awardsSection).getByRole('table', { name: 'First Team All-America' }).querySelectorAll('tbody tr')).toHaveLength(5)
    expect(within(awardsSection).queryByRole('heading', { name: 'Conference Honors' })).not.toBeInTheDocument()
    expect(within(awardsSection).queryByRole('group', { name: 'Conference' })).not.toBeInTheDocument()
  })

  it('defaults leaders to Scoring/PPG, switches categories via tabs, and preserves national and controlled Player IDs', () => {
    const { expected, rendered } = renderYearbook(CONTROLLED_PROGRAM_ID)

    expect(screen.getByRole('heading', { name: 'Season Around the League' })).toBeInTheDocument()
    expect(screen.getByText('Regular season only.')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Your Team Leaders' })).toBeInTheDocument()

    const leadersCard = screen.getByRole('heading', { name: 'Statistical Leaders' }).closest('article')!
    expect(within(leadersCard).getByRole('button', { name: 'PPG' })).toHaveAttribute('aria-pressed', 'true')

    const unitByCategory = {
      points: 'PPG', rebounds: 'RPG', assists: 'APG', steals: 'SPG', blocks: 'BPG',
    } as const

    for (const category of ['points', 'rebounds', 'assists', 'steals', 'blocks'] as const) {
      fireEvent.click(within(leadersCard).getByRole('button', { name: unitByCategory[category] }))

      const national = expected.statisticalLeaders.national[category][0]!
      const controlled = expected.statisticalLeaders.controlledProgram[category][0]!
      expect(within(leadersCard).getByText(`${national.player.firstName} ${national.player.lastName}`))
        .toBeInTheDocument()
      expect(rendered.container.querySelector(`[data-player-id="${national.player.playerId}"]`))
        .not.toBeNull()
      expect(rendered.container.querySelector(`[data-player-id="${controlled.player.playerId}"]`))
        .not.toBeNull()

      // Only the selected leaderboard is presented at a time.
      expect(within(leadersCard).getAllByRole('table')).toHaveLength(1)
      expect(within(leadersCard).getByRole('columnheader', { name: unitByCategory[category] }))
        .toBeInTheDocument()
    }
  })

  it('orders sections Champion → Your Season → Season Around the League → National Tournament', () => {
    const { rendered } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const headings = Array.from(rendered.container.querySelectorAll('h1, h2')).map(
      (el) => el.textContent,
    )
    const yourSeasonIndex = headings.indexOf('Your Season')
    const leagueIndex = headings.indexOf('Season Around the League')
    const tournamentIndex = headings.indexOf('National Tournament')

    expect(yourSeasonIndex).toBeGreaterThan(0)
    expect(leagueIndex).toBeGreaterThan(yourSeasonIndex)
    expect(tournamentIndex).toBeGreaterThan(leagueIndex)
  })

  it('opens a national leader as a former Player and restores the same Yearbook on Back', () => {
    const { expected } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const leader = expected.statisticalLeaders.national.points[0]!
    const leaderName = `${leader.player.firstName} ${leader.player.lastName}`
    const scoringBoard = screen.getByRole('heading', { name: 'Statistical Leaders' }).closest('article')! as HTMLElement

    fireEvent.click(within(scoringBoard).getByRole('button', { name: leaderName }))

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'playerDetails',
      selectedPlayerProgramId: leader.player.program.programId,
      selectedPlayerId: leader.player.playerId,
      selectedArchivedSeasonNumber: 1,
    })
    expect(screen.getByText('Former Player')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Back to Yearbook' }))

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'seasonYearbook',
      selectedArchivedSeasonNumber: 1,
    })
    expect(screen.getByRole('heading', { name: expected.championship.nationalChampion.name }))
      .toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Back to History' }))
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))
    expect(useDynastyStore.getState().view).toBe('league')
  })

  it('opens the controlled Program leader for the correctly resolved Player', () => {
    const { expected } = renderYearbook(CONTROLLED_PROGRAM_ID)
    const leader = expected.statisticalLeaders.controlledProgram.points[0]
    if (!leader) return

    const teamLeaders = screen.getByRole('region', { name: 'Your Team Leaders' })
    const leaderButton = within(teamLeaders).getAllByRole('button', {
      name: new RegExp(`${leader.player.firstName} ${leader.player.lastName}`),
    })[0]!
    fireEvent.click(leaderButton)

    expect(useDynastyStore.getState()).toMatchObject({
      view: 'playerDetails',
      selectedPlayerProgramId: leader.player.program.programId,
      selectedPlayerId: leader.player.playerId,
    })
  })

  it('opens a still-active Player using the active Player Details destination', () => {
    const dynasty = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({
      dynasty: { ...dynasty, activeSeason: archive.season, history: [archive] },
      view: 'seasonYearbook',
      selectedArchivedSeasonNumber: 1,
      explorationViewHistory: ['league', 'history'],
    })
    const expected = deriveCompletedSeasonYearbook(useDynastyStore.getState().dynasty!, 1)
    render(<App />)
    const leader = expected.statisticalLeaders.national.points[0]!
    const scoringBoard = screen.getByRole('heading', { name: 'Statistical Leaders' }).closest('article')! as HTMLElement

    fireEvent.click(within(scoringBoard).getByRole('button', {
      name: `${leader.player.firstName} ${leader.player.lastName}`,
    }))

    expect(useDynastyStore.getState().view).toBe('playerDetails')
    expect(screen.queryByText('Former Player')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Game Log' })).toBeInTheDocument()
  })

  it('does not crash when a Player ID cannot resolve', () => {
    setHistory([archive])
    const dynasty = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({
      dynasty: { ...dynasty, controlledProgramId: CONTROLLED_PROGRAM_ID },
      view: 'playerDetails',
      selectedPlayerProgramId: CONTROLLED_PROGRAM_ID,
      selectedPlayerId: 'unresolvable-player-id',
      selectedArchivedSeasonNumber: 1,
      explorationViewHistory: ['league', 'history', 'seasonYearbook'],
    })

    expect(() => render(<App />)).not.toThrow()
  })
})
