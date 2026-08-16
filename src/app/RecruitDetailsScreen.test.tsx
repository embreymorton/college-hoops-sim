import { render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DynastyState, RecruitingCommitment } from '../dynasty'
import { getRecruit } from '../dynasty'
import { createRecruitingDynasty } from '../dynasty/recruiting/testSupport'
import { calculateOverall } from '../engine'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'
import { formatHeight } from './formatters'
import { formatReadinessLabel } from './recruitingBattleFormatters'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function renderDetails(dynasty: DynastyState, playerId: string) {
  useDynastyStore.setState({
    dynasty,
    view: 'recruitDetails',
    selectedRecruitPlayerId: playerId,
  })
  render(<App />)
}

function withCommitment(
  dynasty: DynastyState,
  playerId: string,
  programId: string,
): DynastyState {
  const commitment: RecruitingCommitment = {
    playerId,
    programId,
    timing: { kind: 'period', period: 5 },
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

beforeEach(resetStore)

describe('Recruit Details screen', () => {
  it('renders canonical identity, class, ability, ratings, readiness, and controlled status', () => {
    const dynasty = createRecruitingDynasty('recruit-details-screen')
    const playerId = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board[0]!.playerId
    const recruit = getRecruit(dynasty.recruiting!, playerId)!
    renderDetails(dynasty, playerId)

    expect(screen.getByRole('heading', {
      name: `${recruit.player.firstName} ${recruit.player.lastName}`,
    })).toBeInTheDocument()
    expect(screen.getByLabelText(`${recruit.stars}-star recruit`)).toBeInTheDocument()
    expect(screen.getByText(`#${recruit.nationalRank} National · #${recruit.positionRank} ${recruit.player.position}`)).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`${recruit.player.position} · ${formatHeight(recruit.player.height)}`))).toBeInTheDocument()
    expect(screen.getByText(`Recruiting Class — Season ${dynasty.recruiting!.targetSeasonNumber}`, { exact: false })).toBeInTheDocument()

    const ability = screen.getByLabelText('Recruit ability')
    expect(within(ability).getByText('OVR').nextElementSibling).toHaveTextContent(
      String(calculateOverall(recruit.player)),
    )
    expect(within(ability).getByText('POT').nextElementSibling).toHaveTextContent(
      String(recruit.player.potential),
    )
    const finishingLabel = screen.getByText('Finishing')
    expect(finishingLabel.nextElementSibling).toHaveTextContent(
      String(recruit.player.attributes.finishing),
    )
    expect(screen.getByText(formatReadinessLabel(
      dynasty.recruiting!.commitmentsByPlayerId[playerId] ? 'committed' : 'not-deciding',
    ))).toBeInTheDocument()
    const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
      (entry) => entry.playerId === playerId,
    )!
    expect(screen.getByText(
      `On your Board · ${target.isFocused ? 'Focused · ' : ''}${target.hasActiveOffer ? 'Offered' : 'No Offer'}`,
    )).toBeInTheDocument()
  })

  it('shows a Recruit outside the controlled Board without fabricating pursuit state', () => {
    const dynasty = createRecruitingDynasty('recruit-details-off-board-screen')
    const boardIds = new Set(
      dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.map(({ playerId }) => playerId),
    )
    const playerId = dynasty.recruiting!.recruits.find(({ player }) => !boardIds.has(player.id))!.player.id
    renderDetails(dynasty, playerId)

    expect(screen.getByText('Not on your Board')).toBeInTheDocument()
    expect(screen.getByText('No Offer')).toBeInTheDocument()
  })

  it.each(['controlled', 'other'] as const)(
    'shows a committed Recruit destination for the %s Program without unresolved battle groups',
    (destination) => {
      const dynasty = createRecruitingDynasty(`recruit-details-commit-${destination}`)
      const playerId = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board[0]!.playerId
      const programId = destination === 'controlled'
        ? dynasty.controlledProgramId
        : UNIVERSE_V0.programs.find(({ id }) => id !== dynasty.controlledProgramId)!.id
      renderDetails(withCommitment(dynasty, playerId, programId), playerId)

      expect(screen.getByText(`Committed to ${UNIVERSE_V0.programs.find(({ id }) => id === programId)!.name}`)).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Pursuing Programs' })).not.toBeInTheDocument()
      expect(screen.queryByText('Leading')).not.toBeInTheDocument()
    },
  )

  it('recovers an unknown selected Recruit locally back to the preserved Recruiting mode', async () => {
    const dynasty = createRecruitingDynasty('recruit-details-stale-screen')
    useDynastyStore.setState({
      dynasty,
      view: 'recruitDetails',
      selectedRecruitPlayerId: 'unknown-recruit',
      recruitingMode: 'national',
    })
    render(<App />)

    await waitFor(() => expect(useDynastyStore.getState()).toMatchObject({
      view: 'recruiting',
      selectedRecruitPlayerId: null,
      recruitingMode: 'national',
    }))
    expect(screen.getByRole('button', { name: 'National Class' })).toHaveAttribute('aria-pressed', 'true')
  })
})
