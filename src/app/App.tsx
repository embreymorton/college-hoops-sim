import { useState } from 'react'
import { ExhibitionApp } from './ExhibitionApp'
import { SeasonApp } from './SeasonApp'

type AppMode = 'season' | 'exhibition'

/** Season Presentation is the primary experience; Exhibition remains a dev/demo sandbox. */
export function App() {
  const [mode, setMode] = useState<AppMode>('season')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="wordmark">College Hoops</h1>
          <button
            type="button"
            className="app-mode-toggle"
            onClick={() => setMode(mode === 'season' ? 'exhibition' : 'season')}
          >
            {mode === 'season' ? 'Exhibition Mode' : 'Back to Season'}
          </button>
        </div>
      </header>
      <main className="app-main">
        {mode === 'season' ? <SeasonApp /> : <ExhibitionApp />}
      </main>
    </div>
  )
}
