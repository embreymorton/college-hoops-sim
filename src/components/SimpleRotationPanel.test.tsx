import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type SimpleRotationIntentIssue,
  type Team,
} from '../engine'
import { SimpleRotationPanel } from './SimpleRotationPanel'

function attributesAt(rating: number): PlayerAttributes {
  return {
    finishing: rating,
    shooting: rating,
    playmaking: rating,
    ballHandling: rating,
    perimeterDefense: rating,
    interiorDefense: rating,
    rebounding: rating,
    athleticism: rating,
    stamina: rating,
  }
}

function makePlayer(id: string, position: Position, rating: number): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes: attributesAt(rating),
    potential: Math.max(rating, 90),
  }
}

function makeTeam(): Team {
  return {
    id: 'simple-rotation-fixture',
    name: 'Simple Rotation Fixture',
    abbreviation: 'SRF',
    prestige: 60,
    roster: POSITIONS.flatMap((position) => [
      makePlayer(`${position}-starter`, position, 80),
      makePlayer(`${position}-backup`, position, 65),
    ]),
  }
}

function defaultMinutes(team: Team): Record<string, number> {
  return Object.fromEntries(team.roster.map((player) => [player.id, 0]))
}

describe('SimpleRotationPanel', () => {
  it('groups Players with positive minutes as Rotation Players and zero-minute Players as Reserves', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 36, 'PG-backup': 0 }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    const rotationRow = screen.getByText('PG-starter Player').closest('tr')!
    const reserveRow = screen.getByText('PG-backup Player').closest('tr')!
    expect(rotationRow.compareDocumentPosition(reserveRow) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const rotationGroupHeading = screen.getByText('Rotation Players')
    const reservesGroupHeading = screen.getByText('Reserves')
    expect(rotationGroupHeading).toBeInTheDocument()
    expect(reservesGroupHeading).toBeInTheDocument()
  })

  it('shows the live total and a hint when the draft is under 200 minutes', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 36 }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.getByText('36')).toBeInTheDocument()
    expect(screen.getByText('Assign 164 more minutes')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply Rotation' })).toBeDisabled()
  })

  it('enables Apply only once the draft totals exactly 200 minutes', () => {
    const team = makeTeam()
    const zeroed = defaultMinutes(team)
    const full: Record<string, number> = { ...zeroed }
    let remaining = 200
    for (const player of team.roster) {
      const assign = Math.min(20, remaining)
      full[player.id] = assign
      remaining -= assign
    }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={full}
        committedMinutesByPlayerId={zeroed}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.getByRole('button', { name: 'Apply Rotation' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Discard Changes' })).toBeEnabled()
  })

  it('disables Discard Changes when the draft matches the committed Rotation', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 36 }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.getByRole('button', { name: 'Discard Changes' })).toBeDisabled()
  })

  it('calls onSetPlayerMinutes with accessible increase/decrease controls', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 20 }
    const onSetPlayerMinutes = vi.fn()

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={onSetPlayerMinutes}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Increase PG-starter Player minutes' }),
    )
    expect(onSetPlayerMinutes).toHaveBeenCalledWith('PG-starter', 21)

    fireEvent.click(
      screen.getByRole('button', { name: 'Decrease PG-starter Player minutes' }),
    )
    expect(onSetPlayerMinutes).toHaveBeenCalledWith('PG-starter', 19)
  })

  it('calls onSelectPlayer when a Player name is clicked', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 20 }
    const onSelectPlayer = vi.fn()

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={onSelectPlayer}
        headingId="heading"
      />,
    )

    fireEvent.click(screen.getByText('PG-starter Player'))
    expect(onSelectPlayer).toHaveBeenCalledWith('PG-starter')
  })

  it('translates infeasible position coverage issues into coaching language, not raw codes', () => {
    const team = makeTeam()
    const minutes = defaultMinutes(team)
    const issues: SimpleRotationIntentIssue[] = [
      {
        code: 'INFEASIBLE_POSITION_COVERAGE',
        message: 'raw engine message',
        position: 'SF',
        actual: 30,
        expected: 40,
      },
    ]

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={issues}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.queryByText('INFEASIBLE_POSITION_COVERAGE')).not.toBeInTheDocument()
    expect(screen.getByText(/can't cover every position/)).toBeInTheDocument()
    expect(screen.getByText(/Advanced for exact positional control/)).toBeInTheDocument()
  })

  it('shows an empty Reserves message when every roster Player has minutes', () => {
    const team = makeTeam()
    const zeroed = defaultMinutes(team)
    const full: Record<string, number> = { ...zeroed }
    let remaining = 200
    for (const player of team.roster) {
      const assign = Math.min(20, remaining)
      full[player.id] = assign
      remaining -= assign
    }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={full}
        committedMinutesByPlayerId={full}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(
      screen.getByText('Every roster Player is currently in the rotation.'),
    ).toBeInTheDocument()
  })

  it('renders each roster Player exactly once', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 36 }

    const { container } = render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    const rows = within(container).getAllByRole('row').filter((row) =>
      row.hasAttribute('data-player-id'),
    )
    expect(rows).toHaveLength(team.roster.length)
  })
})
