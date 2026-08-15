import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_ID = 'northbridge'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function selectControlledProgram(): void {
  useDynastyStore.getState().selectProgram(
    CONTROLLED_PROGRAM_ID,
    DEFAULT_INTERACTIVE_TEST_SEED,
  )
}

function goToLeagueFollowing(): void {
  useDynastyStore.getState().goToLeague()
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: 'Following' }))
}

beforeEach(resetStore)

describe('League — Following', () => {
  it('is reachable through the League experience as a section tab', () => {
    selectControlledProgram()
    useDynastyStore.getState().goToLeague()
    render(<App />)

    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument()
  })

  it('marks Following as the active League tab once selected', () => {
    selectControlledProgram()
    goToLeagueFollowing()

    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Leaders' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('shows a concise empty state when nothing is followed', () => {
    selectControlledProgram()
    goToLeagueFollowing()

    expect(
      screen.getByText(/haven.t followed anyone yet/i),
    ).toBeInTheDocument()
  })

  it('lists a followed active Player with identity and current Program', () => {
    selectControlledProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const player = roster[0]!
    useDynastyStore.getState().followPlayer(player.id)

    goToLeagueFollowing()

    const row = screen.getByText(`${player.firstName} ${player.lastName}`).closest('tr')!
    expect(
      within(row).getByRole('button', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
    expect(within(row).getByText(player.position)).toBeInTheDocument()
    expect(within(row).getByText(player.classYear)).toBeInTheDocument()
    expect(
      within(row).getByText(String(calculateOverall(player))),
    ).toBeInTheDocument()
  })

  it('lists multiple followed active Players in projection (first-followed) order', () => {
    selectControlledProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const first = roster[0]!
    const second = roster[1]!
    useDynastyStore.getState().followPlayer(first.id)
    useDynastyStore.getState().followPlayer(second.id)

    goToLeagueFollowing()

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(
      within(rows[0] as HTMLElement).getByText(`${first.firstName} ${first.lastName}`),
    ).toBeInTheDocument()
    expect(
      within(rows[1] as HTMLElement).getByText(`${second.firstName} ${second.lastName}`),
    ).toBeInTheDocument()
  })

  it('shows PPG/RPG/APG for a followed Player with games played', () => {
    selectControlledProgram()
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()

    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const player = roster[0]!
    useDynastyStore.getState().followPlayer(player.id)

    goToLeagueFollowing()

    const row = screen.getByText(`${player.firstName} ${player.lastName}`).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells).toHaveLength(8)
  })

  it('renders a zero-game followed Player safely', () => {
    selectControlledProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const player = roster[0]!
    useDynastyStore.getState().followPlayer(player.id)

    goToLeagueFollowing()

    const row = screen.getByText(`${player.firstName} ${player.lastName}`).closest('tr')!
    const cells = within(row).getAllByRole('cell')
    expect(cells.at(-3)).toHaveTextContent('0.0')
    expect(cells.at(-2)).toHaveTextContent('0.0')
    expect(cells.at(-1)).toHaveTextContent('0.0')
  })

  it('navigates to Player Details through the existing canonical Player navigation', () => {
    selectControlledProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const player = roster[0]!
    useDynastyStore.getState().followPlayer(player.id)

    goToLeagueFollowing()

    fireEvent.click(
      screen.getByRole('button', { name: `${player.firstName} ${player.lastName}` }),
    )

    expect(
      screen.getByRole('heading', { name: `${player.firstName} ${player.lastName}` }),
    ).toBeInTheDocument()
  })

  it('works for a followed Player outside the controlled Program', () => {
    selectControlledProgram()
    const otherRoster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        OTHER_PROGRAM_ID
      ]!.team.roster
    const player = otherRoster[0]!
    useDynastyStore.getState().followPlayer(player.id)

    goToLeagueFollowing()

    expect(
      screen.getByText(`${player.firstName} ${player.lastName}`),
    ).toBeInTheDocument()
  })

  it('does not render an unresolved followed ID as a broken active row', () => {
    selectControlledProgram()
    useDynastyStore.getState().followPlayer('player-does-not-exist')

    goToLeagueFollowing()

    expect(screen.queryAllByRole('row')).toHaveLength(0)
  })

  it('shows a graceful message when every followed Player is unresolved', () => {
    selectControlledProgram()
    useDynastyStore.getState().followPlayer('player-does-not-exist')

    goToLeagueFollowing()

    expect(
      screen.getByText(/unavailable in this Dynasty/i),
    ).toBeInTheDocument()
  })

  it('shows active Players normally in a mixed active/unresolved result, with a minimal unresolved note', () => {
    selectControlledProgram()
    const roster =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        CONTROLLED_PROGRAM_ID
      ]!.team.roster
    const player = roster[0]!
    useDynastyStore.getState().followPlayer(player.id)
    useDynastyStore.getState().followPlayer('player-does-not-exist')

    goToLeagueFollowing()

    expect(
      screen.getByText(`${player.firstName} ${player.lastName}`),
    ).toBeInTheDocument()
    expect(screen.getByText(/1 followed Player is unavailable/i)).toBeInTheDocument()
  })

  it('leaves existing League Leaders/Teams behavior intact', () => {
    selectControlledProgram()
    useDynastyStore.getState().goToLeague()
    render(<App />)

    expect(screen.getByRole('button', { name: 'Leaders' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }))
    expect(
      screen.getByText(/no completed games yet/i),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Teams' }))

    expect(screen.getByRole('button', { name: 'Teams' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Charlotte Tech')).toBeInTheDocument()
  })
})
