import { selectControlledProgramId, useDynastyStore } from '../store'
import { GamePrepScreen } from './GamePrepScreen'
import { LeagueScreen } from './LeagueScreen'
import { PlayerDetailsScreen } from './PlayerDetailsScreen'
import { PostseasonHubScreen } from './PostseasonHubScreen'
import { ProgramSelectScreen } from './ProgramSelectScreen'
import { RecruitingScreen } from './RecruitingScreen'
import { SeasonHubScreen } from './SeasonHubScreen'
import { SeasonPostgameScreen } from './SeasonPostgameScreen'
import { TeamDetailsScreen } from './TeamDetailsScreen'
import { TournamentGamePrepScreen } from './TournamentGamePrepScreen'
import { TournamentPostgameScreen } from './TournamentPostgameScreen'

/** Routes the Dynasty session across program selection, Season, and Postseason views. */
export function DynastyApp() {
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const view = useDynastyStore((state) => state.view)

  if (!controlledProgramId) {
    return <ProgramSelectScreen />
  }

  switch (view) {
    case 'gamePrep':
      return <GamePrepScreen />
    case 'postgame':
    case 'gameHistory':
      return <SeasonPostgameScreen />
    case 'postseasonHub':
      return <PostseasonHubScreen />
    case 'postseasonGamePrep':
      return <TournamentGamePrepScreen />
    case 'postseasonPostgame':
    case 'postseasonGameHistory':
      return <TournamentPostgameScreen />
    case 'league':
      return <LeagueScreen />
    case 'teamDetails':
      return <TeamDetailsScreen />
    case 'playerDetails':
      return <PlayerDetailsScreen />
    case 'recruiting':
      return <RecruitingScreen />
    case 'hub':
    case 'programSelect':
    default:
      return <SeasonHubScreen />
  }
}
