export type DynastySection = 'competition' | 'recruiting' | 'league'

interface DynastySectionNavProps {
  /** "Season" or "Tournament" — reflects the Dynasty's actual competition lifecycle. */
  readonly competitionLabel: string
  readonly activeSection: DynastySection
  readonly onSelectCompetition: () => void
  readonly onSelectRecruiting: () => void
  readonly onSelectLeague: () => void
}

/**
 * The permanent Dynasty section switcher — Season/Tournament, Recruiting,
 * and League — styled as a sports-management strip, not browser tabs.
 */
export function DynastySectionNav({
  competitionLabel,
  activeSection,
  onSelectCompetition,
  onSelectRecruiting,
  onSelectLeague,
}: DynastySectionNavProps) {
  return (
    <div
      className="tab-list dynasty-section-nav"
      role="group"
      aria-label="Section"
    >
      <button
        type="button"
        className="tab dynasty-section-nav__tab"
        aria-pressed={activeSection === 'competition'}
        onClick={onSelectCompetition}
      >
        {competitionLabel}
      </button>
      <button
        type="button"
        className="tab dynasty-section-nav__tab"
        aria-pressed={activeSection === 'recruiting'}
        onClick={onSelectRecruiting}
      >
        Recruiting
      </button>
      <button
        type="button"
        className="tab dynasty-section-nav__tab"
        aria-pressed={activeSection === 'league'}
        onClick={onSelectLeague}
      >
        League
      </button>
    </div>
  )
}
