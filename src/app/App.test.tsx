import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDynastyStore } from '../store'
import { App } from './App'

function resetSeasonStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

beforeEach(() => {
  resetSeasonStore()
})

describe('App', () => {
  it('presents Season program selection by default', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Start a Dynasty' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'College Hoops' }),
    ).toBeInTheDocument()
  })

  it('switches to the Exhibition sandbox and back via the mode toggle', () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: /exhibition mode/i }))

    expect(
      screen.getByText('Exhibition / Development Matchup'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to season/i }))

    expect(
      screen.getByRole('heading', { name: 'Start a Dynasty' }),
    ).toBeInTheDocument()
  })
})
