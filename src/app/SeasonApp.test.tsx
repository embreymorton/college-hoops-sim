import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { selectNationalTournamentField } from '../postseason'
import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  getCompletedGamesForProgram,
  getCurrentRound,
  getNextGameForProgram,
  isRegularSeasonComplete,
} from '../season'
import { MIDSEASON_ROUND, useSeasonStore } from '../store'
import { UNIVERSE_V0 } from '../universe'
import { App } from './App'

function resetStore() {
  useSeasonStore.setState(useSeasonStore.getInitialState())
}

function selectProgramViaUI(programName: string) {
  const button = [...document.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes(programName),
  )

  if (!button) {
    throw new Error(`Program row for "${programName}" not found`)
  }

  fireEvent.click(button)
}

function clickButtonByText(pattern: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: pattern }))
}

function driveSeasonToCompletion(): void {
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const season = useSeasonStore.getState().season!

    if (isRegularSeasonComplete(season)) {
      return
    }

    useSeasonStore.getState().simulateNextGame()
    useSeasonStore.getState().simulateRestOfRound()
  }

  throw new Error('Season did not complete within the expected round budget.')
}

function finishRegularSeasonWithSuperSim(): void {
  useSeasonStore.getState().selectProgram('charlotte-tech')
  useSeasonStore.getState().requestSuperSim('endOfRegularSeason')
  useSeasonStore.getState().confirmSuperSim()
}

beforeEach(() => {
  resetStore()
})

describe('Season Presentation', () => {
  it('presents permanent Universe V0 program selection initially', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Choose Your Program' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Great Lakes')).toBeInTheDocument()
    expect(screen.getAllByText(/Conference$/).length).toBeGreaterThan(0)
  })

  it('shows the Season Hub with 0-0 records and Round 1 after selecting a Program', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    expect(
      screen.getByRole('heading', { name: 'Charlotte Tech' }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('0-0').length).toBeGreaterThan(0)
    expect(screen.getByText('Southern Crescent Conference · Season 1')).toBeInTheDocument()

    const header = document.querySelector('.season-header') as HTMLElement
    expect(within(header).getByText('1')).toBeInTheDocument()
  })

  it('shows the real next opponent from the Schedule on the hub', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    const { season, controlledProgramId } = useSeasonStore.getState()
    const nextGame = getNextGameForProgram(season!, controlledProgramId!)!
    const opponentId =
      nextGame.homeProgramId === controlledProgramId
        ? nextGame.awayProgramId
        : nextGame.homeProgramId
    const opponentTeam = season!.programStates[opponentId]!.team

    const nextGameCard = document.querySelector('.next-game-card') as HTMLElement
    expect(
      within(nextGameCard).getAllByText(new RegExp(opponentTeam.name)).length,
    ).toBeGreaterThan(0)
    expect(within(nextGameCard).getByText(`Round ${nextGame.round}`)).toBeInTheDocument()
  })

  it('shows the opponent overall and Conference record on the hub, matching the Season-derived record', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    // Play a few rounds so the next opponent has a non-trivial record to show.
    for (let round = 0; round < 3; round += 1) {
      useSeasonStore.getState().simulateNextGame()
      useSeasonStore.getState().simulateRestOfRound()
    }
    useSeasonStore.getState().goToHub()

    render(<App />)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const nextGame = getNextGameForProgram(season!, controlledProgramId!)!
    const opponentId =
      nextGame.homeProgramId === controlledProgramId
        ? nextGame.awayProgramId
        : nextGame.homeProgramId
    const expectedRecord = deriveProgramRecord(season!, opponentId)
    const expectedConferenceRecord = deriveConferenceRecord(season!, opponentId)

    const nextGameCard = document.querySelector('.next-game-card') as HTMLElement
    expect(
      within(nextGameCard).getByText(
        new RegExp(
          `${expectedRecord.wins}-${expectedRecord.losses}.*${expectedConferenceRecord.wins}-${expectedConferenceRecord.losses} Conf`,
        ),
      ),
    ).toBeInTheDocument()
  })

  it('exposes a direct Quick Sim action for the pending game on the Hub, alongside Manage Rotation', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    const matchupCard = document.querySelector('.next-game-card') as HTMLElement
    const roundProgress = document.querySelector('.round-progress') as HTMLElement

    expect(
      within(matchupCard).getByRole('button', { name: /^simulate game$/i }),
    ).toBeInTheDocument()
    expect(
      within(matchupCard).getByRole('button', { name: /manage rotation/i }),
    ).toBeInTheDocument()
    expect(
      within(matchupCard).queryByRole('button', { name: /^super sim/i }),
    ).not.toBeInTheDocument()
    expect(
      within(roundProgress).getByRole('button', {
        name: /simulate rest of round/i,
      }),
    ).toBeInTheDocument()
    expect(
      within(roundProgress).getByRole('button', { name: /^super sim/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('.super-sim-row')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /prepare for game/i }),
    ).not.toBeInTheDocument()
  })

  it('Quick Sim records the actual ScheduledGame result directly from the hub, with no Game Prep screen', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    const { season, controlledProgramId } = useSeasonStore.getState()
    const game = getNextGameForProgram(season!, controlledProgramId!)!

    clickButtonByText(/^simulate game$/i)

    const state = useSeasonStore.getState()
    const result = state.season!.resultsByGameId[game.id]
    expect(result).toBeDefined()
    expect(state.view).toBe('postgame')
    expect(screen.getByText(String(result!.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result!.awayScore))).toBeInTheDocument()
  })

  it('Manage Rotation still opens the existing Rotation Editor workflow', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/manage rotation/i)

    expect(
      screen.getByRole('heading', { name: /your rotation/i }),
    ).toBeInTheDocument()
    expect(document.querySelector('.rotation-table')).not.toBeNull()
  })

  it('gates simulation on a legal draft Rotation in Game Prep', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/manage rotation/i)

    const homePanel = document.querySelectorAll('.team-panel')[0] as HTMLElement
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    const originalValue = (input as HTMLInputElement).value

    fireEvent.change(input, {
      target: { value: String(Number(originalValue) + 6) },
    })

    const simulateButton = screen.getByRole('button', {
      name: /simulate game/i,
    })
    expect(simulateButton).toBeDisabled()

    fireEvent.change(input, { target: { value: originalValue } })
    expect(simulateButton).not.toBeDisabled()
  })

  it('records the actual ScheduledGame result and shows it in postgame via Manage Rotation', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/manage rotation/i)
    clickButtonByText(/simulate game/i)

    const { season, lastPlayedGameId } = useSeasonStore.getState()
    const result = season!.resultsByGameId[lastPlayedGameId!]!

    expect(screen.getByText(String(result.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result.awayScore))).toBeInTheDocument()
  })

  it('renders Player box-score rows from the recorded Season GameResult', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/^simulate game$/i)

    const { season, lastPlayedGameId } = useSeasonStore.getState()
    const result = season!.resultsByGameId[lastPlayedGameId!]!
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!

    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()
  })

  it('completes remaining Round 1 games via Simulate Rest of Round & Continue in a single action, back at the Hub', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/simulate rest of round & continue/i)

    const { season, controlledProgramId, view } = useSeasonStore.getState()
    expect(view).toBe('hub')

    const round1Games = season!.schedule.games.filter(
      (game) => game.round === 1,
    )
    expect(
      round1Games.every((game) => season!.resultsByGameId[game.id]),
    ).toBe(true)

    // The controlled Program's record reflects its own recorded result.
    const ownResult = round1Games
      .map((game) => season!.resultsByGameId[game.id]!)
      .find(
        (result) =>
          result.homeTeamId === controlledProgramId ||
          result.awayTeamId === controlledProgramId,
      )!
    const expectedRecordText =
      ownResult.winnerId === controlledProgramId ? '1-0' : '0-1'
    expect(screen.getAllByText(expectedRecordText).length).toBeGreaterThan(0)

    const header = document.querySelector('.season-header') as HTMLElement
    expect(within(header).getByText('2')).toBeInTheDocument()

    const round2Games = season!.schedule.games.filter(
      (game) => game.round === 2,
    )
    expect(
      round2Games.some((game) => season!.resultsByGameId[game.id] !== undefined),
    ).toBe(false)
  })

  it('renders Conference standings matching the Season standings API', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/simulate rest of round & continue/i)

    const { season } = useSeasonStore.getState()
    const controlledProgram = UNIVERSE_V0.programs.find(
      (program) => program.id === 'charlotte-tech',
    )!
    const expectedStandings = deriveConferenceStandings(
      UNIVERSE_V0,
      season!,
      controlledProgram.conferenceId,
    )

    const standingsTable = document.querySelector('.standings-table')
    const renderedRows = within(standingsTable as HTMLElement).getAllByRole(
      'row',
    )
    // First row is the header; data rows follow in the derived standings order.
    const firstDataRow = renderedRows[1]!
    const firstProgramName = UNIVERSE_V0.programs.find(
      (program) => program.id === expectedStandings[0]!.programId,
    )!.name
    expect(within(firstDataRow).getByText(firstProgramName)).toBeInTheDocument()
  })

  it('shows actual completed game results in the schedule table, distinguishing win/loss/next/pending', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/return to season hub/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const round1Game = season!.schedule.games.find(
      (game) =>
        game.round === 1 &&
        (game.homeProgramId === controlledProgramId ||
          game.awayProgramId === controlledProgramId),
    )!
    const result = season!.resultsByGameId[round1Game.id]!
    const isControlledHome = round1Game.homeProgramId === controlledProgramId
    const controlledScore = isControlledHome
      ? result.homeScore
      : result.awayScore
    const opponentScore = isControlledHome
      ? result.awayScore
      : result.homeScore
    const outcome = controlledScore > opponentScore ? 'win' : 'loss'

    const scheduleTable = document.querySelector('.schedule-table') as HTMLElement
    const completedRow = scheduleTable.querySelector(
      `tr[data-status="${outcome}"]`,
    ) as HTMLElement
    expect(completedRow).not.toBeNull()
    expect(
      within(completedRow).getByText(
        `${outcome === 'win' ? 'W' : 'L'} ${controlledScore}-${opponentScore}`,
      ),
    ).toBeInTheDocument()
    expect(scheduleTable.querySelector('tr[data-status="next"]')).not.toBeNull()
    expect(
      scheduleTable.querySelectorAll('tr[data-status="pending"]').length,
    ).toBeGreaterThan(0)
  })

  it('opens a completed schedule game as a read-only historical result, with full box scores and no resimulation actions', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/^simulate game$/i)
    clickButtonByText(/return to season hub/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const round1Game = season!.schedule.games.find(
      (game) =>
        game.round === 1 &&
        (game.homeProgramId === controlledProgramId ||
          game.awayProgramId === controlledProgramId),
    )!
    const result = season!.resultsByGameId[round1Game.id]!

    const resultButton = screen.getByRole('button', {
      name: new RegExp(`^[WL] \\d+-\\d+$`),
    })
    fireEvent.click(resultButton)

    expect(useSeasonStore.getState().view).toBe('gameHistory')
    expect(screen.getByText(String(result.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result.awayScore))).toBeInTheDocument()

    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!
    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      within(row as HTMLElement).getByText(String(topScorer.points)),
    ).toBeInTheDocument()

    expect(
      screen.queryByRole('button', { name: /simulate rest of round/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /back to season hub/i }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /back to season hub/i }))
    expect(useSeasonStore.getState().view).toBe('hub')
  })

  it('shows Recent Results derived from actual completed games, with a matching Last-N record', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')

    for (let round = 0; round < 2; round += 1) {
      useSeasonStore.getState().simulateNextGame()
      useSeasonStore.getState().simulateRestOfRound()
    }
    useSeasonStore.getState().goToHub()

    render(<App />)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const completedGames = getCompletedGamesForProgram(
      season!,
      controlledProgramId!,
    )
    const wins = completedGames.filter(
      ({ result }) => result.winnerId === controlledProgramId,
    ).length

    const recentResults = document.querySelector('.recent-results') as HTMLElement
    expect(recentResults).not.toBeNull()
    expect(
      within(recentResults).getByText(
        `Last ${completedGames.length}: ${wins}-${completedGames.length - wins}`,
      ),
    ).toBeInTheDocument()
  })

  it('never lets the controlled Program appear in resultsByGameId before it is played, even after Simulate Rest of Round', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    clickButtonByText(/simulate rest of round$/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    const ownGame = getNextGameForProgram(season!, controlledProgramId!)
    expect(ownGame).toBeDefined()
    expect(ownGame!.round).toBe(1)
    expect(season!.resultsByGameId[ownGame!.id]).toBeUndefined()
    const roundProgress = document.querySelector('.round-progress') as HTMLElement
    expect(
      within(roundProgress).queryByRole('button', {
        name: /simulate rest of round/i,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(roundProgress).getByRole('button', { name: /^super sim/i }),
    ).toBeInTheDocument()
  })

  it('shows Regular Season Complete once all 384 games are finished, with no residual game actions', () => {
    useSeasonStore.getState().selectProgram('pine-valley')
    driveSeasonToCompletion()
    useSeasonStore.getState().goToHub()

    render(<App />)

    // Re-render is implicit via subscribed store updates; assert final DOM state.
    expect(screen.getByText('Regular Season Complete')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /manage rotation/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^super sim/i }),
    ).not.toBeInTheDocument()

    // Completed schedule and box scores remain reachable after the season ends.
    const resultButton = screen.getAllByRole('button', {
      name: /^[WL] \d+-\d+$/,
    })[0]!
    fireEvent.click(resultButton)
    expect(useSeasonStore.getState().view).toBe('gameHistory')
  })

  it('reveals the canonical automatic, at-large, and non-qualified Tournament states and keeps the field accessible', () => {
    finishRegularSeasonWithSuperSim()
    useSeasonStore.getState().dismissSuperSimSummary()

    const season = useSeasonStore.getState().season!
    const selection = selectNationalTournamentField(UNIVERSE_V0, season)
    const automaticEntry = selection.field.find(
      (entry) => entry.bidType === 'automatic',
    )!
    const atLargeEntry = selection.field.find(
      (entry) => entry.bidType === 'at-large',
    )!
    const nonQualifiedProgram = UNIVERSE_V0.programs.find(
      (program) =>
        !selection.field.some((entry) => entry.programId === program.id),
    )!

    useSeasonStore.setState({ controlledProgramId: automaticEntry.programId })
    render(<App />)

    const completionPanel = document.querySelector(
      '.season-complete-panel',
    ) as HTMLElement
    expect(within(completionPanel).getByText('National Tournament')).toBeInTheDocument()
    expect(
      within(completionPanel).getByText(
        `#${automaticEntry.seed} Seed · Automatic Bid`,
      ),
    ).toBeInTheDocument()
    expect(
      within(completionPanel).getByRole('button', {
        name: /enter national tournament/i,
      }),
    ).toBeInTheDocument()

    act(() => {
      useSeasonStore.setState({ controlledProgramId: atLargeEntry.programId })
    })
    expect(
      within(completionPanel).getByText(`#${atLargeEntry.seed} Seed · At-Large`),
    ).toBeInTheDocument()
    expect(
      within(completionPanel).getByRole('button', {
        name: /enter national tournament/i,
      }),
    ).toBeInTheDocument()

    act(() => {
      useSeasonStore.setState({
        controlledProgramId: nonQualifiedProgram.id,
      })
    })
    const tournamentStatus = completionPanel.querySelector(
      '.season-complete-panel__tournament-status',
    ) as HTMLElement
    expect(tournamentStatus).toHaveTextContent('Did Not Qualify')
    expect(tournamentStatus).not.toHaveTextContent('#')

    fireEvent.click(
      within(completionPanel).getByRole('button', {
        name: /view national tournament/i,
      }),
    )
    expect(useSeasonStore.getState().view).toBe('postseasonHub')
    expect(useSeasonStore.getState().postseason?.field).toEqual(selection.field)
    expect(
      screen.getByText(
        `${nonQualifiedProgram.name} did not qualify for the National Tournament.`,
      ),
    ).toBeInTheDocument()
  })
})

function openSuperSimMenu() {
  clickButtonByText(/^super sim/i)
}

describe('Super Sim', () => {
  it('appears on the active Season Hub with both checkpoints available in a fresh Season', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')

    expect(
      screen.getByRole('button', { name: /^super sim/i }),
    ).toBeInTheDocument()

    openSuperSimMenu()

    expect(
      screen.getByRole('button', { name: /sim to midseason/i }),
    ).toBeInTheDocument()
    expect(screen.getByText(`Through Round ${MIDSEASON_ROUND}`)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sim to end of regular season/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Through Round 24')).toBeInTheDocument()
  })

  it('hides Midseason once Round 12 has fully completed, while End of Regular Season remains available', () => {
    useSeasonStore.getState().selectProgram('charlotte-tech')
    // Drive past Round 12 using the existing bulk operation directly.
    useSeasonStore.getState().requestSuperSim('midseason')
    useSeasonStore.getState().confirmSuperSim()
    useSeasonStore.getState().dismissSuperSimSummary()
    expect(getCurrentRound(useSeasonStore.getState().season!)).toBe(13)

    render(<App />)
    openSuperSimMenu()

    expect(
      screen.queryByRole('button', { name: /sim to midseason/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /sim to end of regular season/i }),
    ).toBeInTheDocument()
  })

  it('requires confirmation before Sim to Midseason runs, and Cancel leaves the Season untouched', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    openSuperSimMenu()
    clickButtonByText(/sim to midseason/i)

    expect(
      screen.getByRole('heading', { name: /sim to midseason\?/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/all game results are final/i),
    ).toBeInTheDocument()
    expect(useSeasonStore.getState().season!.resultsByGameId).toEqual({})

    clickButtonByText(/^cancel$/i)

    expect(
      screen.queryByRole('heading', { name: /sim to midseason\?/i }),
    ).not.toBeInTheDocument()
    expect(useSeasonStore.getState().season!.resultsByGameId).toEqual({})
    expect(getCurrentRound(useSeasonStore.getState().season!)).toBe(1)
  })

  it('confirming Sim to Midseason completes Rounds 1-12 and shows a completion summary with the correct segment record', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    openSuperSimMenu()
    clickButtonByText(/sim to midseason/i)
    clickButtonByText(new RegExp(`sim to round ${MIDSEASON_ROUND}`, 'i'))

    const { season, controlledProgramId } = useSeasonStore.getState()
    for (let round = 1; round <= MIDSEASON_ROUND; round += 1) {
      const roundGames = season!.schedule.games.filter(
        (game) => game.round === round,
      )
      expect(
        roundGames.every((game) => season!.resultsByGameId[game.id]),
      ).toBe(true)
    }

    const finalRecord = deriveProgramRecord(season!, controlledProgramId!)
    const finalConferenceRecord = deriveConferenceRecord(
      season!,
      controlledProgramId!,
    )
    const gamesSimulated = finalRecord.wins + finalRecord.losses
    expect(gamesSimulated).toBe(MIDSEASON_ROUND)

    const summaryDialog = screen.getByRole('dialog', {
      name: /midseason reached/i,
    })
    expect(
      within(summaryDialog).getByText(`${gamesSimulated} games simulated`),
    ).toBeInTheDocument()
    expect(
      within(summaryDialog).getByText(
        `Charlotte Tech went ${finalRecord.wins}-${finalRecord.losses}`,
      ),
    ).toBeInTheDocument()
    expect(
      within(
        within(summaryDialog).getByText('Overall').closest('div')!,
      ).getByText(`${finalRecord.wins}-${finalRecord.losses}`),
    ).toBeInTheDocument()
    expect(
      within(
        within(summaryDialog).getByText('Conference').closest('div')!,
      ).getByText(
        `${finalConferenceRecord.wins}-${finalConferenceRecord.losses}`,
      ),
    ).toBeInTheDocument()

    clickButtonByText(/^continue$/i)

    expect(
      screen.queryByRole('heading', { name: /midseason reached/i }),
    ).not.toBeInTheDocument()
    const header = document.querySelector('.season-header') as HTMLElement
    expect(within(header).getByText('13')).toBeInTheDocument()
  })

  it('Sim to End of Regular Season requires confirmation and reuses the existing Regular Season Complete presentation', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    openSuperSimMenu()
    clickButtonByText(/sim to end of regular season/i)

    expect(
      screen.getByRole('heading', { name: /sim to end of regular season\?/i }),
    ).toBeInTheDocument()

    clickButtonByText(/^sim regular season$/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    expect(isRegularSeasonComplete(season!)).toBe(true)
    expect(Object.keys(season!.resultsByGameId)).toHaveLength(384)

    const finalRecord = deriveProgramRecord(season!, controlledProgramId!)
    expect(
      screen.getByRole('heading', { name: /regular season complete/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('24 games simulated')).toBeInTheDocument()
    expect(
      screen.getByText(
        `Charlotte Tech went ${finalRecord.wins}-${finalRecord.losses}`,
      ),
    ).toBeInTheDocument()

    clickButtonByText(/^continue$/i)

    // Reuses the existing Regular Season Complete panel — no competing screen.
    expect(screen.getByText('Regular Season Complete')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^simulate game$/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /^super sim/i }),
    ).not.toBeInTheDocument()
  })

  it('shows the canonical automatic, at-large, and non-qualified Tournament result in the end-of-season summary', () => {
    finishRegularSeasonWithSuperSim()

    const season = useSeasonStore.getState().season!
    const selection = selectNationalTournamentField(UNIVERSE_V0, season)
    const repeatedSelection = selectNationalTournamentField(UNIVERSE_V0, season)
    const automaticEntry = selection.field.find(
      (entry) => entry.bidType === 'automatic',
    )!
    const atLargeEntry = selection.field.find(
      (entry) => entry.bidType === 'at-large',
    )!
    const nonQualifiedProgram = UNIVERSE_V0.programs.find(
      (program) =>
        !selection.field.some((entry) => entry.programId === program.id),
    )!

    expect(repeatedSelection).toEqual(selection)
    useSeasonStore.setState({ controlledProgramId: automaticEntry.programId })
    render(<App />)

    const summaryDialog = screen.getByRole('dialog', {
      name: /regular season complete/i,
    })
    const tournamentRow = within(summaryDialog)
      .getByText('Tournament')
      .closest('div')!
    expect(
      within(tournamentRow).getByText(`#${automaticEntry.seed} · Auto`),
    ).toBeInTheDocument()

    act(() => {
      useSeasonStore.setState({ controlledProgramId: atLargeEntry.programId })
    })
    expect(
      within(tournamentRow).getByText(`#${atLargeEntry.seed} · At-Large`),
    ).toBeInTheDocument()

    act(() => {
      useSeasonStore.setState({
        controlledProgramId: nonQualifiedProgram.id,
      })
    })
    expect(within(tournamentRow).getByText('Did Not Qualify')).toBeInTheDocument()
  })

  it('opens a Super-Sim-generated game as an interactive historical result with a full box score', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    openSuperSimMenu()
    clickButtonByText(/sim to midseason/i)
    clickButtonByText(new RegExp(`sim to round ${MIDSEASON_ROUND}`, 'i'))
    clickButtonByText(/^continue$/i)

    const { season, controlledProgramId } = useSeasonStore.getState()
    // The controlled Program's own Round 5 game — never touched by Quick
    // Sim, resolved entirely by Super Sim — and the only kind of completed
    // game the current UI actually exposes a click-through for.
    const round5Game = season!.schedule.games.find(
      (game) =>
        game.round === 5 &&
        (game.homeProgramId === controlledProgramId ||
          game.awayProgramId === controlledProgramId),
    )!
    const result = season!.resultsByGameId[round5Game.id]!

    const scheduleTable = document.querySelector('.schedule-table') as HTMLElement
    const round5Row = within(scheduleTable)
      .getAllByRole('row')
      .find((candidateRow) => within(candidateRow).queryByText('5'))!
    fireEvent.click(within(round5Row).getByRole('button'))

    expect(useSeasonStore.getState().view).toBe('gameHistory')
    expect(screen.getByText(String(result.homeScore))).toBeInTheDocument()
    expect(screen.getByText(String(result.awayScore))).toBeInTheDocument()
    const topScorer = [...result.homePlayerStats].sort(
      (first, second) => second.points - first.points,
    )[0]!
    const row = document.querySelector(
      `tr[data-player-id="${topScorer.playerId}"]`,
    )
    expect(row).not.toBeNull()
    expect(
      screen.getByRole('button', { name: /back to season hub/i }),
    ).toBeInTheDocument()
  })

  it('is not blocked or influenced by a stale invalid Rotation draft left over from Game Prep', () => {
    render(<App />)
    selectProgramViaUI('Charlotte Tech')
    clickButtonByText(/manage rotation/i)

    const homePanel = document.querySelectorAll('.team-panel')[0] as HTMLElement
    const row = homePanel.querySelector('tr[data-player-id]') as HTMLElement
    const input = within(row).getByRole('spinbutton')
    fireEvent.change(input, {
      target: { value: String(Number((input as HTMLInputElement).value) + 6) },
    })
    clickButtonByText(/back to season hub/i)

    openSuperSimMenu()
    clickButtonByText(/sim to midseason/i)
    clickButtonByText(new RegExp(`sim to round ${MIDSEASON_ROUND}`, 'i'))

    expect(getCurrentRound(useSeasonStore.getState().season!)).toBe(13)
  })
})
