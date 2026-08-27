import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { calculateOverall, type Player } from '../engine'
import type { CompletedRecruitingClass, Recruit } from '../dynasty'
import { DEFAULT_INTERACTIVE_TEST_SEED, useDynastyStore } from '../store'
import { App } from './App'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'

function recruitFromPlayer(player: Player, nationalRank: number): Recruit {
  return {
    player: structuredClone(player),
    nationalRank,
    positionRank: nationalRank,
    stars: nationalRank === 1 ? 5 : 4,
    qualityScore: 9999,
    decisionReadyPeriod: 99,
    commitmentStandingThreshold: 9999,
    commitmentSeparationThreshold: 9999,
  }
}

function installHistoryFixture(): {
  activePlayer: Player
  formerPlayer: Player
  incomingPlayer: Player
  perspectiveProgramId: string
  perspectiveProgramName: string
} {
  const dynasty = useDynastyStore.getState().dynasty!
  const controlledTeam = dynasty.activeSeason!.programStates[CONTROLLED_PROGRAM_ID]!.team
  const otherProgramId = dynasty.universe.programs.find(({ id }) => id !== CONTROLLED_PROGRAM_ID)!.id
  const otherTeam = dynasty.activeSeason!.programStates[otherProgramId]!.team
  const perspectiveProgram = dynasty.universe.programs.find(
    ({ id }) => id !== CONTROLLED_PROGRAM_ID && id !== otherProgramId,
  )!
  const perspectiveTeam = dynasty.activeSeason!.programStates[perspectiveProgram.id]!.team
  const activePlayer = controlledTeam.roster[0]!
  const formerPlayer = otherTeam.roster[0]!
  const perspectivePlayers = perspectiveTeam.roster.slice(0, 2)
  const incomingPlayer = dynasty.recruiting!.recruits[0]!.player
  const archivedSeason = structuredClone(dynasty.activeSeason!)
  const activeSeason = {
    ...structuredClone(dynasty.activeSeason!),
    seasonNumber: 2,
  }
  activeSeason.programStates[otherProgramId] = {
    ...activeSeason.programStates[otherProgramId]!,
    team: {
      ...activeSeason.programStates[otherProgramId]!.team,
      roster: activeSeason.programStates[otherProgramId]!.team.roster.filter(
        ({ id }) => id !== formerPlayer.id,
      ),
    },
  }

  const enrolledRecruits = [
    recruitFromPlayer(activePlayer, 1),
    recruitFromPlayer(formerPlayer, 2),
    recruitFromPlayer(perspectivePlayers[0]!, 3),
    recruitFromPlayer(perspectivePlayers[1]!, 4),
  ]
  const enrolledClass: CompletedRecruitingClass = {
    targetSeasonNumber: 1,
    recruitingState: {
      ...structuredClone(dynasty.recruiting!),
      targetSeasonNumber: 1,
      phase: 'finalized',
      recruits: enrolledRecruits,
      relationshipProgressByPlayerId: {
        [activePlayer.id]: { [CONTROLLED_PROGRAM_ID]: 54321 },
      },
      commitmentsByPlayerId: {
        [activePlayer.id]: {
          playerId: activePlayer.id,
          programId: CONTROLLED_PROGRAM_ID,
          timing: { kind: 'period', period: 12 },
          targetSeasonNumber: 1,
        },
        [formerPlayer.id]: {
          playerId: formerPlayer.id,
          programId: otherProgramId,
          timing: { kind: 'late' },
          targetSeasonNumber: 1,
        },
        ...Object.fromEntries(perspectivePlayers.map((player) => [player.id, {
          playerId: player.id,
          programId: perspectiveProgram.id,
          timing: { kind: 'late' as const },
          targetSeasonNumber: 1,
        }])),
      },
    },
  }
  const incomingRecruit = recruitFromPlayer(incomingPlayer, 1)
  const incomingClass: CompletedRecruitingClass = {
    targetSeasonNumber: 3,
    recruitingState: {
      ...structuredClone(dynasty.recruiting!),
      targetSeasonNumber: 3,
      phase: 'finalized',
      recruits: [incomingRecruit],
      commitmentsByPlayerId: {
        [incomingPlayer.id]: {
          playerId: incomingPlayer.id,
          programId: CONTROLLED_PROGRAM_ID,
          timing: { kind: 'late' },
          targetSeasonNumber: 3,
        },
      },
    },
  }

  useDynastyStore.setState({
    dynasty: {
      ...dynasty,
      activeSeason,
      history: [{
        seasonNumber: 1,
        season: archivedSeason,
        postseason: {} as never,
        awards: { rulesVersion: 'awards-v1', honors: [] },
      }],
      completedRecruitingHistory: [enrolledClass, incomingClass],
    },
  })
  useDynastyStore.getState().goToLeague()
  useDynastyStore.getState().setLeagueTab('history')
  useDynastyStore.getState().setHistoryTab('recruiting')
  return {
    activePlayer,
    formerPlayer,
    incomingPlayer,
    perspectiveProgramId: perspectiveProgram.id,
    perspectiveProgramName: perspectiveProgram.name,
  }
}

beforeEach(() => {
  useDynastyStore.setState(useDynastyStore.getInitialState())
  useDynastyStore.getState().selectProgram(
    CONTROLLED_PROGRAM_ID,
    DEFAULT_INTERACTIVE_TEST_SEED,
  )
})

describe('Recruiting History presentation and navigation', () => {
  it('uses the transient Viewed Program as Observer retrospective perspective', () => {
    const { perspectiveProgramId, perspectiveProgramName } = installHistoryFixture()
    const coachDynasty = useDynastyStore.getState().dynasty!
    useDynastyStore.setState({
      dynasty: { ...coachDynasty, controlledProgramId: null },
      viewedProgramId: CONTROLLED_PROGRAM_ID,
    })
    const canonicalBefore = JSON.stringify(useDynastyStore.getState().dynasty)
    render(<App />)

    const seasonOneCard = screen.getByRole('button', {
      name: /Season 1 Recruiting Class/,
    })
    expect(seasonOneCard).toHaveTextContent('Charlotte Tech: 1')
    expect(screen.queryByText(/Your Program/)).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Viewed Program'), {
      target: { value: perspectiveProgramId },
    })

    expect(screen.getByRole('button', { name: /Season 1 Recruiting Class/ }))
      .toHaveTextContent(`${perspectiveProgramName}: 2`)
    fireEvent.click(screen.getByRole('button', { name: /Season 1 Recruiting Class/ }))
    expect(screen.getByText(`4 signees · ${perspectiveProgramName}: 2`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: perspectiveProgramName }))
    expect(within(screen.getByRole('table', { name: /Season 1 national recruiting class/i }))
      .getAllByRole('row')).toHaveLength(3)
    expect(useDynastyStore.getState().dynasty?.controlledProgramId).toBeNull()
    expect(JSON.stringify(useDynastyStore.getState().dynasty)).toBe(canonicalBefore)
    expect(screen.queryByText(/Your Program/)).not.toBeInTheDocument()
  })

  it('lists finalized classes newest first and shows only lean class metadata', () => {
    installHistoryFixture()
    render(<App />)

    const cards = screen.getAllByRole('button', { name: /Recruiting Class/ })
    expect(cards[0]).toHaveTextContent('Season 3 Recruiting Class')
    expect(cards[0]).toHaveTextContent('1 signees')
    expect(cards[0]).toHaveTextContent('Your Program: 1')
    expect(cards[1]).toHaveTextContent('Season 1 Recruiting Class')
    expect(screen.queryByText(/average|class grade|champion/i)).not.toBeInTheDocument()
  })

  it('renders Incoming without a Player link and excludes hidden Recruiting facts', () => {
    const { incomingPlayer } = installHistoryFixture()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Season 3 Recruiting Class/ }))

    const table = screen.getByRole('table', { name: /Season 3 national recruiting class/i })
    expect(table).toHaveTextContent(`${calculateOverall(incomingPlayer)} / ${incomingPlayer.potential}`)
    expect(table).toHaveTextContent('OVR / POT')
    expect(table).toHaveTextContent('Incoming')
    expect(within(table).queryByRole('button', {
      name: `${incomingPlayer.firstName} ${incomingPlayer.lastName}`,
    })).not.toBeInTheDocument()
    expect(table).not.toHaveTextContent('54321')
    expect(table).not.toHaveTextContent('9999')
    expect(table).not.toHaveTextContent('Period 12')
  })

  it('filters locally and preserves class/filter through active Player Details and Back', () => {
    const { activePlayer } = installHistoryFixture()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Season 1 Recruiting Class/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Your Program' }))

    const table = screen.getByRole('table', { name: /Season 1 national recruiting class/i })
    expect(within(table).getAllByRole('row')).toHaveLength(2)
    fireEvent.click(within(table).getByRole('button', {
      name: `${activePlayer.firstName} ${activePlayer.lastName}`,
    }))
    expect(screen.queryByText('Former Player')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))

    expect(screen.getByRole('heading', { name: 'Season 1 Recruiting Class' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Your Program' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('table', { name: /Season 1 national recruiting class/i })).getAllByRole('row'))
      .toHaveLength(2)
  })

  it('opens Former Player Details and returns to the selected class', () => {
    const { formerPlayer } = installHistoryFixture()
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /Season 1 Recruiting Class/ }))
    const table = screen.getByRole('table', { name: /Season 1 national recruiting class/i })
    fireEvent.click(within(table).getByRole('button', {
      name: `${formerPlayer.firstName} ${formerPlayer.lastName}`,
    }))

    expect(screen.getByText('Former Player')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '← Back to League' }))
    expect(screen.getByRole('heading', { name: 'Season 1 Recruiting Class' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All Programs' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows the quiet empty state before any class finalizes', () => {
    useDynastyStore.getState().goToLeague()
    useDynastyStore.getState().setLeagueTab('history')
    useDynastyStore.getState().setHistoryTab('recruiting')
    render(<App />)

    expect(screen.getByText(/Finalized recruiting classes will appear here after Late Recruiting/i))
      .toBeInTheDocument()
  })
})
