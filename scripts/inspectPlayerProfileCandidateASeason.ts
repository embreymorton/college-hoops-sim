import { generateDefaultRotationV1 } from '../src/engine'
import { generateRegularSeasonSchedule } from '../src/schedule'
import { deriveNationalPlayerLeaders, deriveSeasonPlayerStats, deriveSeasonTeamStats, initializeSeason, simulatePendingGamesThroughRound, type NationalLeaderCategory } from '../src/season'
import { initializeUniverse, UNIVERSE_V0, type InitializedUniverse } from '../src/universe'
import { deriveLeaderSeparation, summarize } from './playerStatisticalIdentityMetrics'
import { applyPlayerProfileRedistributionCandidateA } from './playerProfileRedistributionCandidateA'

const SEASONS = Number(process.env.SEASONS ?? 60)
const CATEGORIES: readonly NationalLeaderCategory[] = ['points', 'rebounds', 'assists', 'steals', 'blocks']
const leaderMeans: Record<string, number[]> = {}
const separations: Record<string, number[]> = {}
const teamPoints: Record<string, number[]> = {}
const mpg: Record<string, number[]> = {}
for (const scope of ['baseline', 'candidate']) for (const category of CATEGORIES) { leaderMeans[`${scope}:${category}`] = []; separations[`${scope}:${category}`] = [] }
teamPoints.baseline = []; teamPoints.candidate = []; mpg.baseline = []; mpg.candidate = []

function candidateUniverse(universe: InitializedUniverse): InitializedUniverse {
  return { ...universe, programs: universe.programs.map((state) => {
    const team = { ...state.team, roster: state.team.roster.map((player) => applyPlayerProfileRedistributionCandidateA(player).player) }
    return { ...state, team, rotation: generateDefaultRotationV1(team) }
  }) }
}

for (let index = 0; index < SEASONS; index += 1) {
  const prefix = `player-statistical-identity-v1:season:${String(index + 1).padStart(3, '0')}`
  const baseUniverse = initializeUniverse(UNIVERSE_V0, `${prefix}:universe`)
  const schedule = generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: `${prefix}:schedule` })
  for (const [scope, initializedUniverse] of [['baseline', baseUniverse], ['candidate', candidateUniverse(baseUniverse)]] as const) {
    const season = simulatePendingGamesThroughRound({ season: initializeSeason({ universe: UNIVERSE_V0, initializedUniverse, schedule, seasonNumber: 1 }), throughRound: schedule.roundCount, simulationSeed: `${prefix}:simulation` })
    const leaders = deriveNationalPlayerLeaders(season)
    for (const category of CATEGORIES) {
      const values = leaders[category].map((row) => row.value)
      leaderMeans[`${scope}:${category}`]!.push(values[0]!)
      separations[`${scope}:${category}`]!.push(deriveLeaderSeparation(values).leaderMinusTopTenAverage)
    }
    teamPoints[scope]!.push(...deriveSeasonTeamStats(season).map((row) => row.pointsPerGame))
    mpg[scope]!.push(...deriveSeasonPlayerStats(season).filter((row) => row.gamesPlayed >= 12).map((row) => row.minutesPerGame))
  }
}
const paired = (record: Record<string, number[]>, category?: NationalLeaderCategory) => {
  const baseline = record[category ? `baseline:${category}` : 'baseline']!
  const candidate = record[category ? `candidate:${category}` : 'candidate']!
  const baseMean = summarize(baseline).mean
  const candMean = summarize(candidate).mean
  return { baseline: summarize(baseline), candidate: summarize(candidate), percentMovement: baseMean === 0 ? 0 : (candMean - baseMean) / baseMean }
}
console.log(JSON.stringify({ seasons: SEASONS, leaders: Object.fromEntries(CATEGORIES.map((category) => [category, paired(leaderMeans, category)])), separation: Object.fromEntries(CATEGORIES.map((category) => [category, paired(separations, category)])), teamPoints: paired(teamPoints), mpg: paired(mpg) }, null, 2))
