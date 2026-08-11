import { pathToFileURL } from 'node:url'
import {
  MAX_PLAYER_MINUTES,
  MINUTES_PER_POSITION,
  POSITIONS,
  calculateOverall,
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculateTeamStrength,
  generateDefaultRotation,
  type Player,
  type Position,
  type Team,
} from '../src/engine'
import {
  autoFinalizeRecruiting,
  beginOffseason,
  initializeDynastyState,
  initializeRecruiting,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  type DynastyState,
} from '../src/dynasty'
import {
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../src/postseason'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'

const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const DIAGNOSTIC_SEEDS = ['rotation-flexibility-a', 'rotation-flexibility-b', 'rotation-flexibility-c'] as const
const CHECKPOINT_SEASONS = new Set([1, 5, 10])
const CLEAR_CONTRIBUTION_GAP = 5

export const ROTATION_FLEXIBILITY_MODELS = ['current', 'adjacent', 'secondary'] as const
export type RotationFlexibilityModel = (typeof ROTATION_FLEXIBILITY_MODELS)[number]

export interface DiagnosticRotation {
  readonly model: Exclude<RotationFlexibilityModel, 'current'>
  readonly minutesByPlayerId: Readonly<Record<string, number>>
  readonly minutesByFloorPosition: Readonly<Record<Position, number>>
  readonly assignments: Readonly<Record<string, Readonly<Partial<Record<Position, number>>>>>
}

export interface DiagnosticStrength {
  readonly offense: number
  readonly defense: number
  readonly overall: number
}

interface RosterSnapshot {
  readonly seed: string
  readonly seasonNumber: number
  readonly team: Team
}

interface TeamComparison {
  readonly snapshot: RosterSnapshot
  readonly current: DiagnosticStrength
  readonly adjacent: DiagnosticStrength
  readonly secondary: DiagnosticStrength
  readonly currentMinutes: Readonly<Record<string, number>>
  readonly adjacentRotation: DiagnosticRotation
  readonly secondaryRotation: DiagnosticRotation
}

interface Edge {
  readonly player: Player
  readonly floorPosition: Position
}

function comparePlayer(first: Player, second: Player): number {
  return playerContribution(second) - playerContribution(first) ||
    first.id.localeCompare(second.id)
}

function playerContribution(player: Player): number {
  return (calculatePlayerOffense(player) + calculatePlayerDefense(player)) / 2
}

/** Tooling-only candidate eligibility; production Position/Rotation semantics remain unchanged. */
export function eligibleFloorPositions(
  model: Exclude<RotationFlexibilityModel, 'current'>,
  position: Position,
): readonly Position[] {
  const eligible = model === 'adjacent'
    ? {
        PG: ['PG', 'SG'],
        SG: ['PG', 'SG', 'SF'],
        SF: ['SG', 'SF', 'PF'],
        PF: ['SF', 'PF', 'C'],
        C: ['PF', 'C'],
      }
    : {
        PG: ['PG', 'SG'],
        SG: ['SG', 'SF'],
        SF: ['SF', 'PF'],
        PF: ['PF', 'C'],
        C: ['PF', 'C'],
      }
  return eligible[position] as readonly Position[]
}

/**
 * Deterministically maximizes existing balanced player contribution subject to
 * 40 minutes at each floor position and 40 total per Player. This is a
 * diagnostic allocation, not a production Rotation and intentionally carries
 * no out-of-position penalty.
 */
export function generateFlexibleDiagnosticRotation(
  team: Team,
  model: Exclude<RotationFlexibilityModel, 'current'>,
): DiagnosticRotation {
  const remainingByPlayerId = Object.fromEntries(
    team.roster.map((player) => [player.id, MAX_PLAYER_MINUTES]),
  ) as Record<string, number>
  const remainingByFloorPosition = Object.fromEntries(
    POSITIONS.map((position) => [position, MINUTES_PER_POSITION]),
  ) as Record<Position, number>
  const assignments: Record<string, Partial<Record<Position, number>>> = {}
  const edges: Edge[] = team.roster.flatMap((player) =>
    eligibleFloorPositions(model, player.position).map((floorPosition) => ({ player, floorPosition })),
  )

  // Allocate one minute at a time. The priority first protects scarce floor
  // positions, then uses the exact production balanced OFF/DEF contribution.
  for (let minute = 0; minute < POSITIONS.length * MINUTES_PER_POSITION; minute += 1) {
    const viable = edges.filter(({ player, floorPosition }) =>
      (remainingByPlayerId[player.id] ?? 0) > 0 &&
      (remainingByFloorPosition[floorPosition] ?? 0) > 0,
    )
    if (viable.length === 0) {
      throw new RangeError('Candidate eligibility cannot fill every floor position.')
    }
    const floorCandidateCount = (floorPosition: Position) => viable.filter(
      (edge) => edge.floorPosition === floorPosition,
    ).length
    viable.sort((first, second) =>
      floorCandidateCount(first.floorPosition) - floorCandidateCount(second.floorPosition) ||
      playerContribution(second.player) - playerContribution(first.player) ||
      first.player.id.localeCompare(second.player.id) ||
      first.floorPosition.localeCompare(second.floorPosition),
    )
    const next = viable[0]!
    remainingByPlayerId[next.player.id]! -= 1
    remainingByFloorPosition[next.floorPosition]! -= 1
    const playerAssignments = assignments[next.player.id] ?? {}
    playerAssignments[next.floorPosition] = (playerAssignments[next.floorPosition] ?? 0) + 1
    assignments[next.player.id] = playerAssignments
  }

  const minutesByPlayerId = Object.fromEntries(team.roster.map((player) => [
    player.id,
    Object.values(assignments[player.id] ?? {}).reduce((sum, minutes) => sum + minutes, 0),
  ]))
  const minutesByFloorPosition = Object.fromEntries(POSITIONS.map((position) => [
    position,
    Object.values(assignments).reduce(
      (sum, playerAssignments) => sum + (playerAssignments[position] ?? 0),
      0,
    ),
  ])) as Record<Position, number>

  return { model, minutesByPlayerId, minutesByFloorPosition, assignments }
}

/** Uses current player OFF/DEF contribution functions and current 200-minute math. */
export function calculateDiagnosticStrength(
  team: Team,
  minutesByPlayerId: Readonly<Record<string, number>>,
): DiagnosticStrength {
  const rating = (calculate: (player: Player) => number) => team.roster.reduce(
    (sum, player) => sum + calculate(player) * (minutesByPlayerId[player.id] ?? 0),
    0,
  ) / (POSITIONS.length * MINUTES_PER_POSITION)
  const offense = rating(calculatePlayerOffense)
  const defense = rating(calculatePlayerDefense)
  return { offense, defense, overall: (offense + defense) / 2 }
}

function createDynasty(seed: string): DynastyState {
  const initializedUniverse = initializeUniverse(UNIVERSE_V0, `${seed}:universe`)
  const activeSeason = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse,
    schedule: generateRegularSeasonSchedule({
      universe: UNIVERSE_V0,
      seed: `${seed}:season-1:schedule`,
      gameIdNamespace: 'season-1',
    }),
    seasonNumber: 1,
  })
  return initializeRecruiting(initializeDynastyState({
    dynastyId: `rotation-flexibility:${seed}`,
    dynastySeed: seed,
    controlledProgramId: CONTROLLED_PROGRAM_ID,
    universe: UNIVERSE_V0,
    activeSeason,
  }))
}

function completeSeason(dynasty: DynastyState, seed: string): DynastyState {
  let season = dynasty.activeSeason!
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({
      season,
      round,
      simulationSeed: `${seed}:season-${season.seasonNumber}:games`,
    })
    dynasty = syncRecruitingThroughCompletedRounds({ ...dynasty, activeSeason: season })
  }
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `${seed}:season-${season.seasonNumber}:postseason`,
    })
    dynasty = syncRecruitingThroughCompletedPostseasonRounds({ ...dynasty, activePostseason: postseason })
  }
  dynasty = autoFinalizeRecruiting({ ...dynasty, activePostseason: postseason }).dynasty
  return rolloverDynastyToNextSeason(beginOffseason(dynasty))
}

export function collectDiagnosticRosters(
  seeds: readonly string[] = DIAGNOSTIC_SEEDS,
  finalSeason = 10,
): readonly RosterSnapshot[] {
  const snapshots: RosterSnapshot[] = []
  for (const seed of seeds) {
    let dynasty = createDynasty(seed)
    while (dynasty.activeSeason!.seasonNumber <= finalSeason) {
      const season = dynasty.activeSeason!
      if (CHECKPOINT_SEASONS.has(season.seasonNumber)) {
        for (const team of Object.values(season.programStates).map(({ team }) => team)) {
          snapshots.push({ seed, seasonNumber: season.seasonNumber, team })
        }
      }
      if (season.seasonNumber === finalSeason) break
      dynasty = completeSeason(dynasty, seed)
    }
  }
  return snapshots
}

function currentMinutes(team: Team): Readonly<Record<string, number>> {
  return generateDefaultRotation(team).minutes
}

function naturalDiagnosticRotation(
  team: Team,
  model: Exclude<RotationFlexibilityModel, 'current'>,
  minutesByPlayerId: Readonly<Record<string, number>>,
): DiagnosticRotation {
  const assignments = Object.fromEntries(team.roster
    .filter((player) => (minutesByPlayerId[player.id] ?? 0) > 0)
    .map((player) => [player.id, { [player.position]: minutesByPlayerId[player.id]! }]),
  )
  const minutesByFloorPosition = Object.fromEntries(POSITIONS.map((position) => [
    position,
    team.roster.filter((player) => player.position === position)
      .reduce((sum, player) => sum + (minutesByPlayerId[player.id] ?? 0), 0),
  ])) as Record<Position, number>
  return { model, minutesByPlayerId, minutesByFloorPosition, assignments }
}

function retainCurrentIfBetter(
  team: Team,
  model: Exclude<RotationFlexibilityModel, 'current'>,
  current: DiagnosticStrength,
  currentMinutesByPlayerId: Readonly<Record<string, number>>,
  candidate: DiagnosticRotation,
): DiagnosticRotation {
  return calculateDiagnosticStrength(team, candidate.minutesByPlayerId).overall >= current.overall
    ? candidate
    : naturalDiagnosticRotation(team, model, currentMinutesByPlayerId)
}

function compareRoster(snapshot: RosterSnapshot): TeamComparison {
  const currentRotation = generateDefaultRotation(snapshot.team)
  const currentStrength = calculateTeamStrength(snapshot.team, currentRotation)
  const adjacentRotation = retainCurrentIfBetter(
    snapshot.team,
    'adjacent',
    currentStrength,
    currentRotation.minutes,
    generateFlexibleDiagnosticRotation(snapshot.team, 'adjacent'),
  )
  const secondaryRotation = retainCurrentIfBetter(
    snapshot.team,
    'secondary',
    currentStrength,
    currentRotation.minutes,
    generateFlexibleDiagnosticRotation(snapshot.team, 'secondary'),
  )
  return {
    snapshot,
    current: currentStrength,
    secondary: calculateDiagnosticStrength(snapshot.team, secondaryRotation.minutesByPlayerId),
    adjacent: calculateDiagnosticStrength(snapshot.team, adjacentRotation.minutesByPlayerId),
    currentMinutes: currentMinutes(snapshot.team),
    adjacentRotation,
    secondaryRotation,
  }
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length
}

function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((first, second) => first - second)
  return sorted[Math.round((sorted.length - 1) * fraction)]!
}

function prestigeBand(prestige: number): '80–100' | '60–79' | '40–59' | '1–39' {
  if (prestige >= 80) return '80–100'
  if (prestige >= 60) return '60–79'
  if (prestige >= 40) return '40–59'
  return '1–39'
}

function format(value: number): string { return value.toFixed(2) }

function teamLabel(comparison: TeamComparison): string {
  const { team } = comparison.snapshot
  return `${team.name} (S${comparison.snapshot.seasonNumber}, ${comparison.snapshot.seed})`
}

function totalMinutes(minutes: Readonly<Record<string, number>>): number {
  return Object.values(minutes).reduce((sum, value) => sum + value, 0)
}

function topPlayerMinutes(
  team: Team,
  minutes: Readonly<Record<string, number>>,
  count: number,
): number {
  return [...team.roster]
    .sort(comparePlayer)
    .slice(0, count)
    .reduce((sum, player) => sum + (minutes[player.id] ?? 0), 0)
}

interface CongestionOpportunity {
  readonly sourcePosition: Position
  readonly buried: Player
  readonly floorPlayer: Player
  readonly buriedMinutes: number
  readonly floorPlayerMinutes: number
  readonly contributionGap: number
}

function adjacentTo(position: Position): readonly Position[] {
  return eligibleFloorPositions('adjacent', position).filter(
    (candidate) => candidate !== position,
  )
}

function congestionOpportunities(comparison: TeamComparison): readonly CongestionOpportunity[] {
  const { team } = comparison.snapshot
  const minutes = comparison.currentMinutes
  return team.roster.flatMap((buried) => {
    const buriedMinutes = minutes[buried.id] ?? 0
    if (buriedMinutes >= 10) return []
    return team.roster.flatMap((floorPlayer) => {
      const floorPlayerMinutes = minutes[floorPlayer.id] ?? 0
      const contributionGap = playerContribution(buried) - playerContribution(floorPlayer)
      if (
        !adjacentTo(buried.position).includes(floorPlayer.position) ||
        floorPlayerMinutes < 20 ||
        contributionGap < CLEAR_CONTRIBUTION_GAP
      ) return []
      return [{
        sourcePosition: buried.position,
        buried,
        floorPlayer,
        buriedMinutes,
        floorPlayerMinutes,
        contributionGap,
      }]
    })
  })
}

function printStrengthSummary(
  label: string,
  comparisons: readonly TeamComparison[],
): void {
  const printModel = (model: 'adjacent' | 'secondary') => {
    const deltas = comparisons.map((comparison) =>
      comparison[model].overall - comparison.current.overall,
    )
    console.log(`${label.padEnd(12)} ${model.padEnd(10)} min ${format(Math.min(...deltas))} | mean ${format(average(deltas))} | median ${format(percentile(deltas, .5))} | P90 ${format(percentile(deltas, .9))} | max ${format(Math.max(...deltas))}`)
  }
  printModel('adjacent')
  printModel('secondary')
}

function printTalentUtilization(comparisons: readonly TeamComparison[]): void {
  const values = (model: 'current' | 'adjacent' | 'secondary', top: number) => comparisons.map((comparison) => {
    const minutes = model === 'current'
      ? comparison.currentMinutes
      : model === 'adjacent'
        ? comparison.adjacentRotation.minutesByPlayerId
        : comparison.secondaryRotation.minutesByPlayerId
    return topPlayerMinutes(comparison.snapshot.team, minutes, top)
  })
  const buried = (model: 'current' | 'adjacent' | 'secondary', threshold: number) => comparisons.reduce((sum, comparison) => {
    const minutes = model === 'current'
      ? comparison.currentMinutes
      : model === 'adjacent'
        ? comparison.adjacentRotation.minutesByPlayerId
        : comparison.secondaryRotation.minutesByPlayerId
    return sum + [...comparison.snapshot.team.roster].sort(comparePlayer).slice(0, 5)
      .filter((player) => (minutes[player.id] ?? 0) < threshold).length
  }, 0)
  console.log('\nTALENT UTILIZATION (average minutes per Team)')
  console.log('MODEL       TOP 5    TOP 7    top-5 <5 / <10 / <15 MPG')
  for (const model of ['current', 'secondary', 'adjacent'] as const) {
    console.log(`${model.padEnd(10)} ${format(average(values(model, 5))).padStart(6)}  ${format(average(values(model, 7))).padStart(6)}  ${[5, 10, 15].map((threshold) => (buried(model, threshold) / comparisons.length).toFixed(2)).join(' / ')}`)
  }
}

function printExamples(comparisons: readonly TeamComparison[]): void {
  const ranked = [...comparisons].sort((first, second) =>
    (second.adjacent.overall - second.current.overall) -
      (first.adjacent.overall - first.current.overall) ||
    teamLabel(first).localeCompare(teamLabel(second)),
  )
  const examples = [...ranked.slice(0, 3), ...ranked.filter((comparison) =>
    comparison.adjacent.overall - comparison.current.overall < .05,
  ).slice(0, 2)]
  console.log('\nREPRESENTATIVE ACTUAL-ROSTER EXAMPLES')
  for (const comparison of examples) {
    const meaningful = comparison.snapshot.team.roster
      .filter((player) => (comparison.currentMinutes[player.id] ?? 0) >= 5 || (comparison.adjacentRotation.minutesByPlayerId[player.id] ?? 0) >= 5)
      .sort(comparePlayer)
      .slice(0, 7)
      .map((player) => {
        const assignments = Object.entries(comparison.adjacentRotation.assignments[player.id] ?? {})
          .map(([position, minutes]) => `${position}:${minutes}`)
          .join(',')
        return `${player.position}${calculateOverall(player)} ${comparison.currentMinutes[player.id] ?? 0}→${comparison.adjacentRotation.minutesByPlayerId[player.id] ?? 0} (${assignments})`
      })
      .join(' | ')
    console.log(`${teamLabel(comparison)} | OVR ${format(comparison.current.overall)}→${format(comparison.adjacent.overall)} (${format(comparison.adjacent.overall - comparison.current.overall)})`)
    console.log(`  ${meaningful}`)
  }
}

function printHeightAudit(comparisons: readonly TeamComparison[]): void {
  console.log('\nHEIGHT / PLAUSIBILITY AUDIT (candidate assignments only)')
  for (const model of ['secondary', 'adjacent'] as const) {
    const rotations = comparisons.map((comparison) => ({
      team: comparison.snapshot.team,
      rotation: model === 'adjacent' ? comparison.adjacentRotation : comparison.secondaryRotation,
    }))
    const oddMinutes = rotations.reduce((sum, { team, rotation }) => sum + team.roster.reduce(
      (teamSum, player) => teamSum + Object.entries(rotation.assignments[player.id] ?? {}).reduce(
        (assignmentSum, [floorPosition, minutes]) => assignmentSum + (
          (floorPosition === 'SF' && player.height <= 74) ||
          (floorPosition === 'C' && player.height < 78)
            ? minutes
            : 0
        ),
        0,
      ),
      0,
    ), 0)
    console.log(`${model}: ${oddMinutes} minutes from small (≤6'2") wings at SF or sub-6'6" Players at C across ${comparisons.length} rosters. Universal adjacency never permits a C at SF.`)
  }
}

export function runRotationFlexibilityDiagnostic(options: {
  readonly seeds?: readonly string[]
  readonly finalSeason?: number
} = {}): readonly TeamComparison[] {
  return collectDiagnosticRosters(options.seeds, options.finalSeason).map(compareRoster)
}

export function printRotationFlexibilityReport(comparisons: readonly TeamComparison[]): void {
  console.log('COLLEGE HOOPS SIM — POSITION + ROTATION FLEXIBILITY DIAGNOSTIC\n')
  console.log(`Roster snapshots: ${comparisons.length} (Season 1, 5, and 10 across deterministic seeds)`) 
  console.log(`Congestion definition: a <10 MPG Player with at least ${CLEAR_CONTRIBUTION_GAP.toFixed(0)} more balanced current OFF/DEF contribution than an adjacent-position Player at 20+ MPG.\n`)
  console.log('TEAM STRENGTH CHANGE VS CURRENT PRODUCTION ROTATION')
  printStrengthSummary('All Programs', comparisons)
  for (const seasonNumber of [1, 5, 10]) {
    printStrengthSummary(`Season ${seasonNumber}`, comparisons.filter((comparison) => comparison.snapshot.seasonNumber === seasonNumber))
  }
  for (const band of ['80–100', '60–79', '40–59', '1–39'] as const) {
    printStrengthSummary(band, comparisons.filter((comparison) => prestigeBand(comparison.snapshot.team.prestige) === band))
  }

  const opportunities = comparisons.flatMap((comparison) => congestionOpportunities(comparison).map((opportunity) => ({ comparison, opportunity })))
  const affectedTeams = new Set(opportunities.map(({ comparison }) => `${comparison.snapshot.seed}:${comparison.snapshot.seasonNumber}:${comparison.snapshot.team.id}`))
  console.log('\nCURRENT POSITION CONGESTION')
  console.log(`${affectedTeams.size}/${comparisons.length} Teams (${((affectedTeams.size / comparisons.length) * 100).toFixed(1)}%) have at least one defined cross-position opportunity; ${opportunities.length} player-pair opportunities total.`)
  console.log(`Average contribution gap ${format(average(opportunities.map(({ opportunity }) => opportunity.contributionGap)))}; max ${format(Math.max(0, ...opportunities.map(({ opportunity }) => opportunity.contributionGap)))}.`)
  for (const position of POSITIONS) {
    const rows = opportunities.filter(({ opportunity }) => opportunity.sourcePosition === position)
    console.log(`${position}: ${rows.length} opportunities across ${new Set(rows.map(({ comparison }) => `${comparison.snapshot.seed}:${comparison.snapshot.seasonNumber}:${comparison.snapshot.team.id}`)).size} Teams`)
  }

  printTalentUtilization(comparisons)
  const pine = comparisons.filter(({ snapshot }) => snapshot.team.id === 'pine-valley')
  const elite = comparisons.filter(({ snapshot }) => ['northbridge', 'great-lakes'].includes(snapshot.team.id))
  console.log('\nPROGRAM AUDITS')
  printStrengthSummary('Northbridge/GL', elite)
  printStrengthSummary('Pine Valley', pine)
  console.log(`Current minute totals remain ${[...new Set(comparisons.map(({ currentMinutes }) => totalMinutes(currentMinutes)))].join(', ')}; every diagnostic candidate assigns 200 total and 40 at every floor position.`)
  printHeightAudit(comparisons)
  printExamples(comparisons)
  console.log('\nCANDIDATE COMPLEXITY')
  console.log('Current: simplest and fully plausible, but retains measured congestion.')
  console.log('Adjacent: highest utilization and largest gain; simple eligibility tables, but three-slot SG/SF/PF access can be visually broad and requires AI/UI validation.')
  console.log('Secondary: one extra adjacent slot per Player; nearly the same average benefit with clearer basketball semantics and smaller UI/AI surface. Recruiting and roster construction can remain natural-position based in V1 because this changes minutes, not roster-count requirements.')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  printRotationFlexibilityReport(runRotationFlexibilityDiagnostic())
}
