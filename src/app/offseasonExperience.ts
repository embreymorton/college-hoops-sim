import { assembleNextSeasonRosters, type DynastyState } from '../dynasty'
import {
  deriveDevelopmentRows,
  deriveIncomingClass,
  deriveRosterAverageOverall,
} from './offseasonFormatters'

export const OFFSEASON_STAGE_IDS = [
  'late-recruiting',
  'recruiting-class',
  'departures',
  'development',
  'roster-review',
  'ready-for-season',
] as const

export type OffseasonStageId = (typeof OFFSEASON_STAGE_IDS)[number]
export type OffseasonTurnoverStage = Extract<
  OffseasonStageId,
  'departures' | 'development' | 'roster-review' | 'ready-for-season'
>
export type OffseasonReviewStage = Exclude<OffseasonStageId, 'late-recruiting'>

export interface OffseasonPresentationCursor {
  readonly offseasonKey: string
  readonly furthestStage: OffseasonTurnoverStage
  readonly viewedStage: OffseasonReviewStage
}

export type OffseasonProgressionAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'finalize-recruiting-class'; readonly label: 'Finalize Recruiting Class' }
  | { readonly kind: 'begin-dynasty-offseason'; readonly label: 'Continue to Departures' }
  | { readonly kind: 'advance-presentation'; readonly target: OffseasonTurnoverStage; readonly label: string }
  | { readonly kind: 'begin-next-season'; readonly label: string }

export interface OffseasonStageView {
  readonly id: OffseasonStageId
  readonly label: string
  readonly status: 'completed' | 'active' | 'locked'
  readonly isViewed: boolean
  readonly isFurthestUnlocked: boolean
  readonly isRevisitable: boolean
  readonly isInteractive: boolean
}

export interface OffseasonExperienceFacts {
  readonly incomingCount: number
  readonly returningCount: number
  readonly departureCount: number
  readonly developedCount: number
  readonly rosterCount: number
  readonly rosterAverageOverall: number
}

export interface OffseasonExperienceView {
  readonly offseasonKey: string
  readonly completedSeasonNumber: number
  readonly targetSeasonNumber: number
  readonly canonicalStage: OffseasonStageId
  readonly furthestUnlockedStage: OffseasonStageId
  readonly viewedStage: OffseasonStageId
  readonly stages: readonly OffseasonStageView[]
  readonly progressionAction: OffseasonProgressionAction
  readonly facts: OffseasonExperienceFacts | null
  readonly normalizedCursor: OffseasonPresentationCursor | null
}

const LABELS: Readonly<Record<OffseasonStageId, string>> = {
  'late-recruiting': 'Late Recruiting',
  'recruiting-class': 'Recruiting Class',
  departures: 'Departures',
  development: 'Development',
  'roster-review': 'Roster Review',
  'ready-for-season': 'Ready for Season',
}

const TURNOVER_STAGES: readonly OffseasonTurnoverStage[] = [
  'departures',
  'development',
  'roster-review',
  'ready-for-season',
]

export function offseasonIdentityKey(
  completedSeasonNumber: number,
  targetSeasonNumber: number,
): string {
  return `${completedSeasonNumber}:${targetSeasonNumber}`
}

function stageIndex(stage: OffseasonStageId): number {
  return OFFSEASON_STAGE_IDS.indexOf(stage)
}

function turnoverIndex(stage: OffseasonTurnoverStage): number {
  return TURNOVER_STAGES.indexOf(stage)
}

function isTurnoverStage(value: unknown): value is OffseasonTurnoverStage {
  return TURNOVER_STAGES.includes(value as OffseasonTurnoverStage)
}

function isReviewStage(value: unknown): value is OffseasonReviewStage {
  return value === 'recruiting-class' || isTurnoverStage(value)
}

function normalizeCursor(
  cursor: OffseasonPresentationCursor | null,
  offseasonKey: string,
): OffseasonPresentationCursor {
  if (
    !cursor ||
    cursor.offseasonKey !== offseasonKey ||
    !isTurnoverStage(cursor.furthestStage) ||
    !isReviewStage(cursor.viewedStage)
  ) {
    return { offseasonKey, furthestStage: 'departures', viewedStage: 'departures' }
  }
  const furthestStage = cursor.furthestStage
  const viewedStage = cursor.viewedStage === 'recruiting-class' ||
    (isTurnoverStage(cursor.viewedStage) &&
      turnoverIndex(cursor.viewedStage) <= turnoverIndex(furthestStage))
    ? cursor.viewedStage
    : furthestStage
  return { offseasonKey, furthestStage, viewedStage }
}

/**
 * Pure presentation projection over canonical Dynasty facts plus transient UI
 * intent. It never advances Recruiting, Development, roster assembly, or the
 * Dynasty lifecycle.
 */
export function deriveOffseasonExperience(
  dynasty: DynastyState,
  cursor: OffseasonPresentationCursor | null,
  perspectiveProgramId?: string,
): OffseasonExperienceView | null {
  const recruiting = dynasty.recruiting
  const activeSeasonNumber = dynasty.activeSeason?.seasonNumber
  const completedSeasonNumber = dynasty.offseason?.completedSeasonNumber ?? activeSeasonNumber
  const targetSeasonNumber = dynasty.offseason?.targetSeasonNumber ?? recruiting?.targetSeasonNumber
  if (
    completedSeasonNumber === undefined ||
    targetSeasonNumber === undefined ||
    (!dynasty.offseason && recruiting?.phase !== 'late' && recruiting?.phase !== 'finalized')
  ) return null

  const offseasonKey = offseasonIdentityKey(completedSeasonNumber, targetSeasonNumber)
  let canonicalStage: OffseasonStageId
  let furthestUnlockedStage: OffseasonStageId
  let viewedStage: OffseasonStageId
  let normalizedCursor: OffseasonPresentationCursor | null = null
  let progressionAction: OffseasonProgressionAction
  let facts: OffseasonExperienceFacts | null = null

  if (recruiting?.phase === 'late' && !dynasty.offseason) {
    canonicalStage = 'late-recruiting'
    furthestUnlockedStage = canonicalStage
    viewedStage = canonicalStage
    progressionAction = {
      kind: 'finalize-recruiting-class',
      label: 'Finalize Recruiting Class',
    }
  } else if (recruiting?.phase === 'finalized' && !dynasty.offseason) {
    canonicalStage = 'recruiting-class'
    furthestUnlockedStage = canonicalStage
    viewedStage = canonicalStage
    progressionAction = {
      kind: 'begin-dynasty-offseason',
      label: 'Continue to Departures',
    }
  } else if (dynasty.offseason) {
    const controlledProgramId = perspectiveProgramId ?? dynasty.controlledProgramId
    if (controlledProgramId === null) return null
    normalizedCursor = normalizeCursor(cursor, offseasonKey)
    canonicalStage = 'departures'
    furthestUnlockedStage = normalizedCursor.furthestStage
    viewedStage = normalizedCursor.viewedStage
    const furthestIndex = turnoverIndex(furthestUnlockedStage as OffseasonTurnoverStage)
    if (furthestIndex < TURNOVER_STAGES.length - 1) {
      const target = TURNOVER_STAGES[furthestIndex + 1]!
      progressionAction = {
        kind: 'advance-presentation',
        target,
        label: target === 'development'
          ? 'Continue to Development'
          : target === 'roster-review'
            ? 'Continue to Roster Review'
            : 'Ready for Season',
      }
    } else {
      progressionAction = {
        kind: 'begin-next-season',
        label: `Start Season ${targetSeasonNumber}`,
      }
    }

    const archive = dynasty.history.find(({ seasonNumber }) =>
      seasonNumber === completedSeasonNumber)
    const completedClass = dynasty.completedRecruitingHistory.find(
      ({ targetSeasonNumber: seasonNumber }) => seasonNumber === targetSeasonNumber,
    )
    const program = dynasty.offseason.programs[controlledProgramId]
    if (archive && completedClass && program) {
      const assembly = assembleNextSeasonRosters({
        universe: dynasty.universe,
        offseason: dynasty.offseason,
        completedRecruitingClass: completedClass,
        completedSeasonArchive: archive,
      })
      const roster = assembly.programs[controlledProgramId]?.players ?? []
      const archivedRoster = archive.postseason.programStates[controlledProgramId]
        ?.team.roster ?? archive.season.programStates[controlledProgramId]?.team.roster ?? []
      facts = {
        incomingCount: deriveIncomingClass(
          completedClass.recruitingState,
          controlledProgramId,
        ).length,
        returningCount: program.returningPlayers.length,
        departureCount: archivedRoster.filter(({ classYear }) => classYear === 'SR').length,
        developedCount: deriveDevelopmentRows(
          archive,
          controlledProgramId,
          program,
          dynasty.dynastySeed,
          dynasty.offseason.developmentExplosions,
        ).length,
        rosterCount: roster.length,
        rosterAverageOverall: deriveRosterAverageOverall(roster),
      }
    }
  } else {
    return null
  }

  const furthestIndex = stageIndex(furthestUnlockedStage)
  const stages = OFFSEASON_STAGE_IDS.map((id): OffseasonStageView => {
    const index = stageIndex(id)
    const status = index < furthestIndex
      ? 'completed'
      : index === furthestIndex
        ? 'active'
        : 'locked'
    const isRevisitable = status === 'completed' && id !== 'late-recruiting'
    return {
      id,
      label: LABELS[id],
      status,
      isViewed: id === viewedStage,
      isFurthestUnlocked: id === furthestUnlockedStage,
      isRevisitable,
      isInteractive: isRevisitable || id === furthestUnlockedStage,
    }
  })

  return {
    offseasonKey,
    completedSeasonNumber,
    targetSeasonNumber,
    canonicalStage,
    furthestUnlockedStage,
    viewedStage,
    stages,
    progressionAction,
    facts,
    normalizedCursor,
  }
}
