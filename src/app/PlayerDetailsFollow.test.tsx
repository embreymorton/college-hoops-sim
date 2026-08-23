import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DynastyState } from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_ID = 'northbridge'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function openPlayerDetails(
  dynasty: DynastyState,
  programId: string,
  playerId: string,
) {
  useDynastyStore.setState({ dynasty, view: 'hub' })
  useDynastyStore.getState().openPlayerDetails(programId, playerId)
}

beforeEach(resetStore)

describe('Player Details — Follow control', () => {
  it('renders the unfollowed state for a Player who is not followed', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-initial')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    const button = screen.getByRole('button', { name: 'Follow' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('follows the Player through the canonical store when activated', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-activate')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))

    expect(useDynastyStore.getState().isPlayerFollowed(player.id)).toBe(true)
    const button = screen.getByRole('button', { name: 'Following' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('unfollows an already-followed Player when activated again', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-toggle')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    useDynastyStore.getState().followPlayer(player.id)
    render(<App />)

    const followingButton = screen.getByRole('button', { name: 'Following' })
    expect(followingButton).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(followingButton)

    expect(useDynastyStore.getState().isPlayerFollowed(player.id)).toBe(false)
    expect(
      screen.getByRole('button', { name: 'Follow' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('reflects the currently viewed Player, not a stale prior selection', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-identity')
    const roster =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster
    const first = roster[0]!
    const second = roster[1]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, first.id)
    useDynastyStore.getState().followPlayer(first.id)
    render(<App />)

    expect(
      screen.getByRole('button', { name: 'Following' }),
    ).toBeInTheDocument()

    act(() => {
      useDynastyStore.getState().openPlayerDetails(CONTROLLED_PROGRAM_ID, second.id)
    })

    expect(screen.getByRole('button', { name: 'Follow' })).toBeInTheDocument()
  })

  it('works for a Player outside the controlled Program', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-other-program')
    const player =
      dynasty.activeSeason!.programStates[OTHER_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, OTHER_PROGRAM_ID, player.id)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Follow' }))

    expect(useDynastyStore.getState().isPlayerFollowed(player.id)).toBe(true)
    expect(
      screen.getByRole('button', { name: 'Following' }),
    ).toBeInTheDocument()
  })

  it('preserves existing Player Details content alongside the Follow control', () => {
    const dynasty = createRecruitingDynasty('player-details-follow-preserved')
    const player =
      dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    openPlayerDetails(dynasty, CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Ratings' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(`${player.firstName} ${player.lastName}`),
    ).toBeInTheDocument()
  })
})
