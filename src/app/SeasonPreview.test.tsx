import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

beforeEach(() => useDynastyStore.setState(useDynastyStore.getInitialState()))

describe('Season Preview UI', () => {
  it('promotes from the early Hub and preserves exploration back navigation', () => {
    useDynastyStore.getState().selectProgram('charlotte-tech', DEFAULT_INTERACTIVE_TEST_SEED)
    render(<App />)

    const promotion = screen.getByRole('heading', { name: /Meet this season’s national cast/ }).closest('section')!
    fireEvent.click(within(promotion).getByRole('button', { name: 'View Season Preview' }))
    expect(screen.getByRole('heading', { name: 'Season Preview' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Established Players' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Freshmen to Know' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Back to Season' })).toBeInTheDocument()

    const firstTable = screen.getByRole('heading', { name: 'Established Players' }).closest('section')!
    fireEvent.click(within(firstTable).getAllByRole('button')[0]!)
    expect(screen.getByRole('button', { name: '← Back to Season Preview' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to Season Preview' }))
    expect(screen.getByRole('heading', { name: 'Season Preview' })).toBeInTheDocument()
  })

  it('opens the same destination from the League News header', () => {
    useDynastyStore.getState().selectProgram('charlotte-tech', DEFAULT_INTERACTIVE_TEST_SEED)
    useDynastyStore.getState().goToLeague()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Season Preview' }))
    expect(screen.getByRole('heading', { name: 'Season Preview' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Back to League' })).toBeInTheDocument()
  })
})
