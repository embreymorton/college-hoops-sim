import { selectControlledProgramId, selectPresentationProgramId, useDynastyStore } from '../store'
import { DynastyProgressionBar, RecruitingSetupDialog } from '../components'
import { deriveDynastyProgressionAction } from '../dynasty'
import { deriveOffseasonExperience } from './offseasonExperience'
import { CoachingScreen } from './CoachingScreen'
import { AwardsScreen } from './AwardsScreen'
import { GamePrepScreen } from './GamePrepScreen'
import { HistoryScreen } from './HistoryScreen'
import { LeagueScreen } from './LeagueScreen'
import { OffseasonScreen } from './OffseasonScreen'
import { PlayerDetailsScreen } from './PlayerDetailsScreen'
import { PostseasonHubScreen } from './PostseasonHubScreen'
import { ProgramSelectScreen } from './ProgramSelectScreen'
import { RecruitingScreen } from './RecruitingScreen'
import { RecruitDetailsScreen } from './RecruitDetailsScreen'
import { SeasonHubScreen } from './SeasonHubScreen'
import { SeasonPostgameScreen } from './SeasonPostgameScreen'
import { SeasonPreviewScreen } from './SeasonPreviewScreen'
import { SeasonYearbookScreen } from './SeasonYearbookScreen'
import { TeamDetailsScreen } from './TeamDetailsScreen'
import { TournamentGamePrepScreen } from './TournamentGamePrepScreen'
import { TournamentPostgameScreen } from './TournamentPostgameScreen'

/** Routes the Dynasty session across program selection, Season, and Postseason views. */
export function DynastyApp() {
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const presentationProgramId = useDynastyStore(selectPresentationProgramId)
  const view = useDynastyStore((state) => state.view)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const enterLateRecruiting = useDynastyStore((state) => state.enterLateRecruiting)
  const offseasonCursor = useDynastyStore((state) => state.offseasonPresentationCursor)
  const goToOffseason = useDynastyStore((state) => state.goToOffseason)
  const beginDynastyOffseason = useDynastyStore((state) => state.beginDynastyOffseason)
  const advanceOffseasonPresentation = useDynastyStore((state) => state.advanceOffseasonPresentation)
  const beginNextSeason = useDynastyStore((state) => state.beginNextSeason)
  const pendingRecruitingSetupIntent = useDynastyStore(
    (state) => state.pendingRecruitingSetupIntent,
  )
  const generateDraftBoardAndContinue = useDynastyStore(
    (state) => state.generateDraftBoardAndContinue,
  )
  const reviewRecruitingSetup = useDynastyStore(
    (state) => state.reviewRecruitingSetup,
  )
  const cancelRecruitingSetup = useDynastyStore(
    (state) => state.cancelRecruitingSetup,
  )

  if (!dynasty) {
    return <ProgramSelectScreen />
  }

  const isObserver = controlledProgramId === null

  const progression = dynasty
    ? deriveDynastyProgressionAction(dynasty)
    : { kind: 'none' as const }
  const progressionBar = progression.kind === 'enter-late-recruiting'
    ? <DynastyProgressionBar onContinue={enterLateRecruiting} />
    : null
  const offseasonExperience = dynasty
    ? deriveOffseasonExperience(dynasty, offseasonCursor, presentationProgramId ?? undefined)
    : null
  const runOffseasonProgression = () => {
    const action = offseasonExperience?.progressionAction
    if (!action) return
    // Finalization owns a confirmation dialog inside the dedicated shell.
    if (action.kind === 'finalize-recruiting-class') {
      goToOffseason()
      return
    }
    if (action.kind === 'begin-dynasty-offseason') beginDynastyOffseason()
    if (action.kind === 'advance-presentation') advanceOffseasonPresentation(action.target)
    if (action.kind === 'begin-next-season') beginNextSeason()
  }

  let screen
  switch (view) {
    case 'coaching':
      screen = isObserver ? <SeasonHubScreen /> : <CoachingScreen progressionBar={progressionBar} />
      break
    case 'gamePrep':
      screen = isObserver ? <SeasonHubScreen /> : <GamePrepScreen />
      break
    case 'postgame':
    case 'gameHistory':
      screen = <SeasonPostgameScreen />
      break
    case 'postseasonHub':
      screen = <PostseasonHubScreen progressionBar={progressionBar} />
      break
    case 'awards':
      screen = <AwardsScreen />
      break
    case 'postseasonGamePrep':
      screen = isObserver ? <PostseasonHubScreen progressionBar={progressionBar} /> : <TournamentGamePrepScreen />
      break
    case 'postseasonPostgame':
    case 'postseasonGameHistory':
      screen = <TournamentPostgameScreen />
      break
    case 'league':
      screen = <LeagueScreen progressionBar={progressionBar} />
      break
    case 'seasonPreview':
      screen = <SeasonPreviewScreen />
      break
    case 'history':
      screen = <HistoryScreen />
      break
    case 'seasonYearbook':
      screen = <SeasonYearbookScreen />
      break
    case 'teamDetails':
      screen = <TeamDetailsScreen />
      break
    case 'playerDetails':
      screen = <PlayerDetailsScreen />
      break
    case 'recruiting':
      screen = <RecruitingScreen progressionBar={progressionBar} />
      break
    case 'recruitDetails':
      screen = <RecruitDetailsScreen />
      break
    case 'offseason':
      screen = <OffseasonScreen />
      break
    case 'hub':
    case 'programSelect':
    default:
      screen = <SeasonHubScreen />
      break
  }

  return (
    <>
      {progressionBar &&
        view !== 'postseasonHub' &&
        view !== 'hub' &&
        view !== 'coaching' &&
        view !== 'recruiting' &&
        view !== 'league' && progressionBar}
      {offseasonExperience && view !== 'offseason' && view !== 'recruiting' && view !== 'recruitDetails' && (
        <aside className="offseason-return-bar" aria-label="Offseason progression">
          <button type="button" className="button button--ghost" onClick={goToOffseason}>
            Return to Offseason
          </button>
          {offseasonExperience.progressionAction.kind !== 'none' && (
            <button type="button" className="button button--primary" onClick={runOffseasonProgression}>
              {offseasonExperience.progressionAction.label}
            </button>
          )}
        </aside>
      )}
      {screen}
      {pendingRecruitingSetupIntent && (
        <RecruitingSetupDialog
          onGenerateAndContinue={generateDraftBoardAndContinue}
          onReviewRecruiting={reviewRecruitingSetup}
          onCancel={cancelRecruitingSetup}
        />
      )}
    </>
  )
}
