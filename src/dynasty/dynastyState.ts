import { TEAM_ROSTER_SIZE, type RngSeed, type Team } from '../engine'
import {
  deriveNationalChampion,
  isTournamentComplete,
  validatePostseasonState,
  type PostseasonState,
} from '../postseason'
import {
  isRegularSeasonComplete,
  validateSeasonState,
  type SeasonState,
} from '../season'
import { validateUniverseDefinition } from '../universe'
import type { UniverseDefinition } from '../universe'
import { clonePostseason, cloneSeason } from './cloning'
import { developReturningPlayer } from './development'
import {
  projectProgramPrestigeUpdates,
  type ProgramPrestigeProjectionOptions,
} from './prestige'
import type {
  CompletedSeasonArchive,
  DynastyState,
  InitializeDynastyOptions,
  OffseasonProgramState,
  OffseasonState,
} from './domain'

function assertValidSeed(seed: RngSeed): void {
  if (typeof seed === 'number' && !Number.isFinite(seed)) {
    throw new RangeError('Dynasty seed must be a finite number or a string.')
  }
}

export function initializeDynastyState({
  dynastyId,
  dynastySeed,
  controlledProgramId,
  universe,
  activeSeason,
  activePostseason = null,
}: InitializeDynastyOptions): DynastyState {
  if (dynastyId.trim().length === 0) {
    throw new RangeError('Dynasty ID cannot be empty.')
  }
  assertValidSeed(dynastySeed)
  if (!validateUniverseDefinition(universe).valid) {
    throw new RangeError('Cannot initialize a Dynasty with an invalid Universe.')
  }
  if (!universe.programs.some(({ id }) => id === controlledProgramId)) {
    throw new RangeError(`Unknown controlled Program ID "${controlledProgramId}".`)
  }
  if (
    activeSeason.universeId !== universe.id ||
    activeSeason.universeVersion !== universe.version
  ) {
    throw new RangeError('Active Season does not match the Dynasty Universe.')
  }
  if (activePostseason && activePostseason.seasonId !== activeSeason.id) {
    throw new RangeError('Active Postseason does not belong to the active Season.')
  }

  return {
    dynastyId,
    dynastySeed,
    controlledProgramId,
    universe,
    activeSeason,
    activePostseason,
    recruiting: null,
    history: [],
    completedRecruitingHistory: [],
    offseason: null,
  }
}

function latestTeam(
  seasonTeam: Team,
  postseasonTeam: Team | undefined,
): Team {
  return postseasonTeam ?? seasonTeam
}

function createOffseasonState(
  universe: UniverseDefinition,
  dynastySeed: RngSeed,
  completedSeasonNumber: number,
  season: SeasonState,
  postseason: PostseasonState,
  programIds: readonly string[],
  prestigeOptions: ProgramPrestigeProjectionOptions,
): OffseasonState {
  const programs: Record<string, OffseasonProgramState> = {}
  const returningIds = new Set<string>()
  const prestigeUpdates = new Map(
    projectProgramPrestigeUpdates(universe, season, postseason, prestigeOptions)
      .map((update) => [update.programId, update]),
  )

  for (const programId of [...programIds].sort()) {
    const seasonProgram = season.programStates[programId]
    if (!seasonProgram) {
      throw new RangeError(`Active Season is missing Program "${programId}".`)
    }
    const sourceTeam = latestTeam(
      seasonProgram.team,
      postseason.programStates[programId]?.team,
    )
    if (sourceTeam.roster.length > TEAM_ROSTER_SIZE) {
      throw new RangeError(`Program "${programId}" exceeds the roster-size limit.`)
    }
    const returningPlayers = sourceTeam.roster
      .filter(({ classYear }) => classYear !== 'SR')
      .map((player) => {
        if (returningIds.has(player.id)) {
          throw new RangeError(`Duplicate returning Player ID "${player.id}".`)
        }
        returningIds.add(player.id)
        return developReturningPlayer({
          player,
          dynastySeed,
          completedSeasonNumber,
          programId,
        })
      })

    programs[programId] = {
      programId,
      prestige: prestigeUpdates.get(programId)!.newPrestige,
      prestigeUpdate: prestigeUpdates.get(programId)!,
      returningPlayers,
    }
  }

  return {
    completedSeasonNumber,
    targetSeasonNumber: completedSeasonNumber + 1,
    programs,
  }
}

/** Archives a fully completed year and creates temporary offseason rosters. */
export function beginOffseason(
  dynasty: DynastyState,
  prestigeOptions: ProgramPrestigeProjectionOptions = {},
): DynastyState {
  const season = dynasty.activeSeason
  const postseason = dynasty.activePostseason
  if (!season) throw new RangeError('Dynasty has no active Season to archive.')
  if (!isRegularSeasonComplete(season)) {
    throw new RangeError('Cannot begin offseason before the regular season is complete.')
  }
  if (!postseason) throw new RangeError('Dynasty has no active Postseason to archive.')
  if (!isTournamentComplete(postseason)) {
    throw new RangeError('Cannot begin offseason before the Tournament is complete.')
  }
  if (!deriveNationalChampion(postseason)) {
    throw new RangeError('Cannot begin offseason without a National Champion.')
  }
  if (postseason.seasonId !== season.id) {
    throw new RangeError('Active Postseason does not belong to the active Season.')
  }
  const seasonValidation = validateSeasonState(dynasty.universe, season)
  if (!seasonValidation.valid) {
    throw new RangeError('Cannot archive an invalid active Season.')
  }
  const postseasonValidation = validatePostseasonState(
    dynasty.universe,
    postseason,
  )
  if (!postseasonValidation.valid) {
    throw new RangeError('Cannot archive an invalid active Postseason.')
  }
  if (
    dynasty.history.some(
      ({ seasonNumber }) => seasonNumber === season.seasonNumber,
    )
  ) {
    throw new RangeError(`Season ${season.seasonNumber} is already archived.`)
  }

  const archive: CompletedSeasonArchive = {
    seasonNumber: season.seasonNumber,
    season: cloneSeason(season),
    postseason: clonePostseason(postseason),
  }
  const offseason = createOffseasonState(
    dynasty.universe,
    dynasty.dynastySeed,
    season.seasonNumber,
    season,
    postseason,
    dynasty.universe.programs.map(({ id }) => id),
    prestigeOptions,
  )

  return {
    ...dynasty,
    activeSeason: null,
    activePostseason: null,
    history: [...dynasty.history, archive],
    offseason,
  }
}
