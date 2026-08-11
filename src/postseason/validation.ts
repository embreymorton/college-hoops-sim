import { validateRotationV1 } from '../engine'
import { isRegularSeasonComplete, type SeasonState } from '../season'
import type { UniverseDefinition } from '../universe'
import { createNationalTournamentBracket } from './bracket'
import {
  POSTSEASON_V0_CONFIGURATION,
  TOURNAMENT_ROUNDS,
  type NationalTournamentBracket,
  type PostseasonState,
  type PostseasonValidationIssue,
  type PostseasonValidationIssueCode,
  type PostseasonValidationResult,
  type TournamentEntry,
} from './domain'
import { resolveTournamentGameParticipants } from './queries'
import { getTournamentResultProblems } from './resultValidation'
import { selectNationalTournamentField } from './selection'

function pushIssue(
  issues: PostseasonValidationIssue[],
  code: PostseasonValidationIssueCode,
  message: string,
  details: Omit<PostseasonValidationIssue, 'code' | 'message'> = {},
): void {
  issues.push({ code, message, ...details })
}

function isJsonSafe(value: unknown, ancestors: Set<object> = new Set()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true
  }
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object' || ancestors.has(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) {
    return false
  }
  ancestors.add(value)
  const children = Array.isArray(value) ? value : Object.values(value)
  const safe = children.every((child) => isJsonSafe(child, ancestors))
  ancestors.delete(value)
  return safe
}

export function validateTournamentSelection(
  universe: UniverseDefinition,
  season: SeasonState,
  field: readonly TournamentEntry[],
): PostseasonValidationResult {
  const issues: PostseasonValidationIssue[] = []
  if (!isRegularSeasonComplete(season)) {
    pushIssue(
      issues,
      'INCOMPLETE_REGULAR_SEASON',
      'Tournament selection requires a completed regular season.',
    )
    return { valid: false, issues }
  }
  if (
    season.universeId !== universe.id ||
    season.universeVersion !== universe.version
  ) {
    pushIssue(
      issues,
      'POSTSEASON_UNIVERSE_MISMATCH',
      'Season Universe identity/version does not match the supplied Universe.',
    )
    return { valid: false, issues }
  }
  if (field.length !== POSTSEASON_V0_CONFIGURATION.fieldSize) {
    pushIssue(
      issues,
      'INVALID_FIELD_SIZE',
      `Postseason V0 requires ${POSTSEASON_V0_CONFIGURATION.fieldSize} entries.`,
      { expected: POSTSEASON_V0_CONFIGURATION.fieldSize, actual: field.length },
    )
  }
  const validProgramIds = new Set(universe.programs.map(({ id }) => id))
  const seenPrograms = new Set<string>()
  const seenSeeds = new Set<number>()
  for (const entry of field) {
    if (!validProgramIds.has(entry.programId)) {
      pushIssue(issues, 'UNKNOWN_FIELD_PROGRAM', `Unknown field Program "${entry.programId}".`, {
        programId: entry.programId,
      })
    }
    if (seenPrograms.has(entry.programId)) {
      pushIssue(issues, 'DUPLICATE_FIELD_PROGRAM', `Duplicate field Program "${entry.programId}".`, {
        programId: entry.programId,
      })
    }
    seenPrograms.add(entry.programId)
    if (
      !Number.isSafeInteger(entry.seed) ||
      entry.seed < 1 ||
      entry.seed > POSTSEASON_V0_CONFIGURATION.fieldSize
    ) {
      pushIssue(issues, 'INVALID_SEED', `Invalid tournament seed "${entry.seed}".`)
    }
    if (seenSeeds.has(entry.seed)) {
      pushIssue(issues, 'DUPLICATE_SEED', `Duplicate tournament seed "${entry.seed}".`)
    }
    seenSeeds.add(entry.seed)
    if (entry.bidType !== 'automatic' && entry.bidType !== 'at-large') {
      pushIssue(issues, 'INVALID_BID_TYPE', `Invalid bid type for "${entry.programId}".`)
    }
  }

  const expected = selectNationalTournamentField(universe, season).field
  for (let seed = 1; seed <= POSTSEASON_V0_CONFIGURATION.fieldSize; seed += 1) {
    const expectedEntry = expected.find((entry) => entry.seed === seed)
    const actualEntry = field.find((entry) => entry.seed === seed)
    if (!expectedEntry || actualEntry?.programId !== expectedEntry.programId) {
      pushIssue(
        issues,
        expectedEntry?.bidType === 'automatic'
          ? 'INVALID_AUTOMATIC_BID'
          : 'INVALID_AT_LARGE_BID',
        `Seed ${seed} does not match deterministic V0 selection.`,
        { expected: expectedEntry?.programId, actual: actualEntry?.programId },
      )
    } else if (actualEntry.bidType !== expectedEntry.bidType) {
      pushIssue(
        issues,
        expectedEntry.bidType === 'automatic'
          ? 'INVALID_AUTOMATIC_BID'
          : 'INVALID_AT_LARGE_BID',
        `Seed ${seed} has the wrong bid type.`,
      )
    }
  }
  return { valid: issues.length === 0, issues }
}

export function validateNationalTournamentBracket(
  bracket: NationalTournamentBracket,
): PostseasonValidationResult {
  const issues: PostseasonValidationIssue[] = []
  if (bracket.games.length !== POSTSEASON_V0_CONFIGURATION.totalGames) {
    pushIssue(issues, 'INVALID_BRACKET', 'Postseason V0 bracket must contain 15 games.')
  }
  const ids = new Set<string>()
  for (const game of bracket.games) {
    if (ids.has(game.id)) {
      pushIssue(issues, 'DUPLICATE_GAME_ID', `Duplicate Tournament game ID "${game.id}".`, {
        tournamentGameId: game.id,
      })
    }
    ids.add(game.id)
  }
  const expectedCounts: Record<(typeof TOURNAMENT_ROUNDS)[number], number> = {
    'round-of-16': 8,
    quarterfinals: 4,
    semifinals: 2,
    championship: 1,
  }
  for (const round of TOURNAMENT_ROUNDS) {
    const actual = bracket.games.filter((game) => game.round === round).length
    if (actual !== expectedCounts[round]) {
      pushIssue(issues, 'INVALID_BRACKET', `Tournament round "${round}" has ${actual} games instead of ${expectedCounts[round]}.`)
    }
  }
  if (JSON.stringify(bracket) !== JSON.stringify(createNationalTournamentBracket())) {
    pushIssue(
      issues,
      'INVALID_BRACKET',
      'Tournament bracket does not match the accepted fixed V0 pathways.',
    )
  }
  if (!isJsonSafe(bracket)) {
    pushIssue(issues, 'NOT_SERIALIZABLE', 'Tournament bracket must be JSON-serializable.')
  }
  return { valid: issues.length === 0, issues }
}

export function validatePostseasonState(
  universe: UniverseDefinition,
  postseason: PostseasonState,
): PostseasonValidationResult {
  const issues = [...validateNationalTournamentBracket(postseason.bracket).issues]
  if (
    postseason.universeId !== universe.id ||
    postseason.universeVersion !== universe.version
  ) {
    pushIssue(issues, 'POSTSEASON_UNIVERSE_MISMATCH', 'Postseason Universe identity/version does not match.')
  }
  const fieldIds = new Set(postseason.field.map(({ programId }) => programId))
  const universeProgramIds = new Set(universe.programs.map(({ id }) => id))
  const seenProgramIds = new Set<string>()
  const seenSeeds = new Set<number>()
  if (postseason.field.length !== POSTSEASON_V0_CONFIGURATION.fieldSize) {
    pushIssue(issues, 'INVALID_FIELD_SIZE', 'Postseason field must contain 16 entries.')
  }
  for (const entry of postseason.field) {
    if (!universeProgramIds.has(entry.programId)) {
      pushIssue(issues, 'UNKNOWN_FIELD_PROGRAM', `Unknown field Program "${entry.programId}".`, {
        programId: entry.programId,
      })
    }
    if (seenProgramIds.has(entry.programId)) {
      pushIssue(issues, 'DUPLICATE_FIELD_PROGRAM', `Duplicate field Program "${entry.programId}".`, {
        programId: entry.programId,
      })
    }
    seenProgramIds.add(entry.programId)
    if (
      !Number.isSafeInteger(entry.seed) ||
      entry.seed < 1 ||
      entry.seed > POSTSEASON_V0_CONFIGURATION.fieldSize
    ) {
      pushIssue(issues, 'INVALID_SEED', `Invalid tournament seed "${entry.seed}".`)
    }
    if (seenSeeds.has(entry.seed)) {
      pushIssue(issues, 'DUPLICATE_SEED', `Duplicate tournament seed "${entry.seed}".`)
    }
    seenSeeds.add(entry.seed)
    if (entry.bidType !== 'automatic' && entry.bidType !== 'at-large') {
      pushIssue(
        issues,
        'INVALID_BID_TYPE',
        `Seed ${entry.seed} has an invalid bid type.`,
        { programId: entry.programId },
      )
    }
    const state = postseason.programStates[entry.programId]
    if (!state) {
      pushIssue(issues, 'INVALID_PROGRAM_STATE', `Missing Postseason state for "${entry.programId}".`, {
        programId: entry.programId,
      })
      continue
    }
    if (state.team.id !== entry.programId) {
      pushIssue(issues, 'TEAM_ID_MISMATCH', `Program-state key "${entry.programId}" contains Team "${state.team.id}".`, {
        programId: entry.programId,
      })
    }
    if (!validateRotationV1(state.team, state.rotation).valid) {
      pushIssue(issues, 'INVALID_ROTATION', `Program "${entry.programId}" has an invalid Rotation.`, {
        programId: entry.programId,
      })
    }
  }
  const automaticBidCount = postseason.field.filter(
    ({ bidType }) => bidType === 'automatic',
  ).length
  if (automaticBidCount !== universe.conferences.length) {
    pushIssue(
      issues,
      'INVALID_AUTOMATIC_BID',
      `Postseason must contain ${universe.conferences.length} automatic bids.`,
      { expected: universe.conferences.length, actual: automaticBidCount },
    )
  }
  for (const programId of Object.keys(postseason.programStates)) {
    if (!fieldIds.has(programId)) {
      pushIssue(issues, 'INVALID_PROGRAM_STATE', `Unknown non-field Postseason state "${programId}".`, {
        programId,
      })
    }
  }

  let validatedResults: PostseasonState = { ...postseason, resultsByGameId: {} }
  const gameIds = new Set(postseason.bracket.games.map(({ id }) => id))
  for (const resultId of Object.keys(postseason.resultsByGameId)) {
    if (!gameIds.has(resultId)) {
      pushIssue(issues, 'UNKNOWN_RESULT_GAME', `Result key "${resultId}" is not a Tournament game.`, {
        tournamentGameId: resultId,
      })
    }
  }
  for (const game of postseason.bracket.games) {
    const result = postseason.resultsByGameId[game.id]
    if (!result) continue
    const participants = resolveTournamentGameParticipants(validatedResults, game.id)
    if (!participants) {
      pushIssue(issues, 'UNRESOLVED_RESULT_PARTICIPANTS', `Result for "${game.id}" exists before its sources resolve.`, {
        tournamentGameId: game.id,
      })
      continue
    }
    const problems = getTournamentResultProblems(participants, result)
    for (const problem of problems) {
      pushIssue(
        issues,
        problem.startsWith('Result participants')
          ? 'RESULT_PARTICIPANT_MISMATCH'
          : 'INVALID_GAME_RESULT',
        problem,
        { tournamentGameId: game.id },
      )
    }
    validatedResults = {
      ...validatedResults,
      resultsByGameId: {
        ...validatedResults.resultsByGameId,
        [game.id]: result,
      },
    }
  }
  if (!isJsonSafe(postseason)) {
    pushIssue(issues, 'NOT_SERIALIZABLE', 'Postseason State must contain only finite JSON-serializable data.')
  }
  return { valid: issues.length === 0, issues }
}
