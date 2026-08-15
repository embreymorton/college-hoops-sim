import type { Player, PlayerAttributes } from '../src/engine'

export const PLAYER_ATTRIBUTE_KEYS = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
] as const satisfies readonly (keyof PlayerAttributes)[]

export interface WeaknessCounts {
  readonly below50: number
  readonly below60: number
  readonly below70: number
}

export interface ProfileShape {
  readonly spread: number
  readonly standardDeviation: number
  readonly topTwoMinusBottomTwo: number
  readonly weaknesses: WeaknessCounts
}

export function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length,
  )
}

export function countWeaknesses(values: readonly number[]): WeaknessCounts {
  return {
    below50: values.filter((value) => value < 50).length,
    below60: values.filter((value) => value < 60).length,
    below70: values.filter((value) => value < 70).length,
  }
}

export function deriveProfileShape(
  attributes: PlayerAttributes,
  keys: readonly (keyof PlayerAttributes)[] = PLAYER_ATTRIBUTE_KEYS,
): ProfileShape {
  if (keys.length < 2) {
    throw new RangeError('profile shape requires at least two attributes')
  }
  const values = keys.map((key) => attributes[key]).sort((a, b) => a - b)
  const bottomTwo = (values[0]! + values[1]!) / 2
  const topTwo = (values.at(-1)! + values.at(-2)!) / 2

  return {
    spread: values.at(-1)! - values[0]!,
    standardDeviation: standardDeviation(values),
    topTwoMinusBottomTwo: topTwo - bottomTwo,
    weaknesses: countWeaknesses(values),
  }
}

export function withAttributeConstraints(
  player: Player,
  upperBounds: Partial<Record<keyof PlayerAttributes, number>>,
): Player {
  return {
    ...player,
    attributes: Object.fromEntries(
      PLAYER_ATTRIBUTE_KEYS.map((key) => [
        key,
        Math.min(player.attributes[key], upperBounds[key] ?? 99),
      ]),
    ) as unknown as PlayerAttributes,
  }
}
