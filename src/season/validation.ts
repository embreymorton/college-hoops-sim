import { validateRotation } from '../engine'
import { validateRegularSeasonSchedule } from '../schedule'
import type { UniverseDefinition } from '../universe'
import type {
  SeasonState,
  SeasonValidationIssue,
  SeasonValidationIssueCode,
  SeasonValidationResult,
} from './domain'
import {
  getGameResultParticipantProblem,
  getGameResultStructureProblems,
} from './gameResultValidation'

function pushIssue(
  issues: SeasonValidationIssue[],
  code: SeasonValidationIssueCode,
  message: string,
  details: Omit<SeasonValidationIssue, 'code' | 'message'> = {},
): void {
  issues.push({ code, message, ...details })
}

function isJsonSafe(
  value: unknown,
  ancestors: Set<object> = new Set(),
): boolean {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }

  if (typeof value === 'number') {
    return Number.isFinite(value)
  }

  if (typeof value !== 'object') {
    return false
  }

  if (ancestors.has(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)

  if (
    !Array.isArray(value) &&
    prototype !== Object.prototype &&
    prototype !== null
  ) {
    return false
  }

  ancestors.add(value)
  const children = Array.isArray(value) ? value : Object.values(value)
  const safe = children.every((child) => isJsonSafe(child, ancestors))
  ancestors.delete(value)

  return safe
}

/** Validates canonical facts without storing or validating derived summaries. */
export function validateSeasonState(
  universe: UniverseDefinition,
  season: SeasonState,
): SeasonValidationResult {
  const issues: SeasonValidationIssue[] = []

  if (season.id.trim().length === 0) {
    pushIssue(issues, 'INVALID_SEASON_ID', 'Season ID cannot be empty.', {
      path: 'id',
    })
  }

  if (!Number.isSafeInteger(season.seasonNumber) || season.seasonNumber < 1) {
    pushIssue(
      issues,
      'INVALID_SEASON_NUMBER',
      'Season number must be a positive safe integer.',
      { path: 'seasonNumber', actual: season.seasonNumber },
    )
  }

  if (
    season.universeId !== universe.id ||
    season.universeVersion !== universe.version
  ) {
    pushIssue(
      issues,
      'SEASON_UNIVERSE_MISMATCH',
      'Season Universe identity/version does not match the supplied Universe.',
      {
        expected: `${universe.id}@${universe.version}`,
        actual: `${season.universeId}@${season.universeVersion}`,
      },
    )
  }

  const scheduleValidation = validateRegularSeasonSchedule(
    universe,
    season.schedule,
  )

  if (!scheduleValidation.valid) {
    pushIssue(
      issues,
      'INVALID_SCHEDULE',
      `Season Schedule has ${scheduleValidation.issues.length} validation issue(s).`,
      { path: 'schedule', actual: scheduleValidation.issues.length },
    )
  }

  const expectedProgramIds = new Set(
    universe.programs.map(({ id }) => id),
  )
  const actualProgramIds = Object.keys(season.programStates)

  for (const programId of expectedProgramIds) {
    if (season.programStates[programId] === undefined) {
      pushIssue(
        issues,
        'MISSING_PROGRAM_STATE',
        `Season is missing basketball state for Program "${programId}".`,
        { path: `programStates.${programId}`, programId },
      )
    }
  }

  for (const programId of actualProgramIds) {
    if (!expectedProgramIds.has(programId)) {
      pushIssue(
        issues,
        'UNKNOWN_PROGRAM_STATE',
        `Season contains basketball state for unknown Program "${programId}".`,
        { path: `programStates.${programId}`, programId },
      )
    }

    const programState = season.programStates[programId]

    if (!programState) {
      continue
    }

    if (programState.team.id !== programId) {
      pushIssue(
        issues,
        'TEAM_ID_MISMATCH',
        `Program-state key "${programId}" contains Team "${programState.team.id}".`,
        {
          path: `programStates.${programId}.team.id`,
          programId,
          expected: programId,
          actual: programState.team.id,
        },
      )
    }

    const rotationValidation = validateRotation(
      programState.team,
      programState.rotation,
    )

    if (!rotationValidation.valid) {
      pushIssue(
        issues,
        'INVALID_ROTATION',
        `Program "${programId}" has ${rotationValidation.issues.length} Rotation validation issue(s).`,
        {
          path: `programStates.${programId}.rotation`,
          programId,
          actual: rotationValidation.issues.length,
        },
      )
    }
  }

  const scheduledGameById = new Map(
    season.schedule.games.map((game) => [game.id, game] as const),
  )

  for (const [scheduledGameId, result] of Object.entries(
    season.resultsByGameId,
  )) {
    const scheduledGame = scheduledGameById.get(scheduledGameId)

    if (!scheduledGame) {
      pushIssue(
        issues,
        'UNKNOWN_RESULT_GAME',
        `Result key "${scheduledGameId}" does not reference a ScheduledGame.`,
        { path: `resultsByGameId.${scheduledGameId}`, scheduledGameId },
      )
      continue
    }

    const participantProblem = getGameResultParticipantProblem(
      scheduledGame,
      result,
    )

    if (participantProblem) {
      pushIssue(
        issues,
        'RESULT_PARTICIPANT_MISMATCH',
        participantProblem,
        { path: `resultsByGameId.${scheduledGameId}`, scheduledGameId },
      )
    }

    for (const problem of getGameResultStructureProblems(result)) {
      pushIssue(issues, 'INVALID_GAME_RESULT', problem, {
        path: `resultsByGameId.${scheduledGameId}`,
        scheduledGameId,
      })
    }
  }

  if (!isJsonSafe(season)) {
    pushIssue(
      issues,
      'NOT_SERIALIZABLE',
      'Season State must contain only finite JSON-serializable data.',
    )
  }

  return { valid: issues.length === 0, issues }
}
