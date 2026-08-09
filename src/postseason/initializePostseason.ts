import { isRegularSeasonComplete, validateSeasonState } from '../season'
import { cloneRotation, cloneTeam } from './cloning'
import { createNationalTournamentBracket } from './bracket'
import type {
  InitializePostseasonOptions,
  PostseasonProgramState,
  PostseasonState,
} from './domain'
import { selectNationalTournamentField } from './selection'
import {
  validateNationalTournamentBracket,
  validatePostseasonState,
  validateTournamentSelection,
} from './validation'

/** Copies qualified end-of-season basketball state into a fresh tournament. */
export function initializePostseason({
  universe,
  season,
}: InitializePostseasonOptions): PostseasonState {
  const seasonValidation = validateSeasonState(universe, season)
  if (!seasonValidation.valid) {
    throw new RangeError(
      `Cannot initialize Postseason from an invalid Season: ${seasonValidation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }
  if (!isRegularSeasonComplete(season)) {
    throw new RangeError(
      'Cannot initialize Postseason before the regular season is complete.',
    )
  }

  const selection = selectNationalTournamentField(universe, season)
  const selectionValidation = validateTournamentSelection(
    universe,
    season,
    selection.field,
  )
  if (!selectionValidation.valid) {
    throw new Error('Generated national tournament field failed validation.')
  }
  const bracket = createNationalTournamentBracket()
  if (!validateNationalTournamentBracket(bracket).valid) {
    throw new Error('Generated national tournament bracket failed validation.')
  }

  const programStates: Record<string, PostseasonProgramState> = {}
  for (const entry of [...selection.field].sort(
    (first, second) => first.programId.localeCompare(second.programId),
  )) {
    const state = season.programStates[entry.programId]
    if (!state) {
      throw new RangeError(
        `Selected Program "${entry.programId}" has no Season basketball state.`,
      )
    }
    programStates[entry.programId] = {
      team: cloneTeam(state.team),
      rotation: cloneRotation(state.rotation),
    }
  }

  const postseason: PostseasonState = {
    id: `postseason:${season.id}:national:${bracket.version}`,
    seasonId: season.id,
    universeId: universe.id,
    universeVersion: universe.version,
    field: selection.field.map((entry) => ({ ...entry })),
    bracket,
    programStates,
    resultsByGameId: {},
  }
  const validation = validatePostseasonState(universe, postseason)
  if (!validation.valid) {
    throw new Error(
      `Initialized Postseason failed validation: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }
  return postseason
}
