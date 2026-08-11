import { calculateTeamStrength } from '../src/engine'
import {
  deriveNationalChampion,
  getGamesForTournamentRound,
  TOURNAMENT_ROUNDS,
  type PostseasonState,
  type TournamentBidType,
  type TournamentEntry,
  type TournamentRound,
} from '../src/postseason'
import { deriveProgramRecord, type SeasonState } from '../src/season'
import {
  rankAtLargeCandidates,
  rankAutomaticQualifiers,
} from '../src/postseason/selection'
import { average, correlation, percentile } from './dynastyLongRunMetrics'

export type OvrGapBucket = '0–<2' | '2–<4' | '4–<6' | '6–<8' | '8+'
export type TournamentScope = 'ALL' | 'SEASON 1' | 'SEASON 5+'

export interface TournamentFieldRecord {
  readonly seasonNumber: number
  readonly programId: string
  readonly seed: number
  readonly bidType: TournamentBidType
  readonly overall: number
  readonly winPercentage: number
  readonly actualOvrRank: number
}

export interface TournamentGameRecord {
  readonly seasonNumber: number
  readonly gameId: string
  readonly round: TournamentRound
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly homeSeed: number
  readonly awaySeed: number
  readonly homeOverall: number
  readonly awayOverall: number
  readonly winnerId: string
  readonly overallDifference: number
  readonly seedUpset: boolean
  readonly strengthUpset: boolean
}

export interface TournamentBalanceObservation {
  readonly seasonNumber: number
  readonly field: readonly TournamentFieldRecord[]
  readonly games: readonly TournamentGameRecord[]
  readonly finalFourProgramIds: readonly string[]
  readonly championProgramId: string
}

export interface TournamentDiagnosticSummary {
  readonly tournaments: number
  readonly seedOvrCorrelation: number
  readonly seedWinCorrelation: number
  readonly meanSeedRankError: number
  readonly strongestOneSeedRate: number
  readonly topFourAccuracy: number
  readonly bottomFourTopEightRate: number
  readonly extremeMatchups: Readonly<Record<'1/16' | '2/15' | '3/14', {
    readonly averageGap: number
    readonly medianGap: number
    readonly lowerSeedStrongerRate: number
  }>>
  readonly strongerTeamWinRates: Readonly<Record<OvrGapBucket, number>>
  readonly finalFourSeedBands: readonly number[]
  readonly championSeedBands: readonly number[]
}

/** Tooling-only 6E.7B candidate: preserve membership/bids and replace only seeds. */
export function seedSelectedFieldTogether(
  season: SeasonState,
  field: readonly TournamentEntry[],
): TournamentEntry[] {
  const byProgramId = new Map(field.map((entry) => [entry.programId, entry]))
  return rankAtLargeCandidates(season, field.map(({ programId }) => programId))
    .map((programId, index) => ({
      programId,
      seed: index + 1,
      bidType: byProgramId.get(programId)!.bidType,
    }))
}

/** Tooling-only legacy baseline retained for paired 6E.7B comparisons. */
export function seedSelectedFieldWithProtectedAutomatics(
  season: SeasonState,
  field: readonly TournamentEntry[],
): TournamentEntry[] {
  const automaticIds = field.filter(({ bidType }) => bidType === 'automatic')
    .map(({ programId }) => programId)
  const atLargeIds = field.filter(({ bidType }) => bidType === 'at-large')
    .map(({ programId }) => programId)
  return [
    ...rankAutomaticQualifiers(season, automaticIds).map((programId, index) => ({
      programId,
      seed: index + 1,
      bidType: 'automatic' as const,
    })),
    ...rankAtLargeCandidates(season, atLargeIds).map((programId, index) => ({
      programId,
      seed: automaticIds.length + index + 1,
      bidType: 'at-large' as const,
    })),
  ]
}

export function rankFieldByOverall(
  entries: readonly { readonly programId: string; readonly overall: number }[],
): Readonly<Record<string, number>> {
  return Object.fromEntries([...entries]
    .sort((first, second) =>
      second.overall - first.overall || first.programId.localeCompare(second.programId),
    )
    .map(({ programId }, index) => [programId, index + 1]))
}

export function classifyUpsets(options: {
  readonly homeProgramId: string
  readonly awayProgramId: string
  readonly homeSeed: number
  readonly awaySeed: number
  readonly homeOverall: number
  readonly awayOverall: number
  readonly winnerId: string
}): { readonly seedUpset: boolean; readonly strengthUpset: boolean } {
  const winnerIsHome = options.winnerId === options.homeProgramId
  if (!winnerIsHome && options.winnerId !== options.awayProgramId) {
    throw new RangeError('Tournament winner must be one of the two participants.')
  }
  const winnerSeed = winnerIsHome ? options.homeSeed : options.awaySeed
  const loserSeed = winnerIsHome ? options.awaySeed : options.homeSeed
  const winnerOverall = winnerIsHome ? options.homeOverall : options.awayOverall
  const loserOverall = winnerIsHome ? options.awayOverall : options.homeOverall
  return {
    seedUpset: winnerSeed > loserSeed,
    strengthUpset: winnerOverall < loserOverall,
  }
}

export function ovrGapBucket(gap: number): OvrGapBucket {
  if (!Number.isFinite(gap) || gap < 0) throw new RangeError('OVR gap must be finite and non-negative.')
  if (gap < 2) return '0–<2'
  if (gap < 4) return '2–<4'
  if (gap < 6) return '4–<6'
  if (gap < 8) return '6–<8'
  return '8+'
}

export function extractTournamentBalanceObservation(
  season: SeasonState,
  postseason: PostseasonState,
): TournamentBalanceObservation {
  const baseField = postseason.field.map((entry) => {
    const state = postseason.programStates[entry.programId]
    if (!state) throw new RangeError(`Missing Tournament Program "${entry.programId}".`)
    const record = deriveProgramRecord(season, entry.programId)
    return {
      ...entry,
      seasonNumber: season.seasonNumber,
      overall: calculateTeamStrength(state.team, state.rotation).overall,
      winPercentage: record.wins / (record.wins + record.losses),
    }
  })
  const ranks = rankFieldByOverall(baseField)
  const field: TournamentFieldRecord[] = baseField
    .map((entry) => ({ ...entry, actualOvrRank: ranks[entry.programId]! }))
    .sort((first, second) => first.seed - second.seed)
  const byProgram = new Map(field.map((entry) => [entry.programId, entry]))
  const games = TOURNAMENT_ROUNDS.flatMap((round) =>
    getGamesForTournamentRound(postseason, round).map((game) => {
      const result = postseason.resultsByGameId[game.id]
      if (!result) throw new RangeError(`Tournament game "${game.id}" is incomplete.`)
      const home = byProgram.get(result.homeTeamId)!
      const away = byProgram.get(result.awayTeamId)!
      return {
        seasonNumber: season.seasonNumber,
        gameId: game.id,
        round,
        homeProgramId: home.programId,
        awayProgramId: away.programId,
        homeSeed: home.seed,
        awaySeed: away.seed,
        homeOverall: home.overall,
        awayOverall: away.overall,
        winnerId: result.winnerId,
        overallDifference: Math.abs(home.overall - away.overall),
        ...classifyUpsets({
          homeProgramId: home.programId,
          awayProgramId: away.programId,
          homeSeed: home.seed,
          awaySeed: away.seed,
          homeOverall: home.overall,
          awayOverall: away.overall,
          winnerId: result.winnerId,
        }),
      }
    }),
  )
  const finalFourProgramIds = getGamesForTournamentRound(postseason, 'semifinals')
    .flatMap((game) => {
      const result = postseason.resultsByGameId[game.id]!
      return [result.homeTeamId, result.awayTeamId]
    })
    .sort((first, second) => first.localeCompare(second))
  const championProgramId = deriveNationalChampion(postseason)
  if (!championProgramId) throw new RangeError('Tournament has no champion.')
  return { seasonNumber: season.seasonNumber, field, games, finalFourProgramIds, championProgramId }
}

function fixed(value: number, digits = 2): string { return value.toFixed(digits) }
function percent(value: number): string { return `${(value * 100).toFixed(1)}%` }
function median(values: readonly number[]): number { return percentile(values, 0.5) }

function scopeObservations(
  observations: readonly TournamentBalanceObservation[],
  scope: TournamentScope,
): TournamentBalanceObservation[] {
  if (scope === 'SEASON 1') return observations.filter(({ seasonNumber }) => seasonNumber === 1)
  if (scope === 'SEASON 5+') return observations.filter(({ seasonNumber }) => seasonNumber >= 5)
  return [...observations]
}

export function summarizeTournamentDiagnostics(
  observations: readonly TournamentBalanceObservation[],
  scope: TournamentScope = 'ALL',
): TournamentDiagnosticSummary {
  const tournaments = scopeObservations(observations, scope)
  const field = tournaments.flatMap((entry) => entry.field)
  const games = tournaments.flatMap((entry) => entry.games)
  const extreme = Object.fromEntries(([[1, 16], [2, 15], [3, 14]] as const).map(
    ([highSeed, lowSeed]) => {
      const rows = games.filter((game) => game.round === 'round-of-16' &&
        [game.homeSeed, game.awaySeed].includes(highSeed) &&
        [game.homeSeed, game.awaySeed].includes(lowSeed))
      const gaps = rows.map(({ overallDifference }) => overallDifference)
      return [`${highSeed}/${lowSeed}`, {
        averageGap: average(gaps),
        medianGap: median(gaps),
        lowerSeedStrongerRate: rows.filter((game) => {
          const lowerOverall = game.homeSeed === lowSeed ? game.homeOverall : game.awayOverall
          const higherOverall = game.homeSeed === highSeed ? game.homeOverall : game.awayOverall
          return lowerOverall > higherOverall
        }).length / rows.length,
      }]
    },
  )) as TournamentDiagnosticSummary['extremeMatchups']
  const strongerTeamWinRates = Object.fromEntries(
    (['0–<2', '2–<4', '4–<6', '6–<8', '8+'] as const).map((bucket) => {
      const rows = games.filter((game) =>
        ovrGapBucket(game.overallDifference) === bucket &&
        game.homeOverall !== game.awayOverall,
      )
      const wins = rows.filter((game) => game.winnerId === (
        game.homeOverall > game.awayOverall ? game.homeProgramId : game.awayProgramId
      )).length
      return [bucket, rows.length === 0 ? 0 : wins / rows.length]
    }),
  ) as Record<OvrGapBucket, number>
  const finalFour = tournaments.flatMap((tournament) =>
    tournament.finalFourProgramIds.map((id) =>
      tournament.field.find((row) => row.programId === id)!,
    ),
  )
  const champions = tournaments.map((tournament) =>
    tournament.field.find((row) => row.programId === tournament.championProgramId)!,
  )
  const bands = [[1, 4], [5, 8], [9, 12], [13, 16]] as const
  return {
    tournaments: tournaments.length,
    seedOvrCorrelation: correlation(field.map((row) => ({ first: 17 - row.seed, second: row.overall }))),
    seedWinCorrelation: correlation(field.map((row) => ({ first: 17 - row.seed, second: row.winPercentage }))),
    meanSeedRankError: average(field.map((row) => Math.abs(row.seed - row.actualOvrRank))),
    strongestOneSeedRate: field.filter((row) => row.seed === 1 && row.actualOvrRank === 1).length / tournaments.length,
    topFourAccuracy: field.filter((row) => row.seed <= 4 && row.actualOvrRank <= 4).length / (tournaments.length * 4),
    bottomFourTopEightRate: field.filter((row) => row.seed >= 13 && row.actualOvrRank <= 8).length / (tournaments.length * 4),
    extremeMatchups: extreme,
    strongerTeamWinRates,
    finalFourSeedBands: bands.map(([start, end]) => finalFour.filter(({ seed }) => seed >= start && seed <= end).length),
    championSeedBands: bands.map(([start, end]) => champions.filter(({ seed }) => seed >= start && seed <= end).length),
  }
}

export function formatPairedTournamentComparison(
  baseline: readonly TournamentBalanceObservation[],
  candidate: readonly TournamentBalanceObservation[],
  configuration: { readonly seeds: number; readonly seasons: number; readonly audit: string },
): string {
  const lines = [
    'COLLEGE HOOPS SIM — PAIRED TOURNAMENT SEEDING CANDIDATE', '',
    `Configuration: ${configuration.seeds} seed(s) × ${configuration.seasons} season(s) · ${configuration.audit.toUpperCase()} audit`,
    'Same completed regular seasons and selected fields; only seed order differs.',
  ]
  for (const scope of ['ALL', 'SEASON 1', 'SEASON 5+'] as const) {
    const first = summarizeTournamentDiagnostics(baseline, scope)
    if (first.tournaments === 0) continue
    const second = summarizeTournamentDiagnostics(candidate, scope)
    lines.push('', `=== ${scope} (${first.tournaments} TOURNAMENTS) ===`,
      'METRIC | BASELINE | CANDIDATE',
      `Seed quality ↔ OVR | ${fixed(first.seedOvrCorrelation, 3)} | ${fixed(second.seedOvrCorrelation, 3)}`,
      `Seed quality ↔ win% | ${fixed(first.seedWinCorrelation, 3)} | ${fixed(second.seedWinCorrelation, 3)}`,
      `Mean |seed − OVR rank| | ${fixed(first.meanSeedRankError)} | ${fixed(second.meanSeedRankError)}`,
      `#1 actually strongest | ${percent(first.strongestOneSeedRate)} | ${percent(second.strongestOneSeedRate)}`,
      `Seeds 1–4 actually top-four | ${percent(first.topFourAccuracy)} | ${percent(second.topFourAccuracy)}`,
      `Seeds 13–16 actually top-eight | ${percent(first.bottomFourTopEightRate)} | ${percent(second.bottomFourTopEightRate)}`,
      '', 'EXTREME MATCHUP | BASE GAP/LOWER STRONGER | CANDIDATE GAP/LOWER STRONGER')
    for (const matchup of ['1/16', '2/15', '3/14'] as const) {
      const before = first.extremeMatchups[matchup]
      const after = second.extremeMatchups[matchup]
      lines.push(`${matchup} | ${fixed(before.averageGap)}/${percent(before.lowerSeedStrongerRate)} | ${fixed(after.averageGap)}/${percent(after.lowerSeedStrongerRate)}`)
    }
    lines.push('', `Stronger-Team win curve baseline: ${Object.values(first.strongerTeamWinRates).map(percent).join(' / ')}`,
      `Stronger-Team win curve candidate: ${Object.values(second.strongerTeamWinRates).map(percent).join(' / ')}`,
      `Final Four bands baseline/candidate: ${first.finalFourSeedBands.join('/')} | ${second.finalFourSeedBands.join('/')}`,
      `Champion bands baseline/candidate: ${first.championSeedBands.join('/')} | ${second.championSeedBands.join('/')}`)
  }
  return lines.join('\n')
}

export function formatTournamentBalanceReport(
  observations: readonly TournamentBalanceObservation[],
  configuration: { readonly seeds: number; readonly seasons: number; readonly audit: string },
): string {
  const lines: string[] = [
    'COLLEGE HOOPS SIM — TOURNAMENT BALANCE / SEEDING DIAGNOSTIC', '',
    `Configuration: ${configuration.seeds} seed(s) × ${configuration.seasons} season(s) · ${configuration.audit.toUpperCase()} audit`,
  ]
  for (const scope of ['ALL', 'SEASON 1', 'SEASON 5+'] as const) {
    const tournaments = scopeObservations(observations, scope)
    if (tournaments.length === 0) continue
    const field = tournaments.flatMap((entry) => entry.field)
    const games = tournaments.flatMap((entry) => entry.games)
    lines.push('', `=== ${scope} (${tournaments.length} TOURNAMENTS) ===`, '', 'SEED QUALITY',
      'SEED | AVG OVR | MEDIAN OVR | AVG WIN%')
    for (let seed = 1; seed <= 16; seed += 1) {
      const rows = field.filter((entry) => entry.seed === seed)
      lines.push(`${String(seed).padStart(4)} | ${fixed(average(rows.map((row) => row.overall))).padStart(7)} | ${fixed(median(rows.map((row) => row.overall))).padStart(10)} | ${percent(average(rows.map((row) => row.winPercentage))).padStart(8)}`)
    }
    const seedOvr = field.map((row) => ({ first: 17 - row.seed, second: row.overall }))
    const seedWins = field.map((row) => ({ first: 17 - row.seed, second: row.winPercentage }))
    const topFour = field.filter(({ seed }) => seed <= 4)
    const bottomFour = field.filter(({ seed }) => seed >= 13)
    lines.push(
      `Seed quality ↔ Team OVR correlation: ${fixed(correlation(seedOvr), 3)}`,
      `Seed quality ↔ win% correlation: ${fixed(correlation(seedWins), 3)}`,
      `Mean |seed − OVR rank|: ${fixed(average(field.map((row) => Math.abs(row.seed - row.actualOvrRank))))}`,
      `#1 seed is strongest by OVR: ${percent(field.filter((row) => row.seed === 1 && row.actualOvrRank === 1).length / tournaments.length)}`,
      `Seeds 1–4 actually top-four by OVR: ${percent(topFour.filter((row) => row.actualOvrRank <= 4).length / topFour.length)}`,
      `Seeds 13–16 actually top-eight by OVR: ${percent(bottomFour.filter((row) => row.actualOvrRank <= 8).length / bottomFour.length)}`,
      '', 'BID TYPE', 'BID TYPE | AVG OVR | AVG WIN% | AVG OVR RANK',
    )
    for (const bidType of ['automatic', 'at-large'] as const) {
      const rows = field.filter((entry) => entry.bidType === bidType)
      lines.push(`${bidType.padEnd(9)} | ${fixed(average(rows.map((row) => row.overall))).padStart(7)} | ${percent(average(rows.map((row) => row.winPercentage))).padStart(8)} | ${fixed(average(rows.map((row) => row.actualOvrRank))).padStart(12)}`)
    }
    const autoAtLargePairs = tournaments.flatMap((tournament) => {
      const autos = tournament.field.filter(({ bidType }) => bidType === 'automatic')
      const atLarges = tournament.field.filter(({ bidType }) => bidType === 'at-large')
      return autos.flatMap((automatic) => atLarges.map((atLarge) => ({ automatic, atLarge })))
    })
    lines.push(`At-large higher OVR than automatic qualifier: ${percent(autoAtLargePairs.filter(({ automatic, atLarge }) => atLarge.overall > automatic.overall).length / autoAtLargePairs.length)}`,
      '', 'EXTREME FIRST-ROUND MATCHUPS', 'MATCHUP | AVG OVR GAP | MEDIAN | MIN | MAX | LOWER-SEED STRONGER')
    for (const [highSeed, lowSeed] of [[1, 16], [2, 15], [3, 14]] as const) {
      const rows = games.filter((game) => game.round === 'round-of-16' && [game.homeSeed, game.awaySeed].includes(highSeed) && [game.homeSeed, game.awaySeed].includes(lowSeed))
      const gaps = rows.map(({ overallDifference }) => overallDifference)
      const lowerStronger = rows.filter((game) => {
        const lowOverall = game.homeSeed === lowSeed ? game.homeOverall : game.awayOverall
        const highOverall = game.homeSeed === highSeed ? game.homeOverall : game.awayOverall
        return lowOverall > highOverall
      }).length / rows.length
      lines.push(`${highSeed} vs ${lowSeed}   | ${fixed(average(gaps)).padStart(11)} | ${fixed(median(gaps)).padStart(6)} | ${fixed(Math.min(...gaps)).padStart(3)} | ${fixed(Math.max(...gaps)).padStart(3)} | ${percent(lowerStronger).padStart(19)}`)
    }
    lines.push('', 'ACTUAL STRENGTH VS OUTCOME', 'OVR GAP | GAMES | STRONGER TEAM WIN%')
    for (const bucket of ['0–<2', '2–<4', '4–<6', '6–<8', '8+'] as const) {
      const rows = games.filter((game) => ovrGapBucket(game.overallDifference) === bucket && game.homeOverall !== game.awayOverall)
      const strongerWins = rows.filter((game) => {
        const strongerId = game.homeOverall > game.awayOverall ? game.homeProgramId : game.awayProgramId
        return game.winnerId === strongerId
      }).length
      lines.push(`${bucket.padEnd(7)} | ${String(rows.length).padStart(5)} | ${percent(rows.length === 0 ? 0 : strongerWins / rows.length).padStart(18)}`)
    }
    lines.push(`Seed upsets: ${games.filter(({ seedUpset }) => seedUpset).length}/${games.length} (${percent(games.filter(({ seedUpset }) => seedUpset).length / games.length)})`,
      `Strength upsets: ${games.filter(({ strengthUpset }) => strengthUpset).length}/${games.length} (${percent(games.filter(({ strengthUpset }) => strengthUpset).length / games.length)})`,
      '', 'TOURNAMENT OUTCOME SHAPE', 'BAND | FINAL FOUR | CHAMPIONS')
    const bands = [[1, 4], [5, 8], [9, 12], [13, 16]] as const
    for (const [start, end] of bands) {
      const finalFour = tournaments.flatMap((tournament) => tournament.finalFourProgramIds.map((id) => tournament.field.find((row) => row.programId === id)!))
      const champions = tournaments.map((tournament) => tournament.field.find((row) => row.programId === tournament.championProgramId)!)
      lines.push(`${start}–${end}`.padEnd(5) + ` | ${String(finalFour.filter(({ seed }) => seed >= start && seed <= end).length).padStart(10)} | ${String(champions.filter(({ seed }) => seed >= start && seed <= end).length).padStart(9)}`)
    }
    const champions = tournaments.map((tournament) => tournament.field.find((row) => row.programId === tournament.championProgramId)!)
    const finalFourEntries = tournaments.flatMap((tournament) =>
      tournament.finalFourProgramIds.map((id) =>
        tournament.field.find((row) => row.programId === id)!,
      ),
    )
    lines.push(
      `Final Four OVR AVG/MEDIAN: ${fixed(average(finalFourEntries.map(({ overall }) => overall)))} / ${fixed(median(finalFourEntries.map(({ overall }) => overall)))}`,
      `Final Four OVR rank AVG/MEDIAN/RANGE: ${fixed(average(finalFourEntries.map(({ actualOvrRank }) => actualOvrRank)))} / ${fixed(median(finalFourEntries.map(({ actualOvrRank }) => actualOvrRank)))} / ${Math.min(...finalFourEntries.map(({ actualOvrRank }) => actualOvrRank))}–${Math.max(...finalFourEntries.map(({ actualOvrRank }) => actualOvrRank))}`,
    )
    lines.push(`Champion OVR AVG/MEDIAN: ${fixed(average(champions.map(({ overall }) => overall)))} / ${fixed(median(champions.map(({ overall }) => overall)))}`,
      `Champion OVR rank AVG/MEDIAN/RANGE: ${fixed(average(champions.map(({ actualOvrRank }) => actualOvrRank)))} / ${fixed(median(champions.map(({ actualOvrRank }) => actualOvrRank)))} / ${Math.min(...champions.map(({ actualOvrRank }) => actualOvrRank))}–${Math.max(...champions.map(({ actualOvrRank }) => actualOvrRank))}`)
  }
  lines.push('', 'INTERPRETATION', 'Compare seed alignment with the stronger-Team win curve. Seed upsets and strength upsets are separate facts; no production thresholds or tuning decisions are encoded by this tool.')
  return lines.join('\n')
}
