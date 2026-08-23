import type { Player, RngSeed } from '../engine'
import { deriveDevelopmentTendency, type DevelopmentTendency } from './development'

export type PlayerWorkEthicLabel = 'Inconsistent' | 'Steady' | 'Strong'
export type PlayerWorkEthic =
  | { readonly status: 'unknown'; readonly label: 'Unknown' }
  | { readonly status: 'revealed'; readonly label: PlayerWorkEthicLabel }

const LABELS: Readonly<Record<DevelopmentTendency, PlayerWorkEthicLabel>> = {
  weak: 'Inconsistent',
  steady: 'Steady',
  strong: 'Strong',
}

/** Player-facing projection over the stable ordinary-development tendency. */
export function derivePlayerWorkEthic(
  player: Pick<Player, 'id'>,
  dynastySeed: RngSeed,
  revealed: boolean,
): PlayerWorkEthic {
  if (!revealed) return { status: 'unknown', label: 'Unknown' }
  return {
    status: 'revealed',
    label: LABELS[deriveDevelopmentTendency(player, dynastySeed)],
  }
}
