import {
  deriveConferenceRecord,
  deriveConferenceStandings,
  deriveProgramRecord,
  getCompletedGamesForProgram,
  isRegularSeasonComplete,
  type SeasonState,
} from '../season'
import type { UniverseDefinition } from '../universe'
import {
  POSTSEASON_V0_CONFIGURATION,
  type TournamentEntry,
  type TournamentSelectionResult,
} from './domain'

interface Candidate {
  readonly programId: string
  readonly wins: number
  readonly losses: number
  readonly conferenceWins: number
  readonly conferenceLosses: number
}

function compareRatioDescending(
  firstWins: number,
  firstLosses: number,
  secondWins: number,
  secondLosses: number,
): number {
  const firstGames = firstWins + firstLosses
  const secondGames = secondWins + secondLosses
  return (
    secondWins * (firstGames === 0 ? 1 : firstGames) -
    firstWins * (secondGames === 0 ? 1 : secondGames)
  )
}

function compareOverall(first: Candidate, second: Candidate): number {
  return compareRatioDescending(
    first.wins,
    first.losses,
    second.wins,
    second.losses,
  )
}

function compareConference(first: Candidate, second: Candidate): number {
  return compareRatioDescending(
    first.conferenceWins,
    first.conferenceLosses,
    second.conferenceWins,
    second.conferenceLosses,
  )
}

function compareStableFallback(first: Candidate, second: Candidate): number {
  return (
    compareConference(first, second) ||
    first.programId.localeCompare(second.programId)
  )
}

function candidateFor(season: SeasonState, programId: string): Candidate {
  const overall = deriveProgramRecord(season, programId)
  const conference = deriveConferenceRecord(season, programId)
  return {
    programId,
    wins: overall.wins,
    losses: overall.losses,
    conferenceWins: conference.wins,
    conferenceLosses: conference.losses,
  }
}

function compareHeadToHead(
  season: SeasonState,
  first: Candidate,
  second: Candidate,
): number {
  const games = getCompletedGamesForProgram(season, first.programId).filter(
    ({ game }) =>
      game.homeProgramId === second.programId ||
      game.awayProgramId === second.programId,
  )
  const firstWins = games.filter(
    ({ result }) => result.winnerId === first.programId,
  ).length
  return games.length - firstWins - firstWins
}

/** Groups exact overall-percentage ties before applying safe V0 tie rules. */
export function rankAtLargeCandidates(
  season: SeasonState,
  programIds: readonly string[],
): string[] {
  const candidates = programIds
    .map((programId) => candidateFor(season, programId))
    .sort(
      (first, second) =>
        compareOverall(first, second) ||
        first.programId.localeCompare(second.programId),
    )
  const ordered: Candidate[] = []

  for (let start = 0; start < candidates.length; ) {
    let end = start + 1
    while (
      end < candidates.length &&
      compareOverall(candidates[start]!, candidates[end]!) === 0
    ) {
      end += 1
    }

    const group = candidates.slice(start, end)
    if (group.length === 2) {
      const [first, second] = group as [Candidate, Candidate]
      const headToHead = compareHeadToHead(season, first, second)
      ordered.push(
        ...(headToHead < 0
          ? [first, second]
          : headToHead > 0
            ? [second, first]
            : group.sort(compareStableFallback)),
      )
    } else {
      ordered.push(...group.sort(compareStableFallback))
    }
    start = end
  }

  return ordered.map(({ programId }) => programId)
}

/** Orders protected automatic qualifiers without cross-Conference head-to-head. */
export function rankAutomaticQualifiers(
  season: SeasonState,
  programIds: readonly string[],
): string[] {
  return programIds
    .map((programId) => candidateFor(season, programId))
    .sort(
      (first, second) =>
        compareOverall(first, second) ||
        compareConference(first, second) ||
        first.programId.localeCompare(second.programId),
    )
    .map(({ programId }) => programId)
}

/** Selects and seeds the accepted Universe V0 16-team field from results only. */
export function selectNationalTournamentField(
  universe: UniverseDefinition,
  season: SeasonState,
): TournamentSelectionResult {
  if (!isRegularSeasonComplete(season)) {
    throw new RangeError(
      'Cannot select the national tournament field before the regular season is complete.',
    )
  }
  if (
    season.universeId !== universe.id ||
    season.universeVersion !== universe.version
  ) {
    throw new RangeError(
      'Season Universe identity/version does not match the supplied Universe.',
    )
  }

  const automaticIds = universe.conferences.map((conference) => {
    const champion = deriveConferenceStandings(
      universe,
      season,
      conference.id,
    )[0]
    if (!champion) {
      throw new RangeError(
        `Conference "${conference.id}" has no Program eligible for an automatic bid.`,
      )
    }
    return champion.programId
  })
  const automaticSet = new Set(automaticIds)
  if (automaticSet.size !== automaticIds.length) {
    throw new RangeError('A Program cannot represent multiple automatic bids.')
  }
  if (automaticIds.length >= POSTSEASON_V0_CONFIGURATION.fieldSize) {
    throw new RangeError(
      'Postseason V0 requires fewer conferences than tournament field entries.',
    )
  }

  const orderedAutomaticIds = rankAutomaticQualifiers(season, automaticIds)
  const orderedAtLargeIds = rankAtLargeCandidates(
    season,
    universe.programs
      .map(({ id }) => id)
      .filter((programId) => !automaticSet.has(programId)),
  )
  const atLargeCount =
    POSTSEASON_V0_CONFIGURATION.fieldSize - orderedAutomaticIds.length
  const field: TournamentEntry[] = [
    ...orderedAutomaticIds.map((programId, index) => ({
      programId,
      seed: index + 1,
      bidType: 'automatic' as const,
    })),
    ...orderedAtLargeIds.slice(0, atLargeCount).map((programId, index) => ({
      programId,
      seed: orderedAutomaticIds.length + index + 1,
      bidType: 'at-large' as const,
    })),
  ]

  return {
    field,
    firstFourOutProgramIds: orderedAtLargeIds.slice(
      atLargeCount,
      atLargeCount + POSTSEASON_V0_CONFIGURATION.firstFourOutSize,
    ),
  }
}
