import { pathToFileURL } from 'node:url'
import { UNIVERSE_V0 } from '../src/universe'
import {
  average,
  correlation,
  prestigeBand,
  PRESTIGE_BANDS,
} from './dynastyLongRunMetrics'
import {
  runLongRunCalibration,
  type DynastyRunResult,
  type ProgramRosterTrace,
} from './inspectDynastyLongRun'

const SEEDS = [
  'dynasty-long-run-v0:seed-1',
  'dynasty-long-run-v0:seed-2',
  'dynasty-long-run-v0:seed-3',
] as const
const CONTROLLED_PROGRAM_ID = 'charlotte-tech'
const MATURE_START = 5
const MATURE_END = 10

function fixed(value: number, digits = 2): string {
  return Number.isFinite(value) ? value.toFixed(digits) : '—'
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0 ? '—' : `${fixed(100 * numerator / denominator, 1)}%`
}

function rankMap(rows: readonly { programId: string; value: number }[]): Map<string, number> {
  return new Map([...rows]
    .sort((a, b) => b.value - a.value || a.programId.localeCompare(b.programId))
    .map((row, index) => [row.programId, index + 1]))
}

function topAverage(roster: ProgramRosterTrace, count: number): number {
  return average([...roster.players].sort((a, b) => b.overall - a.overall).slice(0, count).map((p) => p.overall))
}

function printRecruiting(runs: readonly DynastyRunResult[]): void {
  const classes = runs.flatMap((run) => {
    const relevant = run.signedRecruits.filter((r) =>
      r.targetSeasonNumber >= MATURE_START && r.targetSeasonNumber <= MATURE_END &&
      r.programId !== CONTROLLED_PROGRAM_ID)
    const keys = new Set(relevant.map((r) => `${r.targetSeasonNumber}:${r.programId}`))
    return [...keys].map((key) => {
      const [target, programId] = key.split(':') as [string, string]
      const recruits = relevant.filter((r) => r.targetSeasonNumber === Number(target) && r.programId === programId)
      return {
        programId,
        prestige: recruits[0]!.prestige,
        count: recruits.length,
        rank: average(recruits.map((r) => r.nationalRank)),
        overall: average(recruits.map((r) => r.overall)),
        potential: average(recruits.map((r) => r.potential)),
        top25: recruits.filter((r) => r.nationalRank <= 25).length,
        top50: recruits.filter((r) => r.nationalRank <= 50).length,
        premium: recruits.filter((r) => r.stars >= 4).length,
      }
    })
  })
  console.log('\n1. PRESTIGE → RECRUITING (controlled Program excluded)')
  console.log('Band    Classes Size  Avg rank  OVR   POT   Top25/class Top50/class 4★+/class')
  for (const band of PRESTIGE_BANDS) {
    const rows = classes.filter((row) => prestigeBand(row.prestige) === band)
    console.log(`${band.padEnd(8)}${String(rows.length).padStart(7)} ${fixed(average(rows.map((r) => r.count))).padStart(4)} ${fixed(average(rows.map((r) => r.rank)), 1).padStart(9)} ${fixed(average(rows.map((r) => r.overall)), 1).padStart(5)} ${fixed(average(rows.map((r) => r.potential)), 1).padStart(5)} ${fixed(average(rows.map((r) => r.top25))).padStart(11)} ${fixed(average(rows.map((r) => r.top50))).padStart(11)} ${fixed(average(rows.map((r) => r.premium))).padStart(9)}`)
  }
  console.log(`Prestige correlation: class OVR ${fixed(correlation(classes.map((r) => ({ first: r.prestige, second: r.overall }))), 3)}; class POT ${fixed(correlation(classes.map((r) => ({ first: r.prestige, second: r.potential }))), 3)}; better rank ${fixed(correlation(classes.map((r) => ({ first: r.prestige, second: -r.rank }))), 3)}`)
}

function printRosters(runs: readonly DynastyRunResult[]): void {
  const rows = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= MATURE_START && r.seasonNumber <= MATURE_END))
  console.log('\n2. RECRUITING → ROSTER / DEVELOPMENT → STRENGTH')
  console.log('Band    Team-seasons Strength Top3  Top5  Top8  85+ 90+ Rot-wtd')
  for (const band of PRESTIGE_BANDS) {
    const selected = rows.filter((r) => prestigeBand(r.prestige) === band)
    console.log(`${band.padEnd(8)}${String(selected.length).padStart(12)} ${fixed(average(selected.map((r) => r.overall)), 1).padStart(8)} ${fixed(average(selected.map((r) => topAverage(r, 3))), 1).padStart(4)} ${fixed(average(selected.map((r) => topAverage(r, 5))), 1).padStart(5)} ${fixed(average(selected.map((r) => topAverage(r, 8))), 1).padStart(5)} ${fixed(average(selected.map((r) => r.players.filter((p) => p.overall >= 85).length))).padStart(4)} ${fixed(average(selected.map((r) => r.players.filter((p) => p.overall >= 90).length))).padStart(3)} ${fixed(average(selected.map((r) => r.rotationWeightedPlayerOverall)), 1).padStart(7)}`)
  }
  console.log(`Roster-to-Strength correlation: ${fixed(correlation(rows.map((r) => ({ first: r.rotationWeightedPlayerOverall, second: r.overall }))), 3)}`)
  const shocks = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= MATURE_START && r.seasonNumber < MATURE_END).flatMap((row) => {
    const next = run.rosterTraces.find((candidate) => candidate.programId === row.programId && candidate.seasonNumber === row.seasonNumber + 1)
    return next ? [{ seniorMinutes: row.players.filter((p) => p.classYear === 'SR').reduce((sum, p) => sum + p.minutes, 0), change: next.overall - row.overall }] : []
  }))
  console.log(`Senior-minutes vs next-season Strength-change correlation: ${fixed(correlation(shocks.map((r) => ({ first: r.seniorMinutes, second: r.change }))), 3)}; average change with 80+ senior MPG ${fixed(average(shocks.filter((r) => r.seniorMinutes >= 80).map((r) => r.change)))}.`)
  const recruitLinks = runs.flatMap((run) => rows.filter((row) =>
    run.rosterTraces.includes(row) && row.programId !== CONTROLLED_PROGRAM_ID,
  ).map((row) => {
    const signed = run.signedRecruits.filter((r) =>
      r.programId === row.programId && r.targetSeasonNumber >= row.seasonNumber - 1 &&
      r.targetSeasonNumber <= row.seasonNumber,
    )
    return {
      classQuality: average(signed.map((r) => r.overall)),
      premium: signed.filter((r) => r.stars >= 4).length,
      rosterTop5: topAverage(row, 5),
      strength: row.overall,
    }
  }).filter((r) => r.classQuality > 0))
  console.log(`Two-class accumulation correlation: class OVR → top-5 roster ${fixed(correlation(recruitLinks.map((r) => ({ first: r.classQuality, second: r.rosterTop5 }))), 3)}, premium count → Strength ${fixed(correlation(recruitLinks.map((r) => ({ first: r.premium, second: r.strength }))), 3)}.`)
}

function printGames(runs: readonly DynastyRunResult[]): void {
  const games = runs.flatMap((run) => run.regularSeasonGames.filter((g) => g.seasonNumber >= MATURE_START && g.seasonNumber <= MATURE_END))
  const buckets = [[0, 2], [2, 5], [5, 8], [8, 12], [12, Infinity]] as const
  console.log('\n3. TEAM STRENGTH → ACTUAL REGULAR-SEASON OUTCOMES')
  console.log('Gap       Games Stronger wins Fav home Fav away Avg margin')
  for (const [low, high] of buckets) {
    const selected = games.filter((g) => {
      const gap = Math.abs(g.homeStrength - g.awayStrength)
      return gap >= low && gap < high && gap > 0
    })
    const favoriteWon = (g: typeof selected[number]) => g.winnerId === (g.homeStrength > g.awayStrength ? g.homeProgramId : g.awayProgramId)
    const home = selected.filter((g) => g.homeStrength > g.awayStrength)
    const away = selected.filter((g) => g.awayStrength > g.homeStrength)
    console.log(`${`${low}–${high === Infinity ? '+' : high}`.padEnd(10)}${String(selected.length).padStart(5)} ${percent(selected.filter(favoriteWon).length, selected.length).padStart(13)} ${percent(home.filter(favoriteWon).length, home.length).padStart(8)} ${percent(away.filter(favoriteWon).length, away.length).padStart(8)} ${fixed(average(selected.map((g) => g.margin)), 1).padStart(10)}`)
  }
}

function printResume(runs: readonly DynastyRunResult[]): void {
  const rows = runs.flatMap((run) => run.seasons.filter((s) => s.seasonNumber >= MATURE_START && s.seasonNumber <= MATURE_END).flatMap((season) => {
    const outcomes = run.programSeasonOutcomes.filter((o) => o.seasonNumber === season.seasonNumber)
    const strengthRanks = rankMap(season.teams.map((t) => ({ programId: t.programId, value: t.overall })))
    const winRanks = rankMap(outcomes.map((o) => ({ programId: o.programId, value: o.wins / (o.wins + o.losses) })))
    return outcomes.map((o) => ({ ...o, strengthRank: strengthRanks.get(o.programId)!, winRank: winRanks.get(o.programId)! }))
  }))
  console.log('\n4. GAME OUTCOMES → RESULTS-ONLY RÉSUMÉ')
  console.log('Strength group  Observations Top-8 record Top-8 résumé Tournament Top-4 seed')
  for (const [label, limit] of [['Top 4', 4], ['Top 8', 8]] as const) {
    const selected = rows.filter((r) => r.strengthRank <= limit)
    console.log(`${label.padEnd(15)}${String(selected.length).padStart(12)} ${percent(selected.filter((r) => r.winRank <= 8).length, selected.length).padStart(12)} ${percent(selected.filter((r) => r.resumeRank <= 8).length, selected.length).padStart(12)} ${percent(selected.filter((r) => r.tournamentSeed !== null).length, selected.length).padStart(10)} ${percent(selected.filter((r) => r.tournamentSeed !== null && r.tournamentSeed <= 4).length, selected.length).padStart(10)}`)
  }
  console.log(`Win-rank to résumé-rank correlation: ${fixed(correlation(rows.map((r) => ({ first: -r.winRank, second: -r.resumeRank }))), 3)}; Strength-rank to résumé-rank: ${fixed(correlation(rows.map((r) => ({ first: -r.strengthRank, second: -r.resumeRank }))), 3)}.`)
}

function printEcosystem(runs: readonly DynastyRunResult[]): void {
  const mature = runs.flatMap((run) => run.seasons.filter((s) => s.seasonNumber >= MATURE_START && s.seasonNumber <= MATURE_END).map((season) => {
    const ranks = rankMap(season.teams.map((t) => ({ programId: t.programId, value: t.overall })))
    const outcomes = run.programSeasonOutcomes.filter((o) => o.seasonNumber === season.seasonNumber)
    return season.teams.map((team) => ({
      seed: run.seed,
      season: season.seasonNumber,
      ...team,
      strengthRank: ranks.get(team.programId)!,
      wins: outcomes.find((o) => o.programId === team.programId)!.wins,
    }))
  }).flat())
  const elite = mature.filter((r) => r.prestige >= 80)
  const weak = mature.filter((r) => r.prestige < 40)
  const retention: boolean[] = []
  for (const run of runs) for (let season = MATURE_START; season < MATURE_END; season += 1) {
    const current = new Set(mature.filter((r) => r.seed === run.seed && r.season === season && r.strengthRank <= 4).map((r) => r.programId))
    retention.push(...mature.filter((r) => r.seed === run.seed && r.season === season + 1 && r.strengthRank <= 4).map((r) => current.has(r.programId)))
  }
  const maxStrength = Math.max(...mature.map((r) => r.overall))
  const topPrograms = new Set(mature.filter((r) => r.strengthRank === 1).map((r) => r.programId))
  const championCounts = runs.map((run) => Object.keys(run.champions).length)
  console.log('\n5. ECOSYSTEM SHAPE (mature window)')
  console.log(`80+ Prestige: top-8 Strength ${percent(elite.filter((r) => r.strengthRank <= 8).length, elite.length)}, 20+ wins ${percent(elite.filter((r) => r.wins >= 20).length, elite.length)}. <40 Prestige: bottom-8 Strength ${percent(weak.filter((r) => r.strengthRank >= 25).length, weak.length)}.`)
  console.log(`Adjacent top-4 retention ${percent(retention.filter(Boolean).length, retention.length)}; ${topPrograms.size} Programs reached #1 Strength; max Strength ${fixed(maxStrength)}; 85+ Team-Seasons ${mature.filter((r) => r.overall >= 85).length}.`)
  console.log(`Unique champions over all 10 Seasons by seed: ${championCounts.join(' / ')}.`)
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 10, seeds: SEEDS, auditLevel: 'light' })
  console.log('ELITE PROGRAM DOMINANCE AUDIT')
  console.log(`Configuration: ${SEEDS.length} deterministic seeds × 10 Seasons × LIGHT; mature window Seasons ${MATURE_START}–${MATURE_END}`)
  console.log(`Programs: ${UNIVERSE_V0.programs.length}; AI recruiting aggregates exclude controlled ${CONTROLLED_PROGRAM_ID}.`)
  printRecruiting(result.runs)
  printRosters(result.runs)
  printGames(result.runs)
  printResume(result.runs)
  printEcosystem(result.runs)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
