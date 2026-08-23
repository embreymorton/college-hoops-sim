import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  POSITIONS,
  type Player,
  type PlayerAttributes,
  type Position,
  type RotationV1,
  type Team,
} from '../engine'
import { OpponentRotationPanel } from './OpponentRotationPanel'

function attributes(rating: number): PlayerAttributes {
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

function player(id: string, position: Position, rating: number): Player {
  return {
    id,
    firstName: id,
    lastName: 'Player',
    position,
    classYear: 'JR',
    height: 78,
    attributes: attributes(rating),
    potential: 90,
  }
}

function fixture(): { team: Team; rotation: RotationV1 } {
  const roster = POSITIONS.flatMap((position) => [
    player(`${position}-starter`, position, 80),
    player(`${position}-bench`, position, position === 'PG' ? 70 : 75),
  ])
  roster.push(player('reserve-only', 'PG', 95))
  return {
    team: {
      id: 'opponent',
      name: 'Opponent',
      abbreviation: 'OPP',
      prestige: 50,
      roster,
    },
    rotation: {
      minutesByPosition: Object.fromEntries(
        POSITIONS.map((position) => [position, {
          [`${position}-starter`]: position === 'PG' ? 25 : 30,
          [`${position}-bench`]: position === 'PG' ? 15 : 10,
        }]),
      ) as RotationV1['minutesByPosition'],
    },
  }
}

describe('OpponentRotationPanel', () => {
  it('shows the projected five, ordered positive-minute bench, and compact reserves', () => {
    const { team, rotation } = fixture()
    const onSelectPlayer = vi.fn()
    const onViewFullRoster = vi.fn()
    render(
      <OpponentRotationPanel
        team={team}
        rotation={rotation}
        program={{ primaryColor: '#123456' }}
        headingId="opponent-heading"
        onSelectPlayer={onSelectPlayer}
        onViewFullRoster={onViewFullRoster}
      />,
    )

    const starters = screen.getByRole('region', { name: 'Expected Starting Five' })
    expect(within(starters).getAllByRole('listitem')).toHaveLength(5)
    expect(within(starters).getAllByRole('listitem')[0]).toHaveTextContent('PG')

    const bench = screen.getByRole('region', { name: 'Bench' })
    const benchRows = within(bench).getAllByRole('listitem')
    expect(benchRows).toHaveLength(5)
    expect(benchRows[0]).toHaveTextContent('PG-bench Player')
    expect(screen.queryByText('reserve-only Player')).not.toBeInTheDocument()
    expect(screen.getByText('1 reserve outside the current Rotation')).toBeInTheDocument()
    expect(screen.getAllByText('MIN').length).toBeGreaterThan(0)
    expect(screen.queryByText('MPG')).not.toBeInTheDocument()

    fireEvent.click(within(bench).getByRole('button', { name: 'PG-bench Player' }))
    expect(onSelectPlayer).toHaveBeenCalledWith('PG-bench')
    fireEvent.click(screen.getByRole('button', { name: 'View Full Roster' }))
    expect(onViewFullRoster).toHaveBeenCalledOnce()
  })
})
