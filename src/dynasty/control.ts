import type { DynastyState } from './domain'

/** True when this Dynasty grants no Program user-management authority. */
export function isObserverDynasty(
  dynasty: Pick<DynastyState, 'controlledProgramId'>,
): boolean {
  return dynasty.controlledProgramId === null
}

/** User management is authorized only for the actual controlled Program. */
export function canManageProgram(
  dynasty: Pick<DynastyState, 'controlledProgramId'>,
  programId: string,
): boolean {
  return dynasty.controlledProgramId !== null &&
    dynasty.controlledProgramId === programId
}

/** Resolves Coach-only authority without any presentation-state fallback. */
export function requireControlledProgram(
  dynasty: Pick<DynastyState, 'controlledProgramId'>,
): string {
  if (dynasty.controlledProgramId === null) {
    throw new RangeError('Observer Dynasty has no controlled Program.')
  }
  return dynasty.controlledProgramId
}
