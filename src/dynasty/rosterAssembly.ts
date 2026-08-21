import {
  CLASS_YEARS,
  MAX_PLAYER_RATING,
  MIN_PLAYER_RATING,
  POSITIONS,
  TEAM_ROSTER_SIZE,
  calculateOverall,
  type Player,
  type Position,
} from '../engine'
import type { UniverseDefinition } from '../universe'
import type {
  AssembleNextSeasonRostersOptions,
  CompletedSeasonArchive,
  NextSeasonProgramRoster,
  NextSeasonRosterAssembly,
  NextSeasonRosterValidationIssue,
  NextSeasonRosterValidationResult,
  OffseasonState,
} from './domain'
import type { CompletedRecruitingClass } from './recruiting/domain'

const ATTRIBUTE_NAMES = [
  'finishing',
  'shooting',
  'playmaking',
  'ballHandling',
  'perimeterDefense',
  'interiorDefense',
  'rebounding',
  'athleticism',
  'stamina',
] as const satisfies readonly (keyof Player['attributes'])[]

const HEIGHT_RANGES = {
  PG: [70, 77],
  SG: [73, 79],
  SF: [76, 81],
  PF: [78, 83],
  C: [80, 86],
} as const satisfies Readonly<Record<Position, readonly [number, number]>>

function comparePlayers(first: Player, second: Player): number {
  return (
    POSITIONS.indexOf(first.position) - POSITIONS.indexOf(second.position) ||
    first.id.localeCompare(second.id)
  )
}

function samePersonIdentity(first: Player, second: Player): boolean {
  return (
    first.id === second.id &&
    first.firstName === second.firstName &&
    first.lastName === second.lastName &&
    first.position === second.position &&
    first.height === second.height &&
    first.potential === second.potential
  )
}

function latestArchivedRoster(
  archive: CompletedSeasonArchive,
  programId: string,
): readonly Player[] | undefined {
  return (
    archive.postseason.programStates[programId]?.team.roster ??
    archive.season.programStates[programId]?.team.roster
  )
}

function positionCounts(players: readonly Player[]): Record<Position, number> {
  const counts = Object.fromEntries(
    POSITIONS.map((position) => [position, 0]),
  ) as Record<Position, number>
  for (const player of players) {
    if (POSITIONS.includes(player.position)) counts[player.position] += 1
  }
  return counts
}

function addIssue(
  issues: NextSeasonRosterValidationIssue[],
  code: NextSeasonRosterValidationIssue['code'],
  message: string,
  context: Pick<NextSeasonRosterValidationIssue, 'programId' | 'playerId'> = {},
): void {
  issues.push({ code, message, ...context })
}

function validatePlayer(
  player: Player,
  issues: NextSeasonRosterValidationIssue[],
  programId: string,
): void {
  const context = { programId, playerId: player.id }
  const heightRange = HEIGHT_RANGES[player.position]
  if (
    player.id.trim().length === 0 ||
    player.firstName.trim().length === 0 ||
    player.lastName.trim().length === 0 ||
    !POSITIONS.includes(player.position) ||
    !CLASS_YEARS.includes(player.classYear) ||
    !Number.isSafeInteger(player.height) ||
    !heightRange ||
    player.height < heightRange[0] ||
    player.height > heightRange[1]
  ) {
    addIssue(issues, 'INVALID_PLAYER', `Program "${programId}" has an invalid Player identity/profile.`, context)
    return
  }
  if (
    !Number.isInteger(player.potential) ||
    player.potential < MIN_PLAYER_RATING ||
    player.potential > MAX_PLAYER_RATING ||
    ATTRIBUTE_NAMES.some((name) =>
      !Number.isInteger(player.attributes[name]) ||
      player.attributes[name] < MIN_PLAYER_RATING ||
      player.attributes[name] > MAX_PLAYER_RATING,
    )
  ) {
    addIssue(issues, 'INVALID_PLAYER', `Player "${player.id}" has invalid ratings.`, context)
    return
  }
  try {
    if (calculateOverall(player) > player.potential) {
      addIssue(issues, 'INVALID_PLAYER', `Player "${player.id}" has Potential below derived OVR.`, context)
    }
  } catch {
    addIssue(issues, 'INVALID_PLAYER', `Player "${player.id}" cannot produce a valid derived OVR.`, context)
  }
}

function validateProgramKeys(
  universe: UniverseDefinition,
  offseason: OffseasonState,
  recruitingClass: CompletedRecruitingClass,
  issues: NextSeasonRosterValidationIssue[],
): string[] {
  const expected = universe.programs.map(({ id }) => id).sort()
  const expectedSet = new Set(expected)
  const inspect = (
    label: string,
    programs: Record<string, { readonly programId: string }>,
  ) => {
    const keys = Object.keys(programs).sort()
    if (
      keys.length !== expected.length ||
      keys.some((key, index) => key !== expected[index])
    ) {
      addIssue(issues, 'INVALID_UNIVERSE_PROGRAMS', `${label} Program membership does not match the Universe.`)
    }
    const embedded = new Set<string>()
    for (const [key, program] of Object.entries(programs)) {
      if (!expectedSet.has(key) || program.programId !== key || embedded.has(program.programId)) {
        addIssue(issues, 'INVALID_PROGRAM', `${label} has an unknown, duplicate, or mismatched Program record at "${key}".`, { programId: key })
      }
      embedded.add(program.programId)
    }
  }
  inspect('Offseason', offseason.programs)
  inspect('Recruiting', recruitingClass.recruitingState.programs)
  return expected
}

function validateSourceCompatibility(
  options: AssembleNextSeasonRostersOptions,
  issues: NextSeasonRosterValidationIssue[],
): string[] {
  const { universe, offseason, completedRecruitingClass, completedSeasonArchive } = options
  const recruiting = completedRecruitingClass.recruitingState
  if (
    offseason.completedSeasonNumber + 1 !== offseason.targetSeasonNumber ||
    completedSeasonArchive.seasonNumber !== offseason.completedSeasonNumber ||
    completedRecruitingClass.targetSeasonNumber !== offseason.targetSeasonNumber ||
    recruiting.targetSeasonNumber !== offseason.targetSeasonNumber
  ) {
    addIssue(issues, 'INCOMPATIBLE_SEASON', 'Offseason, Recruiting class, and completed Season target different lifecycle years.')
  }
  if (
    completedSeasonArchive.season.universeId !== universe.id ||
    completedSeasonArchive.season.universeVersion !== universe.version
  ) {
    addIssue(issues, 'INVALID_UNIVERSE_PROGRAMS', 'Completed Season archive does not match the Universe.')
  }
  if (recruiting.phase !== 'finalized') {
    addIssue(issues, 'INVALID_RECRUITING_CLASS', 'Roster assembly requires a finalized Recruiting class.')
  }
  return validateProgramKeys(universe, offseason, completedRecruitingClass, issues)
}

function buildRosterAssembly(
  options: AssembleNextSeasonRostersOptions,
  programIds: readonly string[],
  issues: NextSeasonRosterValidationIssue[],
): NextSeasonRosterAssembly {
  const { offseason, completedRecruitingClass } = options
  const recruiting = completedRecruitingClass.recruitingState
  const recruitsById = new Map<string, typeof recruiting.recruits[number]>()
  for (const recruit of recruiting.recruits) {
    if (recruitsById.has(recruit.player.id)) {
      addIssue(issues, 'DUPLICATE_PLAYER_ID', `Recruiting class contains duplicate Player ID "${recruit.player.id}".`, { playerId: recruit.player.id })
    }
    recruitsById.set(recruit.player.id, recruit)
  }

  const incomingByProgram = new Map<string, Player[]>()
  for (const programId of programIds) incomingByProgram.set(programId, [])
  for (const [commitmentKey, commitment] of Object.entries(recruiting.commitmentsByPlayerId)) {
    const recruit = recruitsById.get(commitment.playerId)
    if (commitmentKey !== commitment.playerId || !recruit) {
      addIssue(issues, 'INVALID_COMMITMENT_ENROLLMENT', `Commitment "${commitmentKey}" does not identify exactly one Recruit.`, { playerId: commitment.playerId })
      continue
    }
    const destination = incomingByProgram.get(commitment.programId)
    if (!destination || !recruiting.programs[commitment.programId]) {
      addIssue(issues, 'INVALID_COMMITMENT_ENROLLMENT', `Recruit "${commitment.playerId}" has an unknown commitment destination.`, { programId: commitment.programId, playerId: commitment.playerId })
      continue
    }
    destination.push(structuredClone({ ...recruit.player, classYear: 'FR' as const }))
  }

  const programs: Record<string, NextSeasonProgramRoster> = {}
  for (const programId of programIds) {
    const returningPlayers = options.offseason.programs[programId]?.returningPlayers ?? []
    const incomingPlayers = incomingByProgram.get(programId) ?? []
    programs[programId] = {
      programId,
      players: [
        ...returningPlayers.map((player) => structuredClone(player)),
        ...incomingPlayers,
      ].sort(comparePlayers),
    }
  }
  return { targetSeasonNumber: offseason.targetSeasonNumber, programs }
}

function validateAssemblyFacts(
  options: AssembleNextSeasonRostersOptions,
  assembly: NextSeasonRosterAssembly,
  programIds: readonly string[],
  issues: NextSeasonRosterValidationIssue[],
): void {
  const { offseason, completedRecruitingClass, completedSeasonArchive } = options
  const recruiting = completedRecruitingClass.recruitingState
  const activeIds = new Map<string, string>()
  const appearances = new Map<string, string[]>()
  const archivedById = new Map<string, { player: Player; programId: string }>()

  for (const programId of programIds) {
    for (const player of latestArchivedRoster(completedSeasonArchive, programId) ?? []) {
      const existing = archivedById.get(player.id)
      if (existing && (!samePersonIdentity(existing.player, player) || existing.programId !== programId)) {
        addIssue(issues, 'INVALID_IDENTITY_CONTINUITY', `Archived Player ID "${player.id}" identifies multiple people.`, { programId, playerId: player.id })
      } else {
        archivedById.set(player.id, { player, programId })
      }
    }
  }

  const recruitIds = new Set(recruiting.recruits.map(({ player }) => player.id))
  for (const recruitId of recruitIds) {
    if (archivedById.has(recruitId)) {
      addIssue(issues, 'INVALID_IDENTITY_CONTINUITY', `Recruit Player ID "${recruitId}" collides with an unrelated archived Player.`, { playerId: recruitId })
    }
  }

  for (const programId of programIds) {
    const roster = assembly.programs[programId]
    const offseasonProgram = offseason.programs[programId]
    const archivedRoster = latestArchivedRoster(completedSeasonArchive, programId) ?? []
    if (!roster || roster.programId !== programId || !offseasonProgram) continue
    if (roster.players.length !== TEAM_ROSTER_SIZE) {
      addIssue(issues, 'INVALID_ROSTER_SIZE', `Program "${programId}" assembled ${roster.players.length} Players instead of ${TEAM_ROSTER_SIZE}.`, { programId })
    }
    const rosterIds = new Set<string>()
    for (const player of roster.players) {
      validatePlayer(player, issues, programId)
      if (rosterIds.has(player.id) || activeIds.has(player.id)) {
        addIssue(issues, 'DUPLICATE_PLAYER_ID', `Active Player ID "${player.id}" appears more than once.`, { programId, playerId: player.id })
      }
      rosterIds.add(player.id)
      activeIds.set(player.id, programId)
      appearances.set(player.id, [...(appearances.get(player.id) ?? []), programId])
    }

    const returnerIds = new Set<string>()
    for (const returner of offseasonProgram.returningPlayers) {
      if (returnerIds.has(returner.id)) {
        addIssue(issues, 'DUPLICATE_PLAYER_ID', `Program "${programId}" has duplicate returner ID "${returner.id}".`, { programId, playerId: returner.id })
      }
      returnerIds.add(returner.id)
      const archived = archivedById.get(returner.id)
      if (!archived || archived.programId !== programId || !samePersonIdentity(archived.player, returner)) {
        addIssue(issues, 'INVALID_IDENTITY_CONTINUITY', `Returner "${returner.id}" does not continue the same archived Program/person identity.`, { programId, playerId: returner.id })
      }
      if ((appearances.get(returner.id) ?? []).length !== 1 || activeIds.get(returner.id) !== programId) {
        addIssue(issues, 'INVALID_IDENTITY_CONTINUITY', `Returner "${returner.id}" was not enrolled exactly once at the same Program.`, { programId, playerId: returner.id })
      }
    }

    for (const graduate of archivedRoster.filter(({ classYear }) => classYear === 'SR')) {
      if (activeIds.has(graduate.id)) {
        addIssue(issues, 'GRADUATE_ENROLLED', `Graduated Player "${graduate.id}" appears on a next-season roster.`, { programId, playerId: graduate.id })
      }
    }

    const expectedPositions = positionCounts(archivedRoster)
    const actualPositions = positionCounts(roster.players)
    if (
      !recruiting.experimentalRotationCompatibleOpenings &&
      POSITIONS.some((position) => actualPositions[position] !== expectedPositions[position])
    ) {
      addIssue(issues, 'INVALID_POSITIONAL_COMPOSITION', `Program "${programId}" does not preserve its accepted positional composition.`, { programId })
    }
  }

  for (const [playerId, commitment] of Object.entries(recruiting.commitmentsByPlayerId)) {
    const recruit = recruiting.recruits.find(({ player }) => player.id === playerId)
    const enrolled = assembly.programs[commitment.programId]?.players.find(({ id }) => id === playerId)
    if (
      !recruit ||
      !enrolled ||
      (appearances.get(playerId) ?? []).length !== 1 ||
      enrolled.classYear !== 'FR' ||
      !samePersonIdentity(recruit.player, enrolled) ||
      JSON.stringify(enrolled.attributes) !== JSON.stringify(recruit.player.attributes)
    ) {
      addIssue(issues, 'INVALID_COMMITMENT_ENROLLMENT', `Committed Recruit "${playerId}" was not enrolled exactly once with an unchanged Player snapshot at Program "${commitment.programId}".`, { programId: commitment.programId, playerId })
    }
  }
}

function createAndValidate(
  options: AssembleNextSeasonRostersOptions,
): { assembly: NextSeasonRosterAssembly; validation: NextSeasonRosterValidationResult } {
  const issues: NextSeasonRosterValidationIssue[] = []
  const programIds = validateSourceCompatibility(options, issues)
  const assembly = buildRosterAssembly(options, programIds, issues)
  validateAssemblyFacts(options, assembly, programIds, issues)
  return { assembly, validation: { valid: issues.length === 0, issues } }
}

/** Purely assembles next-season roster facts; it does not advance Dynasty state. */
export function assembleNextSeasonRosters(
  options: AssembleNextSeasonRostersOptions,
): NextSeasonRosterAssembly {
  const { assembly, validation } = createAndValidate(options)
  if (!validation.valid) {
    throw new RangeError(validation.issues[0]!.message)
  }
  return assembly
}

/** Validates source compatibility, lifecycle identity, and assembled roster invariants. */
export function validateNextSeasonRosterAssembly(
  options: AssembleNextSeasonRostersOptions,
): NextSeasonRosterValidationResult {
  return createAndValidate(options).validation
}
