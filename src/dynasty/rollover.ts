import {
  generateDefaultRotation,
  validateRotation,
  type RngSeed,
  type Team,
} from '../engine'
import { generateRegularSeasonSchedule } from '../schedule'
import { initializeSeason } from '../season'
import type { InitializedUniverse } from '../universe'
import type { DynastyState } from './domain'
import { initializeRecruiting } from './recruiting/state'
import { assembleNextSeasonRosters } from './rosterAssembly'

const SCHEDULE_SEED_NAMESPACE = 'college-hoops-sim:dynasty-schedule:v0'

function scheduleSeed(dynastySeed: RngSeed, seasonNumber: number): string {
  return JSON.stringify({
    namespace: SCHEDULE_SEED_NAMESPACE,
    dynastySeed: { type: typeof dynastySeed, value: dynastySeed },
    seasonNumber,
  })
}

function normalizedScheduleGames(
  games: readonly {
    readonly round: number
    readonly homeProgramId: string
    readonly awayProgramId: string
    readonly type: string
  }[],
): string {
  return JSON.stringify(
    games.map(({ round, homeProgramId, awayProgramId, type }) => ({
      round,
      homeProgramId,
      awayProgramId,
      type,
    })),
  )
}

function assertUniqueHistory(dynasty: DynastyState): void {
  const seasonNumbers = dynasty.history.map(({ seasonNumber }) => seasonNumber)
  if (new Set(seasonNumbers).size !== seasonNumbers.length) {
    throw new RangeError('Dynasty contains duplicate completed Season history.')
  }
  const recruitingSeasons = dynasty.completedRecruitingHistory.map(
    ({ targetSeasonNumber }) => targetSeasonNumber,
  )
  if (new Set(recruitingSeasons).size !== recruitingSeasons.length) {
    throw new RangeError('Dynasty contains duplicate completed Recruiting history.')
  }
}

function assertNewRecruitIdentitySafety(
  source: DynastyState,
  next: DynastyState,
): void {
  const existingPersonIds = new Set<string>()
  for (const archive of source.history) {
    for (const program of Object.values(archive.season.programStates)) {
      for (const player of program.team.roster) existingPersonIds.add(player.id)
    }
  }
  for (const recruitingClass of source.completedRecruitingHistory) {
    for (const recruit of recruitingClass.recruitingState.recruits) {
      existingPersonIds.add(recruit.player.id)
    }
  }
  for (const program of Object.values(next.activeSeason!.programStates)) {
    for (const player of program.team.roster) existingPersonIds.add(player.id)
  }

  const newIds = new Set<string>()
  for (const recruit of next.recruiting!.recruits) {
    if (newIds.has(recruit.player.id)) {
      throw new RangeError(
        `New Recruiting class contains duplicate Player ID "${recruit.player.id}".`,
      )
    }
    if (existingPersonIds.has(recruit.player.id)) {
      throw new RangeError(
        `New Recruit Player ID "${recruit.player.id}" collides with an existing person.`,
      )
    }
    newIds.add(recruit.player.id)
  }
}

/**
 * Atomically closes the offseason construction boundary and starts one fresh
 * Season plus its following-year Recruiting cycle.
 */
export function rolloverDynastyToNextSeason(
  dynasty: DynastyState,
): DynastyState {
  if (dynasty.activeSeason || dynasty.activePostseason) {
    throw new RangeError('Dynasty rollover requires no active Season or Postseason.')
  }
  const offseason = dynasty.offseason
  if (!offseason) throw new RangeError('Dynasty rollover requires OffseasonState.')
  assertUniqueHistory(dynasty)

  const matchingArchives = dynasty.history.filter(
    ({ seasonNumber }) => seasonNumber === offseason.completedSeasonNumber,
  )
  if (matchingArchives.length !== 1) {
    throw new RangeError('Dynasty rollover requires exactly one matching completed Season archive.')
  }
  const matchingRecruitingClasses = dynasty.completedRecruitingHistory.filter(
    ({ targetSeasonNumber }) => targetSeasonNumber === offseason.targetSeasonNumber,
  )
  if (matchingRecruitingClasses.length !== 1) {
    throw new RangeError('Dynasty rollover requires exactly one matching finalized Recruiting class.')
  }
  const completedSeasonArchive = matchingArchives[0]!
  const completedRecruitingClass = matchingRecruitingClasses[0]!
  if (
    !dynasty.recruiting ||
    dynasty.recruiting.phase !== 'finalized' ||
    JSON.stringify(dynasty.recruiting) !==
      JSON.stringify(completedRecruitingClass.recruitingState)
  ) {
    throw new RangeError('Active Recruiting facts do not match finalized Recruiting history.')
  }

  const assembly = assembleNextSeasonRosters({
    universe: dynasty.universe,
    offseason,
    completedRecruitingClass,
    completedSeasonArchive,
  })
  const programDefinitions = [...dynasty.universe.programs].sort(
    (first, second) => first.id.localeCompare(second.id),
  )
  const initializedPrograms = programDefinitions.map((program) => {
    const offseasonProgram = offseason.programs[program.id]!
    const assembled = assembly.programs[program.id]!
    const team: Team = {
      id: program.id,
      name: program.name,
      abbreviation: program.abbreviation,
      prestige: offseasonProgram.prestige,
      roster: assembled.players.map((player) => structuredClone(player)),
    }
    const rotation = generateDefaultRotation(team)
    const rotationValidation = validateRotation(team, rotation)
    if (!rotationValidation.valid) {
      throw new RangeError(
        `Program "${program.id}" cannot produce a valid default Rotation.`,
      )
    }
    return { program, team, rotation }
  })
  const initializedUniverse: InitializedUniverse = {
    universeId: dynasty.universe.id,
    universeVersion: dynasty.universe.version,
    rosterGenerationVersion: dynasty.universe.rosterGenerationVersion,
    programs: initializedPrograms,
  }
  const schedule = generateRegularSeasonSchedule({
    universe: dynasty.universe,
    seed: scheduleSeed(dynasty.dynastySeed, offseason.targetSeasonNumber),
    gameIdNamespace: `season-${offseason.targetSeasonNumber}`,
  })
  const historicalGameIds = new Set(
    dynasty.history.flatMap(({ season }) =>
      season.schedule.games.map(({ id }) => id),
    ),
  )
  const collision = schedule.games.find(({ id }) => historicalGameIds.has(id))
  if (collision) {
    throw new RangeError(
      `Next Season ScheduledGame ID "${collision.id}" collides with history.`,
    )
  }
  if (
    normalizedScheduleGames(schedule.games) ===
    normalizedScheduleGames(completedSeasonArchive.season.schedule.games)
  ) {
    throw new RangeError('Season-specific schedule regenerated the prior Season unchanged.')
  }
  const activeSeason = initializeSeason({
    universe: dynasty.universe,
    initializedUniverse,
    schedule,
    seasonNumber: offseason.targetSeasonNumber,
  })
  const transitioned: DynastyState = {
    ...dynasty,
    activeSeason,
    activePostseason: null,
    recruiting: null,
    offseason: null,
  }
  const withRecruiting = initializeRecruiting(transitioned)
  if (
    withRecruiting.recruiting?.targetSeasonNumber !==
      activeSeason.seasonNumber + 1 ||
    withRecruiting.recruiting.lastResolvedPeriod !== 0
  ) {
    throw new RangeError('Next Recruiting cycle did not initialize at the lifecycle boundary.')
  }
  assertNewRecruitIdentitySafety(dynasty, withRecruiting)
  return withRecruiting
}
