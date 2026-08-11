import {
  calculateTeamStrength,
  type RotationInput,
  type Team,
  type TeamStrength,
} from '../domain'
import { createRng, type Rng, type RngSeed } from '../random'
import {
  generateTeamPlayerStats,
  type PlayerGameStats,
} from './boxScore'

export interface SimulateGameOptions {
  homeTeam: Team
  awayTeam: Team
  homeRotation: RotationInput
  awayRotation: RotationInput
  seed: RngSeed
  /** Defaults to the existing home-site behavior for backward compatibility. */
  site?: GameSite
}

export type GameSite = 'home' | 'neutral'

/** Serializable final outcome and full-roster traditional box scores. */
export interface GameResult {
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  winnerId: string
  overtimePeriods: number
  seed: RngSeed
  homePlayerStats: PlayerGameStats[]
  awayPlayerStats: PlayerGameStats[]
}

/** Centralized V0 balance constants; these are tuning inputs, not domain state. */
const GAME_SIMULATION_CONFIG = {
  baselineRegulationScore: 72,
  referenceStrength: 70,
  offensePointsPerRating: 0.65,
  defensePointsPerRating: 0.45,
  homeCourtMargin: 3,
  sharedEnvironmentStandardDeviation: 4,
  teamScoreStandardDeviation: 8,
  minimumRegulationScore: 35,
  maximumRegulationScore: 130,
  overtimeLengthScale: 5 / 40,
  overtimeSharedStandardDeviation: 1.5,
  overtimeTeamStandardDeviation: 3,
  maximumOvertimePeriods: 10,
} as const

interface ExpectedScores {
  readonly home: number
  readonly away: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** Box–Muller transform over the existing deterministic uniform RNG. */
function nextStandardNormal(rng: Rng): number {
  const firstUniform = Math.max(rng.next(), Number.EPSILON)
  const secondUniform = rng.next()

  return (
    Math.sqrt(-2 * Math.log(firstUniform)) *
    Math.cos(2 * Math.PI * secondUniform)
  )
}

function calculateExpectedScores(
  homeStrength: TeamStrength,
  awayStrength: TeamStrength,
  site: GameSite,
): ExpectedScores {
  const homeCourtPerTeam =
    site === 'home' ? GAME_SIMULATION_CONFIG.homeCourtMargin / 2 : 0

  return {
    home:
      GAME_SIMULATION_CONFIG.baselineRegulationScore +
      (homeStrength.offense - GAME_SIMULATION_CONFIG.referenceStrength) *
        GAME_SIMULATION_CONFIG.offensePointsPerRating -
      (awayStrength.defense - GAME_SIMULATION_CONFIG.referenceStrength) *
        GAME_SIMULATION_CONFIG.defensePointsPerRating +
      homeCourtPerTeam,
    away:
      GAME_SIMULATION_CONFIG.baselineRegulationScore +
      (awayStrength.offense - GAME_SIMULATION_CONFIG.referenceStrength) *
        GAME_SIMULATION_CONFIG.offensePointsPerRating -
      (homeStrength.defense - GAME_SIMULATION_CONFIG.referenceStrength) *
        GAME_SIMULATION_CONFIG.defensePointsPerRating -
      homeCourtPerTeam,
  }
}

function simulateRegulationScores(
  expectedScores: ExpectedScores,
  rng: Rng,
): { home: number; away: number } {
  const sharedEnvironment =
    nextStandardNormal(rng) *
    GAME_SIMULATION_CONFIG.sharedEnvironmentStandardDeviation
  const homeVariance =
    nextStandardNormal(rng) * GAME_SIMULATION_CONFIG.teamScoreStandardDeviation
  const awayVariance =
    nextStandardNormal(rng) * GAME_SIMULATION_CONFIG.teamScoreStandardDeviation

  return {
    home: clamp(
      Math.round(expectedScores.home + sharedEnvironment + homeVariance),
      GAME_SIMULATION_CONFIG.minimumRegulationScore,
      GAME_SIMULATION_CONFIG.maximumRegulationScore,
    ),
    away: clamp(
      Math.round(expectedScores.away + sharedEnvironment + awayVariance),
      GAME_SIMULATION_CONFIG.minimumRegulationScore,
      GAME_SIMULATION_CONFIG.maximumRegulationScore,
    ),
  }
}

function simulateOvertimeScores(
  expectedScores: ExpectedScores,
  rng: Rng,
): { home: number; away: number } {
  const sharedEnvironment =
    nextStandardNormal(rng) *
    GAME_SIMULATION_CONFIG.overtimeSharedStandardDeviation
  const homeVariance =
    nextStandardNormal(rng) *
    GAME_SIMULATION_CONFIG.overtimeTeamStandardDeviation
  const awayVariance =
    nextStandardNormal(rng) *
    GAME_SIMULATION_CONFIG.overtimeTeamStandardDeviation

  return {
    home: Math.max(
      0,
      Math.round(
        expectedScores.home * GAME_SIMULATION_CONFIG.overtimeLengthScale +
          sharedEnvironment +
          homeVariance,
      ),
    ),
    away: Math.max(
      0,
      Math.round(
        expectedScores.away * GAME_SIMULATION_CONFIG.overtimeLengthScale +
          sharedEnvironment +
          awayVariance,
      ),
    ),
  }
}

/** Simulates one deterministic outcome and allocates its Player box scores. */
export function simulateGame({
  homeTeam,
  awayTeam,
  homeRotation,
  awayRotation,
  seed,
  site = 'home',
}: SimulateGameOptions): GameResult {
  if (homeTeam.id === awayTeam.id) {
    throw new RangeError('Home and away teams must have different IDs')
  }

  const homeStrength = calculateTeamStrength(homeTeam, homeRotation)
  const awayStrength = calculateTeamStrength(awayTeam, awayRotation)
  const expectedScores = calculateExpectedScores(
    homeStrength,
    awayStrength,
    site,
  )
  const rng = createRng(seed)
  const regulation = simulateRegulationScores(expectedScores, rng)
  let homeScore = regulation.home
  let awayScore = regulation.away
  let overtimePeriods = 0

  while (
    homeScore === awayScore &&
    overtimePeriods < GAME_SIMULATION_CONFIG.maximumOvertimePeriods
  ) {
    const overtime = simulateOvertimeScores(expectedScores, rng)
    homeScore += overtime.home
    awayScore += overtime.away
    overtimePeriods += 1
  }

  if (homeScore === awayScore) {
    if (expectedScores.home >= expectedScores.away) {
      homeScore += 1
    } else {
      awayScore += 1
    }
  }

  const homePlayerStats = generateTeamPlayerStats({
    team: homeTeam,
    rotation: homeRotation,
    teamScore: homeScore,
    overtimePeriods,
    rng,
  })
  const awayPlayerStats = generateTeamPlayerStats({
    team: awayTeam,
    rotation: awayRotation,
    teamScore: awayScore,
    overtimePeriods,
    rng,
  })

  return {
    homeTeamId: homeTeam.id,
    awayTeamId: awayTeam.id,
    homeScore,
    awayScore,
    winnerId: homeScore > awayScore ? homeTeam.id : awayTeam.id,
    overtimePeriods,
    seed,
    homePlayerStats,
    awayPlayerStats,
  }
}
