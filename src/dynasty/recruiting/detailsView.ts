import { calculateOverall, type ClassYear, type PlayerAttributes, type Position } from '../../engine'
import type { DynastyState } from '../domain'
import {
  deriveRecruitingBattleView,
  type RecruitingBattleView,
} from './battleView'
import type { RecruitStarRating } from './domain'
import { getRecruit } from './queries'

/** Player-safe inspection model for one Recruit in the active Recruiting class. */
export interface RecruitDetailsView {
  readonly playerId: string
  readonly firstName: string
  readonly lastName: string
  readonly position: Position
  readonly classYear: ClassYear
  /** Total inches, matching the canonical Player representation. */
  readonly height: number
  readonly ratings: Readonly<PlayerAttributes>
  readonly overall: number
  readonly potential: number
  readonly targetSeasonNumber: number
  readonly nationalRank: number
  readonly positionRank: number
  readonly stars: RecruitStarRating
  /** Existing player-safe readiness, commitment, controlled, and pursuer projection. */
  readonly battle: RecruitingBattleView
}

/**
 * Assembles existing Recruit facts and the accepted battle projection without
 * storing detail state or exposing hidden Recruiting inputs.
 */
export function deriveRecruitDetailsView(
  dynasty: DynastyState,
  playerId: string,
): RecruitDetailsView {
  const recruiting = dynasty.recruiting
  if (!recruiting) throw new RangeError('Dynasty Recruiting is not initialized.')

  const recruit = getRecruit(recruiting, playerId)
  if (!recruit) throw new RangeError(`Unknown Recruit Player ID "${playerId}".`)

  const { player } = recruit
  return {
    playerId: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    classYear: player.classYear,
    height: player.height,
    ratings: player.attributes,
    overall: calculateOverall(player),
    potential: player.potential,
    targetSeasonNumber: recruiting.targetSeasonNumber,
    nationalRank: recruit.nationalRank,
    positionRank: recruit.positionRank,
    stars: recruit.stars,
    battle: deriveRecruitingBattleView(dynasty, playerId),
  }
}
