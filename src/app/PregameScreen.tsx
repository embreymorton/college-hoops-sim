import {
  PregameScoreboard,
  RotationEditorPanel,
  TeamRosterPanel,
  TeamSelect,
} from '../components'
import { useGamePresentationStore } from '../store'
import { DEMO_PROGRAMS, getDemoProgram } from '../demo/demoPrograms'
import { calculateTeamStrength, validateRotation } from '../engine'
import { describeRotationBlockingReason } from './formatters'

export function PregameScreen() {
  const homeProgramId = useGamePresentationStore((state) => state.homeProgramId)
  const awayProgramId = useGamePresentationStore((state) => state.awayProgramId)
  const homeSetup = useGamePresentationStore((state) => state.homeSetup)
  const awaySetup = useGamePresentationStore((state) => state.awaySetup)
  const homeRotation = useGamePresentationStore((state) => state.homeRotation)
  const setHomeProgram = useGamePresentationStore((state) => state.setHomeProgram)
  const setAwayProgram = useGamePresentationStore((state) => state.setAwayProgram)
  const setHomePlayerMinutes = useGamePresentationStore(
    (state) => state.setHomePlayerMinutes,
  )
  const resetHomeRotation = useGamePresentationStore(
    (state) => state.resetHomeRotation,
  )
  const simulate = useGamePresentationStore((state) => state.simulate)

  const homeProgram = getDemoProgram(homeProgramId)
  const awayProgram = getDemoProgram(awayProgramId)
  const homeOptions = DEMO_PROGRAMS.filter(
    (program) => program.id !== awayProgramId,
  )
  const awayOptions = DEMO_PROGRAMS.filter(
    (program) => program.id !== homeProgramId,
  )

  const rotationValidation = validateRotation(homeSetup.team, homeRotation)
  const isRotationValid = rotationValidation.valid
  const currentHomeStrength = isRotationValid
    ? calculateTeamStrength(homeSetup.team, homeRotation)
    : null
  const blockingReason = isRotationValid
    ? null
    : describeRotationBlockingReason(rotationValidation)

  return (
    <>
      <section className="section" aria-labelledby="matchup-heading">
        <h2 id="matchup-heading" className="visually-hidden">
          Matchup setup
        </h2>
        <div className="matchup-select-row">
          <TeamSelect
            id="home-program-select"
            label="Home Program"
            value={homeProgramId}
            options={homeOptions}
            selectedProgram={homeProgram}
            align="home"
            onChange={setHomeProgram}
          />
          <span className="matchup-select-row__divider" aria-hidden="true">
            vs
          </span>
          <TeamSelect
            id="away-program-select"
            label="Away Program"
            value={awayProgramId}
            options={awayOptions}
            selectedProgram={awayProgram}
            align="away"
            onChange={setAwayProgram}
          />
        </div>
        <PregameScoreboard
          home={{
            name: homeSetup.team.name,
            accentColor: homeProgram.primaryColor,
            strength: currentHomeStrength ?? homeSetup.strength,
          }}
          away={{
            name: awaySetup.team.name,
            accentColor: awayProgram.primaryColor,
            strength: awaySetup.strength,
          }}
          onAction={simulate}
          actionDisabled={!isRotationValid}
          actionDisabledReason={blockingReason}
        />
      </section>
      <section className="section" aria-labelledby="rosters-heading">
        <div className="section-heading">
          <h2 id="rosters-heading" className="section-title">
            Rosters &amp; Rotations
          </h2>
          <p className="section-hint">
            Set the home rotation, then simulate.
          </p>
        </div>
        <div className="matchup-panels">
          <RotationEditorPanel
            team={homeSetup.team}
            defaultRotation={homeSetup.rotation}
            currentRotation={homeRotation}
            program={homeProgram}
            validation={rotationValidation}
            defaultStrength={homeSetup.strength}
            currentStrength={currentHomeStrength}
            pendingStrengthReason={blockingReason}
            onSetPlayerMinutes={setHomePlayerMinutes}
            onReset={resetHomeRotation}
            headingId="home-team-heading"
          />
          <TeamRosterPanel
            team={awaySetup.team}
            rotation={awaySetup.rotation}
            program={awayProgram}
            headingId="away-team-heading"
          />
        </div>
      </section>
    </>
  )
}
