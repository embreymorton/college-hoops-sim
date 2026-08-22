import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDynastyStore } from '../store'
import { ProgramSelectScreen } from './ProgramSelectScreen'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

beforeEach(resetStore)

function selectFirstProgram(): void {
  const [firstProgramButton] = screen.getAllByRole('button')
  fireEvent.click(firstProgramButton!)
}

describe('ProgramSelectScreen Dynasty Seed', () => {
  it('leaves the Dynasty Seed field blank by default and preserves the automatic-seed path', () => {
    render(<ProgramSelectScreen />)

    expect(screen.getByLabelText('Dynasty Seed')).toHaveValue('')

    selectFirstProgram()

    const dynasty = useDynastyStore.getState().dynasty
    expect(dynasty).not.toBeNull()
    expect(dynasty!.dynastySeed).toBeTruthy()
  })

  it('passes a valid explicit seed through to Dynasty creation unchanged', () => {
    render(<ProgramSelectScreen />)

    fireEvent.change(screen.getByLabelText('Dynasty Seed'), {
      target: { value: 'my-explicit-seed' },
    })
    selectFirstProgram()

    expect(useDynastyStore.getState().dynasty!.dynastySeed).toBe('my-explicit-seed')
  })

  it('passes a digit-only explicit seed through as a numeric seed', () => {
    render(<ProgramSelectScreen />)

    fireEvent.change(screen.getByLabelText('Dynasty Seed'), {
      target: { value: '184726391' },
    })
    selectFirstProgram()

    expect(useDynastyStore.getState().dynasty!.dynastySeed).toBe(184726391)
  })

  it('rejects a malformed seed and blocks Dynasty creation until it is corrected', () => {
    render(<ProgramSelectScreen />)

    fireEvent.change(screen.getByLabelText('Dynasty Seed'), {
      target: { value: 'bad seed!!' },
    })

    expect(
      screen.getByText(/Use letters, numbers, spaces, or - _ : \./),
    ).toBeInTheDocument()

    const [firstProgramButton] = screen.getAllByRole('button')
    expect(firstProgramButton!).toBeDisabled()
    fireEvent.click(firstProgramButton!)
    expect(useDynastyStore.getState().dynasty).toBeNull()
  })

  it('rejects an out-of-range numeric seed', () => {
    render(<ProgramSelectScreen />)

    fireEvent.change(screen.getByLabelText('Dynasty Seed'), {
      target: { value: '99999999999999999999999999' },
    })

    expect(screen.getByText(/too large/)).toBeInTheDocument()
    const [firstProgramButton] = screen.getAllByRole('button')
    expect(firstProgramButton!).toBeDisabled()
  })

  it('restores normal creation behavior once an invalid seed is cleared', () => {
    render(<ProgramSelectScreen />)

    const seedInput = screen.getByLabelText('Dynasty Seed')
    fireEvent.change(seedInput, { target: { value: 'bad seed!!' } })
    fireEvent.change(seedInput, { target: { value: '' } })

    selectFirstProgram()

    expect(useDynastyStore.getState().dynasty).not.toBeNull()
  })
})
