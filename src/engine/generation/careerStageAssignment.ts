import type { ClassYear } from '../domain'
import { createRng, type RngSeed } from '../random'

export const S0_CAREER_STAGE_PRIORITY_V1 = {
  namespace: 'college-hoops-sim:s0-career-stage-priority:candidate-a:v1',
  location: { FR: -0.9, SO: -0.3, JR: 0.35, SR: 0.55 },
  logisticScale: 1.25,
} as const

export interface CareerStageAssignmentContext {
  readonly universeSeed: RngSeed
  readonly programId: string
}

function logisticNoise(seed: string): number {
  const unit = createRng(seed).next()
  return Math.log((unit + Number.EPSILON) / (1 - unit + Number.EPSILON))
}

export function mapClassYearsByPriority(
  classYears: readonly ClassYear[],
  priorities: readonly number[],
): ClassYear[] {
  if (priorities.length !== classYears.length || priorities.some((value) => !Number.isFinite(value))) {
    throw new RangeError('Career-stage priorities must be finite and match the class-token count.')
  }
  return classYears.map((classYear, tokenIndex) => ({ classYear, tokenIndex, priority: priorities[tokenIndex]! }))
    .sort((first, second) => second.priority - first.priority || first.tokenIndex - second.tokenIndex)
    .map(({ classYear }) => classYear)
}

/** Maps existing class tokens onto ordered S0 talent opportunities without changing their counts. */
export function assignS0CareerStageClassYears(
  classYears: readonly ClassYear[],
  context: CareerStageAssignmentContext,
): ClassYear[] {
  const priorities = classYears.map((classYear, tokenIndex) =>
    S0_CAREER_STAGE_PRIORITY_V1.location[classYear] +
    S0_CAREER_STAGE_PRIORITY_V1.logisticScale * logisticNoise(JSON.stringify({
      namespace: S0_CAREER_STAGE_PRIORITY_V1.namespace,
      seed: context.universeSeed,
      programId: context.programId,
      tokenIndex,
      classYear,
    })),
  )
  return mapClassYearsByPriority(classYears, priorities)
}
