import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  calculateTeamStrength,
  getPlayersByMinutesV1,
  type GameResult,
  type PlayerGameStats,
} from '../engine'
import { useGamePresentationStore } from '../store'
import { ExhibitionApp } from './ExhibitionApp'
import { DEMO_PROGRAMS } from '../demo/demoPrograms'

function resetStore() {
  useGamePresentationStore.setState(useGamePresentationStore.getInitialState())
}

/** The home Rotation editor renders first among the two team panels. */
function getHomeRotationPanel(): HTMLElement {
  const panel = document.querySelectorAll('.team-panel')[0]

  if (!panel) {
    throw new Error('Home rotation panel not found')
  }

  return panel as HTMLElement
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

describe('ExhibitionApp', () => {
  it('renders the initial pregame matchup between two distinct demo programs', () => {
    render(<ExhibitionApp />)

    const state = useGamePresentationStore.getState()
    expect(state.phase).toBe('pregame')
    expect(state.homeProgramId).not.toBe(state.awayProgramId)

    expect(
      screen.getByText('Exhibition / Development Matchup'),
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
    render(<ExhibitionApp />)

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
    render(<ExhibitionApp />)
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

  it('renders the read-only away roster with default rotation minutes from the generated Team', () => {
    render(<ExhibitionApp />)
    const { awaySetup } = useGamePresentationStore.getState()
    const topPlayer = getPlayersByMinutesV1(
      awaySetup.team,
      awaySetup.rotation,
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
    render(<ExhibitionApp />)

    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const state = useGamePresentationStore.getState()
    expect(state.phase).toBe('postgame')
    expect(screen.queryByRole('heading', { name: 'What Changed' })).not.toBeInTheDocument()
    expect(state.result).not.toBeNull()
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0)
  })

  it('shows a final score that matches the actual GameResult', () => {
    render(<ExhibitionApp />)
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
    render(<ExhibitionApp />)
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
    render(<ExhibitionApp />)
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
    render(<ExhibitionApp />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))

    const { homeSetup, awaySetup } = useGamePresentationStore.getState()
    const homeToggle = screen.getByRole('button', {
      name: new RegExp(homeSetup.team.abbreviation),
    })
    const awayToggle = screen.getByRole('button', {
      name: new RegExp(awaySetup.team.abbreviation),
    })

    expect(homeToggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      document.querySelector(
        `tr[data-player-id="${homeSetup.team.roster[0]!.id}"]`,
      ),
    ).not.toBeNull()

    fireEvent.click(awayToggle)

    expect(awayToggle).toHaveAttribute('aria-pressed', 'true')
    expect(homeToggle).toHaveAttribute('aria-pressed', 'false')
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

    render(<ExhibitionApp />)

    expect(screen.getAllByText('Final').length).toBeGreaterThan(0)
    expect(screen.getByText('2OT')).toBeInTheDocument()
  })

  it('returns to the pregame matchup when Change Matchup is pressed', () => {
    render(<ExhibitionApp />)
    fireEvent.click(screen.getByRole('button', { name: /simulate game/i }))
    expect(useGamePresentationStore.getState().phase).toBe('postgame')

    fireEvent.click(screen.getByRole('button', { name: /change matchup/i }))

    expect(useGamePresentationStore.getState().phase).toBe('pregame')
    expect(
      screen.getByRole('button', { name: /simulate game/i }),
    ).toBeInTheDocument()
  })
})

describe('Rotation editor', () => {
  it('renders position minute totals and the global minute budget for the home Rotation', () => {
    render(<ExhibitionApp />)

    const homePanel = getHomeRotationPanel()
    const groupRows = homePanel.querySelectorAll('.rotation-group-row')
    expect(groupRows).toHaveLength(5)
    for (const groupRow of groupRows) {
      expect(within(groupRow as HTMLElement).getByText('40 / 40')).toBeInTheDocument()
      expect(within(groupRow as HTMLElement).getByText('Valid')).toBeInTheDocument()
    }

    const budget = homePanel.querySelector('.rotation-budget')
    expect(budget).not.toBeNull()
    expect(within(budget as HTMLElement).getAllByText('200')).toHaveLength(2)
  })

  it('updates application state when a Player minutes input is edited directly', () => {
    render(<ExhibitionApp />)

    const homePanel = getHomeRotationPanel()
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const playerId = row.getAttribute('data-player-id')!
    const position = row.getAttribute('data-floor-position') as 'PG'
    const input = within(row).getByRole('spinbutton')

    fireEvent.change(input, { target: { value: '17' } })

    expect(
      useGamePresentationStore.getState().homeRotation.minutesByPosition[position][playerId],
    ).toBe(17)
    expect((input as HTMLInputElement).value).toBe('17')
  })

  it('adjusts a Player minutes by one minute via the stepper buttons', () => {
    render(<ExhibitionApp />)

    const homePanel = getHomeRotationPanel()
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const playerId = row.getAttribute('data-player-id')!
    const position = row.getAttribute('data-floor-position') as 'PG'
    const startingMinutes =
      useGamePresentationStore.getState().homeRotation.minutesByPosition[position][playerId] ?? 0
    const increase = within(row).getByRole('button', { name: /increase/i })
    const decrease = within(row).getByRole('button', { name: /decrease/i })

    fireEvent.click(increase)
    expect(
      useGamePresentationStore.getState().homeRotation.minutesByPosition[position][playerId],
    ).toBe(startingMinutes + 1)

    fireEvent.click(decrease)
    fireEvent.click(decrease)
    expect(
      useGamePresentationStore.getState().homeRotation.minutesByPosition[position][playerId],
    ).toBe(startingMinutes - 1)
  })

  it('disables Simulate Game with a reason while the home Rotation is invalid, and re-enables it once fixed', () => {
    render(<ExhibitionApp />)

    const homePanel = getHomeRotationPanel()
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    const originalValue = (input as HTMLInputElement).value

    fireEvent.change(input, {
      target: { value: String(Number(originalValue) + 5) },
    })

    const simulateButton = screen.getByRole('button', {
      name: /simulate game/i,
    })
    expect(simulateButton).toBeDisabled()
    expect(screen.getAllByText(/to simulate\.$/i).length).toBeGreaterThan(0)

    fireEvent.change(input, { target: { value: originalValue } })

    expect(simulateButton).not.toBeDisabled()
  })

  it('updates Team Strength from the real engine for a legal edit, and marks it pending while invalid', () => {
    render(<ExhibitionApp />)

    const { homeSetup } = useGamePresentationStore.getState()
    const pointGuards = getPlayersByMinutesV1(
      homeSetup.team,
      homeSetup.rotation,
    ).filter(({ player }) => player.position === 'PG')
    const donorRow = document.querySelector(
      `tr[data-player-id="${pointGuards[0]!.player.id}"][data-floor-position="PG"]`,
    ) as HTMLElement
    const recipientRow = document.querySelector(
      `tr[data-player-id="${pointGuards[1]!.player.id}"][data-floor-position="PG"]`,
    ) as HTMLElement

    fireEvent.change(within(donorRow).getByRole('spinbutton'), {
      target: { value: String(pointGuards[0]!.minutes - 2) },
    })
    fireEvent.change(within(recipientRow).getByRole('spinbutton'), {
      target: { value: String(pointGuards[1]!.minutes + 2) },
    })

    const editedRotation = useGamePresentationStore.getState().homeRotation
    const expectedStrength = calculateTeamStrength(
      homeSetup.team,
      editedRotation,
    )
    const strengthTable = document.querySelector('.rotation-strength')
    expect(
      within(strengthTable as HTMLElement).getByText(
        expectedStrength.overall.toFixed(1),
      ),
    ).toBeInTheDocument()

    const input = within(donorRow).getByRole('spinbutton')
    fireEvent.change(input, {
      target: { value: String(pointGuards[0]!.minutes + 20) },
    })

    expect(
      within(strengthTable as HTMLElement).getAllByText('—').length,
    ).toBeGreaterThan(0)
  })

  it('restores the generated default Rotation when Reset to Default is pressed', () => {
    render(<ExhibitionApp />)

    const homePanel = getHomeRotationPanel()
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    const originalValue = (input as HTMLInputElement).value
    const resetButton = screen.getByRole('button', {
      name: /reset to default/i,
    })
    expect(resetButton).toBeDisabled()

    fireEvent.change(input, {
      target: { value: String(Number(originalValue) + 3) },
    })
    expect(resetButton).not.toBeDisabled()

    fireEvent.click(resetButton)

    expect((input as HTMLInputElement).value).toBe(originalValue)
    expect(
      useGamePresentationStore.getState().homeRotation,
    ).toEqual(useGamePresentationStore.getState().homeSetup.rotation)
    expect(resetButton).toBeDisabled()
  })

  it('replaces the Rotation editor with the new Team default when the home program changes', () => {
    render(<ExhibitionApp />)

    const homeSelect = screen.getByLabelText(
      'Home Program',
    ) as HTMLSelectElement
    const nextProgram = DEMO_PROGRAMS.find(
      (program) =>
        program.id !== useGamePresentationStore.getState().homeProgramId &&
        program.id !== useGamePresentationStore.getState().awayProgramId,
    )!

    fireEvent.change(homeSelect, { target: { value: nextProgram.id } })

    const state = useGamePresentationStore.getState()
    expect(state.homeProgramId).toBe(nextProgram.id)
    expect(state.homeRotation).toEqual(state.homeSetup.rotation)

    const homePanel = getHomeRotationPanel()
    const groupRows = homePanel.querySelectorAll('.rotation-group-row')
    for (const groupRow of groupRows) {
      expect(within(groupRow as HTMLElement).getByText('Valid')).toBeInTheDocument()
    }
  })
})
