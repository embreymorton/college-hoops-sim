import { calculateTeamStrength, validateRotationV1 } from '../engine'
import {
  PregameScoreboard,
  RotationEditorPanel,
  TeamRosterPanel,
} from '../components'
import {
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { getNextGameForProgram } from '../season'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { describeRotationBlockingReason } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/** The Season equivalent of Pregame: manage the controlled Rotation, then play. */
export function GamePrepScreen() {
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const draftRotation = useDynastyStore((state) => state.draftRotation)
  const controlledProgramDefaultRotation = useDynastyStore(
    (state) => state.controlledProgramDefaultRotation,
  )
  const setDraftPlayerPositionMinutes = useDynastyStore(
    (state) => state.setDraftPlayerPositionMinutes,
  )
  const resetDraftRotation = useDynastyStore(
    (state) => state.resetDraftRotation,
  )
  const playScheduledGame = useDynastyStore((state) => state.playScheduledGame)
  const goToHub = useDynastyStore((state) => state.goToHub)

  if (
    !season ||
    !controlledProgramId ||
    !draftRotation ||
    !controlledProgramDefaultRotation
  ) {
    return null
  }

  const game = getNextGameForProgram(season, controlledProgramId)

  if (!game) {
    goToHub()
    return null
  }

  const isControlledHome = game.homeProgramId === controlledProgramId
  const opponentId = isControlledHome
    ? game.awayProgramId
    : game.homeProgramId
  const controlledProgram = PROGRAMS_BY_ID.get(controlledProgramId)
  const opponentProgram = PROGRAMS_BY_ID.get(opponentId)

  if (!controlledProgram || !opponentProgram) {
    return null
  }

  const controlledTeam = season.programStates[controlledProgramId]!.team
  const opponentTeam = season.programStates[opponentId]!.team
  const opponentRotation = season.programStates[opponentId]!.rotation

  const validation = validateRotationV1(controlledTeam, draftRotation)
  const isValid = validation.valid
  const controlledCurrentStrength = isValid
    ? calculateTeamStrength(controlledTeam, draftRotation)
    : null
  const controlledDefaultStrength = calculateTeamStrength(
    controlledTeam,
    controlledProgramDefaultRotation,
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

  return (
    <>
      <section className="section" aria-labelledby="game-prep-heading">
        <div className="section-heading">
          <h2 id="game-prep-heading" className="section-title">
            Round {game.round} · {isControlledHome ? 'Home' : 'Away'} vs{' '}
            {opponentTeam.name}
          </h2>
          <button
            type="button"
            className="button button--ghost"
            onClick={goToHub}
          >
            Back to Season Hub
          </button>
        </div>
        <PregameScoreboard
          home={isControlledHome ? controlledStrengthInfo : opponentStrengthInfo}
          away={isControlledHome ? opponentStrengthInfo : controlledStrengthInfo}
          onAction={playScheduledGame}
          actionDisabled={!isValid}
          actionDisabledReason={blockingReason}
        />
      </section>
      <section className="section" aria-labelledby="rotations-heading">
        <div className="section-heading">
          <h2 id="rotations-heading" className="section-title">
            Your Rotation &amp; Opponent Roster
          </h2>
          <p className="section-hint">Set your rotation, then simulate.</p>
        </div>
        <div className="matchup-panels">
          <RotationEditorPanel
            team={controlledTeam}
            defaultRotation={controlledProgramDefaultRotation}
            currentRotation={draftRotation}
            program={{ primaryColor: controlledProgram.branding.primaryColor }}
            validation={validation}
            defaultStrength={controlledDefaultStrength}
            currentStrength={controlledCurrentStrength}
            pendingStrengthReason={blockingReason}
            onSetPlayerPositionMinutes={setDraftPlayerPositionMinutes}
            onReset={resetDraftRotation}
            headingId="controlled-team-heading"
          />
          <TeamRosterPanel
            team={opponentTeam}
            rotation={opponentRotation}
            program={{ primaryColor: opponentProgram.branding.primaryColor }}
            headingId="opponent-team-heading"
          />
        </div>
      </section>
    </>
  )
}
