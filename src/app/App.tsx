import { useState } from 'react'
import { ExhibitionApp } from './ExhibitionApp'
import { DynastyApp } from './SeasonApp'

type AppMode = 'season' | 'exhibition'

/**
 * Season Presentation is the permanent product experience. Exhibition is
 * development scaffolding only — its toggle stays out of the primary
 * navigation for real users and is reachable only in development/test builds.
 */
export function App() {
  const [mode, setMode] = useState<AppMode>('season')

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header__inner">
          <h1 className="wordmark">College Hoops</h1>
          {import.meta.env.DEV && (
            <button
              type="button"
              className="app-mode-toggle"
              onClick={() =>
                setMode(mode === 'season' ? 'exhibition' : 'season')
              }
            >
              {mode === 'season' ? 'Exhibition Mode' : 'Back to Season'}
            </button>
          )}
        </div>
      </header>
      <main className="app-main">
        {mode === 'season' ? <DynastyApp /> : <ExhibitionApp />}
      </main>
    </div>
  )
}
