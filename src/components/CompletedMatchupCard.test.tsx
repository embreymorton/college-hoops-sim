import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CompletedMatchupCard } from './CompletedMatchupCard'

const teams = {
  home: {
    name: 'Charlotte Tech',
    accentColor: '#123456',
    score: 81,
    isWinner: true,
  },
  away: {
    name: 'Great Lakes',
    accentColor: '#654321',
    score: 78,
    isWinner: false,
  },
}

const leaders = {
  points: {
    playerName: 'Caleb Daniels',
    programName: 'Charlotte Tech',
    programAbbreviation: 'CTU',
    value: 24,
  },
  rebounds: {
    playerName: 'Tobias Spencer',
    programName: 'Great Lakes',
    programAbbreviation: 'GLU',
    value: 11,
  },
  assists: null,
}

describe('CompletedMatchupCard', () => {
  it.each([
    ['regular-season home overtime', 'Home', 'OT', 'Home · Final/OT'],
    ['regular-season away regulation', 'Away', null, 'Away · Final'],
    ['postseason neutral overtime', 'Neutral', '2OT', 'Neutral · Final/2OT'],
  ] as const)('shows accepted site and FINAL labeling for %s', (_, site, ot, label) => {
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel={site}
        overtimeTag={ot}
        {...teams}
        resultLabel="Win"
        resultTone="positive"
        leaders={leaders}
        onViewBoxScore={vi.fn()}
      />,
    )

    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('shows the result tag beside the round label, colored by tone', () => {
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel="Home"
        {...teams}
        resultLabel="Win"
        resultTone="positive"
        leaders={leaders}
        onViewBoxScore={vi.fn()}
      />,
    )

    const eyebrowLeft = document.querySelector('.next-game-card__eyebrow-left') as HTMLElement
    expect(eyebrowLeft).toHaveTextContent('Round 1')
    const resultTag = screen.getByText('Win')
    expect(resultTag).toHaveAttribute('data-tone', 'positive')
    expect(eyebrowLeft.contains(resultTag)).toBe(true)
  })

  it('shows each Team by its full name and final score', () => {
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel="Home"
        {...teams}
        resultLabel="Win"
        resultTone="positive"
        leaders={leaders}
        onViewBoxScore={vi.fn()}
      />,
    )

    const rows = document.querySelectorAll('.next-game-card__final-team')
    expect(rows).toHaveLength(2)
    expect(screen.getByText('Charlotte Tech')).toBeInTheDocument()
    expect(screen.getByText('Great Lakes')).toBeInTheDocument()
    expect(screen.getByText('81')).toBeInTheDocument()
    expect(screen.getByText('78')).toBeInTheDocument()
  })

  it('renders stat-first whole-game leaders with Program abbreviation, and an empty state', () => {
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel="Home"
        {...teams}
        resultLabel="Loss"
        resultTone="negative"
        leaders={leaders}
        onViewBoxScore={vi.fn()}
      />,
    )

    const points = document.querySelector('[data-stat="pts"]')
    const rebounds = document.querySelector('[data-stat="reb"]')
    expect(points).toHaveTextContent('24')
    expect(points).toHaveTextContent('Caleb Daniels')
    expect(points).toHaveTextContent('CTU')
    expect(points?.querySelector('.team-color-dot')).toHaveStyle({
      background: '#123456',
    })
    expect(rebounds).toHaveTextContent('11')
    expect(rebounds).toHaveTextContent('Tobias Spencer')
    expect(rebounds).toHaveTextContent('GLU')
    expect(rebounds?.querySelector('.team-color-dot')).toHaveStyle({
      background: '#654321',
    })
    expect(document.querySelector('[data-stat="ast"]')).toHaveTextContent('—')
    expect(screen.getByText('Loss')).toHaveAttribute('data-tone', 'negative')
  })

  it('always shows per-row Program identity in Game Leaders, even when every leader shares one Team', () => {
    const sameTeamLeaders = {
      points: {
        playerName: 'Caleb Daniels',
        programName: 'Charlotte Tech',
        programAbbreviation: 'CTU',
        value: 24,
      },
      rebounds: {
        playerName: 'Marcus Webb',
        programName: 'Charlotte Tech',
        programAbbreviation: 'CTU',
        value: 12,
      },
      assists: {
        playerName: 'Trey Holt',
        programName: 'Charlotte Tech',
        programAbbreviation: 'CTU',
        value: 9,
      },
    }
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel="Home"
        {...teams}
        resultLabel="Win"
        resultTone="positive"
        leaders={sameTeamLeaders}
        onViewBoxScore={vi.fn()}
      />,
    )

    expect(document.querySelectorAll('.game-leaders__team')).toHaveLength(3)
    expect(document.querySelector('[data-stat="pts"]')).toHaveTextContent('Caleb Daniels')
    expect(document.querySelector('[data-stat="reb"]')).toHaveTextContent('Marcus Webb')
    expect(document.querySelector('[data-stat="ast"]')).toHaveTextContent('Trey Holt')
  })

  it('keeps the Box Score action available and functional', () => {
    const onViewBoxScore = vi.fn()
    render(
      <CompletedMatchupCard
        roundLabel="Round 1"
        siteLabel="Home"
        {...teams}
        resultLabel="Win"
        resultTone="positive"
        leaders={leaders}
        onViewBoxScore={onViewBoxScore}
      />,
    )

    screen.getByRole('button', { name: 'View Box Score' }).click()
    expect(onViewBoxScore).toHaveBeenCalledOnce()
  })
})
