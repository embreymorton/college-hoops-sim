import { calculateOverall, type ClassYear, type Player } from '../src/engine'
import {
  assignS0CareerStageClassYears,
  S0_CAREER_STAGE_PRIORITY_V1,
} from '../src/engine/generation/careerStageAssignment'

export const S0_CAREER_STAGE_CANDIDATE = S0_CAREER_STAGE_PRIORITY_V1

export interface CandidatePlayer {
  readonly player: Player
  readonly classYear: ClassYear
  readonly overall: number
  readonly slotRank: number
  readonly priority: number
}

/** Diagnostic-only: reassigns the existing class tokens over unchanged roster opportunities. */
export function assignCandidateClasses(
  roster: readonly Player[],
  seed: string,
  programId: string,
): CandidatePlayer[] {
  const classYears = assignS0CareerStageClassYears(
    roster.map(({ classYear }) => classYear),
    { universeSeed: seed, programId },
  )

  return roster.map((player, slotRank) => ({
    player,
    classYear: classYears[slotRank]!,
    overall: calculateOverall(player),
    slotRank,
    priority: -slotRank,
  }))
}
