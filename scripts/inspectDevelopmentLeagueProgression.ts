import { pathToFileURL } from 'node:url'
import { calibrationSeeds, resolveLongRunCliConfig } from './calibration/presets'
import { runLongRunCalibrationParallel } from './longRunCalibrationRunner'
import { runLongRunCalibration, type LongRunCalibrationResult } from './inspectDynastyLongRun'
import { average, percentile, prestigeBand, summarizeDistribution } from './dynastyLongRunMetrics'

function fixed(value: number): string { return value.toFixed(1) }
function percent(value: number): string { return `${(value * 100).toFixed(1)}%` }

function seasonsAt(result: LongRunCalibrationResult, seasonNumber: number) {
  return result.runs.flatMap(({ seasons }) => seasons.filter((season) => season.seasonNumber === seasonNumber))
}

function printLeagueProgression(result: LongRunCalibrationResult): void {
  console.log('COLLEGE HOOPS SIM — DEVELOPMENT + LEAGUE PROGRESSION DIAGNOSTIC\n')
  console.log(`Seeds ${result.seeds.length} | Seasons ${result.seasonsPerSeed}\n`)
  console.log('TEAM + ACTIVE PLAYER CHECKPOINTS')
  console.log('SEASON  TEAM MIN/P10/P25/MED/P75/P90/MAX  BEST/2ND/5TH  TEAMS 85+/83+/80+/<70/<65  PLAYERS 80+/85+/90+/95+')
  for (const seasonNumber of [1, 2, 5, 10].filter((value) => value <= result.seasonsPerSeed)) {
    const seasons = seasonsAt(result, seasonNumber)
    const teamValues = seasons.flatMap(({ teams }) => teams.map(({ overall }) => overall))
    const teamsByRank = [0, 1, 4].map((rank) => average(seasons.map(({ teams }) =>
      [...teams].sort((first, second) => second.overall - first.overall)[rank]?.overall ?? 0,
    )))
    const teamCounts = [85, 83, 80].map((threshold) => average(seasons.map(({ teams }) => teams.filter(({ overall }) => overall >= threshold).length)))
    const lowCounts = [70, 65].map((threshold) => average(seasons.map(({ teams }) => teams.filter(({ overall }) => overall < threshold).length)))
    const playerCounts = [80, 85, 90, 95].map((threshold) => average(seasons.map(({ highEndCounts }) => highEndCounts[threshold as 80 | 85 | 90 | 95])))
    const d = summarizeDistribution(teamValues)
    console.log(`${String(seasonNumber).padStart(6)}  ${[d.minimum, d.p10, d.p25, d.median, d.p75, d.p90, d.maximum].map(fixed).join('/')}  ${teamsByRank.map(fixed).join('/')}  ${teamCounts.map(fixed).join('/')} / ${lowCounts.map(fixed).join('/')}  ${playerCounts.map(fixed).join('/')}`)
  }

  const mature = seasonsAt(result, Math.min(10, result.seasonsPerSeed))
  console.log('\nMATURE CLASS OVR (MEDIAN / P75 / P90 / MAX)')
  for (const classYear of ['FR', 'SO', 'JR', 'SR'] as const) {
    const values = mature.flatMap(({ players }) => players.filter((player) => player.classYear === classYear).map(({ overall }) => overall))
    const d = summarizeDistribution(values)
    console.log(`${classYear}: ${fixed(d.median)} / ${fixed(d.p75)} / ${fixed(d.p90)} / ${fixed(d.maximum)}`)
  }

  console.log('\nTEAM / ACTIVE PLAYER OVR BY PRESTIGE')
  for (const seasonNumber of [5, 10].filter((value) => value <= result.seasonsPerSeed)) {
    console.log(`Season ${seasonNumber}`)
    for (const band of ['80–100', '60–79', '40–59', '1–39'] as const) {
      const seasons = seasonsAt(result, seasonNumber)
      const teams = seasons.flatMap(({ teams }) => teams.filter(({ prestige }) => prestigeBand(prestige) === band))
      const playerIds = new Set(teams.map(({ programId }) => programId))
      const players = seasons.flatMap(({ players }) => players.filter(({ programId }) => playerIds.has(programId)))
      const perProgram = [80, 85, 90].map((threshold) => average(seasons.map(({ teams, players }) => {
        const bandPrograms = teams.filter(({ prestige }) => prestigeBand(prestige) === band)
        return average(bandPrograms.map(({ programId }) => players.filter((player) => player.programId === programId && player.overall >= threshold).length))
      })))
      console.log(`${band}: Team ${fixed(average(teams.map(({ overall }) => overall)))} | Player ${fixed(average(players.map(({ overall }) => overall)))} | 80+/85+/90+ per Program ${perProgram.map(fixed).join('/')}`)
    }
  }

  console.log('\nPINE VALLEY VS NORTHBRIDGE')
  for (const programId of ['pine-valley', 'northbridge']) {
    const rows = [1, 2, 5, 10].filter((value) => value <= result.seasonsPerSeed).map((seasonNumber) => {
      const seasons = seasonsAt(result, seasonNumber)
      const teams = seasons.flatMap(({ teams }) => teams.filter((team) => team.programId === programId))
      const players = seasons.flatMap(({ players }) => players.filter((player) => player.programId === programId))
      return `S${seasonNumber} team ${fixed(average(teams.map(({ overall }) => overall)))} best ${fixed(Math.max(...players.map(({ overall }) => overall)))} 80+ ${fixed(average(seasons.map(({ players: all }) => all.filter((player) => player.programId === programId && player.overall >= 80).length)))} 85+ ${fixed(average(seasons.map(({ players: all }) => all.filter((player) => player.programId === programId && player.overall >= 85).length)))}`
    })
    console.log(`${programId}: ${rows.join(' | ')}`)
  }

  console.log('\nTOURNAMENT CONTENDER STRENGTH')
  for (const role of ['champion', 'runnerUp', 'semifinalist'] as const) {
    const values = result.runs.flatMap(({ tournamentStrengths }) => tournamentStrengths)
      .filter((record) => record.role === role).map(({ overall }) => overall)
    const d = summarizeDistribution(values)
    console.log(`${role}: mean ${fixed(d.average)} med ${fixed(d.median)} range ${fixed(d.minimum)}–${fixed(d.maximum)}`)
  }

  const seniors = result.runs.flatMap(({ graduating }) => graduating)
  const gaps = seniors.map(({ potential, overall }) => potential - overall)
  console.log('\nGRADUATING SENIOR POT REALIZATION')
  console.log(`OVR ${fixed(summarizeDistribution(seniors.map(({ overall }) => overall)).median)} median | POT ${fixed(summarizeDistribution(seniors.map(({ potential }) => potential)).median)} median | gap P10/P50/P90 ${fixed(percentile(gaps, .1))}/${fixed(percentile(gaps, .5))}/${fixed(percentile(gaps, .9))} | ≤5 ${percent(gaps.filter((gap) => gap <= 5).length / gaps.length)} | ≤10 ${percent(gaps.filter((gap) => gap <= 10).length / gaps.length)} | ≤15 ${percent(gaps.filter((gap) => gap <= 15).length / gaps.length)} | 20+ below ${percent(gaps.filter((gap) => gap >= 20).length / gaps.length)}`)

  console.log('\nREAL DYNASTY DEVELOPMENT GAINS')
  for (const transition of ['FR→SO', 'SO→JR', 'JR→SR'] as const) {
    const gains = result.runs.flatMap(({ developments }) => developments)
      .filter((record) => record.transition === transition)
      .map(({ overallGain }) => overallGain)
    const d = summarizeDistribution(gains)
    console.log(`${transition}: med ${fixed(d.median)} P90 ${fixed(d.p90)} max ${fixed(d.maximum)} | 5+ ${percent(gains.filter((gain) => gain >= 5).length / gains.length)} | 6+ ${percent(gains.filter((gain) => gain >= 6).length / gains.length)} | 8+ ${percent(gains.filter((gain) => gain >= 8).length / gains.length)} | 10+ ${percent(gains.filter((gain) => gain >= 10).length / gains.length)}`)
  }
}

export async function main(): Promise<void> {
  const config = resolveLongRunCliConfig(process.argv.slice(2))
  const seeds = calibrationSeeds(config.seeds)
  const result = config.workers === 1
    ? runLongRunCalibration({ seasonsPerSeed: config.seasons, seeds, auditLevel: config.audit })
    : await runLongRunCalibrationParallel({ seasonsPerSeed: config.seasons, seeds, auditLevel: config.audit, workers: config.workers })
  printLeagueProgression(result)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) void main()
