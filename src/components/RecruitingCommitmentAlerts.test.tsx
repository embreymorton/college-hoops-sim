import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { CommitmentActivityDescription } from '../app/recruitingBattleFormatters'
import { RecruitingCommitmentAlerts } from './RecruitingCommitmentAlerts'

function activity(
  overrides: Partial<CommitmentActivityDescription> = {},
): CommitmentActivityDescription {
  return {
    playerId: 'recruit-1',
    kind: 'committed-to-controlled',
    playerName: 'Jamal Carter',
    position: 'SG',
    stars: 4,
    nationalRank: 12,
    programName: 'Charlotte Tech',
    wasFocused: true,
    ...overrides,
  }
}

describe('RecruitingCommitmentAlerts', () => {
  it('renders nothing when there is no commitment activity', () => {
    const { container } = render(<RecruitingCommitmentAlerts activity={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('has no Dismiss control', () => {
    render(<RecruitingCommitmentAlerts activity={[activity()]} />)
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })

  it('surfaces a commitment to the controlled Program prominently', () => {
    render(<RecruitingCommitmentAlerts activity={[activity()]} />)
    expect(screen.getByText(/Jamal Carter/)).toBeInTheDocument()
    expect(screen.getByText(/committed to us/)).toBeInTheDocument()
  })

  it('surfaces a tracked Board Recruit committing elsewhere with the destination Program', () => {
    render(
      <RecruitingCommitmentAlerts
        activity={[
          activity({
            kind: 'tracked-committed-elsewhere',
            programName: 'Northbridge',
            wasFocused: false,
          }),
        ]}
      />,
    )
    expect(screen.getByText(/Northbridge/)).toBeInTheDocument()
  })

  it('renders a compact heading with the decision count', () => {
    render(
      <RecruitingCommitmentAlerts
        activity={[activity(), activity({ playerId: 'recruit-2', playerName: 'Other Player' })]}
      />,
    )
    expect(screen.getByText('Recruiting Update · 2 Changes')).toBeInTheDocument()
  })

  it('never fabricates standing-movement language', () => {
    render(<RecruitingCommitmentAlerts activity={[activity()]} />)
    expect(screen.queryByText(/moved into first/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/interest rose/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/gained ground/i)).not.toBeInTheDocument()
  })
})
