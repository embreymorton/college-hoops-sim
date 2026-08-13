import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { compileSimpleRotationIntent } from '../engine'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function enterCoachingRotation(): void {
  useDynastyStore.getState().selectProgram('charlotte-tech', DEFAULT_INTERACTIVE_TEST_SEED)
  useDynastyStore.getState().generateControlledDraftBoard()
  useDynastyStore.getState().goToCoaching()
}

beforeEach(() => {
  resetStore()
})

describe('Coaching Rotation — Simple / Advanced', () => {
  it('defaults to the Simple editor when opening Coaching → Rotation', () => {
    enterCoachingRotation()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))

    expect(screen.getByRole('button', { name: 'Simple' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByText('Rotation Players')).toBeInTheDocument()
    expect(screen.getByText('Reserves')).toBeInTheDocument()
  })

  it('shows every roster Player exactly once, split by positive vs. zero minutes', () => {
    enterCoachingRotation()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))

    const controlledTeam =
      useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        useDynastyStore.getState().dynasty!.controlledProgramId
      ]!.team
    const simpleMinutes = useDynastyStore.getState().coachingSimpleMinutesByPlayerId!

    const positiveCount = controlledTeam.roster.filter(
      (player) => (simpleMinutes[player.id] ?? 0) > 0,
    ).length
    const zeroCount = controlledTeam.roster.length - positiveCount

    const table = document.querySelector('.simple-rotation-table') as HTMLElement
    const rows = within(table)
      .getAllByRole('row')
      .filter((row) => row.hasAttribute('data-player-id'))
    expect(rows).toHaveLength(controlledTeam.roster.length)

    const zeroMinuteRows = rows.filter(
      (row) => row.getAttribute('data-zero-minutes') === 'true',
    )
    expect(zeroMinuteRows).toHaveLength(zeroCount)
    expect(rows.length - zeroMinuteRows.length).toBe(positiveCount)
  })

  it('applies a valid Simple edit and reflects it in Advanced without manual React sync', () => {
    enterCoachingRotation()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))

    const controlledProgramId = useDynastyStore.getState().dynasty!.controlledProgramId
    const before = useDynastyStore.getState().dynasty!.activeSeason!.programStates[
      controlledProgramId
    ]!.rotation

    // Move one minute between two active Players, keeping the total at 200 so
    // Apply stays enabled. Not every such pair remains positionally feasible
    // (moving a minute away from a Player who is the sole remaining coverage
    // for their position can make the draft infeasible — see the dedicated
    // "translates infeasible position coverage issues" case below), so search
    // for a pair the real compiler confirms stays legal.
    const controlledTeam = useDynastyStore.getState().dynasty!.activeSeason!.programStates[
      controlledProgramId
    ]!.team
    const simpleMinutes = useDynastyStore.getState().coachingSimpleMinutesByPlayerId!
    const positiveEntries = Object.entries(simpleMinutes).filter(
      ([, minutes]) => minutes > 0,
    )
    const increaseCandidates = positiveEntries.filter(([, minutes]) => minutes < 40)
    let firstId: string | undefined
    let secondId: string | undefined

    outer: for (const [increaseId] of increaseCandidates) {
      for (const [decreaseId] of positiveEntries) {
        if (decreaseId === increaseId) continue
        const candidateIntent = {
          ...simpleMinutes,
          [increaseId]: simpleMinutes[increaseId]! + 1,
          [decreaseId]: simpleMinutes[decreaseId]! - 1,
        }
        if (compileSimpleRotationIntent(controlledTeam, candidateIntent).valid) {
          firstId = increaseId
          secondId = decreaseId
          break outer
        }
      }
    }
    expect(firstId).toBeDefined()
    expect(secondId).toBeDefined()

    fireEvent.click(
      screen.getByRole('button', { name: `Increase ${describePlayerLabel(firstId!)} minutes` }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: `Decrease ${describePlayerLabel(secondId!)} minutes` }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Apply Rotation' }))

    const after = useDynastyStore.getState().dynasty!.activeSeason!.programStates[
      controlledProgramId
    ]!.rotation
    expect(after).not.toBe(before)
    expect(useDynastyStore.getState().coachingSimpleRotationIssues).toEqual([])

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByText('Team Strength')).toBeInTheDocument()

    function describePlayerLabel(playerId: string): string {
      const team = useDynastyStore.getState().dynasty!.activeSeason!.programStates[
        controlledProgramId
      ]!.team
      const player = team.roster.find((candidate) => candidate.id === playerId)!
      return `${player.firstName} ${player.lastName}`
    }
  })

  it('discards an uncommitted Simple edit back to the committed Rotation', () => {
    enterCoachingRotation()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Rotation' }))

    const committedBefore = { ...useDynastyStore.getState().coachingSimpleMinutesByPlayerId! }
    const [activeId] = Object.entries(committedBefore).find(([, minutes]) => minutes > 0)!

    const player = useDynastyStore
      .getState()
      .dynasty!.activeSeason!.programStates[
        useDynastyStore.getState().dynasty!.controlledProgramId
      ]!.team.roster.find((candidate) => candidate.id === activeId)!
    const label = `${player.firstName} ${player.lastName}`

    fireEvent.click(screen.getByRole('button', { name: `Increase ${label} minutes` }))
    expect(screen.getByRole('button', { name: 'Discard Changes' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }))

    expect(useDynastyStore.getState().coachingSimpleMinutesByPlayerId).toEqual(committedBefore)
    expect(screen.getByRole('button', { name: 'Discard Changes' })).toBeDisabled()
  })
})
