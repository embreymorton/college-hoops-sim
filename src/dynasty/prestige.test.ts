import { beforeAll, describe, expect, it } from 'vitest'
import { generateRegularSeasonSchedule } from '../schedule'
import { initializeSeason, simulatePendingGamesInRound, type SeasonState } from '../season'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  type PostseasonState,
  type TournamentRound,
} from '../postseason'
import { initializeUniverse, UNIVERSE_V0 } from '../universe'
import { deriveProgramPrestigeHistory, projectProgramPrestigeUpdates } from './prestige'

let season: SeasonState
let postseason: PostseasonState

beforeAll(() => {
  let current = initializeSeason({
    universe: UNIVERSE_V0,
    initializedUniverse: initializeUniverse(UNIVERSE_V0, 'prestige-test-universe'),
    schedule: generateRegularSeasonSchedule({ universe: UNIVERSE_V0, seed: 'prestige-test-schedule' }),
    seasonNumber: 1,
  })
  for (let round = 1; round <= current.schedule.roundCount; round += 1) {
    current = simulatePendingGamesInRound({ season: current, round, simulationSeed: 'prestige-test-season' })
  }
  season = current
  let tournament = initializePostseason({ universe: UNIVERSE_V0, season })
  for (const round of ['round-of-16', 'quarterfinals', 'semifinals', 'championship'] as TournamentRound[]) {
    tournament = simulatePendingGamesInTournamentRound({ postseason: tournament, round, simulationSeed: 'prestige-test-postseason' })
  }
  postseason = tournament
})

describe('Program Prestige V1 projection', () => {
  it('derives starting, archived, current, net, and peak Prestige without stored history', () => {
    const program = UNIVERSE_V0.programs[0]!
    const archivedPrestige = season.programStates[program.id]!.team.prestige
    const currentPrestige = archivedPrestige + 3
    const activeSeason = {
      ...season,
      seasonNumber: 2,
      programStates: {
        ...season.programStates,
        [program.id]: {
          ...season.programStates[program.id]!,
          team: {
            ...season.programStates[program.id]!.team,
            prestige: currentPrestige,
          },
        },
      },
    }
    const history = deriveProgramPrestigeHistory({
      universe: UNIVERSE_V0,
      history: [{ seasonNumber: 1, season, postseason }],
      activeSeason,
      offseason: null,
    }, program.id)

    expect(history).toMatchObject({
      startingPrestige: program.basePrestige,
      currentPrestige,
      dynastyChange: currentPrestige - program.basePrestige,
      peakPrestige: currentPrestige,
    })
    expect(history.rows).toEqual([
      { label: 'Start', seasonNumber: null, prestige: program.basePrestige, change: null, current: false },
      { label: 'Season 1', seasonNumber: 1, prestige: archivedPrestige, change: archivedPrestige - program.basePrestige, current: false },
      { label: 'Season 2', seasonNumber: 2, prestige: currentPrestige, change: 3, current: true },
    ])
  })

  it('is deterministic, complete, bounded, capped, and immutable', () => {
    const beforeSeason = structuredClone(season)
    const beforePostseason = structuredClone(postseason)
    const first = projectProgramPrestigeUpdates(UNIVERSE_V0, season, postseason)
    const second = projectProgramPrestigeUpdates(UNIVERSE_V0, season, postseason)

    expect(first).toEqual(second)
    expect(first).toHaveLength(UNIVERSE_V0.programs.length)
    expect(new Set(first.map(({ programId }) => programId)).size).toBe(UNIVERSE_V0.programs.length)
    for (const update of first) {
      expect(update.newPrestige).toBeGreaterThanOrEqual(1)
      expect(update.newPrestige).toBeLessThanOrEqual(100)
      expect(Number.isInteger(update.newPrestige)).toBe(true)
      expect(Math.abs(update.change)).toBeLessThanOrEqual(3)
    }
    expect(season).toEqual(beforeSeason)
    expect(postseason).toEqual(beforePostseason)
  })

  it('uses base Prestige only as a league distribution, not Program-specific gravity', () => {
    const [first, second, ...rest] = UNIVERSE_V0.programs
    const reassignedBases = {
      ...UNIVERSE_V0,
      programs: [
        { ...first!, basePrestige: second!.basePrestige },
        { ...second!, basePrestige: first!.basePrestige },
        ...rest,
      ],
    }
    expect(projectProgramPrestigeUpdates(reassignedBases, season, postseason)).toEqual(
      projectProgramPrestigeUpdates(UNIVERSE_V0, season, postseason),
    )
  })

  it('compounds sustained strong and poor performance while one Season stays bounded', () => {
    const updates = projectProgramPrestigeUpdates(UNIVERSE_V0, season, postseason)
    const strongest = updates.find(({ effectivePerformanceRank }) => effectivePerformanceRank === 1)!
    const weakest = updates.find(({ regularSeasonRank }) => regularSeasonRank === UNIVERSE_V0.programs.length)!
    let rising = 30
    let falling = 90
    for (let year = 0; year < 10; year += 1) {
      rising += Math.min(3, Math.round(Math.abs(strongest.targetPrestige - rising) * 0.15))
      falling -= Math.min(3, Math.round(Math.abs(weakest.targetPrestige - falling) * 0.15))
    }
    expect(rising).toBeGreaterThanOrEqual(50)
    expect(falling).toBeLessThanOrEqual(70)
    expect(Math.abs(strongest.change)).toBeLessThanOrEqual(3)
  })

  it('uses Tournament advancement only to improve or preserve effective rank', () => {
    const updates = projectProgramPrestigeUpdates(UNIVERSE_V0, season, postseason)
    const qualifiers = new Set(postseason.field.map(({ programId }) => programId))
    for (const update of updates) {
      expect(update.effectivePerformanceRank).toBeLessThanOrEqual(update.regularSeasonRank)
      if (!qualifiers.has(update.programId)) {
        expect(update.effectivePerformanceRank).toBe(update.regularSeasonRank)
      }
    }
    const champion = deriveNationalChampion(postseason)!
    expect(updates.find(({ programId }) => programId === champion)!.effectivePerformanceRank).toBe(1)
  })
})
