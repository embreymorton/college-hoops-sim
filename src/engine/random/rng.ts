export type RngSeed = number | string

export interface Rng {
  /** Returns the next value in the range [0, 1). */
  next(): number

  /** Returns an integer in the inclusive range [min, max]. */
  int(min: number, max: number): number

  /** Returns one element from a non-empty array. */
  pick<T>(items: readonly T[]): T

  /** Returns true with the supplied probability, which must be in [0, 1]. */
  chance(probability: number): boolean
}

const UINT32_RANGE = 0x1_0000_0000

function hashSeed(seed: RngSeed): number {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new RangeError('RNG seed must be a finite number or a string')
  }

  // Including the type makes numeric seed 1 distinct from string seed "1".
  const value = `${typeof seed}:${seed}`
  let hash = 0x811c9dc5

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

/**
 * Creates an independent deterministic RNG using the Mulberry32 algorithm.
 * The generator is suitable for simulation and procedural generation, not
 * cryptographic use.
 */
export function createRng(seed: RngSeed): Rng {
  let state = hashSeed(seed)

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0

    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)

    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
  }

  function int(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new RangeError('RNG integer bounds must be safe integers')
    }

    if (min > max) {
      throw new RangeError('RNG integer minimum cannot exceed maximum')
    }

    const rangeSize = max - min + 1

    if (!Number.isSafeInteger(rangeSize) || rangeSize > UINT32_RANGE) {
      throw new RangeError(
        'RNG integer range can contain at most 2^32 values',
      )
    }

    return min + Math.floor(next() * rangeSize)
  }

  function pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new RangeError('Cannot pick from an empty array')
    }

    return items[int(0, items.length - 1)] as T
  }

  function chance(probability: number): boolean {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      throw new RangeError('RNG probability must be between 0 and 1 inclusive')
    }

    return next() < probability
  }

  return { next, int, pick, chance }
}
