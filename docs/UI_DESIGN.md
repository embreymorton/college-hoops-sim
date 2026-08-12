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

### Recruiting information architecture — implemented (6E.12C, supersedes 6E.12B)

6E.12B (accepted) first exposed the domain's player-safe `deriveRecruitingBattleView` / `deriveRecruitingCommitmentActivity` projections (`src/dynasty/recruiting/battleView.ts`), but manual playtesting found the result shown in too many places at too much visual weight: a standalone Hub Focus module, a Board table carrying full battle detail, and an Alerts banner requiring explicit dismissal. 6E.12C keeps the same accepted domain projection and re-shapes only where and how much of it appears, establishing the current canonical separation of concerns:

```text
Hub      = status        (compact totals, Roster Needs, Focus targets — no competitors)
Board    = management    (Rank/Player/Stars/Ovr/Pot/Readiness/Focus/Status/Action)
Battles  = intelligence  (Recruit + our Program + competitors, in cards)
National = discovery     (unchanged)
```

```text
Season/Postseason Hub Recruiting column
└── RecruitingHubSummary — one module, no separate Focus surface
    ├── condensed overview: Class of Season N · period, a Signed/Board/Offers
    │   fact row, one Needs line
    └── Focus Targets (up to 3, composed inline, never a second Hub panel)
        ├── identity (rank, name, position, stars)
        ├── unresolved: readiness + our standing on one restrained line,
        │   plus "Needs Offer" only when active and un-offered
        └── resolved: one outcome line only (e.g. "Committed To Us"),
            not readiness + standing + outcome stacked
    (no competitor detail; no "Manage Recruiting" CTA — primary Dynasty
    navigation already exposes Recruiting)

Recruiting screen mode tabs — RecruitingModeTabs
└── Board | Battles | National Class

RecruitingBoardTable (Board mode)
└── management columns only: Rank/Player/Stars/Ovr/Pot/Readiness/Focus/
    Status/Action. A `RecruitingReadinessInfo` accessible hover/keyboard-
    focus affordance beside the Readiness heading explains the five
    categories (Early Interest/Developing/Serious Battle/Decision
    Imminent/Committed) without exposing thresholds. No Battle column, no
    competitor list — that intelligence lives on Battles.

RecruitingBattlesGrid (Battles mode)
└── one RecruitingBattleCard per Board Recruit, responsive 2-column
    desktop / 1-column ≤720px grid, sourced from `deriveBattleCardSummaries`
    + `deriveBattleGroups` over the existing selector — no new Recruiting
    facts
    ├── identity: rank/name/position/stars prominent, OVR/POT secondary
    ├── one Readiness line (no separate We Lead/Trail badge — the grouped
    │   standing below already communicates our position)
    ├── every pursuing Program — including the controlled Program — grouped
    │   under only the Leading/Competitive/Trailing headings that actually
    │   have a member, in the domain's existing deterministic order; the
    │   controlled Program is never pinned to a fixed row and appears
    │   wherever its own standing actually places it, marked `YOU` (plus
    │   Focused/Offered when applicable) beside the shared Tournament
    │   `.team-color-dot` square — not a separate circular competitor-dot
    │   language, and standing is never repeated per-row since the group
    │   heading already says it
    ├── competitors are capped with a single "+N other programs" overflow;
    │   the controlled Program is exempt from that cap and can never be
    │   pushed into the overflow count
    └── committed cards collapse to identity + one "Committed To {Program}"
        line, suppressing the unresolved battle detail

RecruitingCommitmentAlerts ("Recruiting Update", Season Hub and Postseason
Hub, above the grid)
└── compact "Recruiting Update · N Decisions" recap, no Dismiss control —
    it represents only the most recent progression/simulation action
```

Readiness uses a restrained categorical label (color via the existing amber-accent/ink-1/ink-2 tokens, never a percentage, progress bar, or raw score) driven by `data-readiness` attributes, matching the `data-status` pattern already used for Board rows. Program identity throughout Recruiting reuses the exact `.team-color-dot` square styling the Tournament bracket already uses (`src/styles.css`), not a bespoke competitor-dot treatment; the color square is the only significant Program-specific color cue; rows, names, and standing labels stay uncolored. Amber/accent stays reserved for genuine urgency (Decision Imminent, the `YOU` marker, a commitment to the controlled Program) rather than decorating every badge/tag/label at once. The Board's `RecruitingReadinessInfo` tooltip (`src/components/RecruitingReadinessInfo.tsx`) centers under its trigger and caps its width to the viewport so it cannot be clipped or pushed off-screen; below 560px it anchors to the viewport as a bottom sheet instead of the trigger.

The session store's `recruitingActivityBaselinePeriod` (`src/store/seasonStore.ts`) now always replaces — never holds — on every Quick Sim / Super Sim / Tournament-round simulation boundary, so a later quiet simulation clears an earlier unseen commitment automatically instead of requiring the removed Dismiss action; opening full Recruiting still clears it. This is session/UI behavior only.

This remains presentation-only: Board + Focus + Offer mechanics, AI Recruiting, 6E.12A's domain contract, and all existing Board/Focus/Offer/navigation actions are unchanged. Phase 6E.12D (Recruiting Battles Clarity Polish) refined only the Battles card's controlled-Program placement/labeling and the Readiness tooltip's viewport containment on top of 6E.12C's information architecture; it did not reopen the Hub/Board/National Class layers.

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
