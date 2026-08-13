import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type ProjectedStartingFive,
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

/** `${position}-starter` at every position — matches `makeTeam()`'s fixture. */
function naturalStartingFive(): ProjectedStartingFive {
  return Object.fromEntries(
    POSITIONS.map((position) => [position, `${position}-starter`]),
  ) as ProjectedStartingFive
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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
        projectedStartingFive={null}
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

  it('presents Starting Five, Bench, and Reserves in PG → C order when a projection is available', () => {
    const team = makeTeam()
    const minutes = {
      ...defaultMinutes(team),
      'PG-starter': 30,
      'SG-starter': 30,
      'SF-starter': 30,
      'PF-starter': 30,
      'C-starter': 30,
      'PG-backup': 10,
    }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        projectedStartingFive={naturalStartingFive()}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.getByText('Starting Five')).toBeInTheDocument()
    expect(screen.getByText('Bench')).toBeInTheDocument()
    expect(screen.getByText('Reserves')).toBeInTheDocument()
    expect(screen.queryByText('Rotation Players')).not.toBeInTheDocument()

    const startingFiveRow = screen.getByText('PG-starter Player').closest('tr')!
    const benchRow = screen.getByText('PG-backup Player').closest('tr')!
    const reservesRow = screen.getByText('SG-backup Player').closest('tr')!
    expect(
      startingFiveRow.compareDocumentPosition(benchRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      benchRow.compareDocumentPosition(reservesRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    for (const position of POSITIONS) {
      const row = screen.getByText(`${position}-starter Player`).closest('tr')!
      expect(within(row).getByText(position)).toBeInTheDocument()
    }
  })

  it('keeps a projected starter in Starting Five when their draft is edited to 0 minutes before Apply', () => {
    const team = makeTeam()
    const minutes = {
      ...defaultMinutes(team),
      'PG-starter': 0,
      'SG-starter': 30,
      'SF-starter': 30,
      'PF-starter': 30,
      'C-starter': 30,
    }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        projectedStartingFive={naturalStartingFive()}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    const startingFiveGroup = screen
      .getByText('Starting Five')
      .closest('tbody')!
    expect(
      within(startingFiveGroup).getByText('PG-starter Player'),
    ).toBeInTheDocument()
    expect(screen.queryByText('Rotation Players')).not.toBeInTheDocument()
  })

  it('moves a Bench Player to Reserves at 0 minutes, and a Reserve to Bench with positive minutes', () => {
    const team = makeTeam()
    const projectedStartingFive = naturalStartingFive()
    const onBench = { ...defaultMinutes(team), 'PG-backup': 10 }
    const onReserves = { ...defaultMinutes(team), 'PG-backup': 0 }

    const { rerender } = render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={onBench}
        committedMinutesByPlayerId={onBench}
        projectedStartingFive={projectedStartingFive}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(
      within(screen.getByText('Bench').closest('tbody')!).getByText(
        'PG-backup Player',
      ),
    ).toBeInTheDocument()

    rerender(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={onReserves}
        committedMinutesByPlayerId={onBench}
        projectedStartingFive={projectedStartingFive}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(
      within(screen.getByText('Reserves').closest('tbody')!).getByText(
        'PG-backup Player',
      ),
    ).toBeInTheDocument()
  })

  it('orders Bench by descending draft MPG, using roster order as a stable tie-break', () => {
    const team = makeTeam()
    const minutes = {
      ...defaultMinutes(team),
      'SG-backup': 6,
      'PF-backup': 6,
      'C-backup': 14,
    }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        projectedStartingFive={naturalStartingFive()}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    const benchGroup = screen.getByText('Bench').closest('tbody')!
    const benchPlayerIds = within(benchGroup)
      .getAllByRole('row')
      .filter((row) => row.hasAttribute('data-player-id'))
      .map((row) => row.getAttribute('data-player-id'))

    expect(benchPlayerIds).toEqual(['C-backup', 'SG-backup', 'PF-backup'])
  })

  it('falls back to a flat Rotation Players / Reserves presentation without a Starting Five projection', () => {
    const team = makeTeam()
    const minutes = { ...defaultMinutes(team), 'PG-starter': 30 }

    render(
      <SimpleRotationPanel
        team={team}
        program={{ primaryColor: '#123456' }}
        minutesByPlayerId={minutes}
        committedMinutesByPlayerId={minutes}
        projectedStartingFive={null}
        issues={[]}
        onSetPlayerMinutes={vi.fn()}
        onApply={vi.fn()}
        onDiscard={vi.fn()}
        onSelectPlayer={vi.fn()}
        headingId="heading"
      />,
    )

    expect(screen.queryByText('Starting Five')).not.toBeInTheDocument()
    expect(screen.queryByText('Bench')).not.toBeInTheDocument()
    expect(screen.getByText('Rotation Players')).toBeInTheDocument()
    expect(screen.getByText('Reserves')).toBeInTheDocument()
  })
})
