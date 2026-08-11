import {
  createRng,
  generateDefaultRotationV1,
  generateTeam,
  type RngSeed,
  type Team,
} from '../engine'
import type {
  InitializedProgram,
  InitializedUniverse,
  ProgramDefinition,
  UniverseDefinition,
} from './domain'
import { validateUniverseDefinition } from './validation'

interface ProgramSeedNamespace {
  readonly universeId: string
  readonly universeVersion: string
  readonly rosterGenerationVersion: string
  readonly dynastySeed: {
    readonly type: 'number' | 'string'
    readonly value: RngSeed
  }
  readonly programId: string
}

function deriveProgramSeed(
  universe: UniverseDefinition,
  dynastySeed: RngSeed,
  programId: string,
): string {
  if (typeof dynastySeed === 'number' && !Number.isFinite(dynastySeed)) {
    throw new RangeError('Dynasty seed must be a finite number or a string')
  }

  const seedType = typeof dynastySeed === 'number' ? 'number' : 'string'

  const namespace: ProgramSeedNamespace = {
    universeId: universe.id,
    universeVersion: universe.version,
    rosterGenerationVersion: universe.rosterGenerationVersion,
    dynastySeed: {
      type: seedType,
      value: dynastySeed,
    },
    programId,
  }

  return JSON.stringify(namespace)
}

function initializeProgram(
  universe: UniverseDefinition,
  program: ProgramDefinition,
  dynastySeed: RngSeed,
): InitializedProgram {
  const generatedTeam = generateTeam({
    name: program.name,
    abbreviation: program.abbreviation,
    prestige: program.basePrestige,
    rng: createRng(deriveProgramSeed(universe, dynastySeed, program.id)),
  })
  const team: Team = {
    ...generatedTeam,
    id: program.id,
    prestige: program.basePrestige,
  }
  const rotation = generateDefaultRotationV1(team)

  return { program, team, rotation }
}

/** Creates isolated deterministic Team/Rotation state for every stable program. */
export function initializeUniverse(
  universe: UniverseDefinition,
  dynastySeed: RngSeed,
): InitializedUniverse {
  const validation = validateUniverseDefinition(universe)

  if (!validation.valid) {
    throw new RangeError(
      `Cannot initialize invalid universe: ${validation.issues
        .map(({ message }) => message)
        .join(' ')}`,
    )
  }

  return {
    universeId: universe.id,
    universeVersion: universe.version,
    rosterGenerationVersion: universe.rosterGenerationVersion,
    programs: universe.programs.map((program) =>
      initializeProgram(universe, program, dynastySeed),
    ),
  }
}
