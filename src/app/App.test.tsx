import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from './App'

describe('App', () => {
  it('identifies the current project milestone', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'College Hoops Simulator' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Foundation milestone')).toBeInTheDocument()
  })
})

