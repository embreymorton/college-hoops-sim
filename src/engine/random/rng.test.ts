import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRng } from './rng'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createRng', () => {
  it('reproduces a known sequence from a numeric seed', () => {
    const rng = createRng(12345)

    expect(Array.from({ length: 5 }, () => rng.next())).toEqual([
      0.13898325990885496,
      0.560948665253818,
      0.8645638290327042,
      0.90921073500067,
      0.07779833395034075,
    ])
  })

  it('reproduces a known sequence from a string seed', () => {
    const rng = createRng('dynasty')

    expect(Array.from({ length: 5 }, () => rng.next())).toEqual([
      0.09320388920605183,
      0.9300307731609792,
      0.103493771282956,
      0.9098911769688129,
      0.24487576936371624,
    ])
  })

  it('keeps generators with the same seed independent and identical', () => {
    const first = createRng('same-seed')
    const second = createRng('same-seed')
    const control = createRng('same-seed')

    Array.from({ length: 10 }, () => first.next())

    expect(Array.from({ length: 20 }, () => second.next())).toEqual(
      Array.from({ length: 20 }, () => control.next()),
    )
  })

  it('produces different sequences for different seeds and seed types', () => {
    const sequence = (seed: number | string) => {
      const rng = createRng(seed)
      return Array.from({ length: 5 }, () => rng.next())
    }

    expect(sequence('alpha')).not.toEqual(sequence('beta'))
    expect(sequence(1)).not.toEqual(sequence('1'))
  })

  it('rejects non-finite numeric seeds', () => {
    expect(() => createRng(Number.NaN)).toThrow(RangeError)
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => createRng(Number.NEGATIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('next', () => {
  it('always returns a value from zero inclusive to one exclusive', () => {
    const rng = createRng('next-range')

    for (let draw = 0; draw < 10_000; draw += 1) {
      const value = rng.next()

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('does not call Math.random', () => {
    vi.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be called')
    })

    const rng = createRng(42)

    expect(() => {
      rng.next()
      rng.int(1, 10)
      rng.pick(['a', 'b'])
      rng.chance(0.5)
    }).not.toThrow()
  })
})

describe('int', () => {
  it('returns a deterministic sequence of inclusive integers', () => {
    const rng = createRng(12345)

    expect(Array.from({ length: 12 }, () => rng.int(-2, 2))).toEqual([
      -2, 0, 2, 2, -2, 0, -2, 0, 1, -2, 2, 2,
    ])
  })

  it('can produce both inclusive boundaries', () => {
    const rng = createRng('inclusive-boundaries')
    const values = Array.from({ length: 500 }, () => rng.int(3, 7))

    expect(values.every(Number.isInteger)).toBe(true)
    expect(values.every((value) => value >= 3 && value <= 7)).toBe(true)
    expect(values).toContain(3)
    expect(values).toContain(7)
  })

  it('supports a range containing one value', () => {
    const rng = createRng('single-value')

    expect(rng.int(8, 8)).toBe(8)
  })

  it('rejects invalid integer ranges', () => {
    const rng = createRng('invalid-range')

    expect(() => rng.int(2, 1)).toThrow(RangeError)
    expect(() => rng.int(1.5, 2)).toThrow(RangeError)
    expect(() => rng.int(1, Number.NaN)).toThrow(RangeError)
    expect(() => rng.int(0, 0x1_0000_0000)).toThrow(RangeError)
    expect(() =>
      rng.int(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER),
    ).toThrow(RangeError)
  })
})

describe('pick', () => {
  it('selects a deterministic element without modifying the source', () => {
    const positions = ['PG', 'SG', 'SF', 'PF', 'C'] as const
    const rng = createRng('positions')

    expect(Array.from({ length: 8 }, () => rng.pick(positions))).toEqual([
      'PG',
      'SF',
      'SF',
      'C',
      'SF',
      'SF',
      'PF',
      'SF',
    ])
    expect(positions).toEqual(['PG', 'SG', 'SF', 'PF', 'C'])
  })

  it('rejects an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow(RangeError)
  })
})

describe('chance', () => {
  it('returns a deterministic boolean sequence', () => {
    const rng = createRng('chance')

    expect(Array.from({ length: 10 }, () => rng.chance(0.25))).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
      false,
      true,
      false,
      false,
    ])
  })

  it('honors zero and one while consuming one draw per call', () => {
    const rng = createRng('probability-boundaries')
    const control = createRng('probability-boundaries')

    expect(rng.chance(0)).toBe(false)
    expect(rng.chance(1)).toBe(true)

    control.next()
    control.next()
    expect(rng.next()).toBe(control.next())
  })

  it('rejects probabilities outside the inclusive range', () => {
    const rng = createRng('invalid-probability')

    expect(() => rng.chance(-0.01)).toThrow(RangeError)
    expect(() => rng.chance(1.01)).toThrow(RangeError)
    expect(() => rng.chance(Number.NaN)).toThrow(RangeError)
    expect(() => rng.chance(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})
