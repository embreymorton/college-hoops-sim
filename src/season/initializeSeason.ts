import { validateRotation } from '../engine'
import { validateRegularSeasonSchedule } from '../schedule'
import { cloneRotation, cloneTeam } from './cloning'
import type {
  InitializeSeasonOptions,
  SeasonProgramState,
  SeasonState,
} from './domain'
import { validateSeasonState } from './validation'

function createSeasonId(
  universeId: string,
  universeVersion: string,
  seasonNumber: number,
): string {
  return `season:${universeId}:${universeVersion}:number-${seasonNumber}`
}

/** Combines stable world, initialized basketball state, and schedule facts. */
export function initializeSeason({
  universe,
  initializedUniverse,
  schedule,
  seasonNumber,
}: InitializeSeasonOptions): SeasonState {
  if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) {
    throw new RangeError('Season number must be a positive safe integer.')
  }

  if (
    initializedUniverse.universeId !== universe.id ||
    initializedUniverse.universeVersion !== universe.version
  ) {
    throw new RangeError(
      'Initialized Universe identity/version does not match the supplied UniverseDefinition.',
    )
  }

  const scheduleValidation = validateRegularSeasonSchedule(universe, schedule)

  if (!scheduleValidation.valid) {
    throw new RangeError(
      `Cannot initialize Season from an invalid Schedule: ${scheduleValidation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  const initializedByProgramId = new Map(
    initializedUniverse.programs.map((state) => [state.program.id, state]),
  )
  const expectedProgramIds = new Set(
    universe.programs.map(({ id }) => id),
  )

  for (const initialized of initializedUniverse.programs) {
    if (!expectedProgramIds.has(initialized.program.id)) {
      throw new RangeError(
        `Initialized Universe contains unknown Program "${initialized.program.id}".`,
      )
    }
  }

  const programStates: Record<string, SeasonProgramState> = {}

  for (const program of [...universe.programs].sort((first, second) =>
    first.id.localeCompare(second.id),
  )) {
    const initialized = initializedByProgramId.get(program.id)

    if (!initialized) {
      throw new RangeError(
        `Initialized Universe is missing Program "${program.id}".`,
      )
    }

    const rotationValidation = validateRotation(
      initialized.team,
      initialized.rotation,
    )

    if (!rotationValidation.valid) {
      throw new RangeError(
        `Program "${program.id}" has an invalid initial Rotation: ${rotationValidation.issues
          .map(({ message }) => message)
          .join(' ')}`,
      )
    }

    programStates[program.id] = {
      team: cloneTeam(initialized.team),
      rotation: cloneRotation(initialized.rotation),
    }
  }

  const season: SeasonState = {
    id: createSeasonId(universe.id, universe.version, seasonNumber),
    seasonNumber,
    universeId: universe.id,
    universeVersion: universe.version,
    schedule,
    programStates,
    resultsByGameId: {},
  }
  const validation = validateSeasonState(universe, season)

  if (!validation.valid) {
    throw new Error(
      `Initialized Season failed validation: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return season
}
