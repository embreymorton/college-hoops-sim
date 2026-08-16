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

## Coaching experience — implemented (6E.17B)

`DynastySectionNav` now permanently exposes `SEASON/TOURNAMENT | COACHING |
RECRUITING | LEAGUE` — Coaching sits beside the existing three destinations
using the identical tab-strip language, on the Season Hub, Postseason Hub,
Recruiting, and League screens alike. Opening it calls the side-effect-free
`goToCoaching()` from Phase 6E.17A only; it never catches up AI games,
initializes Recruiting, simulates, or progresses a lifecycle.

```text
Coaching
├── identity header (reused TeamDetailsHeader: record + live OFF/DEF/OVR)
├── Roster | Rotation (local CoachingModeTabs)
│   ├── Roster   → reused TeamStatsTable (Pos/Player/Cl/Ovr/Pot/GP/MPG/PPG/RPG/APG
│   │              + Shooting/Defense), Player click reuses openPlayerDetails
│   └── Rotation → Simple | Advanced (local RotationModeTabs, Simple default)
│       ├── Simple   → SimpleRotationPanel against coachingSimpleMinutesByPlayerId
│       └── Advanced → reused RotationEditorPanel against the Coaching draft
│                       (postseasonDraftRotation while Postseason is active,
│                       otherwise draftRotation)
```

Coaching reuses `TeamDetailsHeader` and `TeamStatsTable` unchanged — no new
Player-role concept or canonical representation was added. The Roster view's
current-season production comes from the existing
`deriveProgramPlayerSeasonStats` projection; Player Details remains the
deeper destination. `ExplorationBackButton`'s destination-label switch gained
a `coaching` case so returning from Player Details reads "Back to Coaching"
instead of falling back to the generic "Season" label.

Presentation-only fix: an invalid Rotation Player total (0–40) is now
conveyed by recoloring the existing single-line Total cell
(`.rotation-total-cell[data-invalid]`, plus a `title` and visually-hidden
explanation) instead of a second block-level line under the minute stepper,
so an invalid row no longer renders taller than its neighbors. The 0–40
validation rule itself, `RotationEditorPanel`'s other markup, and Game Prep /
Tournament Game Prep are unchanged.

## Following and Player Legacy — accepted current pattern

Player Details exposes one compact `Follow` / `Following` toggle beside Player
identity. League's local `News | Leaders | Teams | Following` navigation keeps
Following inside League rather than adding a global destination. The same
ordered stable-ID intent derives `Active Players`, `Former Players`, and a quiet
unavailable state for IDs absent from active and archived rosters.

Active rows show current Player/Program identity, class, OVR, and regular-season
rates. Former rows show final Program, position, observed Dynasty Season range,
Final OVR, and regular-season career PPG. Player and Program names reuse the
existing detail navigation. Distinct quiet states cover no follow intent, no
active Players, and unavailable IDs; unknown IDs are never mislabeled Former.

The existing Player Details destination is status-aware rather than duplicated
as an Alumni route. Former Player Details shows Former Player identity and
Follow control; an explicitly labeled `College Career · Regular Season`
summary; Final/Peak OVR without POT; Final Ratings from the latest archived
regular-season snapshot; the accepted compact Career Progression table; and
Recruiting Origin only when canonical history exists. Current statistics,
current-class treatment, and game logs remain exclusive to active Players.
Program links and exploration Back navigation reuse the accepted routes.

### Season Preview — accepted (Phase 7B.3)

Season Preview is one focused exploration destination, not a fifth League tab.
A full-width promotional card sits directly below the Season Header only in
Rounds 1–2; League News keeps a compact `Season Preview` action while an active
regular Season is retained, including Tournament play. The view uses compact,
horizontally scrollable tables for Established Players/Freshmen to Know in
Season 1 and Returning Stars/Biggest Leaps/Fresh Faces after rollover, plus an
optional Following section. Player and Program names reuse existing detail
buttons, and the exploration stack labels the return path `Season Preview`.
The 390px layout keeps page width fixed while tables scroll locally.

### Simple Rotation UI — implemented (6E.18C)

Simple is now the default Coaching Rotation editor, presenting the
`compileSimpleRotationIntent()` / Coaching Simple-draft contract (6E.18A/6E.18B)
as one row per roster Player instead of the position-bucketed Advanced table.
Advanced remains available for exact positional control and is unchanged.

```text
SimpleRotationPanel
├── budget header — "N / 200 MINUTES" + a live under/over hint
│   ("Assign N more minutes" / "Remove N minutes" / "Up to date.")
├── Discard Changes / Apply Rotation
│   (Apply enabled only at exactly 200; Discard enabled only when the
│    draft differs from the committed Rotation)
├── translated compiler issues (role="status"), e.g. infeasible positional
│   coverage → "This minute distribution can't cover every position (…).
│   Adjust the Players in your rotation or use Advanced for exact
│   positional control." — never a raw issue code
└── Rotation Players / Reserves — every roster Player exactly once, grouped
    purely by whether its current draft MPG is positive or zero; each row is
    Player · eligible position(s) · class · OVR · a MinuteStepper (reused,
    giving "Decrease/Increase {Player} minutes" accessible names for free)
```

Grouping is derived, not stored: a Player crossing zero minutes moves groups
automatically, with no reserve flag, role, or Starting Five concept. Row order
within each group is stable roster order (not MPG-sorted) so rows never jump
while a Player's own minutes are being edited. Apply/Discard call the existing
6E.18B actions (`applyCoachingSimpleRotation`/`resetCoachingSimpleRotation`)
directly — the component performs no Simple/Advanced synchronization itself,
and a successful commit is confirmed only by the quiet "Up to date." status
change, not a modal. Manual regular-season and active-Postseason acceptance
confirmed: default-to-Simple entry, edits crossing the Reserves boundary in
both directions, disabled Apply while off-200, a translated
`INFEASIBLE_POSITION_COVERAGE` failure that preserves the draft and leaves
canonical state untouched, Discard restoring committed values, and correct
Simple ⇄ Advanced sync after a successful commit in both Season and Postseason.

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
    focus affordance beside the Readiness heading explains the six accepted
    categories (Not Yet Deciding/Decision Soon/Developing/Serious
    Battle/Decision Imminent/Committed) and states readiness is a decision-
    timeline read, not a probability, without exposing periods, thresholds,
    or probabilities. No Battle column, no competitor list — that
    intelligence lives on Battles.

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

Readiness uses a restrained categorical label (color via the existing amber-accent/ink-1/ink-2 tokens, never a percentage, progress bar, or raw score) driven by `data-readiness` attributes, matching the `data-status` pattern already used for Board rows. Program identity throughout Recruiting reuses the exact `.team-color-dot` square styling the Tournament bracket already uses (`src/styles.css`), not a bespoke competitor-dot treatment; the color square is the only significant Program-specific color cue; rows, names, and standing labels stay uncolored. Amber/accent stays reserved for genuine urgency (Decision Imminent, the `YOU` marker, a commitment to the controlled Program) rather than decorating every badge/tag/label at once. The Board's `RecruitingReadinessInfo` hover/focus tooltip that lived here was retired in Phase 6E.16A — see "Recruiting Page Density + Guidance Polish" below for its replacement.

The session store's `recruitingActivityBaselinePeriod` (`src/store/seasonStore.ts`) now always replaces — never holds — on every Quick Sim / Super Sim / Tournament-round simulation boundary, so a later quiet simulation clears an earlier unseen commitment automatically instead of requiring the removed Dismiss action; opening full Recruiting still clears it. This is session/UI behavior only.

This remains presentation-only: Board + Focus + Offer mechanics, AI Recruiting, 6E.12A's domain contract, and all existing Board/Focus/Offer/navigation actions are unchanged. Phase 6E.12D (Recruiting Battles Clarity Polish) refined only the Battles card's controlled-Program placement/labeling and the Readiness tooltip's viewport containment on top of 6E.12C's information architecture; it did not reopen the Hub/Board/National Class layers.

### Recruiting Readiness — accepted six-state presentation (6E.14B-B)

Phase 6E.14B-A (domain) replaced the misleading `early` state with `not-deciding` and a narrow `decision-soon`; 6E.14B-B applies final player-facing copy and a restrained visual hierarchy across Hub, Board, and Battles without reopening any of the above architecture. The accepted labels are `Not Yet Deciding`, `Decision Soon`, `Developing`, `Serious Battle`, `Decision Imminent`, and `Committed` (`formatReadinessLabel` in `src/app/recruitingBattleFormatters.ts`), used identically on every surface. `Not Yet Deciding` deliberately reads as a decision-timeline fact ("not yet in his decision window") rather than a low-interest signal; `Decision Soon` names the real risk ("the current battle is already strong enough that a commitment next period is realistic") without predicting an outcome; `Decision Imminent` communicates urgency without naming a destination.

Visual weight forms a quiet-to-urgent ramp using only existing tokens — never a new badge color per state:

```text
Not Yet Deciding   → ink-2 (muted)
Developing         → ink-1 (unmarked default)
Serious Battle     → ink-0, weight 600 (more prominent, still uncolored)
Decision Soon      → accent, weight 600/700
Decision Imminent  → accent-strong, weight 700, plus the badge's only marker glyph
Committed          → accent (existing outcome treatment)
```

On the Board, this stays column-width-neutral (color/weight only, no chip). On the Season/Postseason Hub's Focus Targets, `Decision Soon` and `Decision Imminent` additionally get a thin left-edge accent bar on the row so they read as scan-stoppers next to ordinary rows — every other state stays flush. On a Battles card, `Decision Soon`/`Decision Imminent` also tint the card's border, and readiness stays positioned above the grouped Leading/Competitive/Trailing standing, never duplicating it. `Early Interest` no longer appears anywhere in the current UI. (The per-state readiness explanation described here now lives in the Recruiting Guide tab — see 6E.16A below — rather than a Board tooltip.)

### Recruiting Page Density + Guidance Polish — implemented (6E.16A)

Manual playtesting found the Recruiting page's top-of-page vertical rhythm excessive (large default `.app-main` gaps between the Dynasty section nav, Recruiting header, Positional Needs, and mode tabs), the Positional Needs table visually heavier than its importance warranted, the Board count duplicated (once in Positional Needs, again beside Fill Remaining Board), and Readiness help outgrowing a single tooltip. Phase 6E.16A is presentation/information-architecture only — Board = management, Battles = intelligence, National Class = discovery are unchanged, and no Recruiting mechanic moved.

A new `.recruiting-screen` wrapper (`src/app/RecruitingScreen.tsx`) gives the Recruiting screen its own tightened local vertical rhythm (`gap: var(--space-4)`) instead of `.app-main`'s default `var(--space-7)`; this is scoped to the Recruiting screen only and does not change spacing anywhere else. `RecruitingNeedsLedger`'s five-row Board/Signed/Offers-by-position matrix is replaced by `RecruitingOverview` (`src/components/RecruitingOverview.tsx`): one compact bar showing Board, Signed, Openings, and Offers as small horizontal stat groups, plus a single concise `Needs` line (`PG 1 · C 1`, or "All positions filled") rather than a per-position table. The Board tab's action row no longer repeats the Board count beside Fill Remaining Board, since the Overview above it is the count's one home.

`RecruitingModeTabs` gained a fourth `Guide` mode alongside Board/Battles/National Class. `RecruitingGuide` (`src/components/RecruitingGuide.tsx`) is the canonical in-app explanation destination: short player-facing sections for Board, Focus, Offers, all six Readiness states (identical categorical language to the retired tooltip — never periods, thresholds, relationship totals, or probabilities), and Leading/Competitive/Trailing battle standing (pointing to the Battles tab for Program-by-Program detail). The Board's `RecruitingReadinessInfo` hover/focus tooltip and its `.info-affordance` styling are retired now that Guide owns this content permanently; the Board's `Readiness` column header is a plain label. The scattered "Board targets receive normal recruiting effort..." helper line that used to sit beneath Positional Needs is also removed, since Guide now owns it.

Late Recruiting's zero-openings state no longer warns that "remaining openings will be resolved automatically" when there are none to resolve: `RecruitingScreen` now branches on `totals.remainingTotal`, showing a quiet "Recruiting Class Complete — All projected roster openings are filled." message instead, while the non-zero-openings warning is unchanged. `RecruitingFinalizationDialog` takes a `remainingOpenings` prop and drops its own auto-resolution sentence the same way when openings are already zero; Finalize Class remains the same action either way. Battles and National Class compose unchanged under the new page rhythm.

As a small adjacent cleanup, `RecruitingScreen`'s Board action row now hides `Fill Remaining Board` outright (not merely disables it) once the Board is already at capacity — the control has no purpose with zero empty slots, and `Fill Remaining Board` itself is unchanged for a partial Board.

### Season Hub + League Information Hierarchy Polish — implemented (6E.16B)

Manual playtesting after 6E.16A found the same category of friction one level up: excess vertical space below the Dynasty nav before primary Hub content; a Quick Sim result card that visibly resized the Hub and pushed `Advance to Next Round`/`Super Sim` down after every game; oversized, awkward completed-game stat presentation; an unresolved-Focus-target list mixed with signed commitments; a Recruiting Update recap that read as a detached top-level alert; Hub Conference standings exposing a league-wide switcher the controlled coach rarely needs; and redundant root League chrome (a Back button and a duplicate `League` heading) on top of primary Dynasty navigation that already establishes location. Phase 6E.16B is presentation/information-architecture only, landed in two manual-play passes; no simulation, Recruiting, League, or Postseason mechanic changed.

**Season Hub rhythm.** A new `.season-hub` wrapper (`src/app/SeasonHubScreen.tsx`, mirrored in `PostseasonHubScreen.tsx`) gives the Hub its own tightened local vertical rhythm (`gap: var(--space-4)`), scoped to the Hub only — `.app-main`'s default spacing is unchanged everywhere else.

**Stable pregame/completed-game card shell.** `NextGameCard` and `CompletedMatchupCard` share the same `.next-game-card` shell and, at desktop widths (`min-width: 641px`), a shared `min-height: 21rem` floor sized to the completed-game state's own natural content height. A follow-up visual pass replaced the completed state's single narrow stacked column (which left the wide desktop shell mostly empty on the right) with a two-region `.next-game-card__final-body` grid: the scoreboard (`.next-game-card__final-scores`) on the left, Game Leaders (`.game-leaders`) on the right, separated by a vertical rule, with `View Box Score` centered below spanning both. The scoreboard rows are content-hugged (`grid-template-columns: auto auto auto`, `align-items: flex-start`) rather than stretched across the column, and both the Team name and the final score are set in large bold display type (`.next-game-card__final-name` at `2.2rem`, `.next-game-card__final-score` at `2.6rem`) using each Team's existing `abbreviation` (e.g. `CTU`) instead of its full name — the full name stays available via a `title` attribute on the row plus a `.visually-hidden` span for accessibility. Game Leaders is a dense row strip (`.game-leaders__list` / `.game-leaders__row`, one line per stat: `PTS 27 · Mason Webb`) with no per-row divider lines (spacing alone carries the rhythm) and larger stat type (`.game-leaders__value` at `1.7rem`); it states a leader's Program abbreviation (with its `.team-color-dot`) once beside the "Game Leaders" heading instead of on every row whenever all three leaders belong to the same Team (`CompletedMatchupCard`'s `sharedTeamName` check) — falling back to a per-row Program tag only when leaders actually span multiple Teams, so identity is never lost. Net effect, verified by direct pixel measurement at desktop width: the `round-progress` row's vertical position is identical before and after Quick Sim, so `Advance to Next Round`/`Super Sim` never move. Narrow widths (`≤900px`) stack the two regions (scoreboard, then Game Leaders, then Box Score) instead of forcing the two-column layout, and are exempt from the shared floor below `641px` — natural growth there is expected and accepted.

**Hub Recruiting — Focus vs. Commits vs. Update.** `deriveFocusTargetSummaries` (`src/app/recruitingBattleFormatters.ts`) now filters Focused Board targets to `status === 'active'` only, so a Recruit who has resolved (committed to the controlled Program, committed elsewhere, or position-filled) no longer lingers as an unresolved Focus Target. A new `deriveHubCommitSummaries` selector projects every `status === 'committed'` Board target into a compact `Commits` list rendered by `RecruitingHubSummary` directly beneath Focus Targets. The `Recruiting Update` recap (`RecruitingCommitmentAlerts`) now renders *inside* `RecruitingHubSummary` (`activity` prop) instead of as a separate top-level card the Hub screens rendered beside `hub-primary-grid`; its accepted session semantics (`recruitingActivityBaselinePeriod` always replaces, never holds) are unchanged, and it restyles to a quiet inline block — a left accent bar and a bottom rule, no background or full border box — so it reads as integrated rather than a second hero surface. The old single-recruit "New Commitment" line and `deriveRecentControlledCommitment` are retired; the new Commits list supersedes it by showing every signed Recruit, not just the most recent. Focus Target rows also dropped their permanently reserved left gutter (a `padding-left` + transparent `border-left` every row paid for, accented or not): `Decision Soon`/`Decision Imminent` now get a `::before` accent bar positioned in the panel's own padding via negative offset, so unaccented rows sit flush with the rest of the module and accented rows still scan-stop.

**Hub standings + Recent Results.** `ConferenceStandingsSection` dropped its Conference-switching tabs — the Hub shows only the controlled Program's own Conference standings, and its heading now names that Conference (`"{Conference name} Standings"`, e.g. "Southern Crescent Conference Standings") instead of a generic label. A new `.hub-secondary-grid` composes Conference Standings and Recent Results side by side on desktop (`≥901px`) and stacks them on narrower widths. League → Teams remains the sole league-wide Conference destination; no Conference Standings League tab was added.

**Root League cleanup.** `LeagueScreen`'s root view dropped its `ExplorationBackButton` and visible `League` `<h1>` — primary Dynasty navigation (`SEASON / RECRUITING / LEAGUE`) already establishes location, so `Leaders | Teams` now sits directly beneath the nav with no redundant chrome. Team Details and Player Details, one level deeper, keep their own `ExplorationBackButton` Back navigation untouched.

Postseason Hub inherits every shared-component change above (`CompletedMatchupCard`, `RecruitingHubSummary`, `RecruitingCommitmentAlerts`) automatically and was manually re-verified; the Postseason bracket, matchup/status banners, and outcome composition accepted in 6E.10 are unchanged.

## League and Player exploration — implemented

```text
League
├── News / Around the Country (default)
│   └── Season Preview retrieval action
├── National Leaders (PPG / RPG / APG / SPG / BPG)
├── Teams directory
├── Following
│   ├── Active Players
│   └── Former Players / unavailable IDs
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

Around the Country is a compact vertical feed grouped by newest fully completed
round. Each story has a restrained type label, linked entity headline, and one
supporting stat line; Followed Players receive a quiet marker without changing
story eligibility or order. The collapsed feed includes whole groups until it
reaches at least 12 stories, then offers Show All. Detail navigation preserves
the exact originating League tab, while a fresh League entry always resets to
News. Player-performance headlines include win/loss context and use explicit
national-championship wording for the title game. They may acknowledge at most
one strong secondary statistical category while preserving the existing primary
variant; triple-doubles are always acknowledged, including with a 50-point
primary. Qualifying upsets over a #1/#2 seed receive the existing `MAJOR UPSET`
treatment even when their seed gap is four through seven. If the latest fully
completed competition checkpoint produced no stories, a quiet status says that
checkpoint is complete with no notable news while older empty checkpoints remain
absent. Before any checkpoint completes, the original New Dynasty empty state
still explains that a complete round is required.

The News heading retains a compact Season Preview action throughout the active
regular Season and Tournament, while the Hub promotion itself is limited to
Rounds 1–2. Season Preview is a destination, not a fifth League tab.

### Season Archive / Yearbook — accepted (7C.1)

History is League-owned but remains a distinct secondary action, not a global
destination or fifth tab. Its index shows completed Seasons only, newest first;
the active Season never appears. A Yearbook should feel like one cohesive recap
in the established app language, ordered as Champion / Season identity, Your
Season (summary, Team Leaders, Tournament Run), Season Around the League, and
the full archived National Tournament bracket as the final deep-dive. Do not
surface the implementation label “read-only archive” in player-facing copy.

Use progressive disclosure when simultaneous historical datasets would harm
scanability. Season Around the League pairs one Final Standings card with a
conference selector and one Statistical Leaders card with a category selector.
Default to the controlled Program's conference and PPG; expose every conference
and regular-season PPG/RPG/APG/SPG/BPG top ten. Pair the cards on desktop and
stack them on mobile. Wide tables and the full bracket scroll locally; the page
must not create body overflow at approximately 390px.

Player rows use stable-ID exploration. Active Players open current Player
Details, departed Players open Former/Alumni details, and unresolved IDs fail
quietly. Back from Player Details restores the same Yearbook. This is contextual
navigation through the existing exploration stack, not a season-specific
historical Player route. The archived Tournament shows the complete bracket but
offers no active simulation or game-detail controls.

### Player Details + Development History — implemented (6E.8)

Player Details now tells a Player's career story without duplicating any canonical facts. Nine current-ability ratings display as a compact three-column grid — deliberately not nine oversized cards — directly below identity/OVR/POT. Career Progression is a dense, prominent table (not a secondary tab) with one row per Season the Player is found on a roster in, current or archived: Season number, class, OVR, offseason development gain (`overall[n] − overall[n-1]`, blank for the earliest known Season), and PPG/RPG/APG. The active partial Season is included as the latest row and stays visibly partial. Recruiting Origin — star rating, national/position rank, entry OVR/POT, and signed Program — appears only for Players resolved from finalized Recruiting history and is omitted entirely, with no placeholder, for original Universe Players.

All of this is a pure read-model (`derivePlayerCareerHistory` in `src/dynasty/careerHistory.ts`) over existing archived Dynasty Season snapshots, the active Season, and finalized Recruiting history, connected by stable Player ID. It reuses the existing Player Season Stats projection for every Season, including archived ones, and introduces no new persisted career-history state. Existing current-season stats, shooting splits, game log, and Team ↔ Player navigation are unchanged.
