import { useMemo } from 'react'
import { calculateTeamStrength, validateRotationV1 } from '../engine'
import {
  GamePrepRotationSection,
  MatchupScoutSection,
  PregameScoreboard,
} from '../components'
import { deriveMatchupScout } from '../matchupScout'
import {
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { getNextGameForProgram, type SeasonState } from '../season'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { deriveSimplePlayerMinutes, describeRotationBlockingReason } from './formatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

function RegularSeasonScout({
  season,
  controlledProgramId,
  opponentProgram,
  onSelectPlayer,
}: {
  readonly season: SeasonState
  readonly controlledProgramId: string
  readonly opponentProgram: ProgramDefinition
  readonly onSelectPlayer: (playerId: string) => void
}) {
  const report = useMemo(
    () => deriveMatchupScout({
      season,
      controlledProgramId,
      opponentProgramId: opponentProgram.id,
    }),
    [season, controlledProgramId, opponentProgram.id],
  )

  return (
    <MatchupScoutSection
      report={report}
      opponentAccentColor={opponentProgram.branding.primaryColor}
      programsById={PROGRAMS_BY_ID}
      onSelectPlayer={onSelectPlayer}
    />
  )
}

/** The Season equivalent of Pregame: manage the controlled Rotation, then play. */
export function GamePrepScreen() {
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const draftRotation = useDynastyStore((state) => state.draftRotation)
  const controlledProgramDefaultRotation = useDynastyStore(
    (state) => state.controlledProgramDefaultRotation,
  )
  const setDraftPlayerPositionMinutes = useDynastyStore(
    (state) => state.setCoachingDraftPlayerPositionMinutes,
  )
  const resetDraftRotation = useDynastyStore(
    (state) => state.resetCoachingDraftRotation,
  )
  const simpleMinutes = useDynastyStore((state) => state.coachingSimpleMinutesByPlayerId)
  const simplePreservedPlayerIds = useDynastyStore((state) => state.coachingSimplePreservedPlayerIds)
  const simpleIssues = useDynastyStore((state) => state.coachingSimpleRotationIssues)
  const setSimplePlayerMinutes = useDynastyStore((state) => state.setCoachingSimplePlayerMinutes)
  const fillSimpleRotation = useDynastyStore((state) => state.fillCoachingSimpleRotation)
  const applySimpleRotation = useDynastyStore((state) => state.applyCoachingSimpleRotation)
  const discardSimpleRotation = useDynastyStore((state) => state.resetCoachingSimpleRotation)
  const playScheduledGame = useDynastyStore((state) => state.playScheduledGame)
  const goToHub = useDynastyStore((state) => state.goToHub)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)

  if (
    !season ||
    !controlledProgramId ||
    !draftRotation ||
    !controlledProgramDefaultRotation ||
    !simpleMinutes
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
  const canonicalRotation = season.programStates[controlledProgramId]!.rotation

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
  const committedSimpleMinutes = deriveSimplePlayerMinutes(controlledTeam, canonicalRotation)
  const simpleIsDirty = controlledTeam.roster.some(
    (player) => (simpleMinutes[player.id] ?? 0) !== (committedSimpleMinutes[player.id] ?? 0),
  )
  const simulationBlockingReason = simpleIsDirty
    ? 'Apply or discard your Rotation changes before simulating.'
    : blockingReason

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
          actionDisabled={!isValid || simpleIsDirty}
          actionDisabledReason={simulationBlockingReason}
        />
      </section>
      <RegularSeasonScout
        season={season}
        controlledProgramId={controlledProgramId}
        opponentProgram={opponentProgram}
        onSelectPlayer={(playerId) => openPlayerDetails(opponentId, playerId)}
      />
      <GamePrepRotationSection
        headingId="rotations-heading"
        controlledTeam={controlledTeam}
        controlledProgram={{ primaryColor: controlledProgram.branding.primaryColor }}
        canonicalRotation={canonicalRotation}
        defaultRotation={controlledProgramDefaultRotation}
        draftRotation={draftRotation}
        validation={validation}
        defaultStrength={controlledDefaultStrength}
        currentStrength={controlledCurrentStrength}
        pendingStrengthReason={blockingReason}
        simpleMinutesByPlayerId={simpleMinutes}
        simplePreservedPlayerIds={simplePreservedPlayerIds}
        simpleIssues={simpleIssues}
        opponentTeam={opponentTeam}
        opponentRotation={opponentRotation}
        opponentProgram={{ primaryColor: opponentProgram.branding.primaryColor }}
        onSetSimplePlayerMinutes={setSimplePlayerMinutes}
        onFillSimple={() => { fillSimpleRotation() }}
        onApplySimple={() => { applySimpleRotation() }}
        onDiscardSimple={discardSimpleRotation}
        onSetAdvancedPlayerPositionMinutes={setDraftPlayerPositionMinutes}
        onResetAdvanced={resetDraftRotation}
        onSelectControlledPlayer={(playerId) => openPlayerDetails(controlledProgramId, playerId)}
        onSelectOpponentPlayer={(playerId) => openPlayerDetails(opponentId, playerId)}
        onViewOpponentRoster={() => openTeamDetails(opponentId)}
      />
    </>
  )
}
