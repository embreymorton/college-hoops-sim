export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'] as const
export type Position = (typeof POSITIONS)[number]

export const CLASS_YEARS = ['FR', 'SO', 'JR', 'SR'] as const
export type ClassYear = (typeof CLASS_YEARS)[number]

export const MIN_PLAYER_RATING = 40
export const MAX_PLAYER_RATING = 99

/** Current on-court ratings, each expected to be in the inclusive 40–99 range. */
export interface PlayerAttributes {
  finishing: number
  shooting: number
  playmaking: number
  ballHandling: number
  perimeterDefense: number
  interiorDefense: number
  rebounding: number
  athleticism: number
  stamina: number
}

/** A JSON-serializable player record. Height is stored as total inches. */
export interface Player {
  id: string
  firstName: string
  lastName: string
  position: Position
  classYear: ClassYear
  height: number
  attributes: PlayerAttributes
  /** Approximate development ceiling in 40–99; never below current overall. */
  potential: number
}
