import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  deriveTeamSeasonStats,
  getCompletedGamesForProgram,
  getPlayerGameLog,
  isRegularSeasonComplete,
} from '../season'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_ID = 'northbridge'

function resetStore() {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function selectControlledProgram(): void {
  useDynastyStore.getState().selectProgram(
    CONTROLLED_PROGRAM_ID,
    DEFAULT_INTERACTIVE_TEST_SEED,
  )
}

function playRounds(count: number) {
  useDynastyStore.getState().generateControlledDraftBoard()
  for (let i = 0; i < count; i += 1) {
    if (isRegularSeasonComplete(useDynastyStore.getState().dynasty!.activeSeason!)) {
      return
    }
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()
  }
}

function driveSeasonToCompletion(): void {
  useDynastyStore.getState().generateControlledDraftBoard()
  for (let iteration = 0; iteration < 30; iteration += 1) {
    if (isRegularSeasonComplete(useDynastyStore.getState().dynasty!.activeSeason!)) {
      return
    }
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()
  }
  throw new Error('Season did not complete within the expected round budget.')
}

/** Finds a Player on `programId` with at least one DNP entry in a partial-Season game log. */
function findPlayerWithDnp(programId: string): string {
  const { activeSeason: season } = useDynastyStore.getState().dynasty!
  const roster = season!.programStates[programId]!.team.roster

  for (const player of roster) {
    const log = getPlayerGameLog(season!, programId, player.id)
    if (log.length > 0 && log.some((entry) => !entry.didPlay)) {
      return player.id
    }
  }

  throw new Error(`No Player with a DNP found on Program "${programId}"`)
}

beforeEach(() => {
  resetStore()
})

describe('League navigation', () => {
  it('opens League from the Season Hub via the section tabs, with no redundant root chrome', () => {
    selectControlledProgram()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))

    expect(screen.getByRole('button', { name: 'Leaders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Teams' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'League' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Primary Dynasty navigation already establishes location — the root
    // League view carries no separate Back action or duplicate heading.
    expect(
      screen.queryByRole('button', { name: /back to season/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'League' }),
    ).not.toBeInTheDocument()
  })

  it('returns to the Season Hub via the primary section nav', () => {
    selectControlledProgram()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))
    fireEvent.click(screen.getByRole('button', { name: 'Season' }))

    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
  })

  it('remains accessible from the Postseason Hub, with no redundant root chrome', () => {
    selectControlledProgram()
    driveSeasonToCompletion()
    useDynastyStore.getState().enterPostseason()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))

    expect(screen.getByRole('button', { name: 'Leaders' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Teams' })).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /back to tournament/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'League' }),
    ).not.toBeInTheDocument()
  })
})

describe('National Leaders', () => {
  it('shows a clear empty state before any regular-season game completes', () => {
    selectControlledProgram()
    useDynastyStore.getState().goToLeague()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }))
    expect(screen.getByText(/no completed games yet/i)).toBeInTheDocument()
  })

  it('shows partial-Season leaders and opens Player Details from a leader row', () => {
    selectControlledProgram()
    playRounds(5)
    useDynastyStore.getState().goToLeague()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }))
    const scoringBoard = screen.getByText('Scoring').closest('.leader-board')!
    const firstPlayerButton = within(scoringBoard as HTMLElement).getAllByRole(
      'button',
    )[0]!
    const playerName = firstPlayerButton.textContent

    fireEvent.click(firstPlayerButton)

    expect(
      screen.getByRole('heading', { name: new RegExp(playerName!) }),
    ).toBeInTheDocument()
    expect(screen.getByText('Regular Season')).toBeInTheDocument()
  })

  it('opens a leader Program separately and returns to League', () => {
    selectControlledProgram()
    playRounds(3)
    useDynastyStore.getState().goToLeague()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }))
    const scoringBoard = screen.getByText('Scoring').closest('.leader-board')!
    const firstRow = scoringBoard.querySelector('tbody tr') as HTMLElement
    const [playerButton, programButton] = within(firstRow).getAllByRole('button')
    const programName = programButton!.textContent!

    expect(playerButton).not.toBe(programButton)
    fireEvent.click(programButton!)

    expect(
      screen.getByRole('heading', { name: programName }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to league/i }))
    expect(screen.getByRole('button', { name: 'Leaders' })).toBeInTheDocument()
    expect(screen.getByText('Scoring')).toBeInTheDocument()
  })
})

describe('Teams directory', () => {
  it('lists every Conference and opens Team Details for a non-controlled Program', () => {
    selectControlledProgram()
    useDynastyStore.getState().goToLeague()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Teams' }))

    for (const conference of UNIVERSE_V0.conferences) {
      expect(screen.getByText(conference.name)).toBeInTheDocument()
    }

    const otherProgram = UNIVERSE_V0.programs.find(
      (program) => program.id === OTHER_PROGRAM_ID,
    )!
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${otherProgram.name}`) }))

    expect(
      screen.getByRole('heading', { name: otherProgram.name }),
    ).toBeInTheDocument()
    expect(screen.getByText('Overall')).toBeInTheDocument()
    expect(screen.getByText('Off')).toBeInTheDocument()
    expect(screen.getByText('Def')).toBeInTheDocument()
  })
})

describe('Team Details', () => {
  it('shows the full current roster and a zero-game-safe Team Leaders state before any games', () => {
    selectControlledProgram()
    useDynastyStore.getState().openTeamDetails(OTHER_PROGRAM_ID)
    render(<App />)

    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const roster = season!.programStates[OTHER_PROGRAM_ID]!.team.roster

    for (const player of roster) {
      expect(
        screen.getByText(`${player.firstName} ${player.lastName}`),
      ).toBeInTheDocument()
    }
    expect(screen.getAllByText(/no completed games yet/i)).toHaveLength(2)
    const detailsTabs = screen.getByRole('group', { name: 'Team details section' })
    expect(within(detailsTabs).getByRole('button', { name: 'Overview' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('heading', { name: 'Dynasty History' })).not.toBeInTheDocument()
    fireEvent.click(within(detailsTabs).getByRole('button', { name: 'History' }))
    expect(screen.getByRole('heading', { name: 'Dynasty History' })).toBeInTheDocument()
    expect(screen.getByText(/history will appear after this Season/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Program Player Records' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Roster' })).not.toBeInTheDocument()
    fireEvent.click(within(detailsTabs).getByRole('button', { name: 'Overview' }))
    expect(screen.getByRole('heading', { name: 'Roster' })).toBeInTheDocument()
    expect(screen.getByText(/Providence, RI · Prestige 88/)).toBeInTheDocument()
    expect(screen.getAllByText('Unestablished').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Recent Era' })).toBeInTheDocument()
    expect(screen.getByText(/Reputation establishes after completed Dynasty results/i)).toBeInTheDocument()
    const averages = screen
      .getByRole('heading', { name: 'Team Averages' })
      .closest('section') as HTMLElement
    expect(within(averages).getAllByText('0.0')).toHaveLength(6)
    expect(within(averages).getAllByText('0.0%')).toHaveLength(3)
    const recentResults = screen
      .getByRole('heading', { name: 'Recent Results' })
      .closest('section') as HTMLElement
    expect(
      within(recentResults).getByText(/no completed games yet/i),
    ).toBeInTheDocument()
  })

  it('renders canonical partial-season Team Averages', () => {
    selectControlledProgram()
    playRounds(3)
    useDynastyStore.getState().openTeamDetails(OTHER_PROGRAM_ID)
    render(<App />)

    const stats = deriveTeamSeasonStats(
      useDynastyStore.getState().dynasty!.activeSeason!,
      OTHER_PROGRAM_ID,
    )
    const averages = screen
      .getByRole('heading', { name: 'Team Averages' })
      .closest('section') as HTMLElement

    expect(stats.gamesPlayed).toBe(3)
    expect(
      within(within(averages).getByText('PPG').parentElement!).getByText(
        stats.pointsPerGame.toFixed(1),
      ),
    ).toBeInTheDocument()
    expect(
      within(within(averages).getByText('Opp PPG').parentElement!).getByText(
        stats.opponentPointsPerGame.toFixed(1),
      ),
    ).toBeInTheDocument()
    expect(
      within(within(averages).getByText('FG').parentElement!).getByText(
        `${(stats.fieldGoalPercentage * 100).toFixed(1)}%`,
      ),
    ).toBeInTheDocument()
    const recentResults = screen
      .getByRole('heading', { name: 'Recent Results' })
      .closest('section') as HTMLElement
    expect(
      recentResults.querySelectorAll('.recent-results__row'),
    ).toHaveLength(3)
  })

  it('shows live Program Player Records, switches category, and restores Team Details after Player navigation', () => {
    selectControlledProgram()
    playRounds(3)
    useDynastyStore.getState().openTeamDetails(OTHER_PROGRAM_ID)
    render(<App />)

    const detailsTabs = screen.getByRole('group', { name: 'Team details section' })
    fireEvent.click(within(detailsTabs).getByRole('button', { name: 'History' }))

    const section = screen
      .getByRole('heading', { name: 'Program Player Records' })
      .closest('section') as HTMLElement
    expect(within(section).getByRole('button', { name: 'PTS' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(section).getByText('Single Game')).toBeInTheDocument()
    expect(within(section).getByText('Single Season')).toBeInTheDocument()
    expect(within(section).getByText('Career')).toBeInTheDocument()
    expect(within(section).getByText('Live')).toBeInTheDocument()

    fireEvent.click(within(section).getByRole('button', { name: 'REB' }))
    expect(within(section).getByRole('button', { name: 'REB' })).toHaveAttribute('aria-pressed', 'true')

    const holder = within(section).getAllByRole('button')
      .find((button) => !['PTS', 'REB', 'AST', 'STL', 'BLK'].includes(button.textContent ?? ''))!
    fireEvent.click(holder)
    expect(screen.getByRole('heading', { name: holder.textContent! })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to team/i }))
    expect(screen.getByRole('heading', { name: 'Team Averages' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Program Player Records' })).not.toBeInTheDocument()
  })

  it('shows only the five most recent results in order with correct home/away context', () => {
    selectControlledProgram()
    playRounds(7)
    useDynastyStore.getState().openTeamDetails(OTHER_PROGRAM_ID)
    render(<App />)

    const season = useDynastyStore.getState().dynasty!.activeSeason!
    const expected = getCompletedGamesForProgram(season, OTHER_PROGRAM_ID)
      .slice()
      .sort(
        (first, second) =>
          second.game.round - first.game.round ||
          second.game.index - first.game.index,
      )
      .slice(0, 5)
    const recentResults = screen
      .getByRole('heading', { name: 'Recent Results' })
      .closest('section') as HTMLElement
    const rows = [...recentResults.querySelectorAll('.recent-results__row')]

    expect(rows).toHaveLength(5)
    expected.forEach(({ game, result }, index) => {
      const isHome = game.homeProgramId === OTHER_PROGRAM_ID
      const opponentId = isHome ? game.awayProgramId : game.homeProgramId
      const opponent = UNIVERSE_V0.programs.find(
        (program) => program.id === opponentId,
      )!
      const teamScore = isHome ? result.homeScore : result.awayScore
      const opponentScore = isHome ? result.awayScore : result.homeScore
      const outcome = result.winnerId === OTHER_PROGRAM_ID ? 'W' : 'L'

      expect(rows[index]).toHaveTextContent(`${outcome}${teamScore}-${opponentScore}`)
      expect(rows[index]).toHaveTextContent(
        `${isHome ? 'vs' : '@'} ${opponent.name}`,
      )
    })
  })

  it('opens the controlled Program too, and Team → Player navigation works from the roster table', () => {
    selectControlledProgram()
    playRounds(3)
    useDynastyStore.getState().openTeamDetails(CONTROLLED_PROGRAM_ID)
    render(<App />)

    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const player = season!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    const rosterSection = screen
      .getByRole('heading', { name: 'Roster' })
      .closest('section') as HTMLElement

    fireEvent.click(
      within(rosterSection).getByRole('button', { name: `${player.firstName} ${player.lastName}` }),
    )

    expect(
      screen.getByRole('heading', {
        name: `${player.firstName} ${player.lastName}`,
      }),
    ).toBeInTheDocument()
  })
})

describe('Player Details', () => {
  it('shows a DNP entry in the game log using the canonical game-log projection', () => {
    selectControlledProgram()
    playRounds(6)
    const playerId = findPlayerWithDnp(CONTROLLED_PROGRAM_ID)
    useDynastyStore.getState().openPlayerDetails(CONTROLLED_PROGRAM_ID, playerId)
    render(<App />)

    expect(screen.getAllByText('DNP').length).toBeGreaterThan(0)
  })

  it('works during a partial Season and returns to Team Details via the Program link', () => {
    selectControlledProgram()
    playRounds(4)
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const otherPlayer = season!.programStates[OTHER_PROGRAM_ID]!.team.roster[0]!
    useDynastyStore.getState().openPlayerDetails(OTHER_PROGRAM_ID, otherPlayer.id)
    render(<App />)

    expect(screen.getByText('Regular Season')).toBeInTheDocument()

    const otherProgram = UNIVERSE_V0.programs.find(
      (program) => program.id === OTHER_PROGRAM_ID,
    )!
    fireEvent.click(screen.getByRole('button', { name: otherProgram.name }))

    expect(
      screen.getByRole('heading', { name: otherProgram.name }),
    ).toBeInTheDocument()
    // Came from Player Details, so the back step returns there, not to Season.
    expect(
      screen.getByRole('button', { name: /back to player/i }),
    ).toBeInTheDocument()
  })

  it('opens a game-log opponent and returns to Player Details', () => {
    selectControlledProgram()
    playRounds(3)
    const { activeSeason: season } = useDynastyStore.getState().dynasty!
    const player = season!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!
    const firstLogEntry = getPlayerGameLog(
      season!,
      CONTROLLED_PROGRAM_ID,
      player.id,
    )[0]!
    const opponent = UNIVERSE_V0.programs.find(
      (program) => program.id === firstLogEntry.opponentProgramId,
    )!
    useDynastyStore
      .getState()
      .openPlayerDetails(CONTROLLED_PROGRAM_ID, player.id)
    render(<App />)

    fireEvent.click(
      screen.getByRole('button', {
        name: `${firstLogEntry.location === 'home' ? 'vs' : '@'} ${opponent.name}`,
      }),
    )

    expect(
      screen.getByRole('heading', { name: opponent.name }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /back to player/i }))
    expect(
      screen.getByRole('heading', {
        name: `${player.firstName} ${player.lastName}`,
      }),
    ).toBeInTheDocument()
  })
})

describe('Standings → Team cross-navigation', () => {
  // Same Conference as Charlotte Tech, so its row is present on the default tab.
  const CONFERENCE_MATE_ID = 'crescent-city'

  it('opens Team Details from a Conference Standings row and returns to the Season Hub', () => {
    selectControlledProgram()
    render(<App />)

    const standingsSection = screen
      .getByRole('heading', { name: /Conference Standings$/ })
      .closest('section')!
    const conferenceMate = UNIVERSE_V0.programs.find(
      (program) => program.id === CONFERENCE_MATE_ID,
    )!
    const rowButton = within(standingsSection as HTMLElement).getByRole(
      'button',
      { name: new RegExp(`^${conferenceMate.name}`) },
    )

    fireEvent.click(rowButton)
    expect(
      screen.getByRole('heading', { name: conferenceMate.name }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to season/i }))
    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
  })
})
