import { beforeAll, describe, expect, it } from 'vitest'
import type { PlayerGameStats } from '../engine'
import {
  deriveNationalChampion,
  initializePostseason,
  simulatePendingGamesInTournamentRound,
  TOURNAMENT_ROUNDS,
} from '../postseason'
import { derivePlayerSeasonStats, deriveProgramRecord, type PlayerSeasonStats } from '../season'
import { UNIVERSE_V0 } from '../universe'
import {
  AWARDS_RULES_VERSION,
  autoFinalizeRecruiting,
  beginOffseason,
  calculateRegularSeasonAwardScore,
  deriveCompletedSeasonAwards,
  deriveCompletedSeasonHonors,
  derivePlayerCareerHonors,
  deriveRegularSeasonAwards,
  deriveTournamentMostOutstandingPlayer,
  projectTournamentMostOutstandingPlayer,
  resolveDynastyPlayer,
  rolloverDynastyToNextSeason,
  syncRecruitingThroughCompletedPostseasonRounds,
  syncRecruitingThroughCompletedRounds,
  validateCompletedSeasonAwards,
  type CompletedSeasonArchive,
  type DynastyState,
} from './index'
import { completeRounds, createRecruitingDynasty } from './recruiting/testSupport'

function stats(overrides: Partial<PlayerSeasonStats> = {}): PlayerSeasonStats {
  return {
    programId: 'program', playerId: 'player', gamesPlayed: 10,
    minutes: 300, points: 100, rebounds: 50, assists: 40, steals: 10,
    blocks: 5, turnovers: 20, fieldGoalsMade: 40, fieldGoalsAttempted: 90,
    threePointersMade: 10, threePointersAttempted: 30,
    freeThrowsMade: 10, freeThrowsAttempted: 20,
    minutesPerGame: 30, pointsPerGame: 10, reboundsPerGame: 5,
    assistsPerGame: 4, stealsPerGame: 1, blocksPerGame: 0.5,
    turnoversPerGame: 2, fieldGoalPercentage: 40 / 90,
    threePointPercentage: 1 / 3, freeThrowPercentage: 0.5,
    ...overrides,
  }
}

function completeCompetition(source: DynastyState): DynastyState {
  const season = completeRounds(source.activeSeason!)
  let dynasty = syncRecruitingThroughCompletedRounds({ ...source, activeSeason: season })
  let postseason = initializePostseason({ universe: dynasty.universe, season })
  for (const round of TOURNAMENT_ROUNDS) {
    postseason = simulatePendingGamesInTournamentRound({
      postseason,
      round,
      simulationSeed: `awards-test:${season.seasonNumber}:postseason`,
    })
  }
  dynasty = syncRecruitingThroughCompletedPostseasonRounds({
    ...dynasty,
    activePostseason: postseason,
  })
  return autoFinalizeRecruiting(dynasty).dynasty
}

let offseason: DynastyState
let archive: CompletedSeasonArchive
let completedCompetition: DynastyState

beforeAll(() => {
  completedCompetition = completeCompetition(createRecruitingDynasty('awards-v1-domain'))
  offseason = beginOffseason(completedCompetition)
  archive = offseason.history[0]!
}, 30000)

describe('Awards V1 formula and eligibility', () => {
  it('implements the exact frozen production and Team-bonus formula without availability', () => {
    const result = calculateRegularSeasonAwardScore(stats(), 15, 5)
    const expectedProduction = (
      100 + 0.7 * 50 + 0.7 * 40 + 1.5 * 10 + 1.5 * 5 -
      0.7 * 20 - 0.7 * (90 - 40) - 0.3 * (20 - 10)
    ) / 10
    expect(result).toEqual({
      productionScorePerGame: expectedProduction,
      teamBonus: 1.5,
      awardScore: expectedProduction + 1.5,
    })
    expect(result).not.toHaveProperty('availabilityMultiplier')
  })

  it('uses canonical GP and a 12 MPG floor for every persisted regular-season recipient', () => {
    const regularHonors = archive.awards.honors.filter(
      ({ type }) => type !== 'tournament-most-outstanding-player',
    )
    for (const honor of regularHonors) {
      const record = deriveProgramRecord(archive.season, honor.programId)
      const row = derivePlayerSeasonStats(archive.season, honor.programId, honor.playerId)
      expect(row.gamesPlayed).toBeGreaterThanOrEqual(
        Math.ceil((record.wins + record.losses) / 2),
      )
      expect(row.minutes / row.gamesPlayed).toBeGreaterThanOrEqual(12)
      if (honor.type.includes('freshman')) {
        const player = archive.season.programStates[honor.programId]!.team.roster
          .find(({ id }) => id === honor.playerId)!
        expect(player.classYear).toBe('FR')
      }
    }
  })
})

describe('Awards V1 selection and persistence', () => {
  it('projects regular-season Awards before archiving without mutation or Tournament input', () => {
    const season = completedCompetition.activeSeason!
    const before = structuredClone(season)
    const first = deriveRegularSeasonAwards(UNIVERSE_V0, season)
    const second = deriveRegularSeasonAwards(UNIVERSE_V0, season)

    expect(first).toEqual(second)
    expect(first.honors).not.toContainEqual(
      expect.objectContaining({ type: 'tournament-most-outstanding-player' }),
    )
    expect(season).toEqual(before)
    expect(archive.awards.honors.filter(
      ({ type }) => type !== 'tournament-most-outstanding-player',
    )).toEqual(first.honors)
  })

  it('projects MOP only after the championship and persists that exact outcome', () => {
    const postseason = completedCompetition.activePostseason!
    const before = structuredClone(postseason)
    const championship = postseason.bracket.games.find(
      ({ round }) => round === 'championship',
    )!
    const beforeChampionship = structuredClone(postseason)
    delete beforeChampionship.resultsByGameId[championship.id]

    expect(projectTournamentMostOutstandingPlayer(beforeChampionship)).toBeNull()
    const projected = projectTournamentMostOutstandingPlayer(postseason)
    expect(projected).not.toBeNull()
    expect(postseason).toEqual(before)
    expect(archive.awards.honors.find(
      ({ type }) => type === 'tournament-most-outstanding-player',
    )).toEqual(projected)
  })

  it('selects the complete national, Conference, freshman, team, and MOP contract', () => {
    expect(archive.awards.rulesVersion).toBe(AWARDS_RULES_VERSION)
    const byType = (type: string) => archive.awards.honors.filter((honor) => honor.type === type)
    expect(byType('national-player-of-the-year')).toHaveLength(1)
    expect(byType('national-freshman-of-the-year')).toHaveLength(1)
    expect(byType('all-america-first-team')).toHaveLength(5)
    expect(byType('conference-player-of-the-year')).toHaveLength(4)
    expect(byType('conference-freshman-of-the-year')).toHaveLength(4)
    expect(byType('all-conference-first-team')).toHaveLength(20)
    expect(byType('tournament-most-outstanding-player')).toHaveLength(1)

    const nationalPoy = byType('national-player-of-the-year')[0]!
    expect(byType('all-america-first-team')[0]).toMatchObject({
      playerId: nationalPoy.playerId,
      programId: nationalPoy.programId,
      rank: 1,
    })
    for (const conference of UNIVERSE_V0.conferences) {
      const poy = byType('conference-player-of-the-year')
        .find(({ conferenceId }) => conferenceId === conference.id)!
      const team = byType('all-conference-first-team')
        .filter(({ conferenceId }) => conferenceId === conference.id)
      expect(team).toHaveLength(5)
      expect(team[0]).toMatchObject({ playerId: poy.playerId, rank: 1 })
      expect(new Set(team.map(({ playerId }) => playerId)).size).toBe(5)
    }
  })

  it('is deterministic and independent of Universe Program/Conference iteration order', () => {
    const direct = deriveCompletedSeasonAwards(
      UNIVERSE_V0,
      archive.season,
      archive.postseason,
    )
    const reversed = deriveCompletedSeasonAwards(
      {
        ...UNIVERSE_V0,
        programs: [...UNIVERSE_V0.programs].reverse(),
        conferences: [...UNIVERSE_V0.conferences].reverse(),
      },
      archive.season,
      archive.postseason,
    )
    expect(direct).toEqual(archive.awards)
    expect(reversed).toEqual(direct)
  })

  it('selects an eligible Champion Player from Tournament-only production', () => {
    const mop = archive.awards.honors.find(
      ({ type }) => type === 'tournament-most-outstanding-player',
    )!
    expect(mop.programId).toBe(deriveNationalChampion(archive.postseason))
    let games = 0
    let playedChampionship = false
    for (const game of archive.postseason.bracket.games) {
      const result = archive.postseason.resultsByGameId[game.id]!
      const rows = result.homeTeamId === mop.programId
        ? result.homePlayerStats
        : result.awayTeamId === mop.programId
          ? result.awayPlayerStats
          : []
      if ((rows.find(({ playerId }) => playerId === mop.playerId)?.minutes ?? 0) > 0) {
        games += 1
        if (game.round === 'championship') playedChampionship = true
      }
    }
    expect(games).toBeGreaterThanOrEqual(3)
    expect(playedChampionship).toBe(true)
  })

  it('uses aggregate, championship, minutes, then stable ID for Champion-only MOP ranking', () => {
    const postseason = structuredClone(archive.postseason)
    const championId = deriveNationalChampion(postseason)!
    const championPlayers = postseason.programStates[championId]!.team.roster
      .map(({ id }) => id)
      .sort()
    const [firstId, secondId, ineligibleId] = championPlayers
    const row = (
      playerId: string,
      points: number,
      minutes: number,
    ): PlayerGameStats => ({
      playerId, minutes, points, rebounds: 0, assists: 0, steals: 0, blocks: 0,
      turnovers: 0, fieldGoalsMade: points, fieldGoalsAttempted: points,
      threePointersMade: 0, threePointersAttempted: 0,
      freeThrowsMade: 0, freeThrowsAttempted: 0,
    })
    const championGames = postseason.bracket.games.filter((game) => {
      const result = postseason.resultsByGameId[game.id]!
      return result.homeTeamId === championId || result.awayTeamId === championId
    })
    for (const [index, game] of championGames.entries()) {
      const result = postseason.resultsByGameId[game.id]!
      const championRows = [
        row(firstId!, index === championGames.length - 1 ? 10 : 5, 20),
        row(secondId!, index === championGames.length - 1 ? 5 : index === 0 ? 10 : 5, 30),
        row(ineligibleId!, index === championGames.length - 1 ? 100 : 0, index === championGames.length - 1 ? 40 : 0),
      ]
      postseason.resultsByGameId[game.id] = {
        ...result,
        homePlayerStats: result.homeTeamId === championId
          ? championRows
          : [row('non-champion', 200, 40)],
        awayPlayerStats: result.awayTeamId === championId
          ? championRows
          : [row('non-champion', 200, 40)],
      }
    }
    // First and second tie on aggregate production. First wins on championship
    // production; the one-game 100-point Champion and non-Champion are ineligible.
    expect(deriveTournamentMostOutstandingPlayer(postseason)).toMatchObject({
      playerId: firstId,
      programId: championId,
    })

    // Equalize championship and aggregate production; second wins on minutes.
    for (const game of championGames) {
      const result = postseason.resultsByGameId[game.id]!
      const rows = (result.homeTeamId === championId
        ? result.homePlayerStats
        : result.awayPlayerStats).map((candidate) =>
        candidate.playerId === firstId ? { ...candidate, minutes: 20 } :
          candidate.playerId === secondId ? { ...candidate, minutes: 30 } : candidate,
      )
      postseason.resultsByGameId[game.id] = {
        ...result,
        homePlayerStats: result.homeTeamId === championId ? rows : result.homePlayerStats,
        awayPlayerStats: result.awayTeamId === championId ? rows : result.awayPlayerStats,
      }
    }
    // The prior construction already gives equal aggregate but unequal final;
    // align first's final with second before checking minutes.
    const final = championGames.find(({ round }) => round === 'championship')!
    const finalResult = postseason.resultsByGameId[final.id]!
    const finalRows = (finalResult.homeTeamId === championId
      ? finalResult.homePlayerStats
      : finalResult.awayPlayerStats).map((candidate) =>
      candidate.playerId === firstId ? { ...candidate, points: 5, fieldGoalsMade: 5, fieldGoalsAttempted: 5 } : candidate,
    )
    postseason.resultsByGameId[final.id] = {
      ...finalResult,
      homePlayerStats: finalResult.homeTeamId === championId ? finalRows : finalResult.homePlayerStats,
      awayPlayerStats: finalResult.awayTeamId === championId ? finalRows : finalResult.awayPlayerStats,
    }
    const opener = championGames[0]!
    const openerResult = postseason.resultsByGameId[opener.id]!
    const openerRows = (openerResult.homeTeamId === championId
      ? openerResult.homePlayerStats
      : openerResult.awayPlayerStats).map((candidate) =>
      candidate.playerId === firstId ? { ...candidate, points: 10, fieldGoalsMade: 10, fieldGoalsAttempted: 10 } : candidate,
    )
    postseason.resultsByGameId[opener.id] = {
      ...openerResult,
      homePlayerStats: openerResult.homeTeamId === championId ? openerRows : openerResult.homePlayerStats,
      awayPlayerStats: openerResult.awayTeamId === championId ? openerRows : openerResult.awayPlayerStats,
    }
    expect(deriveTournamentMostOutstandingPlayer(postseason).playerId).toBe(secondId)
  })

  it('rejects malformed versions, missing slots, duplicate slots, identity errors, and invalid MOP', () => {
    const malformed = (honors: CompletedSeasonArchive['awards']['honors']) => ({
      ...archive,
      awards: { ...archive.awards, honors },
    })
    expect(validateCompletedSeasonAwards(UNIVERSE_V0, archive).valid).toBe(true)
    expect(validateCompletedSeasonAwards(UNIVERSE_V0, {
      ...archive,
      awards: { ...archive.awards, rulesVersion: 'future' as never },
    }).issues[0]?.code).toBe('UNSUPPORTED_RULES_VERSION')
    expect(validateCompletedSeasonAwards(
      UNIVERSE_V0,
      malformed(archive.awards.honors.slice(1)),
    ).valid).toBe(false)
    expect(validateCompletedSeasonAwards(
      UNIVERSE_V0,
      malformed([...archive.awards.honors, archive.awards.honors[0]!]),
    ).valid).toBe(false)
    expect(validateCompletedSeasonAwards(
      UNIVERSE_V0,
      malformed(archive.awards.honors.map((honor, index) =>
        index === 0 ? { ...honor, playerId: 'missing-player' } : honor,
      )),
    ).valid).toBe(false)
    expect(validateCompletedSeasonAwards(
      UNIVERSE_V0,
      malformed(archive.awards.honors.map((honor) =>
        honor.type === 'tournament-most-outstanding-player'
          ? { ...honor, programId: 'pine-valley' }
          : honor,
      )),
    ).valid).toBe(false)
  })
})

describe('Awards V1 read models and lifecycle durability', () => {
  it('resolves completed identities without duplicating display facts in storage', () => {
    const projected = deriveCompletedSeasonHonors(archive, UNIVERSE_V0)
    expect(projected).toHaveLength(archive.awards.honors.length)
    expect(projected[0]).toMatchObject({
      seasonNumber: 1,
      player: { id: archive.awards.honors[0]!.playerId },
      program: { id: archive.awards.honors[0]!.programId },
      seasonStats: derivePlayerSeasonStats(
        archive.season,
        archive.awards.honors[0]!.programId,
        archive.awards.honors[0]!.playerId,
      ),
    })
    expect(archive.awards.honors[0]).not.toHaveProperty('player')
    expect(archive.awards.honors[0]).not.toHaveProperty('playerName')
    expect(archive.awards.honors[0]).not.toHaveProperty('stats')
  })

  it('survives JSON, rollover, and graduation while former-player honors remain discoverable', () => {
    const seniorHonor = archive.awards.honors.find((honor) =>
      archive.season.programStates[honor.programId]!.team.roster
        .find(({ id }) => id === honor.playerId)?.classYear === 'SR',
    )!
    expect(seniorHonor).toBeDefined()
    const before = structuredClone(archive.awards)
    const activeNextSeason = rolloverDynastyToNextSeason(offseason)
    expect(activeNextSeason.history[0]!.awards).toEqual(before)
    expect(resolveDynastyPlayer(activeNextSeason, seniorHonor.playerId).status).toBe('former')
    expect(derivePlayerCareerHonors(activeNextSeason, seniorHonor.playerId)).toEqual(
      deriveCompletedSeasonHonors(activeNextSeason.history[0]!, UNIVERSE_V0)
        .filter(({ player }) => player.id === seniorHonor.playerId),
    )
    const parsed = JSON.parse(JSON.stringify(activeNextSeason)) as DynastyState
    expect(derivePlayerCareerHonors(parsed, seniorHonor.playerId)).toEqual(
      derivePlayerCareerHonors(activeNextSeason, seniorHonor.playerId),
    )
  })
})
