import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
    const { container } = render(
      <RecruitingCommitmentAlerts activity={[]} onDismiss={vi.fn()} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('surfaces a commitment to the controlled Program prominently', () => {
    render(
      <RecruitingCommitmentAlerts activity={[activity()]} onDismiss={vi.fn()} />,
    )
    expect(screen.getByText('Committed To Us')).toBeInTheDocument()
    expect(screen.getByText(/Jamal Carter/)).toBeInTheDocument()
    expect(screen.getByText('Focus Target')).toBeInTheDocument()
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
        onDismiss={vi.fn()}
      />,
    )
    expect(screen.getByText('Committed Elsewhere')).toBeInTheDocument()
    expect(screen.getByText(/to Northbridge/)).toBeInTheDocument()
    expect(screen.queryByText('Focus Target')).not.toBeInTheDocument()
  })

  it('never fabricates standing-movement language', () => {
    render(
      <RecruitingCommitmentAlerts activity={[activity()]} onDismiss={vi.fn()} />,
    )
    expect(screen.queryByText(/moved into first/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/interest rose/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/gained ground/i)).not.toBeInTheDocument()
  })

  it('calls onDismiss when Dismiss is clicked', () => {
    const onDismiss = vi.fn()
    render(
      <RecruitingCommitmentAlerts activity={[activity()]} onDismiss={onDismiss} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
