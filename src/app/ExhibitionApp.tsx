import { useGamePresentationStore } from '../store'
import { PostgameScreen } from './PostgameScreen'
import { PregameScreen } from './PregameScreen'

/** The original demo-program exhibition sandbox; secondary to the Season workflow. */
export function ExhibitionApp() {
  const phase = useGamePresentationStore((state) => state.phase)

  return (
    <>
      <p className="app-subtitle">Exhibition / Development Matchup</p>
      {phase === 'pregame' ? <PregameScreen /> : <PostgameScreen />}
    </>
  )
}
