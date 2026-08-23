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
→ Late Recruiting → Recruiting Class → Departures → Development
→ Roster Review → Ready for Season → next Season → repeat
```

The playable product includes:

- deterministic Player/roster generation, game simulation, overtime, and full
  Player box scores;
- Rotation V1 with legal secondary floor-position assignments, Simple and
  Advanced Coaching editors, and a derived Starting Five presentation;
- a stable 32-Program Universe, 24-round schedules, standings, Quick Sim, Game
  Prep with a shared Matchup Scout and Simple/Advanced Rotation preparation,
  Super Sim, completed-game history, and League exploration;
- regular-season Player and Team statistics, national leaders, Team and Player
  Details with current/history organization, derived Program Dynasty histories
  and Program Player Records, Player Career Highs, Following, News, Alumni,
  Season Preview, and a completed-Season
  first-class League History with Yearbooks, a Dynasty Record Book, and
  finalized national Recruiting class retrospectives;
- a deterministic 16-Team Tournament with automatic and at-large selection,
  accepted results-only résumé seeding, and fixed-bracket progression;
- Board + Focus + Offer Recruiting, Recruiting battles/readiness, stable-ID
  Recruit Details with factual next-Season natural-position outlook, Late
  Recruiting, class finalization, Recruit-to-Player identity continuity, and an
  accepted controlled-Program Board organized by canonical manual/assistant
  entry provenance with atomic unavailable-target cleanup;
- departures with graduating-senior career context, Player Development with
  top attribute gains and a Biggest Leap spotlight, incoming classes, exact
  next-season roster assembly, archived Seasons, and repeatable Dynasty rollover;
- a dedicated guided-but-explorable Offseason shell spanning Late Recruiting,
  Recruiting Class, Departures, Development, Roster Review, and Ready for
  Season, with completed-stage review and safe Dynasty exploration; and
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

At a canonically completed Tournament, one pure Dynasty progression resolver
keeps the explicit Late Recruiting handoff reachable whether Recruiting is
already synchronized through Period 28 or remains at the genuine regular-season
Period 24 boundary. Tournament, League, Coaching, and Recruiting place the
shared progression bar directly below their stable primary navigation; the
final-Season hub retains its contextual checkpoint, while detail/history routes
receive the application-shell fallback. Every surface dispatches the
same idempotent transition command, which synchronizes missing postseason
Recruiting periods before entering Late Recruiting. Navigation does not own or
clear eligibility, and the action disappears only after the canonical phase
actually advances.

The completed Tournament Hub derives one National Championship recap directly
from the canonical title game, independent of last-played/selected-game session
state. It presents champion, runner-up, oriented final score, overtime when
applicable, and the existing read-only box-score action. The controlled Program
summary changes its completed-state `Round` fact to `Finish`, covering Did Not
Qualify through National Champion without duplicating that outcome in the recap.

During an active Tournament, Coaching uses postseason team/rotation state only
when the controlled Program qualified and has canonical Tournament state. A
non-qualifier instead retains valid completed-Season Roster/Rotation Coaching;
opening Coaching never fabricates Tournament participation or mutates either
competition state.

## Accepted and frozen boundaries

Frozen means “reopen only with new evidence,” not “never change.” Do not tune or
refactor these systems during unrelated feature work:

- Recruiting mechanics and accepted Recruiting information architecture;
- Recruiting Board Organization & Cleanup V1, including required Board-entry
  provenance, manual/assistant grouping, authoritative unavailable cleanup,
  preserved relationship history, and no automatic refill;
- the production Recruit POT Candidate B finalizer;
- Player Development V1, including the accepted high-POT/high-headroom
  realization opportunity;
- Rotation V1, role-aware defaults, Simple Rotation, Rotation Assistant V1 —
  Preserve & Fill, and Starting Five projection/presentation;
- Matchup Scout V1 and Game Prep Rotation Experience V1, including their pure
  read-model, single-canonical-Rotation, competition-aware draft, and shared
  regular-season/Tournament presentation boundaries;
- Team Strength, Game Simulation, Player box scores, and current statistical
  projections;
- Tournament selection/seeding and progression;
- Dynasty archive, offseason, roster-assembly, and rollover behavior;
- Dedicated Offseason Experience V1's presentation-staging projection,
  transient review cursor, six-stage flow, and polished shell hierarchy;
- Followed Players and Player Legacy resolver semantics; and
- Phase 7B News, Alumni/Historical Player Details, and Season Preview; and
- Phase 7C.1 Season Archive / Yearbook presentation and read-model boundaries;
  and
- Phase 7C.2 Dynasty Record Book, live Records overlay, and record-breaking
  Single Game News behavior and read-model boundaries; and
- Recruiting Class Retrospectives V1's finalized-signee projection and History
  presentation contract; and
- Program Legacy V1's all-Program historical projection and Team Details
  presentation contract; and
- Player Records Expansion V1's shared regular-season record projections,
  Player Career Highs, Program-attributed Player Records, stable-ID navigation,
  and accepted Team `Overview | History` / Player `Overview | Career`
  information architecture.

Recruit Talent Distribution V1 remains current production behavior while
**NEXT — Recruit Talent Profile V2 — Focused Design** evaluates only its
readiness/current-ability and raw-ceiling model. That selected design milestone
does not reopen Candidate B, Development, positional attribute generation,
Recruit positional supply, or unrelated V0 Universe generation by default.

Recruit POT Candidate B is the accepted production POT finalizer. It must not
be confused with the rejected historical **OVR Experiment B v1**.

## Current watchpoints

[PLAYTESTING.md](PLAYTESTING.md) owns empirical evidence. The active watch list
does not itself authorize implementation:

- low-prestige rebuild feel;
- elite Recruit offer coverage deep into a cycle;
- concentrated single-attribute offseason gains;
- interior/forward-heavy Rotation secondary paths and rare incumbent
  displacement;
- exact-position Recruiting friction;
- shot-selection/statistical translation, including the single-game Steals
  upper tail, only if focused evidence establishes a concrete problem;
- active Dynasty persistence and serialized-history growth; and
- minor wording, session-store, and test-infrastructure items tracked in
  [KNOWN_ISSUES_AND_OPTIMIZATIONS.md](KNOWN_ISSUES_AND_OPTIMIZATIONS.md).

## Current planning checkpoint

**NEXT: Recruit Talent Profile V2 — Focused Design.**

Two decision-complete diagnostics established that the Recruiting-origin
95–99 OVR shortage begins upstream of Development. Recruiting supplies far
fewer elite-POT freshmen, and those high-POT Players enter much lower in OVR;
matched starting OVR/POT/headroom profiles develop similarly regardless of
origin. The Recruit decomposition then found only `1.0%` raw ceilings at 95+,
`0.6%` at 97+, and `0.2%` at 99 before Candidate B. Starting OVR and raw ceiling
are effectively independent (`0.002` correlation), while Candidate B preserves
all raw 95+/97+/99 ceilings and slightly enlarges the finalized elite tail.

The next milestone is design first: inspect production generation seams and
develop a principled Recruit talent-profile direction without selecting a
formula in advance. Development V1 and Candidate B remain accepted/frozen; no
additional broad 95+ diagnostic is required. Original V0 generation is a
comparator, not an automatically selected Recruit model.

Fresh sessions therefore resolve to **Path A**: inspect this authoritative NEXT
and its production/evidence owners, then conduct focused design rather than an
open planning pass or implementation.

Recruiting Board Organization & Cleanup V1 is **COMPLETE / ACCEPTED / FROZEN**.
Canonical Board membership records whether it was created manually or by
assistant/system tooling; the controlled Board presents those entries in two
counted groups. `Clear Unavailable` atomically removes committed-elsewhere and
position-filled targets while retaining controlled commitments, relationships,
and retained order. It leaves opened slots empty until the player explicitly
adds a Recruit or uses `Fill Remaining Board`; Recruiting mechanics and
assistant selection behavior are unchanged.

Player Records Expansion V1 and its Details information-architecture polish are
**COMPLETE / ACCEPTED / FROZEN**. Career Highs and Program Player Records remain
pure derived regular-season projections over archived and active results; no
record state, persistence, or Tournament statistics were added.

Matchup Scout V1 and Game Prep Rotation Experience V1 are **COMPLETE / ACCEPTED /
FROZEN**. Game Prep now composes the pregame matchup, a pure opponent Scout,
and Rotation Preparation; Simple is the default controlled presentation,
Advanced remains available with safe draft transitions, and both use the same
canonical competition `RotationV1`. The opponent Expected Rotation is derived
from planned minutes and projected Starting Five facts rather than introducing
scouting, starter, or Rotation state. Regular-season and Tournament surfaces
share the presentation while preserving their existing Season/Postseason
ownership and simulation boundaries.

Dynamic Prestige was rejected and rolled back; production uses immutable static
Program Prestige. The subsequent hierarchy/compression investigation is
**decision-complete**. Mature compression remains a known accepted/deferred
limitation for the current product scope, no targeted intervention is
recommended, and no compression work is selected. Detailed conditional-read
evidence lives in [DYNASTY_HIERARCHY_RESEARCH.md](DYNASTY_HIERARCHY_RESEARCH.md).

The current Player population is good enough for feature development. Player
Identity / Superstar Separation tuning is **PARKED**. Canonical Player
generation and `calculateOverall()` remain production truth. Profile Generation
Experiment A V2 is experimental input only and is not production-active. OVR
Experiment B v1 is rejected and must not be activated or retuned in place.
Read [PLAYER_IDENTITY_RESEARCH.md](PLAYER_IDENTITY_RESEARCH.md) only when new
manual gameplay evidence justifies deliberately reopening Player tuning.

The Tournament non-qualifier Coaching recovery is **FIXED / MANUALLY VERIFIED**.
Qualified Programs use canonical postseason Coaching context; non-qualifiers
retain completed-Season roster/rotation Coaching without fabricated Tournament
participation or navigation mutation.

Exact Recruit OVR, POT, and individual ratings remain current production
visibility. Scouting grades, ranges, estimates, hidden information, and other
uncertainty remain future-only.

`7C.3 Awards & Honors` remains **PLANNED** and has not begun. Player Identity
work remains parked unless new evidence deliberately reopens it.

Rare Development Breakouts / Explosive Offseasons is also **PLANNED, not
NEXT**. It is a separate future question about extremely rare transformational
offseasons beyond normal `+12/+10/+8` class-year caps while POT stays absolute;
it must not distract from or compensate for Recruit Talent Profile V2.

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
