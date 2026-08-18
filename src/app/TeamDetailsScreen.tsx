import { calculateTeamStrength } from '../engine'
import {
  ExplorationBackButton,
  ProgramLegacySection,
  ProgramPrestigeHistory,
  RecentResultsSection,
  TeamAverages,
  TeamDetailsHeader,
  TeamLeadersStrip,
  TeamStatsTable,
} from '../components'
import { deriveProgramLegacy, deriveProgramPrestigeHistory } from '../dynasty'
import {
  deriveConferenceRecord,
  deriveProgramPlayerSeasonStats,
  deriveProgramRecord,
  deriveTeamSeasonStats,
  deriveTeamPlayerLeaders,
  getCompletedGamesForProgram,
} from '../season'
import {
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

const RECENT_RESULTS_COUNT = 5

/** Team Details: works for any of the 32 Programs, controlled or not. */
export function TeamDetailsScreen() {
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const selectedTeamProgramId = useDynastyStore(
    (state) => state.selectedTeamProgramId,
  )
  const explorationViewHistory = useDynastyStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useDynastyStore(
    (state) => state.goBackFromExploration,
  )
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const dynasty = useDynastyStore((state) => state.dynasty)

  if (!dynasty || !season || !selectedTeamProgramId) {
    return null
  }

  const programState = season.programStates[selectedTeamProgramId]
  const program = PROGRAMS_BY_ID.get(selectedTeamProgramId)

  if (!programState || !program) {
    return null
  }

  const conference = UNIVERSE_V0.conferences.find(
    (candidate) => candidate.id === program.conferenceId,
  )
  const overallRecord = deriveProgramRecord(season, selectedTeamProgramId)
  const conferenceRecord = deriveConferenceRecord(season, selectedTeamProgramId)
  const strength = calculateTeamStrength(programState.team, programState.rotation)
  const programLegacy = deriveProgramLegacy(dynasty, selectedTeamProgramId)
  const prestigeHistory = deriveProgramPrestigeHistory(dynasty, selectedTeamProgramId)
  const teamStats = deriveTeamSeasonStats(season, selectedTeamProgramId)
  const teamLeaders = deriveTeamPlayerLeaders(season, selectedTeamProgramId)
  const playerStats = deriveProgramPlayerSeasonStats(season, selectedTeamProgramId)
  const statsByPlayerId = new Map(
    playerStats.map((stats) => [stats.playerId, stats] as const),
  )
  const rosterNamesByPlayerId = new Map(
    programState.team.roster.map(
      (player) => [player.id, `${player.firstName} ${player.lastName}`] as const,
    ),
  )
  const backDestination = explorationViewHistory.at(-1) ?? 'hub'
  const recentGames = getCompletedGamesForProgram(season, selectedTeamProgramId)
    .slice()
    .sort(
      (first, second) =>
        second.game.round - first.game.round ||
        second.game.index - first.game.index,
    )
    .slice(0, RECENT_RESULTS_COUNT)

  return (
    <>
      <ExplorationBackButton
        destination={backDestination}
        onClick={goBackFromExploration}
      />

      <TeamDetailsHeader
        programName={program.name}
        accentColor={program.branding.primaryColor}
        conferenceName={conference?.name ?? ''}
        locationLabel={`${program.location.city}, ${program.location.stateCode}`}
        prestige={programState.team.prestige}
        isControlled={selectedTeamProgramId === controlledProgramId}
        overallRecord={overallRecord}
        conferenceRecord={conferenceRecord}
        strength={strength}
      />

      <section className="section" aria-labelledby="program-legacy-heading">
        <h2 id="program-legacy-heading" className="section-title">
          Dynasty History
        </h2>
        <ProgramPrestigeHistory history={prestigeHistory} />
        <ProgramLegacySection legacy={programLegacy} />
      </section>

      <section className="section" aria-labelledby="team-averages-heading">
        <h2 id="team-averages-heading" className="section-title">
          Team Averages
        </h2>
        <TeamAverages stats={teamStats} />
      </section>

      <section
        className="section team-details-recent-results"
        aria-labelledby="team-recent-results-heading"
      >
        <h2 id="team-recent-results-heading" className="section-title">
          Recent Results
        </h2>
        <RecentResultsSection
          games={recentGames}
          programId={selectedTeamProgramId}
          programsById={PROGRAMS_BY_ID}
        />
      </section>

      <section className="section" aria-labelledby="team-leaders-heading">
        <h2 id="team-leaders-heading" className="section-title">
          Team Leaders
        </h2>
        <TeamLeadersStrip
          leaders={teamLeaders}
          getPlayerName={(playerId) => rosterNamesByPlayerId.get(playerId) ?? playerId}
          onSelectPlayer={(playerId) => openPlayerDetails(selectedTeamProgramId, playerId)}
        />
      </section>

      <section className="section" aria-labelledby="team-roster-heading">
        <h2 id="team-roster-heading" className="section-title">
          Roster
        </h2>
        <TeamStatsTable
          team={programState.team}
          statsByPlayerId={statsByPlayerId}
          onSelectPlayer={(playerId) => openPlayerDetails(selectedTeamProgramId, playerId)}
        />
      </section>
    </>
  )
}
