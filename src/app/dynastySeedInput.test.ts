import { describe, expect, it } from 'vitest'
import { parseDynastySeedInput } from './dynastySeedInput'

describe('parseDynastySeedInput', () => {
  it('treats a blank or whitespace-only field as blank', () => {
    expect(parseDynastySeedInput('')).toEqual({ kind: 'blank' })
    expect(parseDynastySeedInput('   ')).toEqual({ kind: 'blank' })
  })

  it('parses a digit-only value as a numeric seed', () => {
    expect(parseDynastySeedInput('184726391')).toEqual({
      kind: 'valid',
      seed: 184726391,
    })
  })

  it('parses a normal text value as a string seed', () => {
    expect(parseDynastySeedInput('my-favorite-run_v1')).toEqual({
      kind: 'valid',
      seed: 'my-favorite-run_v1',
    })
  })

  it('trims surrounding whitespace before validating', () => {
    expect(parseDynastySeedInput('  season-one  ')).toEqual({
      kind: 'valid',
      seed: 'season-one',
    })
  })

  it('rejects a digit string too large to be a safe integer', () => {
    const result = parseDynastySeedInput('99999999999999999999999999')
    expect(result.kind).toBe('invalid')
  })

  it('rejects unsupported characters', () => {
    const result = parseDynastySeedInput('seed!! 🏀')
    expect(result.kind).toBe('invalid')
  })

  it('rejects a value beyond the supported length', () => {
    const result = parseDynastySeedInput('a'.repeat(65))
    expect(result.kind).toBe('invalid')
  })
})
