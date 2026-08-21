import { correlation, summarizeDistribution } from './dynastyLongRunMetrics'
import {
  runDynastyCalibration,
  type DynastyRunResult,
} from './inspectDynastyLongRun'
import { UNIVERSE_V0 } from '../src/universe'

const SEEDS = ['prestige-compression-a', 'prestige-compression-b', 'prestige-compression-c']
const CHECKPOINTS = [1, 5, 10, 20, 25]

function round(value: number): number {
  return Number(value.toFixed(3))
}

function distribution(values: readonly number[]) {
  const summary = summarizeDistribution(values)
  return {
    mean: round(summary.average),
    median: round(summary.median),
    sd: round(summary.standardDeviation),
    min: round(summary.minimum),
    max: round(summary.maximum),
    range: round(summary.maximum - summary.minimum),
  }
}

function longestRun(seasons: readonly { seasonNumber: number; teams: readonly { programId: string; overall: number }[] }[], predicate: (overall: number) => boolean): number {
  const current = new Map<string, number>()
  let longest = 0
  for (const season of seasons) {
    for (const team of season.teams) {
      const length = predicate(team.overall) ? (current.get(team.programId) ?? 0) + 1 : 0
      current.set(team.programId, length)
      longest = Math.max(longest, length)
    }
  }
  return longest
}

function hierarchy(run: DynastyRunResult) {
  const topFours = run.seasons.map((season) => new Set([...season.teams]
    .sort((a, b) => b.overall - a.overall || a.programId.localeCompare(b.programId))
    .slice(0, 4).map(({ programId }) => programId)))
  const retained = topFours.slice(1).map((top, index) =>
    [...top].filter((programId) => topFours[index]!.has(programId)).length / 4)
  const champions = Object.values(run.champions)
  return {
    consecutiveTop4Retention: round(retained.reduce((sum, value) => sum + value, 0) / retained.length),
    longest85PlusRun: longestRun(run.seasons, (overall) => overall >= 85),
    longest88PlusRun: longestRun(run.seasons, (overall) => overall >= 88),
    longest90PlusRun: longestRun(run.seasons, (overall) => overall >= 90),
    uniqueChampions: champions.length,
    repeatChampions: champions.filter((count) => count > 1).length,
    topChampionShare: round(Math.max(...champions) / run.seasons.length),
  }
}

function recruiting(run: DynastyRunResult) {
  const premium = run.signedRecruits.filter(({ stars }) => stars >= 4)
  const counts = new Map<string, number>()
  for (const recruit of premium) counts.set(recruit.programId, (counts.get(recruit.programId) ?? 0) + 1)
  const topFour = [...counts.values()].sort((a, b) => b - a).slice(0, 4)
  const classRows = new Map<string, { prestige: number; quality: number[] }>()
  for (const recruit of run.signedRecruits) {
    const key = `${recruit.targetSeasonNumber}:${recruit.programId}`
    const row = classRows.get(key) ?? { prestige: recruit.prestige, quality: [] }
    row.quality.push(recruit.overall * 0.56 + recruit.potential * 0.44)
    classRows.set(key, row)
  }
  return {
    premiumSigned: premium.length,
    premiumTop4ProgramShare: round(topFour.reduce((sum, value) => sum + value, 0) / premium.length),
    premiumTopDestinationShare: round(Math.max(...counts.values()) / premium.length),
    prestigeClassQualityCorrelation: round(correlation([...classRows.values()].map((row) => ({
      first: row.prestige,
      second: row.quality.reduce((sum, value) => sum + value, 0) / row.quality.length,
    })))),
  }
}

function summarize(runs: readonly DynastyRunResult[]) {
  const transitions = runs.flatMap(({ prestigeTransitions }) => prestigeTransitions)
  const endingByProgram = runs.flatMap((run) => run.seasons.at(-1)!.teams)
  const baseByProgram = new Map<string, number>(
    UNIVERSE_V0.programs.map(({ id, basePrestige }) => [id, basePrestige]),
  )
  const dynastyMoves = endingByProgram.map(({ programId, prestige }) => prestige - baseByProgram.get(programId)!)
  const movementCounts = Object.fromEntries([-3, -2, -1, 0, 1, 2, 3].map((change) => [
    String(change),
    transitions.filter((row) => row.change === change).length,
  ]))
  return {
    checkpoints: Object.fromEntries(CHECKPOINTS.map((checkpoint) => {
      const teams = runs.flatMap((run) => run.seasons.find(({ seasonNumber }) => seasonNumber === checkpoint)!.teams)
      const prestige = teams.map(({ prestige }) => prestige)
      const overall = teams.map(({ overall }) => overall)
      return [checkpoint, {
        prestige: {
          ...distribution(prestige),
          count90Plus: prestige.filter((value) => value >= 90).length,
          count85Plus: prestige.filter((value) => value >= 85).length,
          count45OrLess: prestige.filter((value) => value <= 45).length,
          count39OrLess: prestige.filter((value) => value <= 39).length,
        },
        overall: {
          ...distribution(overall),
          count85Plus: overall.filter((value) => value >= 85).length,
          count88Plus: overall.filter((value) => value >= 88).length,
          count90Plus: overall.filter((value) => value >= 90).length,
          count65OrLess: overall.filter((value) => value <= 65).length,
        },
      }]
    })),
    allSeasons: {
      team85PlusOccurrences: runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).filter(({ overall }) => overall >= 85).length,
      team88PlusOccurrences: runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).filter(({ overall }) => overall >= 88).length,
      team90PlusOccurrences: runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).filter(({ overall }) => overall >= 90).length,
      maximumOverall: round(Math.max(...runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).map(({ overall }) => overall))),
    },
    mobility: {
      plus10: dynastyMoves.filter((value) => value >= 10).length,
      plus20: dynastyMoves.filter((value) => value >= 20).length,
      minus10: dynastyMoves.filter((value) => value <= -10).length,
      minus20: dynastyMoves.filter((value) => value <= -20).length,
    },
    annualMovement: {
      counts: movementCounts,
      percentages: Object.fromEntries(Object.entries(movementCounts).map(([change, count]) => [
        change,
        round(count / transitions.length),
      ])),
      capHitFrequency: round(transitions.filter(({ change }) => Math.abs(change) === 3).length / transitions.length),
    },
    hierarchy: runs.map(hierarchy),
    recruiting: runs.map(recruiting),
  }
}

function trajectoryRows(runs: readonly DynastyRunResult[], programIds: readonly string[]) {
  const selectedSeasons = new Set([1, 5, 10, 15, 20, 25])
  return Object.fromEntries(programIds.map((programId) => [programId, runs.map((run) => ({
    seed: run.seed,
    rows: run.prestigeTransitions.filter((row) =>
      row.programId === programId && selectedSeasons.has(row.seasonNumber)),
  }))]))
}

const staticRuns = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light', {}, 'static'))
const dynamicRuns = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light', {}, 'dynamic'))
const expectationRuns = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light', {
  updateModel: 'expectation-relative',
  surpriseBands: { deadband: 5, twoPointThreshold: 11, threePointThreshold: 17 },
}))
const bases = [...UNIVERSE_V0.programs].sort((a, b) => b.basePrestige - a.basePrestige)
const expectationEndMoves = new Map<string, number>()
for (const run of expectationRuns) {
  for (const team of run.seasons.at(-1)!.teams) {
    expectationEndMoves.set(team.programId, (expectationEndMoves.get(team.programId) ?? 0) +
      team.prestige - UNIVERSE_V0.programs.find(({ id }) => id === team.programId)!.basePrestige)
  }
}
const mid = [...UNIVERSE_V0.programs].sort((a, b) =>
  Math.abs(a.basePrestige - 66) - Math.abs(b.basePrestige - 66))[0]!
const riser = [...expectationEndMoves].sort((a, b) => b[1] - a[1])[0]![0]
const decliner = [...expectationEndMoves].sort((a, b) => a[1] - b[1])
  .find(([programId]) => programId !== bases[0]!.id)![0]
const trajectoryPrograms = [bases[0]!.id, bases.at(-1)!.id, mid.id, riser, decliner]
process.stdout.write(JSON.stringify({
  seeds: SEEDS,
  candidateBands: { deadband: 5, twoPointThreshold: 11, threePointThreshold: 17 },
  trajectoryPrograms,
  static: { summary: summarize(staticRuns), trajectories: trajectoryRows(staticRuns, trajectoryPrograms) },
  current8A: { summary: summarize(dynamicRuns), trajectories: trajectoryRows(dynamicRuns, trajectoryPrograms) },
  expectationRelative: { summary: summarize(expectationRuns), trajectories: trajectoryRows(expectationRuns, trajectoryPrograms) },
}, null, 2))
