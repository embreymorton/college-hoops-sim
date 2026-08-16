import type { ReactNode } from 'react'
import { calculateOverall } from '../engine'
import {
  deriveSeasonPreview,
  type BiggestLeapPreview,
  type FollowedSeasonPreview,
  type FreshFacePreview,
  type ReturningStarPreview,
  type SeasonPreviewPlayerBase,
} from '../dynasty'
import { ExplorationBackButton } from '../components'
import { useDynastyStore } from '../store'
import { UNIVERSE_V0 } from '../universe'

const PROGRAM_NAMES: ReadonlyMap<string, string> = new Map(UNIVERSE_V0.programs.map((program) => [program.id, program.name]))
const PROGRAM_ACCENTS: ReadonlyMap<string, string> = new Map(UNIVERSE_V0.programs.map((program) => [program.id, program.branding.primaryColor]))

function PlayerLink({ row }: { readonly row: SeasonPreviewPlayerBase }) {
  const openPlayerDetails = useDynastyStore((state) => state.openPlayerDetails)
  return <button type="button" className="text-link-button" onClick={() => openPlayerDetails(row.programId, row.playerId)}>{row.player.firstName} {row.player.lastName}</button>
}

function ProgramLink({ row }: { readonly row: SeasonPreviewPlayerBase }) {
  const openTeamDetails = useDynastyStore((state) => state.openTeamDetails)
  return (
    <button type="button" className="text-link-button" onClick={() => openTeamDetails(row.programId)}>
      <span className="team-color-dot" style={{ background: PROGRAM_ACCENTS.get(row.programId) }} aria-hidden="true" />
      {' '}{PROGRAM_NAMES.get(row.programId) ?? row.programId}
    </button>
  )
}

interface PreviewColumn<T extends SeasonPreviewPlayerBase> {
  readonly header: string
  readonly className?: string
  readonly render: (row: T) => ReactNode
}

function playerColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'Player', className: 'player-name-cell', render: (row) => <PlayerLink row={row} /> }
}

function programColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'Program', render: (row) => <ProgramLink row={row} /> }
}

function posClassColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'Pos/Cl', className: 'player-pos-cell', render: (row) => `${row.player.position}/${row.player.classYear}` }
}

function posColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'Pos', className: 'player-pos-cell', render: (row) => row.player.position }
}

function ovrColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'OVR', render: (row) => row.currentOverall }
}

function ovrPotColumn<T extends SeasonPreviewPlayerBase>(): PreviewColumn<T> {
  return { header: 'OVR/POT', render: (row) => `${row.currentOverall}/${row.player.potential}` }
}

function signed(value: number): string { return value > 0 ? `+${value}` : String(value) }

function PreviewTable<T extends SeasonPreviewPlayerBase>({ title, rows, columns }: {
  readonly title: string
  readonly rows: readonly T[]
  readonly columns: readonly PreviewColumn<T>[]
}) {
  return (
    <section className="section season-preview-group">
      <h2 className="section-title">{title}</h2>
      <div className="season-preview-panel">
        <div className="table-scroll">
          <table className="data-table season-preview-table">
            <thead>
              <tr>{columns.map((column) => <th key={column.header} scope="col">{column.header}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId}>
                  {columns.map((column) => (
                    <td key={column.header} className={column.className}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export function SeasonPreviewScreen() {
  const dynasty = useDynastyStore((state) => state.dynasty)
  const followedPlayerIds = useDynastyStore((state) => state.followedPlayerIds)
  const explorationViewHistory = useDynastyStore((state) => state.explorationViewHistory)
  const goBackFromExploration = useDynastyStore((state) => state.goBackFromExploration)
  if (!dynasty?.activeSeason) return null

  const preview = deriveSeasonPreview(dynasty, followedPlayerIds)
  return (
    <main className="season-preview-screen">
      <ExplorationBackButton destination={explorationViewHistory.at(-1) ?? 'hub'} onClick={goBackFromExploration} />
      <header className="section season-preview-hero">
        <p className="eyebrow-tag">Season {preview.seasonNumber}</p>
        <h1 className="section-title">Season Preview</h1>
        <p className="section-hint">Meet the Players shaping the national picture before the season settles in.</p>
      </header>
      {preview.kind === 'initial' ? <>
        <PreviewTable
          title="Established Players"
          rows={preview.establishedPlayers}
          columns={[playerColumn(), programColumn(), posClassColumn(), ovrColumn()]}
        />
        <PreviewTable
          title="Freshmen to Know"
          rows={preview.freshmenToKnow}
          columns={[playerColumn(), programColumn(), posColumn(), ovrPotColumn()]}
        />
      </> : <>
        <PreviewTable
          title="Returning Stars"
          rows={preview.returningStars}
          columns={[
            playerColumn<ReturningStarPreview>(),
            programColumn<ReturningStarPreview>(),
            posClassColumn<ReturningStarPreview>(),
            ovrColumn<ReturningStarPreview>(),
            {
              header: 'Last Season',
              render: (row) => `${row.previousPointsPerGame.toFixed(1)} PPG · ${signed(row.overallChange)} OVR`,
            },
          ]}
        />
        <PreviewTable
          title="Biggest Leaps"
          rows={preview.biggestLeaps}
          columns={[
            playerColumn<BiggestLeapPreview>(),
            programColumn<BiggestLeapPreview>(),
            posClassColumn<BiggestLeapPreview>(),
            {
              header: 'OVR Change',
              render: (row) => (
                <span className="season-preview-leap">
                  <span className="season-preview-leap__path">{row.previousOverall} → {row.currentOverall}</span>
                  <span className="season-preview-leap__delta">{signed(row.overallChange)}</span>
                </span>
              ),
            },
          ]}
        />
        <PreviewTable
          title="Fresh Faces"
          rows={preview.freshFaces}
          columns={[
            playerColumn<FreshFacePreview>(),
            programColumn<FreshFacePreview>(),
            posColumn<FreshFacePreview>(),
            { header: 'Recruit', render: (row) => `${row.stars}★ · No. ${row.nationalRank}` },
            ovrPotColumn<FreshFacePreview>(),
          ]}
        />
      </>}
      {preview.followedPlayers.length > 0 ? (
        <PreviewTable
          title={preview.kind === 'initial' ? 'Your Following' : 'Following'}
          rows={preview.followedPlayers}
          columns={[
            playerColumn<FollowedSeasonPreview>(),
            programColumn<FollowedSeasonPreview>(),
            posClassColumn<FollowedSeasonPreview>(),
            {
              header: 'Context',
              render: (row) => row.kind === 'initial'
                ? `OVR ${calculateOverall(row.player)}`
                : row.kind === 'freshman'
                  ? 'Incoming freshman'
                  : `${signed(row.overallChange!)} OVR`,
            },
          ]}
        />
      ) : null}
    </main>
  )
}
