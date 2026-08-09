import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { getPlayerGameLog, isRegularSeasonComplete } from '../season'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const OTHER_PROGRAM_ID = 'northbridge'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
}

function playRounds(count: number) {
  for (let i = 0; i < count; i += 1) {
    if (isRegularSeasonComplete(useSeasonStore.getState().season!)) {
      return
    }
    useSeasonStore.getState().simulateNextGame()
    useSeasonStore.getState().simulateRestOfRound()
  }
}

function driveSeasonToCompletion(): void {
  for (let iteration = 0; iteration < 30; iteration += 1) {
    if (isRegularSeasonComplete(useSeasonStore.getState().season!)) {
      return
    }
    useSeasonStore.getState().simulateNextGame()
    useSeasonStore.getState().simulateRestOfRound()
  }
  throw new Error('Season did not complete within the expected round budget.')
}

/** Finds a Player on `programId` with at least one DNP entry in a partial-Season game log. */
function findPlayerWithDnp(programId: string): string {
  const { season } = useSeasonStore.getState()
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
  it('opens League from the Season Hub via the section tabs', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))

    expect(screen.getByRole('heading', { name: 'League' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /back to season/i }),
    ).toBeInTheDocument()
  })

  it('returns to the Season Hub via the back button', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))
    fireEvent.click(screen.getByRole('button', { name: /back to season/i }))

    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
  })

  it('remains accessible from the Postseason Hub', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    driveSeasonToCompletion()
    useSeasonStore.getState().enterPostseason()
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'League' }))

    expect(screen.getByRole('heading', { name: 'League' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /back to tournament/i }),
    ).toBeInTheDocument()
  })
})

describe('National Leaders', () => {
  it('shows a clear empty state before any regular-season game completes', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    useSeasonStore.getState().goToLeague()
    render(<App />)

    expect(screen.getByText(/no completed games yet/i)).toBeInTheDocument()
  })

  it('shows partial-Season leaders and opens Player Details from a leader row', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    playRounds(5)
    useSeasonStore.getState().goToLeague()
    render(<App />)

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
})

describe('Teams directory', () => {
  it('lists every Conference and opens Team Details for a non-controlled Program', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    useSeasonStore.getState().goToLeague()
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
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    useSeasonStore.getState().openTeamDetails(OTHER_PROGRAM_ID)
    render(<App />)

    const { season } = useSeasonStore.getState()
    const roster = season!.programStates[OTHER_PROGRAM_ID]!.team.roster

    for (const player of roster) {
      expect(
        screen.getByText(`${player.firstName} ${player.lastName}`),
      ).toBeInTheDocument()
    }
    expect(screen.getByText(/no completed games yet/i)).toBeInTheDocument()
  })

  it('opens the controlled Program too, and Team → Player navigation works from the roster table', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    playRounds(3)
    useSeasonStore.getState().openTeamDetails(CONTROLLED_PROGRAM_ID)
    render(<App />)

    const { season } = useSeasonStore.getState()
    const player = season!.programStates[CONTROLLED_PROGRAM_ID]!.team.roster[0]!

    fireEvent.click(
      screen.getByRole('button', { name: `${player.firstName} ${player.lastName}` }),
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
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    playRounds(6)
    const playerId = findPlayerWithDnp(CONTROLLED_PROGRAM_ID)
    useSeasonStore.getState().openPlayerDetails(CONTROLLED_PROGRAM_ID, playerId)
    render(<App />)

    expect(screen.getAllByText('DNP').length).toBeGreaterThan(0)
  })

  it('works during a partial Season and returns to Team Details via the Program link', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    playRounds(4)
    const { season } = useSeasonStore.getState()
    const otherPlayer = season!.programStates[OTHER_PROGRAM_ID]!.team.roster[0]!
    useSeasonStore.getState().openPlayerDetails(OTHER_PROGRAM_ID, otherPlayer.id)
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
})

describe('Standings → Team cross-navigation', () => {
  // Same Conference as Charlotte Tech, so its row is present on the default tab.
  const CONFERENCE_MATE_ID = 'crescent-city'

  it('opens Team Details from a Conference Standings row and returns to the Season Hub', () => {
    useSeasonStore.getState().selectProgram(CONTROLLED_PROGRAM_ID)
    render(<App />)

    const standingsSection = screen
      .getByRole('heading', { name: 'Conference Standings' })
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
