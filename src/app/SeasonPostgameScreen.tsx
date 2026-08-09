import { BoxScorePanel, FinalScoreboard } from '../components'
import {
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { getPendingGamesForRound } from '../season'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { formatOvertimeTag } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/**
 * Reuses the accepted final-score and box-score presentation for a Season
 * result in two presentation contexts, distinguished only by the Season
 * session's current `view` — never encoded into the stored `GameResult`:
 *
 * - `postgame`: the controlled Program's just-played game. Offers the
 *   round-continuation action.
 * - `gameHistory`: any completed game the coach opens from the schedule or
 *   Recent Results. Read-only — no continuation or resimulation action.
 */
export function SeasonPostgameScreen() {
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const view = useDynastyStore((state) => state.view)
  const lastPlayedGameId = useDynastyStore((state) => state.lastPlayedGameId)
  const viewedGameId = useDynastyStore((state) => state.viewedGameId)
  const simulateRestOfRound = useDynastyStore(
    (state) => state.simulateRestOfRound,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)

  const isHistorical = view === 'gameHistory'
  const scheduledGameId = isHistorical ? viewedGameId : lastPlayedGameId

  if (!season || !controlledProgramId || !scheduledGameId) {
    return null
  }

  const game = season.schedule.games.find(
    (candidate) => candidate.id === scheduledGameId,
  )
  const result = season.resultsByGameId[scheduledGameId]

  if (!game || !result) {
    return null
  }

  const homeProgram = PROGRAMS_BY_ID.get(game.homeProgramId)
  const awayProgram = PROGRAMS_BY_ID.get(game.awayProgramId)
  const homeTeam = season.programStates[game.homeProgramId]?.team
  const awayTeam = season.programStates[game.awayProgramId]?.team

  if (!homeProgram || !awayProgram || !homeTeam || !awayTeam) {
    return null
  }

  const homeIsWinner = result.winnerId === homeTeam.id
  const winnerName = homeIsWinner ? homeTeam.name : awayTeam.name

  // Pinned to the round this specific result belongs to, not the live
  // "current round" — otherwise this action would silently drift onto the
  // next round as soon as this one finishes resolving.
  const pendingRoundGames = getPendingGamesForRound(season, game.round)
  const hasSimulatableRoundGames =
    !isHistorical &&
    pendingRoundGames.some(
      (pendingGame) =>
        pendingGame.homeProgramId !== controlledProgramId &&
        pendingGame.awayProgramId !== controlledProgramId,
    )

  function continueToHub() {
    if (hasSimulatableRoundGames) {
      simulateRestOfRound()
    }

    goToHub()
  }

  return (
    <>
      <section className="section" aria-labelledby="season-final-heading">
        <h2 id="season-final-heading" className="visually-hidden">
          {isHistorical ? 'Historical result' : 'Final result'}
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
          winnerName={winnerName}
          overtimeTag={formatOvertimeTag(result.overtimePeriods)}
          roundLabel={`Round ${game.round}`}
          primaryAction={
            hasSimulatableRoundGames
              ? {
                  label: 'Simulate Rest of Round & Continue',
                  onClick: continueToHub,
                }
              : null
          }
          secondaryAction={{
            label: isHistorical ? 'Back to Season Hub' : 'Return to Season Hub',
            onClick: goToHub,
          }}
        />
      </section>
      <section className="section" aria-labelledby="season-box-score-heading">
        <div className="section-heading">
          <h2 id="season-box-score-heading" className="section-title">
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
