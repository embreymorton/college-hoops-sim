import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function resetStore() { useDynastyStore.setState(useDynastyStore.getInitialState()) }
function selectProgram() { useDynastyStore.getState().selectProgram(CONTROLLED_PROGRAM_ID, DEFAULT_INTERACTIVE_TEST_SEED) }
function enterLeague() { useDynastyStore.getState().goToLeague(); render(<App />) }

function publishScoringStory() {
  useDynastyStore.getState().generateControlledDraftBoard()
  useDynastyStore.getState().simulateNextGame()
  useDynastyStore.getState().simulateRestOfRound()
  const state = useDynastyStore.getState()
  const dynasty = state.dynasty!
  const season = dynasty.activeSeason!
  const game = season.schedule.games.find(({ round }) => round === 1)!
  const result = season.resultsByGameId[game.id]!
  const playerId = result.homePlayerStats[0]!.playerId
  const homePlayerStats = result.homePlayerStats.map((row, index) => index === 0 ? { ...row, points: 40 } : row)
  useDynastyStore.setState({ dynasty: { ...dynasty, activeSeason: { ...season, resultsByGameId: { ...season.resultsByGameId, [game.id]: { ...result, homePlayerStats } } } } })
  return { playerId, programId: game.homeProgramId }
}

function completeQuietRound() {
  useDynastyStore.getState().generateControlledDraftBoard()
  useDynastyStore.getState().simulateNextGame()
  useDynastyStore.getState().simulateRestOfRound()
  const dynasty = useDynastyStore.getState().dynasty!
  const season = dynasty.activeSeason!
  const resultsByGameId = Object.fromEntries(Object.entries(season.resultsByGameId).map(([id, result]) => [id, {
    ...result,
    homePlayerStats: result.homePlayerStats.map((row) => ({ ...row, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })),
    awayPlayerStats: result.awayPlayerStats.map((row) => ({ ...row, points: 0, rebounds: 0, assists: 0, steals: 0, blocks: 0 })),
  }]))
  useDynastyStore.setState({ dynasty: { ...dynasty, activeSeason: { ...season, resultsByGameId } } })
}

beforeEach(resetStore)

describe('League — News / Around the Country', () => {
  it('opens News first on fresh entry and shows the intentional empty state', () => {
    selectProgram()
    enterLeague()
    expect(screen.getByRole('button', { name: 'News' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Around the Country' })).toBeInTheDocument()
    expect(screen.getByText(/complete a full round/i)).toBeInTheDocument()
    for (const name of ['Leaders', 'Teams', 'Following']) expect(screen.getByRole('button', { name })).toBeInTheDocument()
  })

  it('renders a published story with Player and Program navigation and restores News on Back', () => {
    selectProgram()
    const { playerId, programId } = publishScoringStory()
    const dynasty = useDynastyStore.getState().dynasty!
    const player = dynasty.activeSeason!.programStates[programId]!.team.roster.find(({ id }) => id === playerId)!
    enterLeague()
    expect(screen.getByRole('heading', { name: 'Round 1' })).toBeInTheDocument()
    expect(screen.queryByText(/No notable news/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: `${player.firstName} ${player.lastName}` }))
    expect(screen.getByRole('button', { name: '← Back to League' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))
    expect(screen.getByRole('button', { name: 'News' })).toHaveAttribute('aria-pressed', 'true')
  })

  it.each(['Teams', 'Leaders', 'Following'] as const)('restores the %s tab after detail exploration and resets a later fresh entry to News', (tab) => {
    selectProgram()
    const { playerId, programId } = publishScoringStory()
    if (tab === 'Following') useDynastyStore.getState().followPlayer(playerId)
    enterLeague()
    fireEvent.click(screen.getByRole('button', { name: tab }))
    if (tab === 'Teams') {
      const directory = screen.getByRole('region', { name: 'League' })
      fireEvent.click(within(directory).getByRole('button', { name: /Granite Coast/ }))
    } else {
      const player = useDynastyStore.getState().dynasty!.activeSeason!.programStates[programId]!.team.roster.find(({ id }) => id === playerId)!
      const buttons = screen.queryAllByRole('button', { name: `${player.firstName} ${player.lastName}` })
      fireEvent.click(buttons[0] ?? screen.getAllByRole('button').find((button) => button.textContent && button.textContent !== tab && button.closest('table'))!)
    }
    fireEvent.click(screen.getByRole('button', { name: /Back to League/ }))
    expect(screen.getByRole('button', { name: tab })).toHaveAttribute('aria-pressed', 'true')
    useDynastyStore.getState().goToHub()
    useDynastyStore.getState().goToLeague()
    expect(useDynastyStore.getState().leagueTab).toBe('news')
  })

  it('quietly identifies the latest completed empty checkpoint without creating a story group', () => {
    selectProgram()
    completeQuietRound()
    enterLeague()
    expect(screen.getByText('Round 1 complete · No notable news')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Round 1' })).not.toBeInTheDocument()
    expect(screen.queryByText(/complete a full round/i)).not.toBeInTheDocument()
    expect(document.querySelectorAll('.news-story')).toHaveLength(0)
  })
})
