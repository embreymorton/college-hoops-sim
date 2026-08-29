import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useDynastyStore } from '../store'
import { ObserverMultiSeasonSimDialog } from './ObserverMultiSeasonSimDialog'

function dynasty() {
  useDynastyStore.getState().startObserverDynasty('charlotte-tech', 'observer-dialog')
  return useDynastyStore.getState().dynasty!
}

describe('ObserverMultiSeasonSimDialog', () => {
  it('offers only the three V1 presets and explains the foreground contract', () => {
    const onSelect = vi.fn()
    render(<ObserverMultiSeasonSimDialog
      dynasty={dynasty()}
      operation={{ status: 'confirming', requestedSeasons: 5, completedSeasons: 0, startingSeasonNumber: 1, currentSeasonNumber: 1, viewedProgramId: 'charlotte-tech', summary: null }}
      onSelectHorizon={onSelect}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onDismiss={vi.fn()}
    />)
    expect(screen.getAllByRole('button', { name: /Seasons?/ })).toHaveLength(4)
    expect(screen.getByRole('button', { name: /^5 Seasons/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
    expect(screen.getByText(/Intermediate review screens will be skipped/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^10 Seasons/ }))
    expect(onSelect).toHaveBeenCalledWith(10)
  })

  it('shows real completed-Season progress without cancellation', () => {
    render(<ObserverMultiSeasonSimDialog
      dynasty={dynasty()}
      operation={{ status: 'running', requestedSeasons: 10, completedSeasons: 2, startingSeasonNumber: 1, currentSeasonNumber: 3, viewedProgramId: 'charlotte-tech', summary: null }}
      onSelectHorizon={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onDismiss={vi.fn()}
    />)
    expect(screen.getByRole('status')).toHaveTextContent('Simulating Season 3 of 10')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('presents a completed summary as a compact, sectioned recap', async () => {
    useDynastyStore.getState().startObserverDynasty('charlotte-tech', 'observer-dialog-summary')
    useDynastyStore.getState().requestObserverMultiSeasonSim()
    useDynastyStore.getState().setObserverMultiSeasonHorizon(1)
    await useDynastyStore.getState().confirmObserverMultiSeasonSim()
    const state = useDynastyStore.getState()

    render(<ObserverMultiSeasonSimDialog
      dynasty={state.dynasty!}
      operation={state.observerMultiSeasonSim!}
      onSelectHorizon={vi.fn()}
      onCancel={vi.fn()}
      onConfirm={vi.fn()}
      onDismiss={vi.fn()}
    />)

    expect(screen.getByRole('heading', { name: '1 Season Simulated' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Season by Season' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Major Awards' })).toBeInTheDocument()
    expect(screen.getByText(/Viewing/)).toBeInTheDocument()
    expect(screen.queryByText('Your Program')).not.toBeInTheDocument()
  })
})
