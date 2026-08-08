import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getPlayersByMinutes, type GameResult, type PlayerGameStats } from '../engine'
import { useGamePresentationStore } from '../store/gamePresentationStore'
import { App } from './App'
import { DEMO_PROGRAMS } from './demoPrograms'

function resetStore() {
  useGamePresentationStore.setState(useGamePresentationStore.getInitialState())
}

function zeroStatsFor(playerId: string): PlayerGameStats {
  return {
    playerId,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fieldGoalsMade: 0,
    fieldGoalsAttempted: 0,
    threePointersMade: 0,
    threePointersAttempted: 0,
    freeThrowsMade: 0,
    freeThrowsAttempted: 0,
  }
}

beforeEach(() => {
  resetStore()
})

describe('App', () => {
  it('renders the initial pregame matchup between two distinct demo programs', () => {
    render(<App />)

    const state = useGamePresentationStore.getState()
    expect(state.phase).toBe('pregame')
    expect(state.homeProgramId).not.toBe(state.awayProgramId)

    expect(
      screen.getByRole('heading', { name: 'College Hoops' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /simulate game/i }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByText(state.homeSetup.team.name).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(state.awaySetup.team.name).length,
    ).toBeGreaterThan(0)
  })

  it('never offers the same program for both home and away', () => {
    render(<App />)

    const homeSelect = screen.getByLabelText('Home Program') as HTMLSelectElement
    const awaySelect = screen.getByLabelText('Away Program') as HTMLSelectElement
    const homeOptionValues = within(homeSelect)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)
    const awayOptionValues = within(awaySelect)
      .getAllByRole('option')
      .map((option) => (option as HTMLOptionElement).value)

    expect(homeOptionValues).not.toContain(awaySelect.value)
    expect(awayOptionValues).not.toContain(homeSelect.value)
    expect(homeOptionValues).toHaveLength(DEMO_PROGRAMS.length - 1)
    expect(awayOptionValues).toHaveLength(DEMO_PROGRAMS.length - 1)
  })

  it('displays Team Strength values produced by the real engine calculation', () => {
    render(<App />)
    const { homeSetup } = useGamePresentationStore.getState()

    expect(
      screen.getAllByText(homeSetup.strength.offense.toFixed(1)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(homeSetup.strength.defense.toFixed(1)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(homeSetup.strength.overall.toFixed(1)).length,
    ).toBeGreaterThan(0)
  })

  it('renders roster rows with default rotation minutes from the generated Team', () => {
    render(<App />)
    const { homeSetup } = useGamePresentationStore.getState()
    const topPlayer = getPlayersByMinutes(
      homeSetup.team,
      homeSetup.rotation,
    )[0]!

    const row = document.querySelector(
      `tr[data-player-id="${topPlayer.player.id}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(
        `${topPlayer.player.firstName} ${topPlayer.player.lastName}`,
      ),
    ).toBeInTheDocument()
    expect(
      within(row as HTMLElement).getByText(String(topPlayer.minutes)),
    ).toBeInTheDocument()
  })

  it('produces a postgame result when Simulate Game is pressed', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const state = useGamePresentationStore.getState()
    expect(state.phase).toBe('postgame')
    expect(state.result).not.toBeNull()
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0)
  })

  it('shows a final score that matches the actual GameResult', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const { result } = useGamePresentationStore.getState()
    expect(result).not.toBeNull()
    expect(
      screen.getByText(String((result as GameResult).homeScore)),
    ).toBeInTheDocument()
    expect(
      screen.getByText(String((result as GameResult).awayScore)),
    ).toBeInTheDocument()
  })

  it('renders player box-score rows that match the actual result data', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const { result, homeSetup } = useGamePresentationStore.getState()
    const topScorer = [...(result as GameResult).homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!

    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()
    expect(
      within(row as HTMLElement).getByText(
        `${topScorer.fieldGoalsMade}-${topScorer.fieldGoalsAttempted}`,
      ),
    ).toBeInTheDocument()
    expect(homeSetup.team.roster.some((player) => player.id === topScorer.playerId)).toBe(true)
  })

  it('advances to a new deterministic simulation when Simulate Again is pressed', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const firstResult = useGamePresentationStore.getState().result as GameResult
    expect(useGamePresentationStore.getState().simulationSequence).toBe(1)

    fireEvent.click(screen.getByRole('button', { name: /simulate again/i }))

    const secondResult = useGamePresentationStore.getState().result as GameResult
    expect(useGamePresentationStore.getState().simulationSequence).toBe(2)
    expect(secondResult.seed).not.toBe(firstResult.seed)
    expect(secondResult).not.toEqual(firstResult)
  })

  it('lets the user inspect both Teams box scores', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const { homeSetup, awaySetup } = useGamePresentationStore.getState()
    const homeTab = screen.getByRole('tab', {
      name: new RegExp(homeSetup.team.abbreviation),
    })
    const awayTab = screen.getByRole('tab', {
      name: new RegExp(awaySetup.team.abbreviation),
    })

    expect(homeTab).toHaveAttribute('aria-selected', 'true')
    expect(
      document.querySelector(
        `tr[data-player-id="${homeSetup.team.roster[0]!.id}"]`,
      ),
    ).not.toBeNull()

    fireEvent.click(awayTab)

    expect(awayTab).toHaveAttribute('aria-selected', 'true')
    expect(homeTab).toHaveAttribute('aria-selected', 'false')
    expect(
      document.querySelector(
        `tr[data-player-id="${awaySetup.team.roster[0]!.id}"]`,
      ),
    ).not.toBeNull()
  })

  it('labels the result with the overtime period count when given an overtime fixture', () => {
    const { homeSetup, awaySetup } = useGamePresentationStore.getState()
    const overtimeResult: GameResult = {
      homeTeamId: homeSetup.team.id,
      awayTeamId: awaySetup.team.id,
      homeScore: 81,
      awayScore: 79,
      winnerId: homeSetup.team.id,
      overtimePeriods: 2,
      seed: 'fixture-overtime-seed',
      homePlayerStats: homeSetup.team.roster.map((player) =>
        zeroStatsFor(player.id),
      ),
      awayPlayerStats: awaySetup.team.roster.map((player) =>
        zeroStatsFor(player.id),
      ),
    }

    useGamePresentationStore.setState({
      result: overtimeResult,
      phase: 'postgame',
    })

    render(<App />)

    expect(screen.getAllByText('Final').length).toBeGreaterThan(0)
    expect(screen.getByText('2OT')).toBeInTheDocument()
  })

  it('returns to the pregame matchup when Change Matchup is pressed', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))
    expect(useGamePresentationStore.getState().phase).toBe('postgame')

    fireEvent.click(screen.getByRole('button', { name: /change matchup/i }))

    expect(useGamePresentationStore.getState().phase).toBe('pregame')
    expect(
      screen.getByRole('button', { name: /simulate game/i }),
    ).toBeInTheDocument()
  })
})
