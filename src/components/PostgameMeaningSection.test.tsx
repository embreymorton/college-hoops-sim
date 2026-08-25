import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { PostgameMeaning } from '../dynasty'
import { PostgameMeaningSection } from './PostgameMeaningSection'

const player = {
  playerId: 'player-stable-id',
  firstName: 'Marcus',
  lastName: 'Webb',
  program: { programId: 'pine-valley', name: 'Pine Valley', abbreviation: 'PVU' },
} as const

describe('PostgameMeaningSection', () => {
  it('renders the structured fact cap and navigates by stable Program/Player IDs', () => {
    const onSelectPlayer = vi.fn()
    const meaning: PostgameMeaning = {
      competition: 'regular-season',
      gameId: 'game-1',
      presentation: 'live',
      facts: [
        {
          kind: 'statistical-record', scope: 'dynasty-single-game', player,
          records: [{ category: 'points', value: 51 }],
        },
        {
          kind: 'career-high', competition: 'regular-season', player,
          records: [{ category: 'assists', value: 14 }],
        },
        {
          kind: 'streak', streak: 'ten-wins', program: player.program,
          opponent: { programId: 'great-lakes', name: 'Great Lakes', abbreviation: 'GLU' },
          wins: 10,
        },
      ],
    }
    const { container } = render(
      <PostgameMeaningSection meaning={meaning} onSelectPlayer={onSelectPlayer} />,
    )
    expect(container.querySelectorAll('.postgame-meaning__fact')).toHaveLength(3)
    fireEvent.click(screen.getAllByRole('button', { name: 'Marcus Webb' })[0]!)
    expect(onSelectPlayer).toHaveBeenCalledWith('pine-valley', 'player-stable-id')
  })

  it('renders retrospective championship and upset facts with both seeds', () => {
    const winner = { programId: 'pine-valley', name: 'Pine Valley', abbreviation: 'PVU' }
    const loser = { programId: 'great-lakes', name: 'Great Lakes', abbreviation: 'GLU' }
    const meaning: PostgameMeaning = {
      competition: 'tournament', gameId: 'title', presentation: 'historical',
      facts: [
        {
          kind: 'competitive-outcome', outcome: 'championship', winner, loser,
          completedRound: 'championship', nextRound: null,
        },
        { kind: 'tournament-upset', winner, loser, winnerSeed: 12, loserSeed: 4 },
      ],
    }
    render(<PostgameMeaningSection meaning={meaning} />)
    expect(screen.getByText(/Pine Valley became National Champion/)).toBeInTheDocument()
    expect(screen.getByText(/No. 12 Pine Valley eliminated No. 4 Great Lakes/)).toBeInTheDocument()
  })
})
