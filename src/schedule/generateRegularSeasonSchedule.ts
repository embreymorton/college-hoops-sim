import { createRng, type Rng, type RngSeed } from '../engine'
import {
  validateUniverseDefinition,
  type ProgramDefinition,
  type UniverseDefinition,
} from '../universe'
import {
  SCHEDULE_V0_CONFIGURATION,
  SCHEDULE_V0_VERSION,
} from './configuration'
import type {
  GenerateRegularSeasonScheduleOptions,
  RegularSeasonSchedule,
  ScheduleConfiguration,
  ScheduledGame,
  ScheduledGameType,
} from './domain'
import { validateRegularSeasonSchedule } from './validation'

interface PendingGame {
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly type: ScheduledGameType
}

interface UnorientedNonConferenceGame {
  readonly firstProgramId: string
  readonly secondProgramId: string
  readonly candidateIndex: number
}

interface NonConferenceCandidateRound {
  readonly pairingRoundIndex: number
  readonly games: Omit<UnorientedNonConferenceGame, 'candidateIndex'>[]
}

interface ScheduleShape {
  readonly conferenceIds: string[]
  readonly programsByConference: Map<string, ProgramDefinition[]>
  readonly programsPerConference: number
  readonly conferenceRoundCount: number
  readonly nonConferenceRoundCount: number
  readonly totalRoundCount: number
}

function compareIds(
  first: { readonly id: string },
  second: { readonly id: string },
): number {
  return first.id.localeCompare(second.id)
}

function shuffled<T>(values: readonly T[], rng: Rng): T[] {
  const result = [...values]

  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index)
    const value = result[index]

    result[index] = result[swapIndex] as T
    result[swapIndex] = value as T
  }

  return result
}

/** Circle-method one-factorization for any even-sized stable collection. */
function createPairingRounds<T>(values: readonly T[]): [T, T][][] {
  if (values.length < 2 || values.length % 2 !== 0) {
    throw new RangeError(
      'Round pairing requires a positive even number of participants.',
    )
  }

  const rotating = [...values]
  const rounds: [T, T][][] = []

  for (let round = 0; round < values.length - 1; round += 1) {
    const pairs: [T, T][] = []

    for (let index = 0; index < values.length / 2; index += 1) {
      pairs.push([
        rotating[index] as T,
        rotating[values.length - 1 - index] as T,
      ])
    }

    rounds.push(pairs)
    rotating.splice(1, 0, rotating.pop() as T)
  }

  return rounds
}

function createSeedNamespace(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
  seed: RngSeed,
  stream: string,
): string {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new RangeError('Schedule seed must be a finite number or a string.')
  }

  return JSON.stringify({
    scheduleVersion: SCHEDULE_V0_VERSION,
    universeId: universe.id,
    universeVersion: universe.version,
    configuration: {
      conferenceFormat: configuration.conferenceFormat,
      nonConferenceGamesPerProgram:
        configuration.nonConferenceGamesPerProgram,
      targetHomeGamesPerProgram: configuration.targetHomeGamesPerProgram,
      targetAwayGamesPerProgram: configuration.targetAwayGamesPerProgram,
    },
    seed: { type: typeof seed, value: seed },
    stream,
  })
}

function scheduleRng(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
  seed: RngSeed,
  stream: string,
): Rng {
  return createRng(createSeedNamespace(universe, configuration, seed, stream))
}

function getSupportedScheduleShape(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
): ScheduleShape {
  const universeValidation = validateUniverseDefinition(universe)

  if (!universeValidation.valid) {
    throw new RangeError(
      `Cannot generate a schedule for an invalid universe: ${universeValidation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  if (configuration.conferenceFormat !== 'double-round-robin') {
    throw new RangeError(
      `Unsupported conference format "${String(configuration.conferenceFormat)}".`,
    )
  }

  for (const [name, value] of Object.entries({
    nonConferenceGamesPerProgram:
      configuration.nonConferenceGamesPerProgram,
    targetHomeGamesPerProgram: configuration.targetHomeGamesPerProgram,
    targetAwayGamesPerProgram: configuration.targetAwayGamesPerProgram,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a non-negative safe integer.`)
    }
  }

  const conferences = [...universe.conferences].sort(compareIds)
  const programsByConference = new Map<string, ProgramDefinition[]>()

  for (const conference of conferences) {
    programsByConference.set(
      conference.id,
      universe.programs
        .filter(({ conferenceId }) => conferenceId === conference.id)
        .sort(compareIds),
    )
  }

  const membershipCounts = [...programsByConference.values()].map(
    ({ length }) => length,
  )
  const programsPerConference = membershipCounts[0] ?? 0

  if (
    programsPerConference === 0 ||
    membershipCounts.some((count) => count !== programsPerConference)
  ) {
    throw new RangeError(
      'Round-based Schedule V0 requires equally sized non-empty conferences.',
    )
  }

  if (programsPerConference !== 1 && programsPerConference % 2 !== 0) {
    throw new RangeError(
      'Round-based double round robin requires an even number of Programs per Conference.',
    )
  }

  const conferenceIds = conferences.map(({ id }) => id)
  const nonConferenceRoundCount =
    configuration.nonConferenceGamesPerProgram

  if (
    nonConferenceRoundCount > 0 &&
    (conferenceIds.length < 2 || conferenceIds.length % 2 !== 0)
  ) {
    throw new RangeError(
      'Round-based non-conference scheduling requires an even number of Conferences.',
    )
  }

  const maximumDistinctNonConferenceOpponents =
    (conferenceIds.length - 1) * programsPerConference

  if (
    nonConferenceRoundCount > maximumDistinctNonConferenceOpponents
  ) {
    throw new RangeError(
      `Cannot assign ${nonConferenceRoundCount} distinct non-conference opponents; ` +
        `only ${maximumDistinctNonConferenceOpponents} are available per Program.`,
    )
  }

  const conferenceRoundCount = 2 * (programsPerConference - 1)
  const totalRoundCount = conferenceRoundCount + nonConferenceRoundCount
  const conferenceHomeGames = programsPerConference - 1
  const requiredNonConferenceHomeGames =
    configuration.targetHomeGamesPerProgram - conferenceHomeGames
  const requiredNonConferenceAwayGames =
    configuration.targetAwayGamesPerProgram - conferenceHomeGames

  if (
    configuration.targetHomeGamesPerProgram +
      configuration.targetAwayGamesPerProgram !==
    totalRoundCount
  ) {
    throw new RangeError(
      'Target home and away games must sum to the derived games per Program.',
    )
  }

  if (
    nonConferenceRoundCount % 2 !== 0 ||
    requiredNonConferenceHomeGames !== nonConferenceRoundCount / 2 ||
    requiredNonConferenceAwayGames !== nonConferenceRoundCount / 2
  ) {
    throw new RangeError(
      'Schedule V0 supports an even, equally split non-conference home/away target.',
    )
  }

  return {
    conferenceIds,
    programsByConference,
    programsPerConference,
    conferenceRoundCount,
    nonConferenceRoundCount,
    totalRoundCount,
  }
}

function createConferenceRounds(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
  seed: RngSeed,
  shape: ScheduleShape,
): PendingGame[][] {
  if (shape.programsPerConference === 1) {
    return []
  }

  const firstLegRounds = Array.from(
    { length: shape.programsPerConference - 1 },
    () => [] as PendingGame[],
  )

  for (const conferenceId of shape.conferenceIds) {
    const programs = shape.programsByConference.get(conferenceId) ?? []
    const orderedPrograms = shuffled(
      programs,
      scheduleRng(
        universe,
        configuration,
        seed,
        `conference-members:${conferenceId}`,
      ),
    )
    const pairingRounds = createPairingRounds(orderedPrograms)

    pairingRounds.forEach((pairs, roundIndex) => {
      pairs.forEach(([first, second], pairIndex) => {
        const firstHosts = (roundIndex + pairIndex) % 2 === 0

        firstLegRounds[roundIndex]?.push({
          homeProgramId: firstHosts ? first.id : second.id,
          awayProgramId: firstHosts ? second.id : first.id,
          type: 'conference',
        })
      })
    })
  }

  const returnLegRounds = firstLegRounds.map((games) =>
    games.map(({ homeProgramId, awayProgramId, type }) => ({
      homeProgramId: awayProgramId,
      awayProgramId: homeProgramId,
      type,
    })),
  )

  return [...firstLegRounds, ...returnLegRounds]
}

function createNonConferenceCandidates(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
  seed: RngSeed,
  shape: ScheduleShape,
): NonConferenceCandidateRound[] {
  if (shape.nonConferenceRoundCount === 0) {
    return []
  }

  const orderedConferenceIds = shuffled(
    shape.conferenceIds,
    scheduleRng(universe, configuration, seed, 'nonconference-conferences'),
  )
  const conferencePairingRounds = createPairingRounds(orderedConferenceIds)
  const orderedProgramsByConference = new Map<string, ProgramDefinition[]>()

  for (const conferenceId of shape.conferenceIds) {
    orderedProgramsByConference.set(
      conferenceId,
      shuffled(
        shape.programsByConference.get(conferenceId) ?? [],
        scheduleRng(
          universe,
          configuration,
          seed,
          `nonconference-members:${conferenceId}`,
        ),
      ),
    )
  }

  const candidates: NonConferenceCandidateRound[] = []

  conferencePairingRounds.forEach((conferencePairs, pairingRoundIndex) => {
    for (let shift = 0; shift < shape.programsPerConference; shift += 1) {
      const games: Omit<
        UnorientedNonConferenceGame,
        'candidateIndex'
      >[] = []

      for (const [firstConferenceId, secondConferenceId] of conferencePairs) {
        const firstPrograms =
          orderedProgramsByConference.get(firstConferenceId) ?? []
        const secondPrograms =
          orderedProgramsByConference.get(secondConferenceId) ?? []

        firstPrograms.forEach((firstProgram, programIndex) => {
          const secondProgram =
            secondPrograms[
              (programIndex + shift) % shape.programsPerConference
            ]

          if (!secondProgram) {
            throw new Error('Non-conference pairing construction failed.')
          }

          games.push({
            firstProgramId: firstProgram.id,
            secondProgramId: secondProgram.id,
          })
        })
      }

      candidates.push({ pairingRoundIndex, games })
    }
  })

  return candidates
}

/** An Euler orientation gives every vertex equal incoming/outgoing degree. */
function orientEvenDegreeGraph(
  edges: readonly UnorientedNonConferenceGame[],
  programIds: readonly string[],
  rng: Rng,
): Map<number, { homeProgramId: string; awayProgramId: string }> {
  const adjacency = new Map<string, number[]>(
    programIds.map((programId) => [programId, []]),
  )

  edges.forEach((edge, edgeIndex) => {
    adjacency.get(edge.firstProgramId)?.push(edgeIndex)
    adjacency.get(edge.secondProgramId)?.push(edgeIndex)
  })

  for (const programId of [...programIds].sort()) {
    adjacency.set(programId, shuffled(adjacency.get(programId) ?? [], rng))
  }

  const cursors = new Map(programIds.map((programId) => [programId, 0]))
  const used = Array.from({ length: edges.length }, () => false)
  const orientation = new Map<
    number,
    { homeProgramId: string; awayProgramId: string }
  >()

  function nextUnusedEdge(programId: string): number | undefined {
    const incidentEdges = adjacency.get(programId) ?? []
    let cursor = cursors.get(programId) ?? 0

    while (cursor < incidentEdges.length) {
      const edgeIndex = incidentEdges[cursor]
      cursor += 1
      cursors.set(programId, cursor)

      if (edgeIndex !== undefined && !used[edgeIndex]) {
        return edgeIndex
      }
    }

    return undefined
  }

  for (const startProgramId of [...programIds].sort()) {
    const hasUnusedIncidentEdge = (adjacency.get(startProgramId) ?? []).some(
      (edgeIndex) => !used[edgeIndex],
    )

    if (!hasUnusedIncidentEdge) {
      continue
    }

    const vertexStack = [startProgramId]
    const edgeStack: number[] = []
    const circuitVertices: string[] = []
    const circuitEdges: number[] = []

    while (vertexStack.length > 0) {
      const currentProgramId = vertexStack.at(-1) as string
      const edgeIndex = nextUnusedEdge(currentProgramId)

      if (edgeIndex === undefined) {
        circuitVertices.push(vertexStack.pop() as string)
        const incomingEdgeIndex = edgeStack.pop()

        if (incomingEdgeIndex !== undefined) {
          circuitEdges.push(incomingEdgeIndex)
        }
        continue
      }

      const edge = edges[edgeIndex]

      if (!edge) {
        throw new Error('Non-conference orientation encountered a missing edge.')
      }

      used[edgeIndex] = true
      const nextProgramId =
        edge.firstProgramId === currentProgramId
          ? edge.secondProgramId
          : edge.firstProgramId
      vertexStack.push(nextProgramId)
      edgeStack.push(edgeIndex)
    }

    circuitVertices.reverse()
    circuitEdges.reverse()

    circuitEdges.forEach((edgeIndex, index) => {
      orientation.set(edgeIndex, {
        homeProgramId: circuitVertices[index] as string,
        awayProgramId: circuitVertices[index + 1] as string,
      })
    })
  }

  if (orientation.size !== edges.length) {
    throw new Error('Could not orient every non-conference matchup.')
  }

  return orientation
}

function createNonConferenceRounds(
  universe: UniverseDefinition,
  configuration: ScheduleConfiguration,
  seed: RngSeed,
  shape: ScheduleShape,
): PendingGame[][] {
  if (shape.nonConferenceRoundCount === 0) {
    return []
  }

  const allCandidates = createNonConferenceCandidates(
    universe,
    configuration,
    seed,
    shape,
  )
  const selectionRng = scheduleRng(
    universe,
    configuration,
    seed,
    'nonconference-selection',
  )
  const candidatesByPairingRound = new Map<
    number,
    NonConferenceCandidateRound[]
  >()

  // Each conference pairing round represents one perfect matching of all
  // Conferences. Taking an even share from each keeps opponent-Conference
  // counts within one game while distinct cyclic shifts prevent rematches.
  for (const candidate of allCandidates) {
    const group =
      candidatesByPairingRound.get(candidate.pairingRoundIndex) ?? []
    group.push(candidate)
    candidatesByPairingRound.set(candidate.pairingRoundIndex, group)
  }

  const pairingRoundIndexes = shuffled(
    [...candidatesByPairingRound.keys()].sort((first, second) => first - second),
    selectionRng,
  )
  const baseRoundsPerConferencePairing = Math.floor(
    shape.nonConferenceRoundCount / pairingRoundIndexes.length,
  )
  const extraRoundCount =
    shape.nonConferenceRoundCount % pairingRoundIndexes.length
  const candidates = pairingRoundIndexes.flatMap((pairingRoundIndex, index) =>
    shuffled(
      candidatesByPairingRound.get(pairingRoundIndex) ?? [],
      selectionRng,
    ).slice(
      0,
      baseRoundsPerConferencePairing + (index < extraRoundCount ? 1 : 0),
    ),
  )
  const edges = candidates.flatMap((candidate, candidateIndex) =>
    candidate.games.map((game) => ({ ...game, candidateIndex })),
  )
  const programIds = [...universe.programs]
    .sort(compareIds)
    .map(({ id }) => id)
  const orientation = orientEvenDegreeGraph(
    edges,
    programIds,
    scheduleRng(universe, configuration, seed, 'nonconference-orientation'),
  )
  const rounds = candidates.map(() => [] as PendingGame[])

  edges.forEach((edge, edgeIndex) => {
    const oriented = orientation.get(edgeIndex)

    if (!oriented) {
      throw new Error('Non-conference orientation result is incomplete.')
    }

    rounds[edge.candidateIndex]?.push({ ...oriented, type: 'nonconference' })
  })

  return rounds
}

function mixRounds(
  conferenceRounds: readonly PendingGame[][],
  nonConferenceRounds: readonly PendingGame[][],
): PendingGame[][] {
  const totalRoundCount =
    conferenceRounds.length + nonConferenceRounds.length
  const result: PendingGame[][] = []
  let conferenceIndex = 0
  let nonConferenceIndex = 0

  for (let index = 0; index < totalRoundCount; index += 1) {
    const nonConferenceRoundsBefore = Math.floor(
      (index * nonConferenceRounds.length) / totalRoundCount,
    )
    const nonConferenceRoundsAfter = Math.floor(
      ((index + 1) * nonConferenceRounds.length) / totalRoundCount,
    )
    const useNonConference =
      nonConferenceRoundsAfter > nonConferenceRoundsBefore

    if (useNonConference) {
      result.push(nonConferenceRounds[nonConferenceIndex] as PendingGame[])
      nonConferenceIndex += 1
    } else {
      result.push(conferenceRounds[conferenceIndex] as PendingGame[])
      conferenceIndex += 1
    }
  }

  return result
}

function assignGameIdentity(
  universe: UniverseDefinition,
  rounds: readonly PendingGame[][],
  universeRng: Rng,
  gameIdNamespace?: string,
): ScheduledGame[] {
  let gameIndex = 0

  return rounds.flatMap((roundGames, roundIndex) =>
    shuffled(roundGames, universeRng).map((game) => {
      const index = gameIndex
      const round = roundIndex + 1

      gameIndex += 1

      return {
        ...game,
        id:
          `schedule:${universe.id}:${universe.version}:` +
          (gameIdNamespace ? `${gameIdNamespace}:` : '') +
          `round-${round}:game-${index}:${game.homeProgramId}:${game.awayProgramId}`,
        index,
        round,
      }
    }),
  )
}

/**
 * Builds a complete schedule through finite round-robin constructions.
 * No random retries or search are used.
 */
export function generateRegularSeasonSchedule({
  universe,
  seed,
  configuration = SCHEDULE_V0_CONFIGURATION,
  gameIdNamespace,
}: GenerateRegularSeasonScheduleOptions): RegularSeasonSchedule {
  if (gameIdNamespace !== undefined && gameIdNamespace.trim().length === 0) {
    throw new RangeError('Schedule game-ID namespace cannot be empty.')
  }
  const shape = getSupportedScheduleShape(universe, configuration)
  const conferenceRounds = createConferenceRounds(
    universe,
    configuration,
    seed,
    shape,
  )
  const firstLegCount = shape.conferenceRoundCount / 2
  const orderedConferenceRounds = [
    ...shuffled(
      conferenceRounds.slice(0, firstLegCount),
      scheduleRng(universe, configuration, seed, 'conference-first-leg-order'),
    ),
    ...shuffled(
      conferenceRounds.slice(firstLegCount),
      scheduleRng(universe, configuration, seed, 'conference-return-leg-order'),
    ),
  ]
  const nonConferenceRounds = shuffled(
    createNonConferenceRounds(
      universe,
      configuration,
      seed,
      shape,
    ),
    scheduleRng(universe, configuration, seed, 'nonconference-round-order'),
  )
  const rounds = mixRounds(orderedConferenceRounds, nonConferenceRounds)
  const schedule: RegularSeasonSchedule = {
    version: SCHEDULE_V0_VERSION,
    universeId: universe.id,
    universeVersion: universe.version,
    seed,
    configuration: { ...configuration },
    roundCount: shape.totalRoundCount,
    games: assignGameIdentity(
      universe,
      rounds,
      scheduleRng(universe, configuration, seed, 'games-within-round'),
      gameIdNamespace,
    ),
  }
  const validation = validateRegularSeasonSchedule(universe, schedule)

  if (!validation.valid) {
    throw new Error(
      `Generated schedule failed validation: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return schedule
}
