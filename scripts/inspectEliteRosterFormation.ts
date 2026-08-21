import {
  calculateOverall,
  calculateTeamStrength,
  generateDefaultRotationV1,
  type ClassYear,
  type Player,
  type Position,
  type Team,
} from '../src/engine'
import { average, correlation, summarizeDistribution } from './dynastyLongRunMetrics'
import { runDynastyCalibration, type DynastyRunResult, type ProgramRosterTrace } from './inspectDynastyLongRun'

const SEEDS = ['prestige-compression-a', 'prestige-compression-b', 'prestige-compression-c']

function rounded(value: number): number {
  return Number(value.toFixed(3))
}

function groupBy<Item, Key>(items: readonly Item[], keyFor: (item: Item) => Key): Map<Key, Item[]> {
  const grouped = new Map<Key, Item[]>()
  for (const item of items) {
    const key = keyFor(item)
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }
  return grouped
}

function rates(values: readonly number[]) {
  const summary = summarizeDistribution(values)
  return { mean: rounded(summary.average), median: rounded(summary.median), sd: rounded(summary.standardDeviation), min: rounded(summary.minimum), max: rounded(summary.maximum) }
}

function supply(run: DynastyRunResult) {
  const classes = groupBy(run.generatedRecruits, (recruit) => recruit.targetSeasonNumber)
  const classRows = [...classes.values()].map((recruits) => ({
    total: recruits.length,
    ovr80: recruits.filter(({ overall }) => overall >= 80).length,
    ovr85: recruits.filter(({ overall }) => overall >= 85).length,
    pot85: recruits.filter(({ potential }) => potential >= 85).length,
    pot90: recruits.filter(({ potential }) => potential >= 90).length,
    ovr80Pot85: recruits.filter(({ overall, potential }) => overall >= 80 && potential >= 85).length,
    top10: average(recruits.filter(({ nationalRank }) => nationalRank <= 10).map(({ overall, potential }) => overall * 0.56 + potential * 0.44)),
    top25: average(recruits.filter(({ nationalRank }) => nationalRank <= 25).map(({ overall, potential }) => overall * 0.56 + potential * 0.44)),
    top50: average(recruits.filter(({ nationalRank }) => nationalRank <= 50).map(({ overall, potential }) => overall * 0.56 + potential * 0.44)),
  }))
  const elitePositions = Object.fromEntries(['PG', 'SG', 'SF', 'PF', 'C'].map((position) => [position,
    run.generatedRecruits.filter((recruit) => recruit.position === position && recruit.overall >= 80 && recruit.potential >= 85).length,
  ]))
  return { classCount: classRows.length, averages: Object.fromEntries(Object.keys(classRows[0]!).map((key) => [key, rounded(average(classRows.map((row) => row[key as keyof typeof row])))])), elitePositions }
}

function concentration(run: DynastyRunResult) {
  const classes = groupBy(run.signedRecruits, (recruit) => recruit.targetSeasonNumber)
  const rows = [...classes.values()].map((recruits) => {
    const programs = groupBy(recruits, (recruit) => recruit.programId)
    const premiumCounts = [...programs.values()].map((signed) => signed.filter(({ stars }) => stars >= 4).length)
    const top10Counts = [...programs.values()].map((signed) => signed.filter(({ nationalRank }) => nationalRank <= 10).length)
    const top25Counts = [...programs.values()].map((signed) => signed.filter(({ nationalRank }) => nationalRank <= 25).length)
    const qualities = [...programs.entries()].map(([programId, signed]) => ({
      programId,
      quality: average(signed.map(({ overall, potential }) => overall * 0.56 + potential * 0.44)),
    })).sort((a, b) => b.quality - a.quality)
    return {
      maxPremium: Math.max(...premiumCounts),
      maxTop10: Math.max(...top10Counts),
      maxTop25: Math.max(...top25Counts),
      topClassQuality: qualities[0]!.quality,
      top3ClassQuality: average(qualities.slice(0, 3).map(({ quality }) => quality)),
      top5ClassQuality: average(qualities.slice(0, 5).map(({ quality }) => quality)),
    }
  })
  const byProgram = groupBy(run.signedRecruits.filter(({ stars }) => stars >= 4), (recruit) => recruit.programId)
  let maxPremiumOverTwoClasses = 0
  for (const recruits of byProgram.values()) {
    const counts = new Map<number, number>()
    for (const recruit of recruits) counts.set(recruit.targetSeasonNumber, (counts.get(recruit.targetSeasonNumber) ?? 0) + 1)
    for (const season of counts.keys()) maxPremiumOverTwoClasses = Math.max(maxPremiumOverTwoClasses, (counts.get(season) ?? 0) + (counts.get(season - 1) ?? 0))
  }
  return { classAverages: Object.fromEntries(Object.keys(rows[0]!).map((key) => [key, rounded(average(rows.map((row) => row[key as keyof typeof row])))])), maxPremiumOverTwoClasses }
}

function development(run: DynastyRunResult, threshold: 85 | 90 = 85) {
  const elite = run.signedRecruits.filter(({ potential, targetSeasonNumber }) =>
    potential >= threshold && targetSeasonNumber <= 22)
  const rosterById = groupBy(run.rosterTraces.flatMap((trace) => trace.players.map((player) => ({ ...player, seasonNumber: trace.seasonNumber }))), (player) => player.playerId)
  const realized = elite.map((recruit) => {
    const seasons = rosterById.get(recruit.playerId) ?? []
    const peak = Math.max(recruit.overall, ...seasons.map(({ overall }) => overall))
    const final = seasons.sort((a, b) => a.seasonNumber - b.seasonNumber).at(-1)
    return { peak, gap: recruit.potential - peak, reached80: peak >= 80, reached85: peak >= 85, reached90: peak >= 90, observedSenior: final?.classYear === 'SR' }
  })
  return {
    cohort: elite.length,
    peakOverall: rates(realized.map(({ peak }) => peak)),
    meanUnusedPotential: rounded(average(realized.map(({ gap }) => gap))),
    reached80: rounded(realized.filter(({ reached80 }) => reached80).length / realized.length),
    reached85: rounded(realized.filter(({ reached85 }) => reached85).length / realized.length),
    reached90: rounded(realized.filter(({ reached90 }) => reached90).length / realized.length),
    observedThroughSenior: rounded(realized.filter(({ observedSenior }) => observedSenior).length / realized.length),
  }
}

function longestEliteRun(traces: readonly ProgramRosterTrace[], threshold: number): number {
  const byProgram = groupBy(traces, ({ programId }) => programId)
  let longest = 0
  for (const rows of byProgram.values()) {
    let current = 0
    for (const row of [...rows].sort((a, b) => a.seasonNumber - b.seasonNumber)) {
      current = row.overall >= threshold ? current + 1 : 0
      longest = Math.max(longest, current)
    }
  }
  return longest
}

function acceptedStaticBaseline(runs: readonly DynastyRunResult[]) {
  const traces = runs.flatMap(({ rosterTraces }) => rosterTraces)
  const season25Teams = runs.flatMap(({ seasons }) =>
    seasons.find(({ seasonNumber }) => seasonNumber === 25)!.teams.map(({ overall }) => overall),
  )
  const cohort = (threshold: 85 | 90) => {
    const rows = runs.map((run) => development(run, threshold))
    return {
      peakMean: rounded(average(rows.map(({ peakOverall }) => peakOverall.mean))),
      peakMedian: rounded(average(rows.map(({ peakOverall }) => peakOverall.median))),
      peakSd: rounded(average(rows.map(({ peakOverall }) => peakOverall.sd))),
      unusedPotential: rounded(average(rows.map(({ meanUnusedPotential }) => meanUnusedPotential))),
      reached85: rounded(average(rows.map(({ reached85 }) => reached85))),
      reached90: rounded(average(rows.map(({ reached90 }) => reached90))),
    }
  }
  const topFourRetention = runs.flatMap((run) => {
    const bySeason = groupBy(
      run.rosterTraces.filter(({ seasonNumber }) => seasonNumber >= 5),
      ({ seasonNumber }) => seasonNumber,
    )
    const topSets = [...bySeason.entries()].sort(([a], [b]) => a - b).map(([, rows]) =>
      new Set([...rows].sort((a, b) => b.overall - a.overall).slice(0, 4).map(({ programId }) => programId)),
    )
    return topSets.slice(1).map((set, index) =>
      [...set].filter((programId) => topSets[index]!.has(programId)).length / 4,
    )
  })
  const strongest = [...traces].sort((a, b) => b.overall - a.overall)[0]!
  return {
    cohort85: cohort(85),
    cohort90: cohort(90),
    season25TeamOverall: { ...rates(season25Teams), range: rounded(Math.max(...season25Teams) - Math.min(...season25Teams)) },
    eliteOccurrences: Object.fromEntries([85, 88, 90].map((threshold) => [
      threshold,
      traces.filter(({ overall }) => overall >= threshold).length,
    ])),
    longestEliteRun: Object.fromEntries([85, 88, 90].map((threshold) => [
      threshold,
      longestEliteRun(traces, threshold),
    ])),
    maximumTeamOverall: rounded(strongest.overall),
    strongestRoster: traceRow(strongest),
    topFourRetention: rounded(average(topFourRetention)),
    champions: runs.map((run) => ({
      unique: Object.keys(run.champions).length,
      leaderShare: rounded(Math.max(...Object.values(run.champions)) / 25),
    })),
  }
}

function manualDevelopmentExamples(runs: readonly DynastyRunResult[]) {
  const transitions = runs.flatMap((run) => {
    const signedById = new Map(run.signedRecruits.map((recruit) => [recruit.playerId, recruit]))
    const byPlayer = groupBy(
      run.rosterTraces.flatMap((trace) => trace.players.map((player) => ({
        ...player,
        seasonNumber: trace.seasonNumber,
        programId: trace.programId,
      }))),
      ({ playerId }) => playerId,
    )
    return [...byPlayer.entries()].flatMap(([playerId, rows]) => {
      const recruit = signedById.get(playerId)
      if (!recruit) return []
      const seasons = [...rows].sort((a, b) => a.seasonNumber - b.seasonNumber)
      return seasons.slice(1).map((after, index) => {
        const before = seasons[index]!
        return {
          seed: run.seed,
          playerId,
          programId: after.programId,
          transition: `${before.classYear}→${after.classYear}`,
          beforeOverall: before.overall,
          afterOverall: after.overall,
          potential: recruit.potential,
          headroom: recruit.potential - before.overall,
          gain: after.overall - before.overall,
        }
      })
    })
  })
  const careers = runs.flatMap((run) => {
    const signedById = new Map(run.signedRecruits.map((recruit) => [recruit.playerId, recruit]))
    return run.rosterTraces.flatMap((trace) => trace.players
      .filter(({ classYear }) => classYear === 'SR')
      .flatMap((player) => {
        const recruit = signedById.get(player.playerId)
        return recruit ? [{
          seed: run.seed,
          playerId: player.playerId,
          programId: trace.programId,
          seniorOverall: player.overall,
          potential: recruit.potential,
          unusedPotential: recruit.potential - player.overall,
        }] : []
      }))
  })
  return {
    meaningfulJump: transitions.find(({ potential, headroom, gain }) =>
      potential >= 90 && headroom >= 12 && gain >= 6),
    modestProgress: transitions.find(({ potential, headroom, gain }) =>
      potential >= 90 && headroom >= 8 && gain >= 1 && gain <= 3),
    disappointingCareer: careers.find(({ potential, unusedPotential }) =>
      potential >= 90 && unusedPotential >= 15),
    nearPotential: transitions.find(({ headroom, gain }) => headroom <= 2 && gain <= 2),
  }
}

function rosterSummary(run: DynastyRunResult) {
  const mature = run.rosterTraces.filter(({ seasonNumber }) => seasonNumber >= 5)
  const top = [...mature].sort((a, b) => b.overall - a.overall)
  const selected: ProgramRosterTrace[] = []
  for (const trace of top) {
    if (selected.some(({ programId }) => programId === trace.programId)) continue
    selected.push(trace)
    if (selected.length === 2) break
  }
  const failed = top.find((trace) =>
    trace.overall < 84 && trace.players.filter(({ overall }) => overall >= 90).length >= 2)
  if (failed) selected.push(failed)
  return {
    maximumCounts: {
      players80: Math.max(...mature.map(({ players }) => players.filter(({ overall }) => overall >= 80).length)),
      players85: Math.max(...mature.map(({ players }) => players.filter(({ overall }) => overall >= 85).length)),
      players90: Math.max(...mature.map(({ players }) => players.filter(({ overall }) => overall >= 90).length)),
      rotation80: Math.max(...mature.map(({ players }) => players.filter(({ overall, minutes }) => overall >= 80 && minutes > 0).length)),
      rotation85: Math.max(...mature.map(({ players }) => players.filter(({ overall, minutes }) => overall >= 85 && minutes > 0).length)),
    },
    translationCorrelation: rounded(correlation(mature.map(({ rotationWeightedPlayerOverall, overall }) => ({ first: rotationWeightedPlayerOverall, second: overall })))),
    translationGap: rates(mature.map(({ rotationWeightedPlayerOverall, overall }) => rotationWeightedPlayerOverall - overall)),
    representative: selected.map((trace) => {
      const next = run.rosterTraces.find(({ seasonNumber, programId }) =>
        seasonNumber === trace.seasonNumber + 1 && programId === trace.programId)
      return {
        ...traceRow(trace),
        departingSeniorMinutes: trace.players.filter(({ classYear }) => classYear === 'SR').reduce((sum, { minutes }) => sum + minutes, 0),
        nextSeasonOverall: next ? rounded(next.overall) : null,
        nextSeasonCounts: next ? {
          ovr80: next.players.filter(({ overall }) => overall >= 80).length,
          ovr85: next.players.filter(({ overall }) => overall >= 85).length,
          ovr90: next.players.filter(({ overall }) => overall >= 90).length,
        } : null,
      }
    }),
  }
}

function traceRow(trace: ProgramRosterTrace) {
  return {
    season: trace.seasonNumber,
    program: trace.programId,
    prestige: trace.prestige,
    teamOverall: rounded(trace.overall),
    offense: rounded(trace.offense),
    defense: rounded(trace.defense),
    weightedPlayerOverall: rounded(trace.rotationWeightedPlayerOverall),
    counts: { ovr80: trace.players.filter(({ overall }) => overall >= 80).length, ovr85: trace.players.filter(({ overall }) => overall >= 85).length, ovr90: trace.players.filter(({ overall }) => overall >= 90).length },
    rotation: trace.players.filter(({ minutes }) => minutes > 0).map(({ playerId, classYear, position, overall, potential, minutes, contribution }) => ({ playerId, classYear, position, overall, potential, minutes, contribution: rounded(contribution) })),
  }
}

const ROSTER_POSITIONS: readonly Position[] = ['PG', 'PG', 'SG', 'SG', 'SF', 'SF', 'PF', 'PF', 'C', 'C', 'SF', 'C']
function theoreticalTeam(label: string, starters: number, bench: number) {
  const seen = new Map<Position, number>()
  const roster: Player[] = ROSTER_POSITIONS.map((position, index) => {
    const positionIndex = seen.get(position) ?? 0
    seen.set(position, positionIndex + 1)
    const rating = positionIndex === 0 ? starters : bench
    return { id: `${label}-${index}`, firstName: 'Scale', lastName: 'Check', position, classYear: 'JR' as ClassYear, height: position === 'PG' ? 74 : position === 'SG' ? 77 : position === 'SF' ? 79 : position === 'PF' ? 81 : 83, potential: rating, attributes: { finishing: rating, shooting: rating, playmaking: rating, ballHandling: rating, perimeterDefense: rating, interiorDefense: rating, rebounding: rating, athleticism: rating, stamina: rating } }
  })
  const team: Team = { id: label, name: label, abbreviation: label.slice(0, 3), prestige: 80, roster }
  const rotation = generateDefaultRotationV1(team)
  return { label, starters, bench, playerOvrs: [...new Set(roster.map(calculateOverall))], strength: calculateTeamStrength(team, rotation) }
}

const runs = SEEDS.map((seed) => runDynastyCalibration(seed, 25, 'light'))
process.stdout.write(JSON.stringify({
  seeds: SEEDS,
  acceptedStaticBaseline: acceptedStaticBaseline(runs),
  manualDevelopmentExamples: manualDevelopmentExamples(runs),
  supply: runs.map(supply),
  concentration: runs.map(concentration),
  development85: runs.map((run) => development(run, 85)),
  development90: runs.map((run) => development(run, 90)),
  rosters: runs.map(rosterSummary),
  theoretical: [theoreticalTeam('all-85', 85, 85), theoreticalTeam('all-90', 90, 90), theoreticalTeam('all-95', 95, 95), theoreticalTeam('stars-90-bench-80', 90, 80), theoreticalTeam('stars-95-bench-85', 95, 85)],
}, null, 2))
