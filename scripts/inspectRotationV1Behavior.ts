import {
  calculatePlayerDefense,
  calculatePlayerOffense,
  calculateTeamStrength,
  derivePlayerMinutesV1,
  generateDefaultRotationV1,
  generateNaturalDefaultRotationV1,
  POSITIONS,
  validateRotationV1,
  type Player,
  type RotationV1,
} from '../src/engine'
import { generateRegularSeasonSchedule } from '../src/schedule'
import {
  initializeSeason,
  simulatePendingGamesInRound,
  type SeasonState,
} from '../src/season'
import { initializeUniverse, UNIVERSE_V0 } from '../src/universe'
import {
  calibrationSeeds,
  resolveLongRunCliConfig,
} from './calibration/presets'

const DIRECT_SEEDS = [
  'rotation-v1-generation-a',
  'rotation-v1-generation-b',
  'rotation-v1-generation-c',
] as const

function contribution(player: Player): number {
  return (calculatePlayerOffense(player) + calculatePlayerDefense(player)) / 2
}

function percentile(values: readonly number[], fraction: number): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.round((sorted.length - 1) * fraction)] ?? 0
}

function average(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function rotationShape(rotation: RotationV1): Record<string, number> {
  const minutes = Object.values(derivePlayerMinutesV1(rotation))
  return {
    positive: minutes.filter((value) => value > 0).length,
    atLeast10: minutes.filter((value) => value >= 10).length,
    atLeast20: minutes.filter((value) => value >= 20).length,
    atLeast30: minutes.filter((value) => value >= 30).length,
    atLeast36: minutes.filter((value) => value >= 36).length,
    exactly40: minutes.filter((value) => value === 40).length,
    zero: 12 - minutes.filter((value) => value > 0).length,
  }
}

export function inspectDirectRotationBehavior() {
  const overallDeltas: number[] = []
  const offenseDeltas: number[] = []
  const defenseDeltas: number[] = []
  const gains: number[] = []
  const losses: number[] = []
  const secondaryByPlayer: number[] = []
  const paths: Record<string, { players: number; minutes: number }> = {}
  const baselineShape: Record<string, number> = {}
  const flexibleShape: Record<string, number> = {}
  const cases: Array<Record<string, string | number>> = []
  let teams = 0
  let teamsChanged = 0
  let reached40 = 0
  let buriedReached10 = 0
  let zeroMinutePlayersEnteringRotation = 0
  let materiallyDisplaced = 0

  for (const seed of DIRECT_SEEDS) {
    for (const { team } of initializeUniverse(UNIVERSE_V0, seed).programs) {
      const natural = generateNaturalDefaultRotationV1(team)
      const flexible = generateDefaultRotationV1(team)
      const naturalMinutes = derivePlayerMinutesV1(natural)
      const flexibleMinutes = derivePlayerMinutesV1(flexible)
      const naturalStrength = calculateTeamStrength(team, natural)
      const flexibleStrength = calculateTeamStrength(team, flexible)
      const naturalShape = rotationShape(natural)
      const changed = JSON.stringify(natural) !== JSON.stringify(flexible)

      teams += 1
      if (changed) teamsChanged += 1
      if (!validateRotationV1(team, flexible).valid) {
        throw new Error(`Invalid flexible rotation for ${seed}/${team.id}.`)
      }
      offenseDeltas.push(flexibleStrength.offense - naturalStrength.offense)
      defenseDeltas.push(flexibleStrength.defense - naturalStrength.defense)
      overallDeltas.push(flexibleStrength.overall - naturalStrength.overall)
      for (const [key, value] of Object.entries(naturalShape)) {
        baselineShape[key] = (baselineShape[key] ?? 0) + value
      }
      for (const [key, value] of Object.entries(rotationShape(flexible))) {
        flexibleShape[key] = (flexibleShape[key] ?? 0) + value
      }

      for (const player of team.roster) {
        const before = naturalMinutes[player.id] ?? 0
        const after = flexibleMinutes[player.id] ?? 0
        const delta = after - before
        if (delta > 0) gains.push(delta)
        if (delta < 0) losses.push(delta)
        if (before < 40 && after === 40) reached40 += 1
        if (before <= 9 && after >= 10) buriedReached10 += 1
        if (before === 0 && after > 0) zeroMinutePlayersEnteringRotation += 1
        if (delta <= -4) materiallyDisplaced += 1

        let secondary = 0
        for (const floorPosition of POSITIONS) {
          const minutes = flexible.minutesByPosition[floorPosition][player.id] ?? 0
          if (floorPosition === player.position || minutes <= 0) continue
          secondary += minutes
          const key = `${player.position}->${floorPosition}`
          const path = paths[key] ?? { players: 0, minutes: 0 }
          path.players += 1
          path.minutes += minutes
          paths[key] = path

          if (cases.length < 8) {
            const displaced = team.roster
              .filter((candidate) => candidate.position === floorPosition)
              .map((candidate) => ({
                candidate,
                lost:
                  (natural.minutesByPosition[floorPosition][candidate.id] ?? 0) -
                  (flexible.minutesByPosition[floorPosition][candidate.id] ?? 0),
              }))
              .sort((a, b) => b.lost - a.lost)[0]
            cases.push({
              seed,
              team: team.name,
              player: `${player.firstName} ${player.lastName}`,
              naturalPosition: player.position,
              baselineMinutes: before,
              secondaryFloor: floorPosition,
              secondaryMinutes: minutes,
              newMinutes: after,
              contribution: contribution(player),
              displacedPlayer: displaced
                ? `${displaced.candidate.firstName} ${displaced.candidate.lastName}`
                : 'unknown',
              displacedContribution: displaced
                ? contribution(displaced.candidate)
                : 0,
              overallDelta: flexibleStrength.overall - naturalStrength.overall,
            })
          }
        }
        if (secondary > 0) secondaryByPlayer.push(secondary)
      }
    }
  }

  const averageShape = (shape: Record<string, number>) =>
    Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, value / teams]))

  return {
    activation: {
      teams,
      teamsChanged,
      percentageChanged: (teamsChanged / teams) * 100,
      playersReceivingSecondaryMinutes: secondaryByPlayer.length,
      totalSecondaryMinutes: secondaryByPlayer.reduce((sum, value) => sum + value, 0),
      averageSecondaryMinutesPerAffectedTeam:
        secondaryByPlayer.reduce((sum, value) => sum + value, 0) / teamsChanged,
      averageSecondaryMinutesPerAffectedPlayer: average(secondaryByPlayer),
    },
    playerMinuteEffects: {
      playersGaining: gains.length,
      playersLosing: losses.length,
      averageGain: average(gains),
      averageLoss: average(losses),
      maximumGain: Math.max(...gains),
      maximumLoss: Math.min(...losses),
      reached40BecauseOfFlexibility: reached40,
      buriedPlayersReaching10Minutes: buriedReached10,
      zeroMinutePlayersEnteringRotation,
      materiallyDisplacedIncumbents: materiallyDisplaced,
      secondaryMinuteDistribution: {
        oneToTwo: secondaryByPlayer.filter((value) => value <= 2).length,
        threeToFour: secondaryByPlayer.filter((value) => value >= 3 && value <= 4).length,
        fiveToSix: secondaryByPlayer.filter((value) => value >= 5 && value <= 6).length,
        sevenToEight: secondaryByPlayer.filter((value) => value >= 7 && value <= 8).length,
      },
    },
    shape: { naturalPerTeam: averageShape(baselineShape), flexiblePerTeam: averageShape(flexibleShape) },
    paths,
    strength: {
      averageOffenseDelta: average(offenseDeltas),
      averageDefenseDelta: average(defenseDeltas),
      averageOverallDelta: average(overallDeltas),
      medianOverallDelta: percentile(overallDeltas, 0.5),
      p90OverallDelta: percentile(overallDeltas, 0.9),
      maximumOverallGain: Math.max(...overallDeltas),
      minimumOverallDelta: Math.min(...overallDeltas),
      regressions: overallDeltas.filter((value) => value < -1e-10).length,
    },
    representativeCases: cases,
  }
}

interface EcosystemAccumulator {
  games: number
  teamPoints: number
  rebounds: number
  assists: number
  fieldGoalsMade: number
  fieldGoalsAttempted: number
  threesMade: number
  threesAttempted: number
  freeThrowsMade: number
  freeThrowsAttempted: number
  closeGames: number
  blowouts: number
  playerGames: number
  playerPoints: number
  maxPlayerPoints: number
  wins: number[]
  strengths: number[]
}

function emptyEcosystem(): EcosystemAccumulator {
  return { games: 0, teamPoints: 0, rebounds: 0, assists: 0, fieldGoalsMade: 0, fieldGoalsAttempted: 0, threesMade: 0, threesAttempted: 0, freeThrowsMade: 0, freeThrowsAttempted: 0, closeGames: 0, blowouts: 0, playerGames: 0, playerPoints: 0, maxPlayerPoints: 0, wins: [], strengths: [] }
}

function completeSeason(initial: SeasonState, seed: string): SeasonState {
  let season = initial
  for (let round = 1; round <= season.schedule.roundCount; round += 1) {
    season = simulatePendingGamesInRound({ season, round, simulationSeed: seed })
  }
  return season
}

function collectSeason(target: EcosystemAccumulator, season: SeasonState): void {
  const wins = new Map(Object.keys(season.programStates).map((id) => [id, 0]))
  for (const { team, rotation } of Object.values(season.programStates)) {
    target.strengths.push(calculateTeamStrength(team, rotation).overall)
  }
  for (const result of Object.values(season.resultsByGameId)) {
    if (!result) continue
    target.games += 1
    target.teamPoints += result.homeScore + result.awayScore
    target.closeGames += Math.abs(result.homeScore - result.awayScore) <= 5 ? 1 : 0
    target.blowouts += Math.abs(result.homeScore - result.awayScore) >= 20 ? 1 : 0
    wins.set(result.winnerId, (wins.get(result.winnerId) ?? 0) + 1)
    for (const stats of [...result.homePlayerStats, ...result.awayPlayerStats]) {
      target.rebounds += stats.rebounds
      target.assists += stats.assists
      target.fieldGoalsMade += stats.fieldGoalsMade
      target.fieldGoalsAttempted += stats.fieldGoalsAttempted
      target.threesMade += stats.threePointersMade
      target.threesAttempted += stats.threePointersAttempted
      target.freeThrowsMade += stats.freeThrowsMade
      target.freeThrowsAttempted += stats.freeThrowsAttempted
      if (stats.minutes > 0) {
        target.playerGames += 1
        target.playerPoints += stats.points
        target.maxPlayerPoints = Math.max(target.maxPlayerPoints, stats.points)
      }
    }
  }
  target.wins.push(...wins.values())
}

function summarizeEcosystem(value: EcosystemAccumulator) {
  const pct = (made: number, attempted: number) => made / attempted
  return {
    games: value.games,
    pointsPerTeamGame: value.teamPoints / (value.games * 2),
    reboundsPerTeamGame: value.rebounds / (value.games * 2),
    assistsPerTeamGame: value.assists / (value.games * 2),
    pointsPerActivePlayerGame: value.playerPoints / value.playerGames,
    maximumPlayerPoints: value.maxPlayerPoints,
    fieldGoalPercentage: pct(value.fieldGoalsMade, value.fieldGoalsAttempted),
    threePointPercentage: pct(value.threesMade, value.threesAttempted),
    freeThrowPercentage: pct(value.freeThrowsMade, value.freeThrowsAttempted),
    closeGamePercentage: value.closeGames / value.games,
    blowoutPercentage: value.blowouts / value.games,
    averageTeamStrength: average(value.strengths),
    winStandardDeviation: Math.sqrt(average(value.wins.map((wins) => (wins - 12) ** 2))),
  }
}

export function inspectPairedSeasonBehavior(args: readonly string[]) {
  const config = resolveLongRunCliConfig(args)
  const seeds = calibrationSeeds(config.seeds)
  const naturalMetrics = emptyEcosystem()
  const flexibleMetrics = emptyEcosystem()
  const perSeed: Array<Record<string, unknown>> = []

  for (const seed of seeds) {
    const seedNatural = emptyEcosystem()
    const seedFlexible = emptyEcosystem()
    for (let seasonNumber = 1; seasonNumber <= config.seasons; seasonNumber += 1) {
      const pairSeed = `${seed}:rotation-v1:${seasonNumber}`
      const initializedUniverse = initializeUniverse(UNIVERSE_V0, pairSeed)
      const schedule = generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${pairSeed}:schedule` })
      const initializedSeason = initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule, seasonNumber })
      const natural: SeasonState = {
        ...initializedSeason,
        programStates: Object.fromEntries(Object.entries(initializedSeason.programStates).map(([id, state]) => [id, { ...state, rotation: generateNaturalDefaultRotationV1(state.team) }])),
      }
      const flexible: SeasonState = {
        ...initializedSeason,
        programStates: Object.fromEntries(Object.entries(initializedSeason.programStates).map(([id, state]) => [id, { ...state, rotation: generateDefaultRotationV1(state.team) }])),
      }
      const completedNatural = completeSeason(natural, `${pairSeed}:games`)
      const completedFlexible = completeSeason(flexible, `${pairSeed}:games`)
      collectSeason(naturalMetrics, completedNatural)
      collectSeason(flexibleMetrics, completedFlexible)
      collectSeason(seedNatural, completedNatural)
      collectSeason(seedFlexible, completedFlexible)
    }
    const natural = summarizeEcosystem(seedNatural)
    const flexible = summarizeEcosystem(seedFlexible)
    perSeed.push({
      seed,
      overallStrengthDelta:
        flexible.averageTeamStrength - natural.averageTeamStrength,
      scoringDelta: flexible.pointsPerTeamGame - natural.pointsPerTeamGame,
      closeGameDelta:
        flexible.closeGamePercentage - natural.closeGamePercentage,
      blowoutDelta: flexible.blowoutPercentage - natural.blowoutPercentage,
      winSpreadDelta:
        flexible.winStandardDeviation - natural.winStandardDeviation,
    })
  }
  const natural = summarizeEcosystem(naturalMetrics)
  const flexible = summarizeEcosystem(flexibleMetrics)
  return {
    preset: config.preset ?? 'custom', seeds, seasonsPerSeed: config.seasons, perSeed,
    natural,
    flexible,
    delta: Object.fromEntries(Object.keys(natural).filter((key) => key !== 'games').map((key) => [key, flexible[key as keyof typeof flexible] - natural[key as keyof typeof natural]])),
  }
}

const args = process.argv.slice(2)
console.log(JSON.stringify(args.includes('--direct') ? inspectDirectRotationBehavior() : inspectPairedSeasonBehavior(args), null, 2))
