import {
  DynastySectionNav,
  FollowingSection,
  LeagueHeader,
  LeagueTeamsDirectory,
  NationalLeadersSection,
  NewsFeedSection,
} from '../components'
import { deriveNewsFeed } from '../dynasty'
import { calculateTeamStrength } from '../engine'
import { formatTournamentRoundName } from './postseasonFormatters'
import { getCurrentTournamentRound, isTournamentComplete } from '../postseason'
import { deriveProgramRecord, getCurrentRound } from '../season'
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
import { RecruitingHistoryScreen } from './RecruitingHistoryScreen'

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

  const controlledProgram = controlledProgramId
    ? PROGRAMS_BY_ID.get(controlledProgramId)
    : undefined
  const controlledSeasonState = controlledProgramId
    ? season.programStates[controlledProgramId]
    : undefined
  const postseasonControlledState = controlledProgramId
    ? postseason?.programStates[controlledProgramId]
    : undefined
  const controlledTeam = postseasonControlledState?.team ?? controlledSeasonState?.team
  const canonicalRotation =
    postseasonControlledState?.rotation ?? controlledSeasonState?.rotation

  const phaseLabel = postseason
    ? isTournamentComplete(postseason)
      ? 'Postseason · Final'
      : (() => {
          const currentTournamentRound = getCurrentTournamentRound(postseason)
          return currentTournamentRound
            ? `Postseason · ${formatTournamentRoundName(currentTournamentRound)}`
            : 'Postseason'
        })()
    : (() => {
        const currentRound = getCurrentRound(season)
        return currentRound
          ? `Regular Season · Round ${currentRound} of ${season.schedule.roundCount}`
          : 'Regular Season · Complete'
      })()

  return (
    <div className="league-page">
      <DynastySectionNav
        competitionLabel={postseason ? 'Tournament' : 'Season'}
        activeSection="league"
        onSelectCompetition={postseason ? goToPostseasonHub : goToHub}
        onSelectCoaching={goToCoaching}
        onSelectRecruiting={goToRecruiting}
        onSelectLeague={goToLeague}
      />

      {controlledProgram && controlledProgramId && controlledTeam && canonicalRotation ? (
        <LeagueHeader
          seasonNumber={season.seasonNumber}
          phaseLabel={phaseLabel}
          programName={controlledProgram.name}
          accentColor={controlledProgram.branding.primaryColor}
          overallRecord={deriveProgramRecord(season, controlledProgramId)}
          overallRating={calculateTeamStrength(controlledTeam, canonicalRotation).overall}
          dynastySeed={dynasty.dynastySeed}
        />
      ) : null}

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
              <button type="button" className="tab" aria-pressed={historyTab === 'recruiting'} onClick={() => setHistoryTab('recruiting')}>Recruiting</button>
            </div>
            {historyTab === 'yearbooks' ? (
              <HistoryScreen />
            ) : historyTab === 'records' ? (
              <RecordsScreen />
            ) : (
              <RecruitingHistoryScreen />
            )}
          </div>
        )}
      </section>
    </div>
  )
}
