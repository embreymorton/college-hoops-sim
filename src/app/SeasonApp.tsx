import { useSeasonStore } from '../store'
import { GamePrepScreen } from './GamePrepScreen'
import { ProgramSelectScreen } from './ProgramSelectScreen'
import { SeasonHubScreen } from './SeasonHubScreen'
import { SeasonPostgameScreen } from './SeasonPostgameScreen'

/** Routes the Season session: program select, then hub/game-prep/postgame. */
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
    case 'hub':
    case 'programSelect':
    default:
      return <SeasonHubScreen />
  }
}
