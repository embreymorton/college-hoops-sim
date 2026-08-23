import { useMemo } from 'react'
import { calculateTeamStrength, validateRotationV1 } from '../engine'
import {
  GamePrepRotationSection,
  MatchupScoutSection,
  PregameScoreboard,
} from '../components'
import { deriveMatchupScout } from '../matchupScout'
import {
  getCurrentTournamentRound,
  getTournamentGameForProgram,
  resolveTournamentGameParticipants,
  type PostseasonState,
} from '../postseason'
import type { SeasonState } from '../season'
import {
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { deriveSimplePlayerMinutes, describeRotationBlockingReason } from './formatters'
import { formatSeedLabel, formatTournamentRoundName } from './postseasonFormatters'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

function TournamentScout({
  season,
  postseason,
  controlledProgramId,
  opponentProgram,
  onSelectPlayer,
}: {
  readonly season: SeasonState
  readonly postseason: PostseasonState
  readonly controlledProgramId: string
  readonly opponentProgram: ProgramDefinition
  readonly onSelectPlayer: (playerId: string) => void
}) {
  const report = useMemo(
    () => deriveMatchupScout({
      season,
      postseason,
      controlledProgramId,
      opponentProgramId: opponentProgram.id,
    }),
    [season, postseason, controlledProgramId, opponentProgram.id],
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

/** The Tournament equivalent of Game Prep: manage the Postseason Rotation, then play — always neutral site. */
export function TournamentGamePrepScreen() {
  const postseason = useDynastyStore(selectActivePostseason)
  const season = useDynastyStore(selectActiveSeason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const draftRotation = useDynastyStore((state) => state.postseasonDraftRotation)
  const controlledDefaultRotation = useDynastyStore(
    (state) => state.postseasonControlledDefaultRotation,
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
  const playPostseasonScheduledGame = useDynastyStore(
    (state) => state.playPostseasonScheduledGame,
  )
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)

  if (!postseason || !season || !controlledProgramId || !draftRotation || !controlledDefaultRotation || !simpleMinutes) {
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
  const canonicalRotation = postseason.programStates[controlledProgramId]!.rotation

  const validation = validateRotationV1(controlledTeam, draftRotation)
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
  const isControlledHome = participants.homeProgramId === controlledProgramId

  return (
    <>
      <section className="section game-prep-hero" aria-labelledby="tournament-game-prep-heading">
        <h2 id="tournament-game-prep-heading" className="visually-hidden">
          {formatTournamentRoundName(game.round)} · Neutral Site vs{' '}
          {opponentTeam.name}
        </h2>
        <div className="game-prep-hero__nav">
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
          actionDisabled={!isValid || simpleIsDirty}
          actionDisabledReason={simulationBlockingReason}
          contextTag={`${formatTournamentRoundName(game.round)} · Neutral Site`}
        />
      </section>
      <TournamentScout
        season={season}
        postseason={postseason}
        controlledProgramId={controlledProgramId}
        opponentProgram={opponentProgram}
        onSelectPlayer={(playerId) => openPlayerDetails(opponentId, playerId)}
      />
      <GamePrepRotationSection
        headingId="tournament-rotations-heading"
        controlledTeam={controlledTeam}
        controlledProgram={{ primaryColor: controlledProgram.branding.primaryColor }}
        canonicalRotation={canonicalRotation}
        defaultRotation={controlledDefaultRotation}
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
