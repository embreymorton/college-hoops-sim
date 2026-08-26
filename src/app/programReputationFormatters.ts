import type {
  ProgramReputationFact,
  ProgramReputationTier,
  ProgramReputationTrend,
} from '../dynasty'

const TIER_LABELS: Readonly<Record<ProgramReputationTier, string>> = {
  unestablished: 'Unestablished',
  low: 'Low',
  regional: 'Regional',
  emerging: 'Emerging',
  national: 'National',
  'national-power': 'National Power',
  elite: 'Elite',
}

export function formatProgramReputationTier(tier: ProgramReputationTier): string {
  return TIER_LABELS[tier]
}

export function programReputationTrendArrow(trend: ProgramReputationTrend): string {
  if (trend === 'rising') return '↑'
  if (trend === 'falling') return '↓'
  return ''
}

export function formatProgramReputationTrend(trend: ProgramReputationTrend): string | null {
  if (trend === 'rising') return 'Rising'
  if (trend === 'falling') return 'Falling'
  if (trend === 'steady') return 'Steady'
  return null
}

function relativeSeason(seasonsAgo: number): string {
  if (seasonsAgo === 0) return 'last Season'
  if (seasonsAgo === 1) return '2 Seasons ago'
  return `${seasonsAgo + 1} Seasons ago`
}

export function formatProgramReputationFact(fact: ProgramReputationFact): string {
  switch (fact.kind) {
    case 'recent-national-championship':
      return `National Champion ${relativeSeason(fact.seasonsAgo)}`
    case 'multiple-deep-tournament-runs':
      return `${fact.count} Final Fours in the last ${fact.windowSeasons} Seasons`
    case 'consecutive-tournament-misses':
      return `Missed the Tournament in ${fact.count} straight Seasons`
    case 'consecutive-losing-seasons':
      return `${fact.count} consecutive losing Seasons`
    case 'recent-deep-tournament-run':
      return `${fact.finish === 'runner-up' ? 'National Runner-Up' : 'Final Four'} ${relativeSeason(fact.seasonsAgo)}`
    case 'repeated-tournament-appearances':
      return `${fact.count} Tournament appearances in the last ${fact.windowSeasons} Seasons`
    case 'repeated-twenty-win-seasons':
      return `${fact.count} 20-win Seasons in the last ${fact.windowSeasons} Seasons`
    case 'recent-conference-championships':
      return fact.count === 1
        ? `Conference Champion in Season ${fact.mostRecentSeasonNumber}`
        : `${fact.count} Conference championships in the last ${fact.windowSeasons} Seasons`
    case 'strong-aggregate-record':
    case 'weak-aggregate-record':
      return `${fact.wins}-${fact.losses} over the last ${fact.seasons} Seasons`
  }
}
