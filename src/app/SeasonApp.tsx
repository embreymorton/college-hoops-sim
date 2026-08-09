import { useSeasonStore } from '../store'
import { GamePrepScreen } from './GamePrepScreen'
import { PostseasonHubScreen } from './PostseasonHubScreen'
import { ProgramSelectScreen } from './ProgramSelectScreen'
import { SeasonHubScreen } from './SeasonHubScreen'
import { SeasonPostgameScreen } from './SeasonPostgameScreen'
import { TournamentGamePrepScreen } from './TournamentGamePrepScreen'
import { TournamentPostgameScreen } from './TournamentPostgameScreen'

/** Routes the Season session: program select, then hub/game-prep/postgame/Postseason. */
export function SeasonApp() {
  const controlledProgramId = useSeasonStore(
    (state) => state.controlledProgramId,
  )
  const view = useSeasonStore((state) => state.view)

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
    case 'hub':
    case 'programSelect':
    default:
      return <SeasonHubScreen />
  }
}
