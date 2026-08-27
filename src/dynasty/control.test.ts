import { describe, expect, it } from 'vitest'
import {
  canManageProgram,
  isObserverDynasty,
  requireControlledProgram,
} from './control'

describe('Dynasty Program authority', () => {
  it('authorizes only the actual controlled Program', () => {
    const coach = { controlledProgramId: 'charlotte-tech' }
    expect(isObserverDynasty(coach)).toBe(false)
    expect(canManageProgram(coach, 'charlotte-tech')).toBe(true)
    expect(canManageProgram(coach, 'pine-valley')).toBe(false)
    expect(requireControlledProgram(coach)).toBe('charlotte-tech')
  })

  it('grants an Observer no Program authority', () => {
    const observer = { controlledProgramId: null }
    expect(isObserverDynasty(observer)).toBe(true)
    expect(canManageProgram(observer, 'charlotte-tech')).toBe(false)
    expect(canManageProgram(observer, 'pine-valley')).toBe(false)
    expect(() => requireControlledProgram(observer)).toThrow(/no controlled Program/)
  })
})
