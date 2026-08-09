import { calculateTeamStrength, validateRotation } from '../engine'
import {
  PregameScoreboard,
  RotationEditorPanel,
  TeamRosterPanel,
} from '../components'
import {
  getCurrentTournamentRound,
  getTournamentGameForProgram,
  resolveTournamentGameParticipants,
} from '../postseason'
import { useSeasonStore } from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { describeRotationBlockingReason } from './formatters'
import { formatSeedLabel, formatTournamentRoundName } from './postseasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** The Tournament equivalent of Game Prep: manage the Postseason Rotation, then play — always neutral site. */
export function TournamentGamePrepScreen() {
  const postseason = useSeasonStore((state) => state.postseason)
  const controlledProgramId = useSeasonStore((state) => state.controlledProgramId)
  const draftRotation = useSeasonStore((state) => state.postseasonDraftRotation)
  const controlledDefaultRotation = useSeasonStore(
    (state) => state.postseasonControlledDefaultRotation,
  )
  const setDraftPlayerMinutes = useSeasonStore(
    (state) => state.setPostseasonDraftPlayerMinutes,
  )
  const resetDraftRotation = useSeasonStore(
    (state) => state.resetPostseasonDraftRotation,
  )
  const playPostseasonScheduledGame = useSeasonStore(
    (state) => state.playPostseasonScheduledGame,
  )
  const goToPostseasonHub = useSeasonStore((state) => state.goToPostseasonHub)

  if (!postseason || !controlledProgramId || !draftRotation || !controlledDefaultRotation) {
    return null
  }

  const currentRound = getCurrentTournamentRound(postseason)
  const game =
    currentRound !== undefined
      ? getTournamentGameForProgram(postseason, controlledProgramId, currentRound)
      : undefined
  const isPending = game && postseason.resultsByGameId[game.id] === undefined

  if (!game || !isPending) {
    goToPostseasonHub()
    return null
  }

  const participants = resolveTournamentGameParticipants(postseason, game.id)!
  const opponentId =
    participants.homeProgramId === controlledProgramId
      ? participants.awayProgramId
      : participants.homeProgramId
  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)
  const opponentProgram = PROGRAMS_BY_ID.get(opponentId)

  if (!controlledProgram || !opponentProgram) {
    return null
  }

  const controlledEntry = postseason.field.find(
    (entry) => entry.programId === controlledProgramId,
  )!
  const opponentEntry = postseason.field.find(
    (entry) => entry.programId === opponentId,
  )!
  const controlledTeam = postseason.programStates[controlledProgramId]!.team
  const opponentTeam = postseason.programStates[opponentId]!.team
  const opponentRotation = postseason.programStates[opponentId]!.rotation

  const validation = validateRotation(controlledTeam, draftRotation)
  const isValid = validation.valid
  const controlledCurrentStrength = isValid
    ? calculateTeamStrength(controlledTeam, draftRotation)
    : null
  const controlledDefaultStrength = calculateTeamStrength(
    controlledTeam,
    controlledDefaultRotation,
  )
  const opponentStrength = calculateTeamStrength(opponentTeam, opponentRotation)
  const blockingReason = isValid
    ? null
    : describeRotationBlockingReason(validation)

  const controlledStrengthInfo = {
    name: controlledTeam.name,
    accentColor: controlledProgram.branding.primaryColor,
    strength: controlledCurrentStrength ?? controlledDefaultStrength,
  }
  const opponentStrengthInfo = {
    name: opponentTeam.name,
    accentColor: opponentProgram.branding.primaryColor,
    strength: opponentStrength,
  }
  const isControlledHome = participants.homeProgramId === controlledProgramId

  return (
    <>
      <section className="section" aria-labelledby="tournament-game-prep-heading">
        <div className="section-heading">
          <h2 id="tournament-game-prep-heading" className="section-title">
            {formatTournamentRoundName(game.round)} · Neutral Site vs{' '}
            {opponentTeam.name}
          </h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={goToPostseasonHub}
          >
            Back to Tournament Hub
          </button>
        </div>
        <PregameScoreboard
          home={isControlledHome ? controlledStrengthInfo : opponentStrengthInfo}
          away={isControlledHome ? opponentStrengthInfo : controlledStrengthInfo}
          homeLabel={formatSeedLabel(
            isControlledHome ? controlledEntry.seed : opponentEntry.seed,
          )}
          awayLabel={formatSeedLabel(
            isControlledHome ? opponentEntry.seed : controlledEntry.seed,
          )}
          onAction={playPostseasonScheduledGame}
          actionDisabled={!isValid}
          actionDisabledReason={blockingReason}
        />
      </section>
      <section className="section" aria-labelledby="tournament-rotations-heading">
        <div className="section-heading">
          <h2 id="tournament-rotations-heading" className="section-title">
            Your Rotation &amp; Opponent Roster
          </h2>
          <p className="section-hint">Set your rotation, then simulate.</p>
        </div>
        <div className="matchup-panels">
          <RotationEditorPanel
            team={controlledTeam}
            defaultRotation={controlledDefaultRotation}
            currentRotation={draftRotation}
            program={{ primaryColor: controlledProgram.branding.primaryColor }}
            validation={validation}
            defaultStrength={controlledDefaultStrength}
            currentStrength={controlledCurrentStrength}
            pendingStrengthReason={blockingReason}
            onSetPlayerMinutes={setDraftPlayerMinutes}
            onReset={resetDraftRotation}
            headingId="tournament-controlled-team-heading"
          />
          <TeamRosterPanel
            team={opponentTeam}
            rotation={opponentRotation}
            program={{ primaryColor: opponentProgram.branding.primaryColor }}
            headingId="tournament-opponent-team-heading"
          />
        </div>
      </section>
    </>
  )
}
