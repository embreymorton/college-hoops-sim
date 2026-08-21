import { correlation, summarizeDistribution } from './dynastyLongRunMetrics'
import {
  runDynastyCalibration,
  type DynastyRunResult,
} from './inspectDynastyLongRun'

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
    prestigeClassQualityCorrelation: round(correlation([...classRows.values()].map((row) => ({
      first: row.prestige,
      second: row.quality.reduce((sum, value) => sum + value, 0) / row.quality.length,
    })))),
  }
}

function summarize(runs: readonly DynastyRunResult[]) {
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
          count39OrLess: prestige.filter((value) => value <= 39).length,
        },
        overall: {
          ...distribution(overall),
          count85Plus: overall.filter((value) => value >= 85).length,
          count90Plus: overall.filter((value) => value >= 90).length,
          count65OrLess: overall.filter((value) => value <= 65).length,
        },
      }]
    })),
    allSeasons: {
      team85PlusOccurrences: runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).filter(({ overall }) => overall >= 85).length,
      team90PlusOccurrences: runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).filter(({ overall }) => overall >= 90).length,
      maximumOverall: round(Math.max(...runs.flatMap((run) => run.seasons).flatMap(({ teams }) => teams).map(({ overall }) => overall))),
    },
    hierarchy: runs.map(hierarchy),
    recruiting: runs.map(recruiting),
  }
}

const staticRuns = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light', {}, 'static'))
const dynamicRuns = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light', {}, 'dynamic'))
process.stdout.write(JSON.stringify({ seeds: SEEDS, static: summarize(staticRuns), dynamic: summarize(dynamicRuns) }, null, 2))
