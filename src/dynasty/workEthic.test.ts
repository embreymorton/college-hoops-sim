import { describe, expect, it } from 'vitest'
import { deriveDevelopmentTendency } from './development'
import { derivePlayerWorkEthic } from './workEthic'

describe('Player-facing Work Ethic', () => {
  it('keeps unrevealed Players unknown without changing their underlying tendency', () => {
    const player = { id: 'unknown-freshman' }
    const before = deriveDevelopmentTendency(player, 'work-ethic')
    expect(derivePlayerWorkEthic(player, 'work-ethic', false)).toEqual({ status: 'unknown', label: 'Unknown' })
    expect(deriveDevelopmentTendency(player, 'work-ethic')).toBe(before)
  })

  it.each([
    ['weak', 'Inconsistent'],
    ['steady', 'Steady'],
    ['strong', 'Strong'],
  ] as const)('maps stable %s tendency to %s', (tendency, label) => {
    const player = Array.from({ length: 500 }, (_, index) => ({ id: `${tendency}-${index}` }))
      .find(candidate => deriveDevelopmentTendency(candidate, 'work-ethic-mapping') === tendency)!
    expect(derivePlayerWorkEthic(player, 'work-ethic-mapping', true)).toEqual({ status: 'revealed', label })
    expect(derivePlayerWorkEthic(player, 'work-ethic-mapping', true)).toEqual(derivePlayerWorkEthic(player, 'work-ethic-mapping', true))
  })
})
