import {
  DynastySectionNav,
  FollowingSection,
  LeagueTeamsDirectory,
  NationalLeadersSection,
  NewsFeedSection,
} from '../components'
import { deriveNewsFeed } from '../dynasty'
import { deriveNationalPlayerLeaders } from '../season'
import {
  deriveFollowingView,
  selectActivePostseason,
  selectActiveSeason,
  selectControlledProgramId,
  useDynastyStore,
} from '../store'
import { UNIVERSE_V0, type ProgramDefinition } from '../universe'
import { HistoryScreen } from './HistoryScreen'
import { RecordsScreen } from './RecordsScreen'

const PROGRAMS_BY_ID: ReadonlyMap<string, ProgramDefinition> = new Map(
  UNIVERSE_V0.programs.map((program) => [program.id, program] as const),
)

/**
 * The League destination: national statistical leaders and the full
 * 32-Program directory. Primary Dynasty navigation already establishes
 * location (`SEASON / RECRUITING / LEAGUE`), so this root view carries no
 * separate Back action or duplicate title — only Team/Player Details, one
 * level deeper, need their own exploration Back navigation.
 */
export function LeagueScreen() {
  const tab = useDynastyStore((state) => state.leagueTab)
  const setTab = useDynastyStore((state) => state.setLeagueTab)
  const dynasty = useDynastyStore((state) => state.dynasty)
  const season = useDynastyStore(selectActiveSeason)
  const postseason = useDynastyStore(selectActivePostseason)
  const controlledProgramId = useDynastyStore(selectControlledProgramId)
  const followedPlayerIds = useDynastyStore((state) => state.followedPlayerIds)
  const goToHub = useDynastyStore((state) => state.goToHub)
  const goToPostseasonHub = useDynastyStore((state) => state.goToPostseasonHub)
  const goToCoaching = useDynastyStore((state) => state.goToCoaching)
  const goToRecruiting = useDynastyStore((state) => state.goToRecruiting)
  const goToLeague = useDynastyStore((state) => state.goToLeague)
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  const openSeasonPreview = useDynastyStore((state) => state.openSeasonPreview)
  const historyTab = useDynastyStore((state) => state.historyTab)
  const setHistoryTab = useDynastyStore((state) => state.setHistoryTab)

  if (!season || !dynasty) {
    return null
  }

  const leaderboards = deriveNationalPlayerLeaders(season)
  const followingView = deriveFollowingView(followedPlayerIds, dynasty)
  const newsFeed = deriveNewsFeed(dynasty, followedPlayerIds)

  return (
    <>
      <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="league"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectCoaching={goToCoaching}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />

      <section className="section league-screen" aria-label="League">
        <div className="league-screen__navigation">
        <div role="group" aria-label="League section" className="tab-list">
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'news'}
            onClick={() => setTab('news')}
          >
            News
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'leaders'}
            onClick={() => setTab('leaders')}
          >
            Leaders
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'teams'}
            onClick={() => setTab('teams')}
          >
            Teams
          </button>
          <button
            type="button"
            className="tab"
            aria-pressed={tab === 'following'}
            onClick={() => setTab('following')}
          >
            Following
          </button>
          <button type="button" className="tab" aria-pressed={tab === 'history'} onClick={() => setTab('history')}>History</button>
        </div>
        </div>

        {tab === 'news' ? (
          <NewsFeedSection
            feed={newsFeed}
            dynasty={dynasty}
            onSelectPlayer={openPlayerDetails}
            onSelectProgram={openTeamDetails}
            onOpenSeasonPreview={openSeasonPreview}
          />
        ) : tab === 'leaders' ? (
          <NationalLeadersSection
            leaderboards={leaderboards}
            season={season}
            programsById={PROGRAMS_BY_ID}
            onSelectPlayer={openPlayerDetails}
            onSelectProgram={openTeamDetails}
          />
        ) : tab === 'teams' ? (
          <LeagueTeamsDirectory
            universe={UNIVERSE_V0}
            season={season}
            controlledProgramId={controlledProgramId}
            onSelectProgram={openTeamDetails}
          />
        ) : tab === 'following' ? (
          <FollowingSection
            projection={followingView}
            onSelectPlayer={openPlayerDetails}
            onSelectProgram={openTeamDetails}
          />
        ) : (
          <div className="league-history">
            <div role="group" aria-label="History section" className="tab-list history-tab-list">
              <button type="button" className="tab" aria-pressed={historyTab === 'yearbooks'} onClick={() => setHistoryTab('yearbooks')}>Yearbooks</button>
              <button type="button" className="tab" aria-pressed={historyTab === 'records'} onClick={() => setHistoryTab('records')}>Records</button>
            </div>
            {historyTab === 'yearbooks' ? <HistoryScreen /> : <RecordsScreen />}
          </div>
        )}
      </section>
    </>
  )
}
