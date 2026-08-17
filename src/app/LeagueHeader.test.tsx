import { render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}
function selectProgram() {
  useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED)
}
function enterLeague() {
  useDynastyStore.getState().goToLeague()
  render(<App />)
}

beforeEach(resetStore)

describe('League header', () => {
  it('shows League identity, Season/round context, and the controlled Program snapshot', () => {
    selectProgram()
    enterLeague()

    const header = document.querySelector('.league-header') as HTMLElement
    expect(header).toBeTruthy()
    expect(within(header).getByRole('heading', { name: 'The League' })).toBeInTheDocument()
    expect(within(header).getByText(/Season 1 · Regular Season · Round 1 of \d+/)).toBeInTheDocument()
    expect(within(header).getByText('Charlotte Tech')).toBeInTheDocument()
    expect(within(header).getByText(/0-0 · \d+\.\d OVR/)).toBeInTheDocument()
  })

  it('reflects the controlled Program record after games are played', () => {
    selectProgram()
    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().simulateNextGame()
    enterLeague()

    const header = document.querySelector('.league-header') as HTMLElement
    expect(within(header).getByText(/\d-\d · \d+\.\d OVR/)).toBeInTheDocument()
  })

  it('leaves League secondary navigation and Teams/News content unchanged', () => {
    selectProgram()
    enterLeague()

    expect(screen.getByRole('button', { name: 'News' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Leaders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Following' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'History' })).toBeInTheDocument()
  })
})
