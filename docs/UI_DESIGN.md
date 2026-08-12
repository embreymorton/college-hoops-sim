# UI Design

## Accepted visual direction

The implemented presentation combines modern collegiate athletics, broadcast graphics, and a management simulation. It is dark-first, competitive, serious, data-rich, and polished.

- Use condensed sports display typography with a readable data sans-serif.
- Prefer dense tables, strong hierarchy, and visually dominant scores.
- Use restrained Program accent colors; branding belongs to Universe presentation metadata rather than Team simulation state.
- Keep motion subtle and functional.
- Design desktop-first while preserving responsive narrow-screen use.
- Avoid generic SaaS dashboards, purple gradients, excessive rounded cards, huge empty whitespace, and sportsbook aesthetics.

## Primary Season experience — implemented

Program selection groups all 32 permanent Universe V0 Programs by Conference. The Season Hub is the primary product surface; Exhibition remains secondary development tooling.

```text
Season Hub
├── Matchup
│   ├── SIMULATE GAME
│   │   → Quick Sim
│   │   → remain on Hub
│   │   → inline FINAL and outcome/margin
│   │   → whole-game PTS / REB / AST leaders
│   │   → optional VIEW BOX SCORE
│   │
│   └── GAME PREP
│       → detailed matchup
│       → Rotation editing
│       → simulate
│       → Box Score
│
├── Round Progression
│   ├── Simulate Other Games / Advance to Next Round
│   └── Super Sim
│
├── Conference standings
├── Recent Results and Schedule history
└── League navigation
```

**SIMULATE GAME is the fast path. GAME PREP is the detailed path.** This distinction is intentional and should remain consistent. Quick Sim resolves the controlled game only, keeps the user on the Hub, and presents the stored final compactly. Game Prep exposes the current legal Season Rotation and deliberately opens the full Box Score after simulation.

Completed Quick Sim cards preserve HOME/AWAY and overtime context, show WIN/LOSS plus a restrained margin, and derive whole-game statistical leaders from the canonical result. Leaders may represent either Program and display their Program identity. View Box Score remains optional detail; advancement remains in the separate Round Progression card. Historical Schedule/Recent Results views never re-simulate.

Super Sim remains a confirmed secondary pacing control for Midseason (through Round 12) or End of Regular Season (through Round 24). It uses the same simulation pipeline and never enters Postseason automatically.

## Rotation and Box Score presentation

Game Prep reuses the accepted Rotation V1 Editor: five floor-position sections,
only legally eligible Players in each section, compact minute steppers, floor
and Team budgets, derived aggregate Player totals, engine-authored legality,
default/current OFF/DEF/OVR comparison, reset, and disabled simulation while
invalid. Legal secondary assignments may be made manually. A legal draft
commits to current competition state; temporary invalid drafts do not affect
Quick Sim.

Postgame and historical views use the accepted final-score and full Player box-score presentation. Historical results are read-only. Exhibition retains home-Team editing and deterministic re-simulation for isolated development testing, but it does not define the permanent Season workflow.

## Postseason experience — implemented

```text
Tournament Hub
├── Quick Sim → remain on Hub → inline result and whole-game leaders
├── Game Prep → Postseason Rotation → simulation → Box Score
├── fixed bracket and 16-Team field
├── advancement / elimination / did-not-qualify states
├── explicit round progression
└── National Champion
```

The controlled Program may be qualified/alive, eliminated, or did not qualify. These are distinct legitimate states; the wider Tournament remains simulatable after elimination or non-qualification. Tournament Quick Sim preserves NEUTRAL context and milestone language such as advancement, National Championship qualification, Tournament Run Ends, and National Champions. The bracket progressively resolves canonical participant sources and remains horizontally scrollable on narrow screens.

Postseason-specific styles live in `src/postseason.css` beside shared `src/styles.css`. React and Zustand present and orchestrate public Postseason facts; they do not recreate selection, advancement, or champion rules.

### Postseason Tournament-complete / Season-Complete composition — accepted (Phase 6E.10)

The bracket is accepted and remains unchanged. On the completed-Tournament
Hub, `hub-primary-grid` keeps its existing two-column shape, but the
lifecycle content now composes coherently instead of the Season Complete
handoff trailing as a separate full-width section:

```text
hub-primary-grid__game (left)         hub-primary-grid__recruiting (right)
├── Tournament outcome banner         ├── Recruiting summary
│   (champion / eliminated /          │   (board, needs, signed/offers)
│    did-not-qualify)                 └── "Late Recruiting is next —
└── SeasonCompleteHandoff                 this board carries forward."
    ("Season Complete" checkpoint,        (shown once the Tournament is
     Continue to Late Recruiting)          complete)
```

`SeasonCompleteHandoff` renders as a quieter sub-panel (`.season-complete-panel--secondary`)
directly beneath the Tournament outcome banner in the same column, rather than
as an isolated full-width panel below the grid. `RecruitingHubSummary` accepts
an `isSeasonComplete` flag that adds the handoff hint without introducing any
new Recruiting fact, mechanic, or persisted state. The responsive
single-column breakpoint (`≤1040px`) stacks the same content in the same
priority order: Tournament outcome, Season Complete, Recruiting, then
bracket/field. This establishes the accepted pattern for a two-tier lifecycle
banner (hero result + quieter next-step checkpoint) composing inside an
existing primary grid column rather than as a trailing full-width section.

This is presentation work only. Tournament balance/seeding is a separate
simulation diagnostic and was not touched by this milestone.

## Dynasty lifecycle and Recruiting — implemented

Regular navigation is `SEASON / RECRUITING / LEAGUE`; Tournament navigation is `TOURNAMENT / RECRUITING / LEAGUE`. The Season Hub pairs weekly competition context with Recruiting controls. Recruiting provides a Board and National Class, positional-needs ledger, PRESEASON state, and Generate Draft Board onboarding before the first period can resolve.

After the championship, the player explicitly enters the distinct Late Recruiting mode, may make final legal Board/Offer changes, and finalizes the Recruiting class. A focused Offseason turnover screen presents departures, automatic Player Development, incoming Recruits, and the next roster before the explicit Season N+1 handoff returns to the normal Hub. These screens preserve the established modern-collegiate-athletics, broadcast-graphics, management-simulation visual direction rather than introducing a separate product style.

### Recruiting battle, readiness, and commitment visibility — implemented (6E.12B)

Recruiting presents the domain's player-safe `deriveRecruitingBattleView` / `deriveRecruitingCommitmentActivity` projections (`src/dynasty/recruiting/battleView.ts`) instead of a static Board:

```text
Season Hub Recruiting column
├── SeasonHubFocusTargets (up to 3 Focused Recruits, always first)
│   ├── identity (rank, name, position, stars)
│   ├── readiness badge (Early Interest / Developing / Serious Battle /
│   │   Decision Imminent / Committed)
│   ├── standing badge (We Lead / Competitive Battle / We Trail /
│   │   Committed To Us / Committed Elsewhere)
│   ├── Offered tag when applicable
│   └── compact competitor list (Program dot + name + standing + Offer)
└── RecruitingHubSummary (existing Board/Offer/Signed facts, unchanged)

Recruiting Hub board table
└── Readiness + Battle columns (same badges/competitor list) replace the
    old bare numeric Standing column

RecruitingCommitmentAlerts (Season Hub and Postseason Hub, above the grid)
└── dismissible banner of commitment-only activity since the last
    unviewed Quick Sim / Super Sim boundary
```

Readiness and standing use restrained categorical badges (color via the existing amber-accent/ink-1/ink-2 tokens, never a percentage, progress bar, or raw score) driven by `data-readiness` / `data-position` attributes, matching the `data-status` pattern already used for Board rows. Competitor lists cap at 2–3 entries plus a "+N more" overflow rather than listing every pursuer, and always exclude the controlled Program (it is represented by the standing badge, not a self-referential competitor row).

Commitment activity is deliberately conservative: `useDynastyStore` tracks a transient `recruitingActivityBaselinePeriod` (the `recruiting.lastResolvedPeriod` value from just before an unviewed Quick Sim / Super Sim / Tournament-round simulation), not a persisted history log. It is held — not overwritten — across further quiet simulation until the player dismisses the banner or opens full Recruiting, so a no-op Quick Sim never erases an earlier unseen commitment. The banner shows only commitments the selector already proves (to the controlled Program, or to another Program for a tracked Board/Focus Recruit) and never claims standing movement, since canonical Recruiting stores no historical standing snapshots.

This is presentation-only: Board + Focus + Offer mechanics, AI Recruiting, and all existing Board/Focus/Offer/navigation actions are unchanged.

## League and Player exploration — implemented

```text
League
├── National Leaders (PPG / RPG / APG / SPG / BPG)
├── Teams directory
├── Team Details
│   ├── record
│   ├── OFF / DEF / OVR
│   ├── Team averages
│   ├── Team leaders
│   ├── recent results
│   └── roster / Player stats
└── Player Details
    ├── identity and OVR/POT summary
    ├── compact nine-attribute ratings grid
    ├── Recruiting Origin (Recruits only; omitted cleanly otherwise)
    ├── Career Progression (Season/Class/OVR/Dev/PPG/RPG/APG)
    ├── regular-season statistics
    └── chronological game log
```

Conference standings, Tournament field rows, Team rosters, national leader rows, Player game-log opponents, and Program links support cross-League Team/Player exploration with context-aware return navigation. These views consume derived regular-season projections and stable Universe identities rather than duplicating statistical state in Zustand.

### Player Details + Development History — implemented (6E.8)

Player Details now tells a Player's career story without duplicating any canonical facts. Nine current-ability ratings display as a compact three-column grid — deliberately not nine oversized cards — directly below identity/OVR/POT. Career Progression is a dense, prominent table (not a secondary tab) with one row per Season the Player is found on a roster in, current or archived: Season number, class, OVR, offseason development gain (`overall[n] − overall[n-1]`, blank for the earliest known Season), and PPG/RPG/APG. The active partial Season is included as the latest row and stays visibly partial. Recruiting Origin — star rating, national/position rank, entry OVR/POT, and signed Program — appears only for Players resolved from finalized Recruiting history and is omitted entirely, with no placeholder, for original Universe Players.

All of this is a pure read-model (`derivePlayerCareerHistory` in `src/dynasty/careerHistory.ts`) over existing archived Dynasty Season snapshots, the active Season, and finalized Recruiting history, connected by stable Player ID. It reuses the existing Player Season Stats projection for every Season, including archived ones, and introduces no new persisted career-history state. Existing current-season stats, shooting splits, game log, and Team ↔ Player navigation are unchanged.
