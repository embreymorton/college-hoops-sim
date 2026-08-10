import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_INTERACTIVE_TEST_SEED,
  useDynastyStore,
} from './seasonStore'

const PROGRAM_ID = 'charlotte-tech'

function resetStore(): void {
  useDynastyStore.setState(useDynastyStore.getInitialState())
}

function startDynasty(seed?: string): void {
  useDynastyStore.getState().selectProgram(PROGRAM_ID, seed)
}

function startingWorldSnapshot() {
  const dynasty = useDynastyStore.getState().dynasty!
  const season = dynasty.activeSeason!

  return {
    dynastyId: dynasty.dynastyId,
    dynastySeed: dynasty.dynastySeed,
    roster: season.programStates[PROGRAM_ID]!.team.roster,
    schedule: season.schedule,
    recruitingClass: dynasty.recruiting!.recruits,
  }
}

beforeEach(resetStore)

describe('interactive Dynasty seed creation', () => {
  it('assigns a distinct canonical seed and starting world to each new interactive Dynasty', () => {
    startDynasty()
    const first = startingWorldSnapshot()

    resetStore()
    startDynasty()
    const second = startingWorldSnapshot()

    expect(second.dynastySeed).not.toBe(first.dynastySeed)
    expect(second.dynastyId).not.toBe(first.dynastyId)
    expect(second.roster).not.toEqual(first.roster)
    expect(second.schedule).not.toEqual(first.schedule)
    expect(second.recruitingClass).not.toEqual(first.recruitingClass)
  })

  it('keeps explicitly supplied seeds fully repeatable, including the former fixed seed namespaces', () => {
    startDynasty(DEFAULT_INTERACTIVE_TEST_SEED)
    const first = startingWorldSnapshot()

    resetStore()
    startDynasty(DEFAULT_INTERACTIVE_TEST_SEED)
    const second = startingWorldSnapshot()

    expect(second).toEqual(first)
    expect(second.schedule.seed).toBe(
      `${DEFAULT_INTERACTIVE_TEST_SEED}:schedule:season-1`,
    )
  })

  it('keeps the Dynasty seed stable while normal Season and Recruiting state advances', () => {
    startDynasty('interactive-seed-stability')
    const initialSeed = useDynastyStore.getState().dynasty!.dynastySeed

    useDynastyStore.getState().generateControlledDraftBoard()
    useDynastyStore.getState().simulateNextGame()
    useDynastyStore.getState().simulateRestOfRound()

    expect(useDynastyStore.getState().dynasty!.dynastySeed).toBe(initialSeed)
  })

  it('does not use Math.random while creating or simulating an interactive Dynasty', () => {
    const randomSpy = vi
      .spyOn(Math, 'random')
      .mockImplementation(() => {
        throw new Error('Math.random must not be called')
      })

    try {
      startDynasty()
      useDynastyStore.getState().generateControlledDraftBoard()
      useDynastyStore.getState().simulateNextGame()
    } finally {
      randomSpy.mockRestore()
    }
  })
})
