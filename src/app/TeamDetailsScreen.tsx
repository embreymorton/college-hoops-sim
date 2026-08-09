import { calculateTeamStrength } from '../engine'
import {
  ExplorationBackButton,
  TeamDetailsHeader,
  TeamLeadersStrip,
  TeamStatsTable,
} from '../components'
import {
  deriveConferenceRecord,
  deriveProgramPlayerSeasonStats,
  deriveProgramRecord,
  deriveTeamPlayerLeaders,
} from '../season'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** Team Details: works for any of the 32 Programs, controlled or not. */
export function TeamDetailsScreen() {
  const season = useSeasonStore((state) => state.season)
  const controlledProgramId = useSeasonStore((state) => state.controlledProgramId)
  const selectedTeamProgramId = useSeasonStore(
    (state) => state.selectedTeamProgramId,
  )
  const explorationViewHistory = useSeasonStore(
    (state) => state.explorationViewHistory,
  )
  const goBackFromExploration = useSeasonStore(
    (state) => state.goBackFromExploration,
  )
  const openPlayerDetails = useSeasonStore((state) => state.openPlayerDetails)

  if (!season || !selectedTeamProgramId) {
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
        isControlled={selectedTeamProgramId === controlledProgramId}
        overallRecord={overallRecord}
        conferenceRecord={conferenceRecord}
        strength={strength}
      />

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
