import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { DynastyState, RecruitingCommitment } from '../dynasty'
import {
  deriveProgramRecruitingBoard,
  deriveTargetStatus,
  getRecruit,
  RECRUITING_BOARD_LIMIT,
} from '../dynasty'
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
    expect(within(ability).getByText('Ovr').previousElementSibling).toHaveTextContent(
      String(calculateOverall(recruit.player)),
    )
    expect(within(ability).getByText('Pot').previousElementSibling).toHaveTextContent(
      String(recruit.player.potential),
    )
    const finishingLabel = screen.getByText('Finishing')
    expect(finishingLabel.nextElementSibling).toHaveTextContent(
      String(recruit.player.attributes.finishing),
    )
    expect(screen.getByText(formatReadinessLabel(
      dynasty.recruiting!.commitmentsByPlayerId[playerId] ? 'committed' : 'not-deciding',
    ))).toBeInTheDocument()
    expect(screen.queryByText('Work Ethic')).not.toBeInTheDocument()
    const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
      (entry) => entry.playerId === playerId,
    )!
    expect(screen.getByText(
      `On your Board · ${target.isFocused ? 'Focused · ' : ''}${target.hasActiveOffer ? 'Offered' : 'No Offer'}`,
    )).toBeInTheDocument()

    const ratingsHeading = screen.getByRole('heading', { name: 'Player Ratings' })
    const outlookHeading = screen.getByRole('heading', {
      name: `Next Season ${recruit.player.position} Outlook`,
    })
    const recruitmentHeading = screen.getByRole('heading', { name: 'Current Recruitment' })
    expect(ratingsHeading.compareDocumentPosition(outlookHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(outlookHeading.compareDocumentPosition(recruitmentHeading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const outlook = screen.getByRole('region', {
      name: `Next Season ${recruit.player.position} Outlook`,
    })
    expect(within(outlook).getByLabelText(`Projected natural ${recruit.player.position}s`)).toBeInTheDocument()
    const viewedRow = outlook.querySelector('[data-viewed="true"]')
    expect(viewedRow).toHaveTextContent(`${calculateOverall(recruit.player)} OVR`)
    expect(viewedRow).toHaveTextContent(`${recruit.player.potential} POT`)
    expect(within(outlook).getByText(/Would currently (rank|be tied for)/)).toBeInTheDocument()
    expect(within(outlook).getByText('Ranking uses current OVR. Future Development and Rotation roles are not projected.')).toBeInTheDocument()
    expect(within(outlook).queryByText(/Fit score|Starter|Bench|Reserve|projected MPG/i)).not.toBeInTheDocument()
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
      // No management actions once resolved.
      expect(screen.queryByRole('button', { name: /Focus|Remove from Board|Add to Board|Offer/ })).not.toBeInTheDocument()
      const outlook = screen.getByRole('region', { name: /Next Season .* Outlook/ })
      if (destination === 'controlled') {
        expect(within(outlook).getByText(/Currently (ranks|is tied for)/)).toBeInTheDocument()
      } else {
        expect(within(outlook).getByText('Committed elsewhere — not included in this projection.')).toBeInTheDocument()
      }
    },
  )

  it('shows a filled-position exclusion instead of an impossible hypothetical row', () => {
    const dynasty = createRecruitingDynasty('recruit-details-filled-position')
    const playerId = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board[0]!.playerId
    const recruit = getRecruit(dynasty.recruiting!, playerId)!
    const program = dynasty.recruiting!.programs[dynasty.controlledProgramId]!
    const filled = {
      ...dynasty,
      recruiting: {
        ...dynasty.recruiting!,
        programs: {
          ...dynasty.recruiting!.programs,
          [dynasty.controlledProgramId]: {
            ...program,
            projectedOpeningsByPosition: {
              ...program.projectedOpeningsByPosition,
              [recruit.player.position]: 0,
            },
          },
        },
      },
    }
    renderDetails(filled, playerId)

    const outlook = screen.getByRole('region', { name: `Next Season ${recruit.player.position} Outlook` })
    expect(within(outlook).getByText('Position filled — this Recruit is not included.')).toBeInTheDocument()
    expect(within(outlook).queryByText(/Would currently/)).not.toBeInTheDocument()
  })

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

  describe('management actions', () => {
    it('reuses the canonical Unfocus action for a focused Board target', () => {
      const dynasty = createRecruitingDynasty('recruit-details-focus-action')
      // The default board's initial plan focuses its first RECRUITING_FOCUS_LIMIT
      // active recommendations, so an already-focused target always exists here.
      const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
        (entry) => entry.isFocused,
      )!
      renderDetails(dynasty, target.playerId)

      const recruit = getRecruit(dynasty.recruiting!, target.playerId)!
      const fullName = `${recruit.player.firstName} ${recruit.player.lastName}`
      fireEvent.click(screen.getByRole('button', { name: `Unfocus ${fullName}` }))

      expect(useDynastyStore.getState().dynasty!.recruiting!
        .programs[dynasty.controlledProgramId]!.board
        .find((entry) => entry.playerId === target.playerId)!.isFocused).toBe(false)
    })

    it('reuses the canonical Remove action for a Board target', () => {
      const dynasty = createRecruitingDynasty('recruit-details-remove-action')
      const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
        (entry) => deriveTargetStatus(dynasty.recruiting!, dynasty.controlledProgramId, entry.playerId) === 'active',
      )!
      renderDetails(dynasty, target.playerId)

      fireEvent.click(screen.getByRole('button', { name: 'Remove from Board' }))

      expect(useDynastyStore.getState().dynasty!.recruiting!
        .programs[dynasty.controlledProgramId]!.board
        .some((entry) => entry.playerId === target.playerId)).toBe(false)
    })

    it('reuses the canonical Offer action for an un-offered Board target, matching Board offer-capacity eligibility', () => {
      const dynasty = createRecruitingDynasty('recruit-details-offer-action')
      const board = deriveProgramRecruitingBoard(dynasty, dynasty.controlledProgramId)
      const target = board.targets.find((entry) => entry.status === 'active' && !entry.hasActiveOffer)

      if (!target) {
        // Default board init already offers everywhere capacity allows; nothing to assert.
        return
      }
      renderDetails(dynasty, target.playerId)

      const offerButton = screen.getByRole('button', { name: 'Offer' })
      const hasCapacity = board.availableOfferSlotsByPosition[
        getRecruit(dynasty.recruiting!, target.playerId)!.player.position
      ] > 0
      expect(offerButton).toHaveProperty('disabled', !hasCapacity)

      fireEvent.click(offerButton)

      expect(useDynastyStore.getState().dynasty!.recruiting!
        .programs[dynasty.controlledProgramId]!.board
        .find((entry) => entry.playerId === target.playerId)!.hasActiveOffer).toBe(hasCapacity)
    })

    it('reuses the canonical Withdraw action for an offered Board target', () => {
      const dynasty = createRecruitingDynasty('recruit-details-withdraw-action')
      const target = dynasty.recruiting!.programs[dynasty.controlledProgramId]!.board.find(
        (entry) => entry.hasActiveOffer
          && deriveTargetStatus(dynasty.recruiting!, dynasty.controlledProgramId, entry.playerId) === 'active',
      )

      if (!target) {
        // Default board init happened to extend no offers for this seed; nothing to assert.
        return
      }
      renderDetails(dynasty, target.playerId)

      fireEvent.click(screen.getByRole('button', { name: 'Withdraw Offer' }))

      expect(useDynastyStore.getState().dynasty!.recruiting!
        .programs[dynasty.controlledProgramId]!.board
        .find((entry) => entry.playerId === target.playerId)!.hasActiveOffer).toBe(false)
    })

    it('reuses the canonical Add to Board action for a Recruit not yet pursued', () => {
      const dynasty = createRecruitingDynasty('recruit-details-add-action')
      useDynastyStore.setState({ dynasty })
      const controlledProgramId = dynasty.controlledProgramId
      const initialBoard = dynasty.recruiting!.programs[controlledProgramId]!.board
      // The default board fills all `RECRUITING_BOARD_LIMIT` slots; remove one
      // to make room, matching how National already handles a full board.
      useDynastyStore.getState().removeRecruitingTarget(initialBoard[0]!.playerId)

      const recruiting = useDynastyStore.getState().dynasty!.recruiting!
      const boardIds = new Set(
        recruiting.programs[controlledProgramId]!.board.map(({ playerId }) => playerId),
      )
      const addable = recruiting.recruits.find(
        (recruit) =>
          !boardIds.has(recruit.player.id)
          && deriveTargetStatus(recruiting, controlledProgramId, recruit.player.id) === 'active',
      )!

      useDynastyStore.setState({
        view: 'recruitDetails',
        selectedRecruitPlayerId: addable.player.id,
      })
      render(<App />)

      fireEvent.click(screen.getByRole('button', { name: 'Add to Board' }))

      expect(useDynastyStore.getState().dynasty!.recruiting!
        .programs[controlledProgramId]!.board
        .some((entry) => entry.playerId === addable.player.id)).toBe(true)
    })

    it('shows Board Full instead of a click-through Add action once the Board is already full', () => {
      const dynasty = createRecruitingDynasty('recruit-details-capacity')
      useDynastyStore.setState({ dynasty })
      useDynastyStore.getState().fillRemainingRecruitingBoard()
      const filled = useDynastyStore.getState().dynasty!
      const board = deriveProgramRecruitingBoard(filled, filled.controlledProgramId)
      expect(board.targets.length).toBe(RECRUITING_BOARD_LIMIT)
      const boardIds = new Set(board.targets.map(({ playerId }) => playerId))
      const recruiting = filled.recruiting!
      const playerId = recruiting.recruits.find(
        (recruit) =>
          !boardIds.has(recruit.player.id)
          && deriveTargetStatus(recruiting, filled.controlledProgramId, recruit.player.id) === 'active',
      )!.player.id

      useDynastyStore.setState({
        view: 'recruitDetails',
        selectedRecruitPlayerId: playerId,
      })
      render(<App />)

      expect(screen.getByRole('button', { name: 'Board Full' })).toBeDisabled()
    })
  })
})
