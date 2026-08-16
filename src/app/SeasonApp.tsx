import { selectControlledProgramId, useDynastyStore } from '../store'
import { RecruitingSetupDialog } from '../components'
import { CoachingScreen } from './CoachingScreen'
import { GamePrepScreen } from './GamePrepScreen'
import { HistoryScreen } from './HistoryScreen'
import { LeagueScreen } from './LeagueScreen'
import { OffseasonScreen } from './OffseasonScreen'
import { PlayerDetailsScreen } from './PlayerDetailsScreen'
import { PostseasonHubScreen } from './PostseasonHubScreen'
import { ProgramSelectScreen } from './ProgramSelectScreen'
import { RecruitingScreen } from './RecruitingScreen'
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
  const view = useDynastyStore((state) => state.view)
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

  if (!controlledProgramId) {
    return <ProgramSelectScreen />
  }

  let screen
  switch (view) {
    case 'coaching':
      screen = <CoachingScreen />
      break
    case 'gamePrep':
      screen = <GamePrepScreen />
      break
    case 'postgame':
    case 'gameHistory':
      screen = <SeasonPostgameScreen />
      break
    case 'postseasonHub':
      screen = <PostseasonHubScreen />
      break
    case 'postseasonGamePrep':
      screen = <TournamentGamePrepScreen />
      break
    case 'postseasonPostgame':
    case 'postseasonGameHistory':
      screen = <TournamentPostgameScreen />
      break
    case 'league':
      screen = <LeagueScreen />
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
      screen = <RecruitingScreen />
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
