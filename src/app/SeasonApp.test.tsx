import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  deriveConferenceStandings,
  getNextGameForProgram,
  isRegularSeasonComplete,
} from '../season'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
}

function selectProgramViaUI(programName: string) {
  const button = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(programName),
  )

  if (!button) {
    throw new Error(`Program row for "${programName}" not found`)
  }

  fireEvent.click(button)
}

function clickButtonByText(pattern: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: pattern }))
}

function driveSeasonToCompletion(): void {
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const season = useSeasonStore.getState().season!

    if (isRegularSeasonComplete(season)) {
      return
    }

    useSeasonStore.getState().playScheduledGame()
    useSeasonStore.getState().simulateRestOfRound()
  }

  throw new Error('Season did not complete within the expected round budget.')
}

beforeEach(() => {
  resetStore()
})

describe('Season Presentation', () => {
  it('presents permanent Universe V0 program selection initially', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Choose Your Program' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Great Lakes')).toBeInTheDocument()
    expect(screen.getAllByText(/Conference$/).length).toBeGreaterThan(0)
  })

  it('shows the Season Hub with 0-0 records and Round 1 after selecting a Program', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('0-0').length).toBeGreaterThan(0)
    expect(screen.getByText('Southern Crescent Conference · Season 1')).toBeInTheDocument()

    const header = document.querySelector('.season-header') as HTMLElement
    expect(within(header).getByText('1')).toBeInTheDocument()
  })

  it('shows the real next opponent from the Schedule on the hub', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    const { season, controlledProgramId } = useSeasonStore.getState()
    const nextGame = getNextGameForProgram(season!, controlledProgramId!)!
    const opponentId =
      nextGame.homeProgramId === controlledProgramId
        ? nextGame.awayProgramId
        : nextGame.homeProgramId
    const opponentTeam = season!.programStates[opponentId]!.team

    const nextGameCard = document.querySelector('.next-game-card') as HTMLElement
    expect(
      within(nextGameCard).getAllByText(new RegExp(opponentTeam.name)).length,
    ).toBeGreaterThan(0)
    expect(within(nextGameCard).getByText(`Round ${nextGame.round}`)).toBeInTheDocument()
  })

  it('gates simulation on a legal draft Rotation in game prep', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)

    const homePanel = document.querySelectorAll('.team-panel')[0] as HTMLElement
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    const originalValue = (input as HTMLInputElement).value

    fireEvent.change(input, {
      target: { value: String(Number(originalValue) + 6) },
    })

    const simulateButton = screen.getByRole('button', {
      name: /simulate game/i,
    })
    expect(simulateButton).toBeDisabled()

    fireEvent.change(input, { target: { value: originalValue } })
    expect(simulateButton).not.toBeDisabled()
  })

  it('records the actual ScheduledGame result and shows it in postgame', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)

    const { season, lastPlayedGameId } = useSeasonStore.getState()
    const result = season!.resultsByGameId[lastPlayedGameId!]!

    expect(screen.getByText(String(result.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result.awayScore))).toBeInTheDocument()
  })

  it('renders Player box-score rows from the recorded Season GameResult', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)

    const { season, lastPlayedGameId } = useSeasonStore.getState()
    const result = season!.resultsByGameId[lastPlayedGameId!]!
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!

    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()
  })

  it('completes remaining Round 1 games via Simulate Rest of Round and updates the hub', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)
    clickButtonByText(/simulate rest of round/i)
    clickButtonByText(/return to season hub/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const round1Games = season!.schedule.games.filter(
      (game) => game.round === 1,
    )
    expect(
      round1Games.every((game) => season!.resultsByGameId[game.id]),
    ).toBe(true)

    // The controlled Program's record reflects its own recorded result.
    const ownResult = round1Games
      .map((game) => season!.resultsByGameId[game.id]!)
      .find(
        (result) =>
          result.homeTeamId === controlledProgramId ||
          result.awayTeamId === controlledProgramId,
      )!
    const expectedRecordText =
      ownResult.winnerId === controlledProgramId ? '1-0' : '0-1'
    expect(screen.getAllByText(expectedRecordText).length).toBeGreaterThan(0)

    const header = document.querySelector('.season-header') as HTMLElement
    expect(within(header).getByText('2')).toBeInTheDocument()
  })

  it('does not let Simulate Rest of Round drift onto the next round from postgame', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)

    // Still viewing the round-1 result; resolve the rest of round 1 from here.
    clickButtonByText(/simulate rest of round/i)

    // The action must disappear rather than silently re-target round 2 while
    // the user is still looking at the round-1 result.
    expect(
      screen.queryByRole('button', { name: /simulate rest of round/i }),
    ).not.toBeInTheDocument()

    const { season } = useSeasonStore.getState()
    const round2Games = season!.schedule.games.filter(
      (game) => game.round === 2,
    )
    expect(
      round2Games.some((game) => season!.resultsByGameId[game.id] !== undefined),
    ).toBe(false)
  })

  it('renders Conference standings matching the Season standings API', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)
    clickButtonByText(/simulate rest of round/i)
    clickButtonByText(/return to season hub/i)

    const { season } = useSeasonStore.getState()
    const controlledProgram = UNIVERSE_V0.programs.find(
      (program) => program.id === 'charlotte-tech',
    )!
    const expectedStandings = deriveConferenceStandings(
      UNIVERSE_V0,
      season!,
      controlledProgram.conferenceId,
    )

    const standingsTable = document.querySelector('.standings-table')
    const renderedRows = within(standingsTable as HTMLElement).getAllByRole(
      'row',
    )
    // First row is the header; data rows follow in the derived standings order.
    const firstDataRow = renderedRows[1]!
    const firstProgramName = UNIVERSE_V0.programs.find(
      (program) => program.id === expectedStandings[0]!.programId,
    )!.name
    expect(within(firstDataRow).getByText(firstProgramName)).toBeInTheDocument()
  })

  it('shows actual completed game results in the schedule table', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/prepare for game/i)
    clickButtonByText(/simulate game/i)
    clickButtonByText(/return to season hub/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const round1Game = season!.schedule.games.find(
      (game) =>
        game.round === 1 &&
        (game.homeProgramId === controlledProgramId ||
          game.awayProgramId === controlledProgramId),
    )!
    const result = season!.resultsByGameId[round1Game.id]!
    const isControlledHome = round1Game.homeProgramId === controlledProgramId
    const controlledScore = isControlledHome
      ? result.homeScore
      : result.awayScore
    const opponentScore = isControlledHome
      ? result.awayScore
      : result.homeScore
    const outcome = controlledScore > opponentScore ? 'W' : 'L'

    expect(
      screen.getByText(`${outcome} ${controlledScore}-${opponentScore}`),
    ).toBeInTheDocument()
  })

  it('never lets the controlled Program appear in resultsByGameId before it is played, even after Simulate Rest of Round', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    clickButtonByText(/simulate rest of round/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const ownGame = getNextGameForProgram(season!, controlledProgramId!)
    expect(ownGame).toBeDefined()
    expect(ownGame!.round).toBe(1)
    expect(season!.resultsByGameId[ownGame!.id]).toBeUndefined()
  })

  it('shows Regular Season Complete once all 384 games are finished', () => {
    useSeasonStore.getState().selectProgram('pine-valley')
    driveSeasonToCompletion()
    useSeasonStore.getState().goToHub()

    render(<App />)

    // Re-render is implicit via subscribed store updates; assert final DOM state.
    expect(screen.getByText('Regular Season Complete')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /prepare for game/i }),
    ).not.toBeInTheDocument()
  })
})
