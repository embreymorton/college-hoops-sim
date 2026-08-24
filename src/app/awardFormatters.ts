import type { AwardHonorType } from '../dynasty'

export const AWARD_LABELS: Readonly<Record<AwardHonorType, string>> = {
  'national-player-of-the-year': 'National Player of the Year',
  'national-freshman-of-the-year': 'National Freshman of the Year',
  'all-america-first-team': 'First Team All-America',
  'conference-player-of-the-year': 'Conference Player of the Year',
  'conference-freshman-of-the-year': 'Conference Freshman of the Year',
  'all-conference-first-team': 'First Team All-Conference',
  'tournament-most-outstanding-player': 'Tournament Most Outstanding Player',
}
