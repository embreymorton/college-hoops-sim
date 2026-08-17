# Current Repository State

> **Fresh planning and engineering sessions must read this document first.**

This is the concise handoff for accepted production truth. The repository is
authoritative when documentation and code disagree. Read
[ROADMAP.md](ROADMAP.md) for selected sequencing,
[PLAYTESTING.md](PLAYTESTING.md) for current evidence, and
[COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md](COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md)
for project working style. Read [CALIBRATION.md](CALIBRATION.md) before proposing
simulation tuning.

## Current product

College Hoops supports a repeatable multi-season Dynasty:

```text
Program selection → Season opening / Regular Season + Recruiting → Tournament
→ Late Recruiting → Offseason → Development + roster assembly
→ next Season → repeat
```

The playable product includes:

- deterministic Player/roster generation, game simulation, overtime, and full
  Player box scores;
- Rotation V1 with legal secondary floor-position assignments, Simple and
  Advanced Coaching editors, and a derived Starting Five presentation;
- a stable 32-Program Universe, 24-round schedules, standings, Quick Sim, Game
  Prep, Super Sim, completed-game history, and League exploration;
- regular-season Player and Team statistics, national leaders, Team and Player
  Details, Following, News, Alumni, Season Preview, and a completed-Season
  first-class League History with Yearbooks and a Dynasty Record Book;
- a deterministic 16-Team Tournament with automatic and at-large selection,
  accepted results-only résumé seeding, and fixed-bracket progression;
- Board + Focus + Offer Recruiting, Recruiting battles/readiness, stable-ID
  Recruit Details, Late Recruiting, class finalization, and Recruit-to-Player
  identity continuity;
- departures, Player Development, incoming classes, exact next-season roster
  assembly, archived Seasons, and repeatable Dynasty rollover; and
- one stored creation seed per normal interactive Dynasty, with explicit-seed
  paths remaining exactly reproducible.

Persistence/save-load, transfers, injuries, staff, rankings, and deeper
offseason decisions are not implemented.

## Canonical architecture

```text
DynastyState             = canonical multi-season domain state
Season/Postseason/etc.   = deterministic domain facts and projections
Zustand                  = session orchestration and presentation state
React                    = presentation
```

Canonical facts are not independently duplicated in Zustand. Domain generation
and simulation use explicit seeded RNG streams; production does not use
`Math.random()`. Exact ownership and dependency rules live in
[ARCHITECTURE.md](ARCHITECTURE.md), accepted formulas and invariants in
[SIMULATION.md](SIMULATION.md), and player-facing rules in
[GAME_DESIGN.md](GAME_DESIGN.md).

At a canonically completed Tournament with Recruiting synchronized through
Period 28, the explicit Late Recruiting handoff remains available from both the
Tournament Hub and the final regular-season review reached through normal
navigation. Navigation does not own or clear that lifecycle eligibility.

During an active Tournament, Coaching uses postseason team/rotation state only
when the controlled Program qualified and has canonical Tournament state. A
non-qualifier instead retains valid completed-Season Roster/Rotation Coaching;
opening Coaching never fabricates Tournament participation or mutates either
competition state.

## Accepted and frozen boundaries

Frozen means “reopen only with new evidence,” not “never change.” Do not tune or
refactor these systems during unrelated feature work:

- Recruiting mechanics and accepted Recruiting information architecture;
- Recruit Talent Distribution V1 and the production Recruit POT Candidate B
  finalizer;
- Player Development V1;
- Rotation V1, role-aware defaults, Simple Rotation, and Starting Five
  projection/presentation;
- Team Strength, Game Simulation, Player box scores, and current statistical
  projections;
- Tournament selection/seeding and progression;
- Dynasty archive, offseason, roster-assembly, and rollover behavior;
- Followed Players and Player Legacy resolver semantics; and
- Phase 7B News, Alumni/Historical Player Details, and Season Preview; and
- Phase 7C.1 Season Archive / Yearbook presentation and read-model boundaries.

Recruit POT Candidate B is the accepted production POT finalizer. It must not
be confused with the rejected historical **OVR Experiment B v1**.

## Current watchpoints

[PLAYTESTING.md](PLAYTESTING.md) owns empirical evidence. The active watch list
does not itself authorize implementation:

- low-prestige rebuild feel and mature-league powerhouse ceilings;
- concentrated single-attribute offseason gains;
- interior/forward-heavy Rotation secondary paths and rare incumbent
  displacement;
- premium Recruit Offer allocation, pending its own diagnostic;
- shot-selection/statistical translation only if fresh manual play identifies a
  concrete Player-identity problem;
- active Dynasty persistence and serialized-history growth; and
- minor wording, session-store, and test-infrastructure items tracked in
  [KNOWN_ISSUES_AND_OPTIMIZATIONS.md](KNOWN_ISSUES_AND_OPTIMIZATIONS.md).

## Current planning checkpoint

**Phase 7C.1 — Season Archive / Yearbook is COMPLETE / ACCEPTED / FROZEN.**

League-owned History now appears as the fifth League tab, with Yearbooks and
Records as peer sub-destinations. Yearbooks list completed Seasons only, newest
first, then present one cohesive Season recap:

- Champion / Season identity;
- Your Season summary, Team Leaders, and Tournament Run;
- Season Around the League with one selectable Final Standings card and one
  selectable Statistical Leaders card; and
- the full archived National Tournament bracket as the final deep-dive.

The Yearbook is a pure read-model over `CompletedSeasonArchive`; conference and
stat-category selectors are transient local UI state. Player links resolve by
stable ID to current details, Former/Alumni details, or quiet unresolved
behavior, and Back returns to the same Yearbook. No copied summary, historical
Player route, simulation behavior, or parallel canonical history was added.

The current Player population is good enough for feature development. Player
Identity / Superstar Separation tuning is **PARKED**. Canonical Player
generation and `calculateOverall()` remain production truth. Profile Generation
Experiment A V2 is experimental input only and is not production-active. OVR
Experiment B v1 is rejected and must not be activated or retuned in place.
Read [PLAYER_IDENTITY_RESEARCH.md](PLAYER_IDENTITY_RESEARCH.md) only when new
manual gameplay evidence justifies deliberately reopening Player tuning.

**Phase 7D.1 — Recruit Details is COMPLETE / ACCEPTED / FROZEN.** The polished
stable-ID destination opens from Board, Battles, and National Class; presents
the canonical profile, exact OVR/POT and nine ratings, safe derived Recruiting
context, and contextual versions of existing management actions; resolves
committed status; and returns to its preserved parent Recruiting mode. The
tournament-complete progression recovery that unblocked acceptance was also
manually verified.

**Phase 7D.2 — Follow Recruits is COMPLETE / ACCEPTED / FROZEN.** Recruit
Details owns Follow/Unfollow, while Recruiting Following preserves
first-followed order and presents live current-class readiness, controlled-
Program status, or resolved commitment destinations. Following remains
independent from Board, Focus, and Offer management and uses the accepted League
Following interaction language. The user manually confirmed it works as
expected.

**Phase 7D.3 — Recruit → Player Continuity is COMPLETE / ACCEPTED / FROZEN.**
At successful season rollover, followed Recruit intent transfers only when the
completed class and canonical active roster verify the same stable Player ID.
Existing Player-follow order is preserved, newly enrolled follows append in
Recruit-follow order, converted Recruit ownership is retired, and existing
Player Following becomes canonical. Unresolved Recruit IDs remain safely stored
without fabricated continuity. The accepted behavior works for the controlled
Program's signees and Recruits who sign elsewhere.

The Tournament non-qualifier Coaching recovery is **FIXED / MANUALLY VERIFIED**.
Qualified Programs use canonical postseason Coaching context; non-qualifiers
retain completed-Season roster/rotation Coaching without fabricated Tournament
participation or navigation mutation.

Exact Recruit OVR, POT, and individual ratings remain current production
visibility. Scouting grades, ranges, estimates, hidden information, and other
uncertainty remain future-only.

**Phase 7C.2 — Records & Milestones V1 is NEXT and IMPLEMENTED / PENDING MANUAL
ACCEPTANCE.** History is now the fifth League tab with Yearbooks / Records
sub-navigation. Records derive completed-regular-season Single Game totals,
qualified Season rates, and stable-ID Career totals as deterministic Top 10s.
The active Season and postseason statistics do not contribute; no record state
is stored. One shared projection derives every category and scope, while the UI
selects a category and presents Single Game, Single Season, and Career panels
together. Player links reuse active/former resolution and preserve the selected
category on Back.

`7C.3 Awards & Honors` remains **PLANNED** and has not begun. Player Identity
work remains parked unless new evidence deliberately reopens it.

## Fresh-session rules

- Current repository state beats old chat history.
- Roadmap sequencing beats informal future-interest discussion.
- `FUTURE_FEATURES.md` is an idea bank, not a priority list.
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` is not a feature backlog.
- Frozen systems require new evidence to reopen.
- Prefer small green milestones and inspect current code before architecture.
- Meaningful gameplay work requires manual play as part of acceptance.
- Documentation changes follow [DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md).

## Documentation map

| Document | Purpose |
| --- | --- |
| `ROADMAP.md` | Completed sequence and deliberately selected horizon |
| `PLAYTESTING.md` | Active priorities, live WATCH items, and current empirical evidence |
| `PLAYTESTING_ARCHIVE.md` | Conditional closed playtesting evidence |
| `PLAYER_IDENTITY_RESEARCH.md` | Parked Player Identity experiments and reopening criteria |
| `ARCHITECTURE.md` | Canonical ownership, boundaries, and dependencies |
| `SIMULATION.md` | Accepted production formulas, constants, and invariants |
| `GAME_DESIGN.md` | Accepted player-facing rules |
| `UI_DESIGN.md` | Accepted presentation and navigation patterns |
| `CALIBRATION.md` | Diagnostic and tuning methodology |
| `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` | Confirmed unresolved debt and watchpoints |
| `FUTURE_FEATURES.md` | Unscheduled idea bank |
| `COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md` | Assistant workflow and judgment rules |
