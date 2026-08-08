import { useGamePresentationStore } from '../store/gamePresentationStore'
import { PostgameScreen } from './PostgameScreen'
import { PregameScreen } from './PregameScreen'

export function App() {
  const phase = useGamePresentationStore((state) => state.phase)

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="wordmark">College Hoops</h1>
          <p className="app-subtitle">Exhibition / Development Matchup</p>
        </div>
      </header>
      <main className="app-main">
        {phase === 'pregame' ? <PregameScreen /> : <PostgameScreen />}
      </main>
    </div>
  )
}
