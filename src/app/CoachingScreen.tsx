import { useState, type ReactNode } from 'react'
import {
  calculateTeamStrength,
  deriveProjectedStartingFive,
  validateRotationV1,
} from '../engine'
import {
  CoachingModeTabs,
  DynastySectionNav,
  RotationEditorPanel,
  RotationModeTabs,
  SimpleRotationPanel,
  TeamDetailsHeader,
  TeamStatsTable,
  type CoachingMode,
  type RotationMode,
} from '../components'
import {
  deriveConferenceRecord,
  deriveProgramPlayerSeasonStats,
  deriveProgramRecord,
} from '../season'
import {
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { deriveSimplePlayerMinutes, describeRotationBlockingReason } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/**
 * The permanent Coaching home: inspect the controlled Program's current
 * Roster, or manage its Rotation, independent of pregame Game Prep. Reuses
 * the existing canonical Rotation editor and validated draft boundary from
 * Phase 6E.17A — Postseason takes precedence over the regular Season exactly
 * as `goToCoaching()` established.
 */
export function CoachingScreen({ progressionBar }: { readonly progressionBar?: ReactNode }) {
  const [mode, setMode] = useState<CoachingMode>('roster')
  const [rotationMode, setRotationMode] = useState<RotationMode>('simple')
  const season = useDynastyStore(selectActiveSeason)
  const postseason = useDynastyStore(selectActivePostseason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const draftRotation = useDynastyStore((state) => {
    const programId = state.dynasty?.controlledProgramId
    const hasPostseasonTeam = Boolean(
      programId && state.dynasty?.activePostseason?.programStates[programId],
    )
    return hasPostseasonTeam ? state.postseasonDraftRotation : state.draftRotation
  })
  const defaultRotation = useDynastyStore((state) => {
    const programId = state.dynasty?.controlledProgramId
    const hasPostseasonTeam = Boolean(
      programId && state.dynasty?.activePostseason?.programStates[programId],
    )
    return hasPostseasonTeam
      ? state.postseasonControlledDefaultRotation
      : state.controlledProgramDefaultRotation
  })
  const setCoachingDraftPlayerPositionMinutes = useDynastyStore(
    (state) => state.setCoachingDraftPlayerPositionMinutes,
  )
  const resetCoachingDraftRotation = useDynastyStore(
    (state) => state.resetCoachingDraftRotation,
  )
  const coachingSimpleMinutesByPlayerId = useDynastyStore(
    (state) => state.coachingSimpleMinutesByPlayerId,
  )
  const coachingSimpleRotationIssues = useDynastyStore(
    (state) => state.coachingSimpleRotationIssues,
  )
  const coachingSimplePreservedPlayerIds = useDynastyStore(
    (state) => state.coachingSimplePreservedPlayerIds,
  )
  const setCoachingSimplePlayerMinutes = useDynastyStore(
    (state) => state.setCoachingSimplePlayerMinutes,
  )
  const applyCoachingSimpleRotation = useDynastyStore(
    (state) => state.applyCoachingSimpleRotation,
  )
  const fillCoachingSimpleRotation = useDynastyStore(
    (state) => state.fillCoachingSimpleRotation,
  )
  const resetCoachingSimpleRotation = useDynastyStore(
    (state) => state.resetCoachingSimpleRotation,
  )
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToCoaching = useDynastyStore((state) => state.goToCoaching)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)

  if (
    !season ||
    !controlledProgramId ||
    !draftRotation ||
    !defaultRotation ||
    !coachingSimpleMinutesByPlayerId
  ) {
    return null
  }

  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)
  const controlledConference = UNIVERSE_V0.conferences.find(
    (conference) => conference.id === controlledProgram?.conferenceId,
  )

  if (!controlledProgram || !controlledConference) {
    return null
  }

  const postseasonControlledState = postseason?.programStates[controlledProgramId]
  const controlledSeasonState = season.programStates[controlledProgramId]
  if (!controlledSeasonState) return null
  const controlledTeam = postseasonControlledState?.team ?? controlledSeasonState.team
  const canonicalRotation =
    postseasonControlledState?.rotation ?? controlledSeasonState.rotation

  const overallRecord = deriveProgramRecord(season, controlledProgramId)
  const conferenceRecord = deriveConferenceRecord(season, controlledProgramId)
  const currentStrength = calculateTeamStrength(controlledTeam, canonicalRotation)
  const playerStats = deriveProgramPlayerSeasonStats(season, controlledProgramId)
  const statsByPlayerId = new Map(
    playerStats.map((stats) => [stats.playerId, stats] as const),
  )

  const projectedStartingFiveResult = deriveProjectedStartingFive(
    controlledTeam,
    canonicalRotation,
  )
  const projectedStartingFive = projectedStartingFiveResult.valid
    ? projectedStartingFiveResult.startingFive
    : null

  const validation = validateRotationV1(controlledTeam, draftRotation)
  const isValid = validation.valid
  const editStrength = isValid
    ? calculateTeamStrength(controlledTeam, draftRotation)
    : null
  const defaultStrength = calculateTeamStrength(controlledTeam, defaultRotation)
  const blockingReason = isValid ? null : describeRotationBlockingReason(validation)

  return (
    <div className="coaching-screen">
      <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="coaching"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectCoaching={goToCoaching}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />
      {progressionBar}

      <TeamDetailsHeader
        programName={controlledProgram.name}
        accentColor={controlledProgram.branding.primaryColor}
        conferenceName={controlledConference.name}
        isControlled
        overallRecord={overallRecord}
        conferenceRecord={conferenceRecord}
        strength={currentStrength}
      />

      <section className="section" aria-labelledby="coaching-mode-heading">
        <div className="section-heading">
          <h2 id="coaching-mode-heading" className="visually-hidden">
            Coaching mode
          </h2>
          <CoachingModeTabs mode={mode} onSelectMode={setMode} />
        </div>

        {mode === 'roster' ? (
          <TeamStatsTable
            team={controlledTeam}
            statsByPlayerId={statsByPlayerId}
            onSelectPlayer={(playerId) =>
              openPlayerDetails(controlledProgramId, playerId)
            }
          />
        ) : (
          <div className="coaching-rotation-panel">
            <div className="rotation-mode-toolbar">
              <RotationModeTabs mode={rotationMode} onSelectMode={setRotationMode} />
            </div>
            {rotationMode === 'simple' ? (
              <SimpleRotationPanel
                team={controlledTeam}
                program={{ primaryColor: controlledProgram.branding.primaryColor }}
                minutesByPlayerId={coachingSimpleMinutesByPlayerId}
                preservedPlayerIds={coachingSimplePreservedPlayerIds}
                committedMinutesByPlayerId={deriveSimplePlayerMinutes(
                  controlledTeam,
                  canonicalRotation,
                )}
                projectedStartingFive={projectedStartingFive}
                issues={coachingSimpleRotationIssues}
                onSetPlayerMinutes={setCoachingSimplePlayerMinutes}
                onFill={fillCoachingSimpleRotation}
                onApply={() => applyCoachingSimpleRotation()}
                onDiscard={resetCoachingSimpleRotation}
                onSelectPlayer={(playerId) =>
                  openPlayerDetails(controlledProgramId, playerId)
                }
                headingId="coaching-team-heading"
              />
            ) : (
              <RotationEditorPanel
                team={controlledTeam}
                defaultRotation={defaultRotation}
                currentRotation={draftRotation}
                program={{ primaryColor: controlledProgram.branding.primaryColor }}
                validation={validation}
                defaultStrength={defaultStrength}
                currentStrength={editStrength}
                pendingStrengthReason={blockingReason}
                onSetPlayerPositionMinutes={setCoachingDraftPlayerPositionMinutes}
                onReset={resetCoachingDraftRotation}
                headingId="coaching-team-heading"
              />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
