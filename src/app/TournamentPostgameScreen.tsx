import { BoxScorePanel, FinalScoreboard } from '../components'
import { getPendingGamesForTournamentRound } from '../postseason'
import { selectActivePostseason, useDynastyStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { formatOvertimeTag } from './formatters'
import { formatSeedLabel, formatTournamentRoundName } from './postseasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/**
 * Reuses the accepted final-score and box-score presentation for a Tournament
 * result in two contexts, distinguished only by the session's current
 * `view` — never encoded into the stored `GameResult`:
 *
 * - `postseasonPostgame`: the controlled Program's just-played game. Offers
 *   the round-continuation action.
 * - `postseasonGameHistory`: any completed bracket game opened later.
 *   Read-only — no continuation or resimulation action.
 */
export function TournamentPostgameScreen() {
  const postseason = useDynastyStore(selectActivePostseason)
  const view = useDynastyStore((state) => state.view)
  const lastPlayedTournamentGameId = useDynastyStore(
    (state) => state.lastPlayedTournamentGameId,
  )
  const viewedTournamentGameId = useDynastyStore(
    (state) => state.viewedTournamentGameId,
  )
  const simulateRestOfCurrentTournamentRound = useDynastyStore(
    (state) => state.simulateRestOfCurrentTournamentRound,
  )
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)

  const isHistorical = view === 'postseasonGameHistory'
  const tournamentGameId = isHistorical
    ? viewedTournamentGameId
    : lastPlayedTournamentGameId

  if (!postseason || !tournamentGameId) {
    return null
  }

  const game = postseason.bracket.games.find(
    (candidate) => candidate.id === tournamentGameId,
  )
  const result = postseason.resultsByGameId[tournamentGameId]

  if (!game || !result) {
    return null
  }

  const homeProgram = PROGRAMS_BY_ID.get(result.homeTeamId)
  const awayProgram = PROGRAMS_BY_ID.get(result.awayTeamId)
  const homeTeam = postseason.programStates[result.homeTeamId]?.team
  const awayTeam = postseason.programStates[result.awayTeamId]?.team
  const homeSeed = postseason.field.find(
    (entry) => entry.programId === result.homeTeamId,
  )?.seed
  const awaySeed = postseason.field.find(
    (entry) => entry.programId === result.awayTeamId,
  )?.seed

  if (!homeProgram || !awayProgram || !homeTeam || !awayTeam) {
    return null
  }

  const homeIsWinner = result.winnerId === homeTeam.id
  const winnerName = homeIsWinner ? homeTeam.name : awayTeam.name

  const pendingRoundGames = getPendingGamesForTournamentRound(
    postseason,
    game.round,
  )
  const hasSimulatableRoundGames = !isHistorical && pendingRoundGames.length > 0

  function continueToHub() {
    if (hasSimulatableRoundGames) {
      simulateRestOfCurrentTournamentRound()
    }

    goToPostseasonHub()
  }

  return (
    <>
      <section className="section" aria-labelledby="tournament-final-heading">
        <h2 id="tournament-final-heading" className="visually-hidden">
          {isHistorical ? 'Historical Tournament result' : 'Final Tournament result'}
        </h2>
        <FinalScoreboard
          home={{
            name: homeTeam.name,
            accentColor: homeProgram.branding.primaryColor,
            score: result.homeScore,
            isWinner: homeIsWinner,
          }}
          away={{
            name: awayTeam.name,
            accentColor: awayProgram.branding.primaryColor,
            score: result.awayScore,
            isWinner: !homeIsWinner,
          }}
          homeLabel={homeSeed !== undefined ? formatSeedLabel(homeSeed) : 'Home'}
          awayLabel={awaySeed !== undefined ? formatSeedLabel(awaySeed) : 'Away'}
          winnerName={winnerName}
          overtimeTag={formatOvertimeTag(result.overtimePeriods)}
          roundLabel={`${formatTournamentRoundName(game.round)} · Neutral Site`}
          primaryAction={
            hasSimulatableRoundGames
              ? {
                  label: `Simulate Rest of ${formatTournamentRoundName(game.round)} & Continue`,
                  onClick: continueToHub,
                }
              : null
          }
          secondaryAction={{
            label: isHistorical
              ? 'Back to Tournament Hub'
              : 'Return to Tournament Hub',
            onClick: goToPostseasonHub,
          }}
        />
      </section>
      <section className="section" aria-labelledby="tournament-box-score-heading">
        <div className="section-heading">
          <h2 id="tournament-box-score-heading" className="section-title">
            Player Box Score
          </h2>
        </div>
        <BoxScorePanel
          home={{
            team: homeTeam,
            stats: result.homePlayerStats,
            program: { primaryColor: homeProgram.branding.primaryColor },
          }}
          away={{
            team: awayTeam,
            stats: result.awayPlayerStats,
            program: { primaryColor: awayProgram.branding.primaryColor },
          }}
        />
      </section>
    </>
  )
}
