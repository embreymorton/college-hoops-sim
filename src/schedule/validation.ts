import {
  validateUniverseDefinition,
  type UniverseDefinition,
} from '../universe'
import type {
  RegularSeasonSchedule,
  ScheduleValidationIssue,
  ScheduleValidationIssueCode,
  ScheduleValidationResult,
} from './domain'

interface ProgramScheduleCounts {
  total: number
  conference: number
  nonconference: number
  home: number
  away: number
}

function pairKey(firstProgramId: string, secondProgramId: string): string {
  return [firstProgramId, secondProgramId].sort().join('\u0000')
}

function pushIssue(
  issues: ScheduleValidationIssue[],
  code: ScheduleValidationIssueCode,
  message: string,
  details: Omit<ScheduleValidationIssue, 'code' | 'message'> = {},
): void {
  issues.push({ code, message, ...details })
}

function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

/** Validates both schedule-wide structure and every Program's schedule. */
export function validateRegularSeasonSchedule(
  universe: UniverseDefinition,
  schedule: RegularSeasonSchedule,
): ScheduleValidationResult {
  const issues: ScheduleValidationIssue[] = []
  const universeValidation = validateUniverseDefinition(universe)

  if (!universeValidation.valid) {
    pushIssue(
      issues,
      'INVALID_UNIVERSE',
      'Schedule validation requires a valid UniverseDefinition.',
      { actual: universeValidation.issues.length },
    )
    return { valid: false, issues }
  }

  if (
    schedule.universeId !== universe.id ||
    schedule.universeVersion !== universe.version
  ) {
    pushIssue(
      issues,
      'SCHEDULE_UNIVERSE_MISMATCH',
      'Schedule Universe identity/version does not match the supplied Universe.',
      {
        expected: `${universe.id}@${universe.version}`,
        actual: `${schedule.universeId}@${schedule.universeVersion}`,
      },
    )
  }

  const { configuration } = schedule
  const configurationValues = [
    configuration.nonConferenceGamesPerProgram,
    configuration.targetHomeGamesPerProgram,
    configuration.targetAwayGamesPerProgram,
  ]
  const programsByConference = new Map<string, string[]>(
    universe.conferences.map(({ id }) => [id, []]),
  )

  for (const program of universe.programs) {
    programsByConference.get(program.conferenceId)?.push(program.id)
  }

  const membershipCounts = [...programsByConference.values()].map(
    ({ length }) => length,
  )
  const programsPerConference = membershipCounts[0] ?? 0
  const supportedMembership =
    programsPerConference > 0 &&
    membershipCounts.every((count) => count === programsPerConference)
  const conferenceGamesPerProgram = 2 * (programsPerConference - 1)
  const expectedGamesPerProgram =
    conferenceGamesPerProgram + configuration.nonConferenceGamesPerProgram
  const configurationSupported =
    configuration.conferenceFormat === 'double-round-robin' &&
    configurationValues.every(isNonNegativeSafeInteger) &&
    supportedMembership &&
    configuration.targetHomeGamesPerProgram +
      configuration.targetAwayGamesPerProgram ===
      expectedGamesPerProgram

  if (!configurationSupported) {
    pushIssue(
      issues,
      'UNSUPPORTED_CONFIGURATION',
      'Schedule configuration and Universe membership do not describe a supported complete schedule.',
    )
  }

  const expectedGameCount =
    (universe.programs.length * expectedGamesPerProgram) / 2

  if (
    !Number.isSafeInteger(expectedGameCount) ||
    schedule.games.length !== expectedGameCount
  ) {
    pushIssue(
      issues,
      'INVALID_GAME_COUNT',
      `Schedule contains ${schedule.games.length} games; expected ${expectedGameCount}.`,
      { expected: expectedGameCount, actual: schedule.games.length },
    )
  }

  if (schedule.roundCount !== expectedGamesPerProgram) {
    pushIssue(
      issues,
      'INVALID_ROUND_COUNT',
      `Schedule contains ${schedule.roundCount} rounds; expected ${expectedGamesPerProgram}.`,
      { expected: expectedGamesPerProgram, actual: schedule.roundCount },
    )
  }

  const programById = new Map(
    universe.programs.map((program) => [program.id, program] as const),
  )
  const countsByProgram = new Map<string, ProgramScheduleCounts>(
    universe.programs.map(({ id }) => [
      id,
      { total: 0, conference: 0, nonconference: 0, home: 0, away: 0 },
    ]),
  )
  const gameIds = new Set<string>()
  const conferenceGamesByPair = new Map<
    string,
    { homeProgramId: string; awayProgramId: string }[]
  >()
  const nonConferencePairCounts = new Map<string, number>()
  const roundParticipation = new Map<number, Map<string, number>>()

  schedule.games.forEach((game, gameIndex) => {
    const path = `games[${gameIndex}]`

    if (game.id.trim().length === 0) {
      pushIssue(issues, 'INVALID_GAME_ID', 'ScheduledGame ID cannot be empty.', {
        path: `${path}.id`,
      })
    } else if (gameIds.has(game.id)) {
      pushIssue(
        issues,
        'DUPLICATE_GAME_ID',
        `ScheduledGame ID "${game.id}" is not unique.`,
        { path: `${path}.id`, gameId: game.id },
      )
    } else {
      gameIds.add(game.id)
    }

    if (game.index !== gameIndex) {
      pushIssue(
        issues,
        'INVALID_GAME_INDEX',
        `ScheduledGame index ${game.index} does not match canonical position ${gameIndex}.`,
        {
          path: `${path}.index`,
          gameId: game.id,
          expected: gameIndex,
          actual: game.index,
        },
      )
    }

    if (
      !Number.isSafeInteger(game.round) ||
      game.round < 1 ||
      game.round > schedule.roundCount
    ) {
      pushIssue(
        issues,
        'INVALID_ROUND',
        `ScheduledGame round ${game.round} is outside 1–${schedule.roundCount}.`,
        { path: `${path}.round`, gameId: game.id, actual: game.round },
      )
    }

    const homeProgram = programById.get(game.homeProgramId)
    const awayProgram = programById.get(game.awayProgramId)

    if (!homeProgram) {
      pushIssue(
        issues,
        'UNKNOWN_PROGRAM',
        `Unknown home Program ID "${game.homeProgramId}".`,
        {
          path: `${path}.homeProgramId`,
          gameId: game.id,
          actual: game.homeProgramId,
        },
      )
    }

    if (!awayProgram) {
      pushIssue(
        issues,
        'UNKNOWN_PROGRAM',
        `Unknown away Program ID "${game.awayProgramId}".`,
        {
          path: `${path}.awayProgramId`,
          gameId: game.id,
          actual: game.awayProgramId,
        },
      )
    }

    if (game.homeProgramId === game.awayProgramId) {
      pushIssue(
        issues,
        'SELF_MATCHUP',
        `Program "${game.homeProgramId}" cannot play itself.`,
        { path, gameId: game.id, programId: game.homeProgramId },
      )
    }

    if (game.type !== 'conference' && game.type !== 'nonconference') {
      pushIssue(
        issues,
        'INVALID_GAME_TYPE',
        `ScheduledGame type "${String(game.type)}" is invalid.`,
        { path: `${path}.type`, gameId: game.id, actual: String(game.type) },
      )
    }

    if (!homeProgram || !awayProgram || homeProgram.id === awayProgram.id) {
      return
    }

    const sameConference =
      homeProgram.conferenceId === awayProgram.conferenceId
    const expectedType = sameConference ? 'conference' : 'nonconference'

    if (game.type !== expectedType) {
      pushIssue(
        issues,
        'INVALID_GAME_CLASSIFICATION',
        `Game between "${homeProgram.id}" and "${awayProgram.id}" must be ${expectedType}.`,
        {
          path: `${path}.type`,
          gameId: game.id,
          expected: expectedType,
          actual: String(game.type),
        },
      )
    }

    const homeCounts = countsByProgram.get(homeProgram.id)
    const awayCounts = countsByProgram.get(awayProgram.id)

    if (homeCounts && awayCounts) {
      homeCounts.total += 1
      homeCounts.home += 1
      awayCounts.total += 1
      awayCounts.away += 1

      if (game.type === 'conference') {
        homeCounts.conference += 1
        awayCounts.conference += 1
      } else if (game.type === 'nonconference') {
        homeCounts.nonconference += 1
        awayCounts.nonconference += 1
      }
    }

    const key = pairKey(homeProgram.id, awayProgram.id)

    if (game.type === 'conference') {
      const pairGames = conferenceGamesByPair.get(key) ?? []
      pairGames.push({
        homeProgramId: homeProgram.id,
        awayProgramId: awayProgram.id,
      })
      conferenceGamesByPair.set(key, pairGames)
    } else if (game.type === 'nonconference') {
      nonConferencePairCounts.set(
        key,
        (nonConferencePairCounts.get(key) ?? 0) + 1,
      )
    }

    if (
      Number.isSafeInteger(game.round) &&
      game.round >= 1 &&
      game.round <= schedule.roundCount
    ) {
      const participation = roundParticipation.get(game.round) ?? new Map()
      participation.set(
        homeProgram.id,
        (participation.get(homeProgram.id) ?? 0) + 1,
      )
      participation.set(
        awayProgram.id,
        (participation.get(awayProgram.id) ?? 0) + 1,
      )
      roundParticipation.set(game.round, participation)
    }
  })

  for (const [key, count] of nonConferencePairCounts) {
    if (count > 1) {
      pushIssue(
        issues,
        'DUPLICATE_NONCONFERENCE_MATCHUP',
        `Non-conference pairing "${key.replace('\u0000', ' / ')}" appears ${count} times.`,
        { expected: 1, actual: count },
      )
    }
  }

  for (const programIds of programsByConference.values()) {
    const sortedProgramIds = [...programIds].sort()

    for (let firstIndex = 0; firstIndex < sortedProgramIds.length; firstIndex += 1) {
      for (
        let secondIndex = firstIndex + 1;
        secondIndex < sortedProgramIds.length;
        secondIndex += 1
      ) {
        const firstProgramId = sortedProgramIds[firstIndex] as string
        const secondProgramId = sortedProgramIds[secondIndex] as string
        const pairGames =
          conferenceGamesByPair.get(pairKey(firstProgramId, secondProgramId)) ??
          []
        const reciprocal =
          pairGames.length === 2 &&
          pairGames.some(
            ({ homeProgramId, awayProgramId }) =>
              homeProgramId === firstProgramId &&
              awayProgramId === secondProgramId,
          ) &&
          pairGames.some(
            ({ homeProgramId, awayProgramId }) =>
              homeProgramId === secondProgramId &&
              awayProgramId === firstProgramId,
          )

        if (!reciprocal) {
          pushIssue(
            issues,
            'INVALID_CONFERENCE_PAIRING',
            `Conference pair "${firstProgramId}" / "${secondProgramId}" must play twice with reciprocal hosts.`,
            {
              expected: 2,
              actual: pairGames.length,
            },
          )
        }
      }
    }
  }

  for (const program of universe.programs) {
    const counts = countsByProgram.get(program.id) as ProgramScheduleCounts

    if (counts.total !== expectedGamesPerProgram) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_GAME_COUNT',
        `Program "${program.id}" has ${counts.total} games; expected ${expectedGamesPerProgram}.`,
        {
          programId: program.id,
          expected: expectedGamesPerProgram,
          actual: counts.total,
        },
      )
    }

    if (counts.conference !== conferenceGamesPerProgram) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_CONFERENCE_COUNT',
        `Program "${program.id}" has ${counts.conference} conference games; expected ${conferenceGamesPerProgram}.`,
        {
          programId: program.id,
          expected: conferenceGamesPerProgram,
          actual: counts.conference,
        },
      )
    }

    if (
      counts.nonconference !== configuration.nonConferenceGamesPerProgram
    ) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_NONCONFERENCE_COUNT',
        `Program "${program.id}" has ${counts.nonconference} non-conference games; expected ${configuration.nonConferenceGamesPerProgram}.`,
        {
          programId: program.id,
          expected: configuration.nonConferenceGamesPerProgram,
          actual: counts.nonconference,
        },
      )
    }

    if (counts.home !== configuration.targetHomeGamesPerProgram) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_HOME_COUNT',
        `Program "${program.id}" has ${counts.home} home games; expected ${configuration.targetHomeGamesPerProgram}.`,
        {
          programId: program.id,
          expected: configuration.targetHomeGamesPerProgram,
          actual: counts.home,
        },
      )
    }

    if (counts.away !== configuration.targetAwayGamesPerProgram) {
      pushIssue(
        issues,
        'INVALID_PROGRAM_AWAY_COUNT',
        `Program "${program.id}" has ${counts.away} away games; expected ${configuration.targetAwayGamesPerProgram}.`,
        {
          programId: program.id,
          expected: configuration.targetAwayGamesPerProgram,
          actual: counts.away,
        },
      )
    }
  }

  for (let round = 1; round <= schedule.roundCount; round += 1) {
    const participation = roundParticipation.get(round) ?? new Map()

    for (const program of universe.programs) {
      const actual = participation.get(program.id) ?? 0

      if (actual !== 1) {
        pushIssue(
          issues,
          'INVALID_ROUND_PARTICIPATION',
          `Program "${program.id}" appears ${actual} times in round ${round}; expected once.`,
          {
            path: `rounds[${round}]`,
            programId: program.id,
            expected: 1,
            actual,
          },
        )
      }
    }
  }

  return { valid: issues.length === 0, issues }
}
