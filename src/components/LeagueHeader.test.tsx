import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LeagueHeader } from './LeagueHeader'

const baseProps = {
  seasonNumber: 1,
  phaseLabel: 'Regular Season · Round 1 of 24',
  programName: 'Charlotte Tech',
  accentColor: '#123456',
  overallRecord: { wins: 10, losses: 5 },
  overallRating: 78,
}

describe('LeagueHeader Dynasty Seed', () => {
  it('shows no seed metadata when no Dynasty seed is provided', () => {
    render(<LeagueHeader {...baseProps} />)
    expect(screen.queryByText(/Dynasty Seed/)).not.toBeInTheDocument()
  })

  it('displays the canonical active Dynasty seed', () => {
    render(<LeagueHeader {...baseProps} dynastySeed={184726391} />)
    expect(screen.getByText('Dynasty Seed')).toBeInTheDocument()
    expect(screen.getByText('184726391')).toBeInTheDocument()
  })

  it('displays a string Dynasty seed as-is', () => {
    render(<LeagueHeader {...baseProps} dynastySeed="my-explicit-seed" />)
    expect(screen.getByText('my-explicit-seed')).toBeInTheDocument()
  })

  describe('Copy Seed', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      })
    })

    it('copies the exact seed and shows a transient confirmation that clears on its own', async () => {
      render(<LeagueHeader {...baseProps} dynastySeed={184726391} />)

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
      })
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('184726391')
      expect(screen.getByText('Copied')).toBeInTheDocument()

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1600))
      })
      expect(screen.queryByText('Copied')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
    })
  })
})
