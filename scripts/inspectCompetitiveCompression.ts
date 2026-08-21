import { pathToFileURL } from 'node:url'
import { average, correlation, percentile, summarizeDistribution } from './dynastyLongRunMetrics'
import { runLongRunCalibration, type DynastyRunResult, type ProgramRosterTrace } from './inspectDynastyLongRun'

const SEEDS = ['dynasty-long-run-v0:seed-1', 'dynasty-long-run-v0:seed-2', 'dynasty-long-run-v0:seed-3'] as const
const CHECKPOINTS = [1, 2, 3, 5, 10, 15, 20, 25] as const
const MATURE_START = 5
const MATURE_END = 25

const f = (value: number, digits = 2): string => Number.isFinite(value) ? value.toFixed(digits) : '—'
const pct = (value: number): string => Number.isFinite(value) ? `${f(value * 100, 1)}%` : '—'
const rate = (yes: number, total: number): number => total === 0 ? Number.NaN : yes / total
const top = (row: ProgramRosterTrace, count: number): number => average([...row.players].sort((a, b) => b.overall - a.overall).slice(0, count).map((p) => p.overall))

interface Spread { mean: number; sd: number; range: number; p90p10: number; top4bottom4: number; top8middle: number; within2: number; within5: number }
function spread(values: readonly number[]): Spread {
  const summary = summarizeDistribution(values)
  const sorted = [...values].sort((a, b) => b - a)
  const middle = sorted.slice(8, 24)
  return {
    mean: summary.average, sd: summary.standardDeviation,
    range: summary.maximum - summary.minimum, p90p10: summary.p90 - summary.p10,
    top4bottom4: average(sorted.slice(0, 4)) - average(sorted.slice(-4)),
    top8middle: average(sorted.slice(0, 8)) - average(middle),
    within2: rate(values.filter((v) => Math.abs(v - summary.average) <= 2).length, values.length),
    within5: rate(values.filter((v) => Math.abs(v - summary.average) <= 5).length, values.length),
  }
}
function averagedSpread(groups: readonly number[][]): Spread {
  const rows = groups.map(spread)
  const mean = (key: keyof Spread) => average(rows.map((row) => row[key]))
  return { mean: mean('mean'), sd: mean('sd'), range: mean('range'), p90p10: mean('p90p10'), top4bottom4: mean('top4bottom4'), top8middle: mean('top8middle'), within2: mean('within2'), within5: mean('within5') }
}
function rankMap(rows: readonly { programId: string; value: number }[]): Map<string, number> {
  return new Map([...rows].sort((a, b) => b.value - a.value || a.programId.localeCompare(b.programId)).map((row, i) => [row.programId, i + 1]))
}
function printSpread(label: string, s: Spread): void {
  console.log(`${label.padEnd(22)} ${f(s.mean).padStart(6)} ${f(s.sd).padStart(6)} ${f(s.range).padStart(7)} ${f(s.p90p10).padStart(8)} ${f(s.top4bottom4).padStart(9)} ${f(s.top8middle).padStart(9)} ${pct(s.within2).padStart(8)} ${pct(s.within5).padStart(8)}`)
}

function varianceWaterfall(runs: readonly DynastyRunResult[]): void {
  const rosters = runs.flatMap((run) => run.rosterTraces.filter((r) => r.seasonNumber >= MATURE_START))
  const keys = new Set(rosters.map((r) => `${r.seasonNumber}:${r.programId}:${runs.findIndex((run) => run.rosterTraces.includes(r))}`))
  void keys
  const perSeason = runs.flatMap((run) => Array.from({ length: MATURE_END - MATURE_START + 1 }, (_, i) => {
    const season = i + MATURE_START
    const rows = run.rosterTraces.filter((r) => r.seasonNumber === season)
    const classes = rows.map((row) => {
      const recruits = run.signedRecruits.filter((r) => r.targetSeasonNumber === season && r.programId === row.programId)
      return recruits.length ? average(recruits.map((r) => r.overall)) : Number.NaN
    })
    return { rows, classes }
  }))
  console.log('\nA. MATURE VARIANCE WATERFALL — mean of 63 seed-Seasons (S5–25)')
  console.log('Stage                    Mean     SD   Range  P90-P10  T4-B4  T8-Mid   ±2       ±5')
  printSpread('Prestige', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => r.prestige))))
  printSpread('Recruit class OVR', averagedSpread(perSeason.map(({ classes }) => classes.filter(Number.isFinite))))
  printSpread('Full roster OVR', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => average(r.players.map((p) => p.overall))))))
  printSpread('Top-5 roster OVR', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => top(r, 5)))))
  printSpread('Top-8 roster OVR', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => top(r, 8)))))
  printSpread('Rotation-wtd OVR', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => r.rotationWeightedPlayerOverall))))
  printSpread('Team Strength', averagedSpread(perSeason.map(({ rows }) => rows.map((r) => r.overall))))
  console.log(`Rotation-weighted OVR ↔ Strength correlation: ${f(correlation(rosters.map((r) => ({ first: r.rotationWeightedPlayerOverall, second: r.overall }))), 3)}`)
}

function trajectory(runs: readonly DynastyRunResult[]): void {
  console.log('\nB. TEAM STRENGTH BY DYNASTY AGE — mean of 3 seed-Seasons')
  console.log('Season  Mean    SD  Range P90-P10 Strong Weak 80+ 85+   ±2     ±5  T4 retain T8 retain Rank move')
  for (const season of CHECKPOINTS) {
    const groups = runs.map((run) => run.rosterTraces.filter((r) => r.seasonNumber === season).map((r) => r.overall))
    const s = averagedSpread(groups)
    const all = groups.flat()
    const retention = (limit: number) => runs.flatMap((run) => {
      if (season === 1) return []
      const prior = rankMap(run.rosterTraces.filter((r) => r.seasonNumber === season - 1).map((r) => ({ programId: r.programId, value: r.overall })))
      const current = rankMap(run.rosterTraces.filter((r) => r.seasonNumber === season).map((r) => ({ programId: r.programId, value: r.overall })))
      return [...current].filter(([, rank]) => rank <= limit).map(([id]) => (prior.get(id) ?? 99) <= limit)
    })
    const moves = runs.flatMap((run) => {
      if (season === 1) return []
      const prior = rankMap(run.rosterTraces.filter((r) => r.seasonNumber === season - 1).map((r) => ({ programId: r.programId, value: r.overall })))
      const current = rankMap(run.rosterTraces.filter((r) => r.seasonNumber === season).map((r) => ({ programId: r.programId, value: r.overall })))
      return [...current].map(([id, rank]) => Math.abs(rank - prior.get(id)!))
    })
    console.log(`${String(season).padStart(6)} ${f(s.mean).padStart(5)} ${f(s.sd).padStart(5)} ${f(s.range).padStart(6)} ${f(s.p90p10).padStart(7)} ${f(Math.max(...all)).padStart(6)} ${f(Math.min(...all)).padStart(4)} ${String(all.filter((v) => v >= 80).length).padStart(3)} ${String(all.filter((v) => v >= 85).length).padStart(3)} ${pct(s.within2).padStart(6)} ${pct(s.within5).padStart(7)} ${pct(rate(retention(4).filter(Boolean).length, retention(4).length)).padStart(9)} ${pct(rate(retention(8).filter(Boolean).length, retention(8).length)).padStart(9)} ${f(average(moves), 1).padStart(9)}`)
  }
}

function fieldCompression(runs: readonly DynastyRunResult[]): void {
  console.log('\nC. FULL LEAGUE VS TOURNAMENT FIELD — mean spread by age')
  console.log('Season Scope       Mean    SD  Range P90-P10   ±2     ±5')
  for (const season of CHECKPOINTS) for (const scope of ['League', 'Field', 'Top 8'] as const) {
    const groups = runs.map((run) => {
      const obs = run.tournamentBalanceCandidate.find((o) => o.seasonNumber === season)!
      if (scope === 'League') return run.rosterTraces.filter((r) => r.seasonNumber === season).map((r) => r.overall)
      const field = scope === 'Field' ? obs.field : obs.field.filter((r) => r.seed <= 8)
      return field.map((r) => r.overall)
    })
    const s = averagedSpread(groups)
    console.log(`${String(season).padStart(6)} ${scope.padEnd(10)} ${f(s.mean).padStart(6)} ${f(s.sd).padStart(5)} ${f(s.range).padStart(6)} ${f(s.p90p10).padStart(7)} ${pct(s.within2).padStart(6)} ${pct(s.within5).padStart(7)}`)
  }
}

function matchups(runs: readonly DynastyRunResult[]): void {
  const games = runs.flatMap((run) => run.tournamentBalanceCandidate.filter((o) => o.seasonNumber >= MATURE_START).flatMap((o) => o.games))
  const roundOne = games.filter((g) => g.round === 'round-of-16')
  console.log('\nD. MATURE ROUND 1 MATCHUP MEANING — 63 Tournaments')
  console.log('Matchup  N AvgGap MedGap  ≤1     ≤2     ≤5  Low stronger Seed upset Strength upset 2+ upset 5+ upset Avg margin')
  for (let high = 1; high <= 8; high += 1) {
    const low = 17 - high
    const rows = roundOne.filter((g) => [g.homeSeed, g.awaySeed].includes(high) && [g.homeSeed, g.awaySeed].includes(low))
    const lowerStronger = rows.filter((g) => (g.homeSeed === low ? g.homeOverall : g.awayOverall) > (g.homeSeed === high ? g.homeOverall : g.awayOverall))
    const winnerGap = (g: typeof rows[number]) => {
      const winner = g.winnerId === g.homeProgramId ? g.homeOverall : g.awayOverall
      const loser = g.winnerId === g.homeProgramId ? g.awayOverall : g.homeOverall
      return loser - winner
    }
    console.log(`${`${high}v${low}`.padEnd(8)} ${String(rows.length).padStart(2)} ${f(average(rows.map((r) => r.overallDifference))).padStart(6)} ${f(percentile(rows.map((r) => r.overallDifference), .5)).padStart(6)} ${pct(rate(rows.filter((r) => r.overallDifference <= 1).length, rows.length)).padStart(6)} ${pct(rate(rows.filter((r) => r.overallDifference <= 2).length, rows.length)).padStart(6)} ${pct(rate(rows.filter((r) => r.overallDifference <= 5).length, rows.length)).padStart(6)} ${pct(rate(lowerStronger.length, rows.length)).padStart(12)} ${pct(rate(rows.filter((r) => r.seedUpset).length, rows.length)).padStart(10)} ${pct(rate(rows.filter((r) => r.strengthUpset).length, rows.length)).padStart(15)} ${pct(rate(rows.filter((r) => winnerGap(r) >= 2).length, rows.length)).padStart(8)} ${pct(rate(rows.filter((r) => winnerGap(r) >= 5).length, rows.length)).padStart(8)} ${f(average(rows.map((r) => r.margin)), 1).padStart(10)}`)
  }
  console.log(`All rounds: ${games.length} games; seed upsets ${pct(rate(games.filter((g) => g.seedUpset).length, games.length))}; any Strength upsets ${pct(rate(games.filter((g) => g.strengthUpset).length, games.length))}.`)
}

function rankMeaning(runs: readonly DynastyRunResult[]): void {
  const pairs = [[1, 4], [1, 8], [1, 16], [1, 24], [1, 32], [4, 13], [8, 16]] as const
  console.log('\nE. ACTUAL REGULAR-SEASON RANK MATCHUPS — mature S5–25')
  console.log('Ranks   Games Avg gap Better-rank wins Home Away')
  for (const [a, b] of pairs) {
    const rows = runs.flatMap((run) => Array.from({ length: 21 }, (_, i) => i + 5).flatMap((season) => {
      const strengths = run.rosterTraces.filter((r) => r.seasonNumber === season)
      const ranks = rankMap(strengths.map((r) => ({ programId: r.programId, value: r.overall })))
      return run.regularSeasonGames.filter((g) => g.seasonNumber === season && new Set([ranks.get(g.homeProgramId), ranks.get(g.awayProgramId)]).size === 2 && [ranks.get(g.homeProgramId), ranks.get(g.awayProgramId)].includes(a) && [ranks.get(g.homeProgramId), ranks.get(g.awayProgramId)].includes(b)).map((g) => ({ ...g, betterId: ranks.get(g.homeProgramId) === a ? g.homeProgramId : g.awayProgramId }))
    }))
    const home = rows.filter((r) => r.betterId === r.homeProgramId)
    const away = rows.filter((r) => r.betterId === r.awayProgramId)
    console.log(`${`${a}v${b}`.padEnd(7)} ${String(rows.length).padStart(5)} ${f(average(rows.map((r) => Math.abs(r.homeStrength - r.awayStrength)))).padStart(7)} ${pct(rate(rows.filter((r) => r.winnerId === r.betterId).length, rows.length)).padStart(16)} ${pct(rate(home.filter((r) => r.winnerId === r.betterId).length, home.length)).padStart(5)} ${pct(rate(away.filter((r) => r.winnerId === r.betterId).length, away.length)).padStart(5)}`)
  }
}

function championMeaning(runs: readonly DynastyRunResult[]): void {
  const rows = runs.flatMap((run) => run.tournamentBalanceCandidate.filter((o) => o.seasonNumber >= MATURE_START).map((o) => {
    const champion = o.field.find((r) => r.programId === o.championProgramId)!
    const strongest = Math.max(...o.field.map((r) => r.overall))
    return { seed: champion.seed, strengthRank: champion.actualOvrRank, strength: champion.overall, gap: strongest - champion.overall }
  }))
  console.log('\nF. CHAMPION QUALITY — mature S5–25')
  console.log(`Champions: ${rows.length}; strongest field team won ${pct(rate(rows.filter((r) => r.strengthRank === 1).length, rows.length))}; top-4 Strength won ${pct(rate(rows.filter((r) => r.strengthRank <= 4).length, rows.length))}; bottom-half Strength won ${pct(rate(rows.filter((r) => r.strengthRank >= 9).length, rows.length))}.`)
  console.log(`Champion Strength ${f(average(rows.map((r) => r.strength)))} average; ${f(percentile(rows.map((r) => r.strength), .5))} median; gap from field strongest ${f(average(rows.map((r) => r.gap)))} average / ${f(percentile(rows.map((r) => r.gap), .5))} median; within 2 ${pct(rate(rows.filter((r) => r.gap <= 2).length, rows.length))}, within 5 ${pct(rate(rows.filter((r) => r.gap <= 5).length, rows.length))}.`)
  console.log(`Champion seeds 1–4: ${pct(rate(rows.filter((r) => r.seed <= 4).length, rows.length))}; 9–16: ${pct(rate(rows.filter((r) => r.seed >= 9).length, rows.length))}; unique champions by 25-Season seed: ${runs.map((run) => Object.keys(run.champions).length).join(' / ')}.`)
}

export function main(): void {
  const result = runLongRunCalibration({ seasonsPerSeed: 25, seeds: SEEDS, auditLevel: 'light' })
  console.log('COLLEGE HOOPS SIM — COMPETITIVE COMPRESSION AUDIT')
  console.log('Configuration: 3 deterministic production-fidelity seeds × 25 Seasons × LIGHT audit; mature = Seasons 5–25.')
  varianceWaterfall(result.runs)
  trajectory(result.runs)
  fieldCompression(result.runs)
  matchups(result.runs)
  rankMeaning(result.runs)
  championMeaning(result.runs)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
