import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { calculateOverall } from '../engine'
import {
  deriveFollowingRecruitsView,
  type DynastyState,
  type RecruitingCommitment,
} from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'
import {
  formatControlledPositionLabel,
  formatReadinessLabel,
} from './recruitingBattleFormatters'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function seedRecruiting(seed: string): DynastyState {
  const dynasty = createRecruitingDynasty(seed)
  useDynastyStore.setState({ dynasty, view: 'recruiting' })
  return dynasty
}

function withCommitment(
  dynasty: DynastyState,
  playerId: string,
  programId: string,
): DynastyState {
  const commitment: RecruitingCommitment = {
    playerId,
    programId,
    timing: { kind: 'period', period: 8 },
    targetSeasonNumber: dynasty.recruiting!.targetSeasonNumber,
  }
  return {
    ...dynasty,
    recruiting: {
      ...dynasty.recruiting!,
      commitmentsByPlayerId: {
        ...dynasty.recruiting!.commitmentsByPlayerId,
        [playerId]: commitment,
      },
    },
  }
}

function openFollowing(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Following' }))
}

beforeEach(resetStore)

describe('Recruit Details Follow control', () => {
  it('toggles canonical Recruit follow intent without touching Player follows', () => {
    const dynasty = seedRecruiting('recruit-following:details')
    const playerId = dynasty.recruiting!.recruits[0]!.player.id
    useDynastyStore.getState().openRecruitDetails(playerId)
    render(<App />)

    const follow = screen.getByRole('button', { name: 'Follow' })
    expect(follow).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(follow)

    const following = screen.getByRole('button', { name: 'Following' })
    expect(following).toHaveAttribute('aria-pressed', 'true')
    expect(useDynastyStore.getState().followedRecruitIds).toEqual([playerId])
    expect(useDynastyStore.getState().followedPlayerIds).toEqual([])

    fireEvent.click(following)
    expect(screen.getByRole('button', { name: 'Follow' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(useDynastyStore.getState().followedRecruitIds).toEqual([])
  })
})

describe('Recruiting — Following', () => {
  it('selects Following while fresh/root Recruiting still defaults to Board', () => {
    seedRecruiting('recruit-following:mode')
    render(<App />)

    openFollowing()
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    useDynastyStore.getState().goToRecruiting()
    expect(useDynastyStore.getState().recruitingMode).toBe('board')
  })

  it('shows the sibling empty state and a safe stale-only state', async () => {
    seedRecruiting('recruit-following:empty')
    render(<App />)
    openFollowing()

    expect(screen.getByText(/haven.t followed any Recruits yet/i)).toBeInTheDocument()

    useDynastyStore.setState({ followedRecruitIds: ['stale-recruit-id'] })
    await waitFor(() => expect(
      screen.getByText(/followed Recruit is unavailable in the current recruiting class/i),
    ).toBeInTheDocument())
  })

  it('renders current facts in first-followed order, including an off-Board Recruit', () => {
    const dynasty = seedRecruiting('recruit-following:rows')
    const recruiting = dynasty.recruiting!
    const boardIds = new Set(
      recruiting.programs[dynasty.controlledProgramId]!.board.map(({ playerId }) => playerId),
    )
    const offBoard = recruiting.recruits.find(({ player }) => !boardIds.has(player.id))!
    const onBoard = recruiting.recruits.find(({ player }) => boardIds.has(player.id))!
    useDynastyStore.getState().followRecruit(offBoard.player.id)
    useDynastyStore.getState().followRecruit(onBoard.player.id)
    render(<App />)
    openFollowing()

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)
    expect(within(rows[0]!).getByText(`${offBoard.player.firstName} ${offBoard.player.lastName}`)).toBeInTheDocument()
    expect(within(rows[1]!).getByText(`${onBoard.player.firstName} ${onBoard.player.lastName}`)).toBeInTheDocument()

    const offBoardRow = rows[0]!
    expect(within(offBoardRow).getByText(`#${offBoard.nationalRank}`)).toBeInTheDocument()
    expect(within(offBoardRow).getByText(offBoard.player.position)).toBeInTheDocument()
    expect(within(offBoardRow).getByText(String(calculateOverall(offBoard.player)))).toBeInTheDocument()
    expect(within(offBoardRow).getByText(String(offBoard.player.potential))).toBeInTheDocument()
    const expectedReadiness = deriveFollowingRecruitsView(
      dynasty,
      [offBoard.player.id],
    ).recruits[0]!.battle.readiness
    expect(
      within(offBoardRow).getByText(formatReadinessLabel(expectedReadiness)),
    ).toBeInTheDocument()
    expect(within(offBoardRow).getByText('Not Pursuing')).toBeInTheDocument()
  })

  it.each(['controlled', 'other'] as const)(
    'keeps a Recruit visible after committing to the %s Program with resolved status',
    (destination) => {
      const dynasty = seedRecruiting(`recruit-following:commit:${destination}`)
      const playerId = dynasty.recruiting!.recruits[0]!.player.id
      const programId = destination === 'controlled'
        ? dynasty.controlledProgramId
        : UNIVERSE_V0.programs.find(({ id }) => id !== dynasty.controlledProgramId)!.id
      useDynastyStore.getState().followRecruit(playerId)
      useDynastyStore.setState({ dynasty: withCommitment(dynasty, playerId, programId) })
      render(<App />)
      openFollowing()

      const row = screen.getByText(
        `${dynasty.recruiting!.recruits[0]!.player.firstName} ${dynasty.recruiting!.recruits[0]!.player.lastName}`,
      ).closest('tr')!
      const expectedStatus = destination === 'controlled'
        ? 'Committed to Us'
        : `Committed — ${UNIVERSE_V0.programs.find(({ id }) => id === programId)!.name}`
      expect(within(row).getByText(expectedStatus)).toBeInTheDocument()
      expect(within(row).getByText('—')).toBeInTheDocument()
      expect(within(row).queryByText(formatControlledPositionLabel('leading'))).not.toBeInTheDocument()
    },
  )

  it('opens Recruit Details and Back restores Following mode', () => {
    const dynasty = seedRecruiting('recruit-following:round-trip')
    const recruit = dynasty.recruiting!.recruits[0]!
    useDynastyStore.getState().followRecruit(recruit.player.id)
    render(<App />)
    openFollowing()

    fireEvent.click(screen.getByRole('button', {
      name: `${recruit.player.firstName} ${recruit.player.lastName}`,
    }))
    expect(useDynastyStore.getState()).toMatchObject({
      view: 'recruitDetails',
      recruitingMode: 'following',
      selectedRecruitPlayerId: recruit.player.id,
    })

    fireEvent.click(screen.getByRole('button', { name: '← Back to Recruiting' }))
    expect(screen.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('supports row-level Unfollow without changing Player follow intent', () => {
    const dynasty = seedRecruiting('recruit-following:unfollow')
    const recruit = dynasty.recruiting!.recruits[0]!
    const fullName = `${recruit.player.firstName} ${recruit.player.lastName}`
    useDynastyStore.getState().followRecruit(recruit.player.id)
    render(<App />)
    openFollowing()

    fireEvent.click(screen.getByRole('button', { name: `Unfollow ${fullName}` }))

    expect(useDynastyStore.getState().followedRecruitIds).toEqual([])
    expect(useDynastyStore.getState().followedPlayerIds).toEqual([])
    expect(screen.getByText(/haven.t followed any Recruits yet/i)).toBeInTheDocument()
  })
})
