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
    value: 24,
  },
  rebounds: {
    playerName: 'Tobias Spencer',
    programName: 'Great Lakes',
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

  it('renders stat-first whole-game leaders, Program identity, and an empty state', () => {
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
    expect(points).toHaveTextContent('Charlotte Tech')
    expect(points?.querySelector('.team-color-dot')).toHaveStyle({
      background: '#123456',
    })
    expect(rebounds).toHaveTextContent('11')
    expect(rebounds).toHaveTextContent('Tobias Spencer')
    expect(rebounds).toHaveTextContent('Great Lakes')
    expect(rebounds?.querySelector('.team-color-dot')).toHaveStyle({
      background: '#654321',
    })
    expect(document.querySelector('[data-stat="ast"]')).toHaveTextContent('—')
    expect(screen.getByText('Loss')).toHaveAttribute('data-tone', 'negative')
  })
})
