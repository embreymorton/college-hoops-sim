import type { RngSeed } from '../engine'

export type DynastySeedInputResult =
  | { readonly kind: 'blank' }
  | { readonly kind: 'valid'; readonly seed: RngSeed }
  | { readonly kind: 'invalid'; readonly reason: string }

const ALLOWED_SEED_TEXT = /^[A-Za-z0-9 _:.-]{1,64}$/

/**
 * Lightweight setup-local parsing for the optional Dynasty Seed field.
 * Digit-only entries become a numeric seed (matching `RngSeed`'s
 * `Number.isFinite` constraint); other entries become a string seed within a
 * conservative character set. This does not alter the canonical seed
 * contract in `RngSeed` / `assertValidSeed` — it only keeps the setup input
 * predictable before it reaches `selectProgram`.
 */
export function parseDynastySeedInput(raw: string): DynastySeedInputResult {
  const trimmed = raw.trim()
  if (trimmed === '') {
    return { kind: 'blank' }
  }

  if (/^\d+$/.test(trimmed)) {
    const numeric = Number(trimmed)
    if (Number.isSafeInteger(numeric)) {
      return { kind: 'valid', seed: numeric }
    }
    return { kind: 'invalid', reason: 'That seed number is too large.' }
  }

  if (ALLOWED_SEED_TEXT.test(trimmed)) {
    return { kind: 'valid', seed: trimmed }
  }

  return {
    kind: 'invalid',
    reason: 'Use letters, numbers, spaces, or - _ : . (up to 64 characters).',
  }
}
