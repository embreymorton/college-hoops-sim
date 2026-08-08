import { describe, expect, it } from 'vitest'
import { UNIVERSE_V0 } from '../universe'
import { DEMO_PROGRAMS } from './demoPrograms'

describe('demo program Universe V0 adapter', () => {
  it('sources retained permanent metadata from Universe V0', () => {
    const permanentDemoPrograms = DEMO_PROGRAMS.filter(
      ({ id }) => id !== 'national-tech',
    )

    expect(permanentDemoPrograms).toHaveLength(5)
    for (const demoProgram of permanentDemoPrograms) {
      const program = UNIVERSE_V0.programs.find(
        ({ id }) => id === demoProgram.id,
      )

      expect(program).toBeDefined()
      expect(demoProgram).toMatchObject({
        id: program!.id,
        name: program!.name,
        abbreviation: program!.abbreviation,
        prestige: program!.basePrestige,
        primaryColor: program!.branding.primaryColor,
        secondaryColor: program!.branding.secondaryColor,
      })
    }
  })

  it('keeps National Tech explicitly outside Universe V0', () => {
    expect(DEMO_PROGRAMS.some(({ id }) => id === 'national-tech')).toBe(true)
    expect(
      UNIVERSE_V0.programs.some(({ id }) => String(id) === 'national-tech'),
    ).toBe(false)
  })
})
