import { calculateTeamStrength, type Team, type TeamStrength } from '../engine'
import {
  ConferenceStandingsSection,
  NextGameCard,
  ScheduleTable,
  SeasonHeader,
} from '../components'
import { useSeasonStore } from '../store'
import {
  deriveConferenceRecord,
  deriveProgramRecord,
  getCurrentRound,
  getNextGameForProgram,
  getPendingGamesForRound,
  getScheduleForProgram,
  isRegularSeasonComplete,
  type SeasonState,
} from '../season'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { describeRoundProgress, formatRecord } from './seasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

function buildTeamInfo(
  season: SeasonState,
  programId: string,
  accentColor: string,
): { name: string; accentColor: string; strength: TeamStrength } {
  const programState = season.programStates[programId]
  const team = programState?.team as Team

  return {
    name: team.name,
    accentColor,
    strength: calculateTeamStrength(team, programState!.rotation),
  }
}

export function SeasonHubScreen() {
  const season = useSeasonStore((state) => state.season)
  const controlledProgramId = useSeasonStore(
    (state) => state.controlledProgramId,
  )
  const goToGamePrep = useSeasonStore((state) => state.goToGamePrep)
  const simulateRestOfRound = useSeasonStore(
    (state) => state.simulateRestOfRound,
  )

  if (!season || !controlledProgramId) {
    return null
  }

  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)
  const controlledConference = UNIVERSE_V0.conferences.find(
    (conference) => conference.id === controlledProgram?.conferenceId,
  )

  if (!controlledProgram || !controlledConference) {
    return null
  }

  const overallRecord = deriveProgramRecord(season, controlledProgramId)
  const conferenceRecord = deriveConferenceRecord(season, controlledProgramId)
  const currentRound = getCurrentRound(season)
  const seasonComplete = isRegularSeasonComplete(season)
  const nextGame = getNextGameForProgram(season, controlledProgramId)
  const pendingRoundGames =
    currentRound !== undefined
      ? getPendingGamesForRound(season, currentRound)
      : []
  const roundGameCount =
    currentRound !== undefined
      ? season.schedule.games.filter((game) => game.round === currentRound)
          .length
      : 0
  const hasSimulatableRoundGames = pendingRoundGames.some(
    (game) =>
      game.homeProgramId !== controlledProgramId &&
      game.awayProgramId !== controlledProgramId,
  )
  const opponentId = nextGame
    ? nextGame.homeProgramId === controlledProgramId
      ? nextGame.awayProgramId
      : nextGame.homeProgramId
    : undefined
  const opponentProgram = opponentId ? PROGRAMS_BY_ID.get(opponentId) : undefined
  const opponentConference = opponentProgram
    ? UNIVERSE_V0.conferences.find(
        (conference) => conference.id === opponentProgram.conferenceId,
      )
    : undefined

  return (
    <>
      <SeasonHeader
        programName={controlledProgram.name}
        accentColor={controlledProgram.branding.primaryColor}
        conferenceName={controlledConference.name}
        seasonNumber={season.seasonNumber}
        overallRecord={overallRecord}
        conferenceRecord={conferenceRecord}
        currentRound={currentRound}
        roundCount={season.schedule.roundCount}
        isComplete={seasonComplete}
      />

      <section className="section" aria-labelledby="next-game-heading">
        <h2 id="next-game-heading" className="visually-hidden">
          Next game
        </h2>
        {seasonComplete ? (
          <div className="season-complete-panel">
            <p className="eyebrow-tag">Regular Season Complete</p>
            <p className="season-complete-panel__body">
              Final record {formatRecord(overallRecord.wins, overallRecord.losses)}{' '}
              ({formatRecord(conferenceRecord.wins, conferenceRecord.losses)}{' '}
              conference).
            </p>
          </div>
        ) : (
          nextGame &&
          opponentProgram &&
          opponentConference && (
            <NextGameCard
              round={nextGame.round}
              isControlledHome={nextGame.homeProgramId === controlledProgramId}
              controlled={buildTeamInfo(
                season,
                controlledProgramId,
                controlledProgram.branding.primaryColor,
              )}
              opponent={buildTeamInfo(
                season,
                opponentProgram.id,
                opponentProgram.branding.primaryColor,
              )}
              opponentConferenceName={opponentConference.name}
              onPrepare={goToGamePrep}
            />
          )
        )}
        {currentRound !== undefined && hasSimulatableRoundGames && (
          <div className="round-progress">
            <p className="round-progress__text">
              Round {currentRound} —{' '}
              {describeRoundProgress(
                roundGameCount - pendingRoundGames.length,
                roundGameCount,
              )}
            </p>
            <button
              type="button"
              className="button button--ghost"
              onClick={simulateRestOfRound}
            >
              Simulate Rest of Round
            </button>
          </div>
        )}
      </section>

      <section className="section" aria-labelledby="standings-heading">
        <h2 id="standings-heading" className="section-title">
          Conference Standings
        </h2>
        <ConferenceStandingsSection
          universe={UNIVERSE_V0}
          season={season}
          controlledProgramId={controlledProgramId}
          defaultConferenceId={controlledProgram.conferenceId}
        />
      </section>

      <section className="section" aria-labelledby="schedule-heading">
        <h2 id="schedule-heading" className="section-title">
          Schedule &amp; Results
        </h2>
        <ScheduleTable
          games={getScheduleForProgram(season, controlledProgramId)}
          controlledProgramId={controlledProgramId}
          programsById={PROGRAMS_BY_ID}
          resultsByGameId={season.resultsByGameId}
          nextGameId={nextGame?.id}
        />
      </section>
    </>
  )
}
