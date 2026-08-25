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
  Details with current/history organization, full completed-Season Program
  Trajectories and Program Player Records, Player Career Highs, Following, News,
  Alumni, Season Preview, and a completed-Season
  first-class League History with Yearbooks, a Dynasty Record Book, and
  finalized national Recruiting class retrospectives, plus deterministic
  Awards & Honors with archived outcomes and Player Career Honors; Player
  Career now separates regular-season and Tournament history, while the Record
  Book has an explicitly separate Tournament scope;
- a deterministic 16-Team Tournament with automatic and at-large selection,
  accepted results-only résumé seeding, and fixed-bracket progression;
- Board + Focus + Offer Recruiting, Recruiting battles/readiness, stable-ID
  Recruit Details with factual next-Season natural-position outlook, Late
  Recruiting, a factual whole-roster Season N+1 Roster Outlook, class
  finalization, Recruit-to-Player identity continuity, and an
  accepted controlled-Program Board organized by canonical manual/assistant
  entry provenance with atomic unavailable-target cleanup;
- departures with graduating-senior career context, ordinary Player Development
  plus rare Explosive Offseasons, Work Ethic reveal, top attribute gains and an
  event-aware Biggest Leap spotlight, incoming classes, exact
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
- Recruit Talent Profile V2's loose readiness-conditioned raw-ceiling model,
  with unchanged readiness/current-ability generation and Candidate B POT
  finalization;
- S0 Current Ability / Career-Stage Generation's budget-preserving noisy
  class-to-talent-opportunity assignment, with no class-specific OVR caps;
- S0 POT / Career-Profile Continuity's deterministic direct conditional-tier
  model, shared six-tier ceiling semantics, and fixed legal career ceilings;
- Recruiting Board Organization & Cleanup V1, including required Board-entry
  provenance, manual/assistant grouping, authoritative unavailable cleanup,
  preserved relationship history, and no automatic refill;
- Next Season Roster Planner / Roster Outlook V1's pure factual projection,
  position-group/opening presentation, current-rating semantics, and existing
  Player/Recruit Details navigation;
- the production Recruit POT Candidate B finalizer;
- Player Development V1, including the accepted high-POT/high-headroom
  realization opportunity;
- Rare Development Breakouts / Explosive Offseasons + Work Ethic Reveal V1,
  including isolated deterministic event resolution, POT as an absolute
  ceiling, and exact ordinary-Development preservation when no event occurs;
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
- Program Legacy / Program Trajectory V1's all-Program full-history projection,
  canonical historical-source semantics, and Team Details presentation contract;
  and
- Player Records Expansion V1's shared regular-season record projections,
  Player Career Highs, Program-attributed Player Records, stable-ID navigation,
  and accepted Team `Overview | History` / Player `Overview | Career`
  information architecture.
- Postseason Player Legacy / Tournament Records V1's Tournament GP and
  appearance semantics, stable-ID active/former continuity, active/archive
  deduplication, separate Career competition contexts, Tournament record
  definitions, and strict regular-season statistical isolation.

Recruit Talent Profile V2 is implemented, accepted, and frozen production
behavior. It supersedes V1's independent raw-ceiling roll with the loose
readiness-conditioned distribution documented in [SIMULATION.md](SIMULATION.md).
Recruit readiness/current-ability generation, Candidate B, Development,
positional attribute generation and supply, ranking and stars, Recruiting
mechanics, and downstream Dynasty systems remain unchanged. S0 current ability
now uses the separate accepted career-stage assignment documented in
[SIMULATION.md](SIMULATION.md). No Recruit Talent Profile calibration remains
open.

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

**NEXT: Roster Positional Flexibility — Focused Design.**

Fresh sessions resolve to **Path A**. This is a design milestone only; no
implementation contract or replacement Recruiting model has been selected.
The design pass will investigate whether Programs should be able to reshape
their inherited natural-position counts and the resulting Recruiting, AI,
assembly, migration, Rotation, and balance implications.

Next Season Roster Planner / Roster Outlook V1 is **COMPLETE / ACCEPTED /
FROZEN**. Recruiting now includes a factual read-only Season N+1 outlook over
returners, controlled commitments, exact-position openings, and departing
seniors. It uses current pre-Development OVR/POT, adds no canonical state or
mechanics, and yields to the actual assembled Roster Review after Recruiting
finalization and Offseason Development.

Awards & Honors V1 is **COMPLETE / ACCEPTED / FROZEN**. It includes the accepted
national, Conference, and Tournament honors, deterministic `awards-v1`
evaluation, archive persistence, Final Four reveal, dedicated Awards surface,
championship MOP context, condensed Yearbook summary, Player Career Honors, and
bounded Awards News. It evaluates canonical production with no gameplay effects
and does not alter any frozen simulation, Recruiting, Tournament, roster,
Prestige, or Offseason behavior.

Postseason Player Legacy / Tournament Records V1 is **COMPLETE / ACCEPTED /
FROZEN**. Tournament performance now follows stable Player identity across
active and former Player Details: Career separates Regular Season and
Tournament contexts, with Tournament production, achievements, season runs,
career highs, and game history. The Dynasty Record Book likewise exposes a
separate Tournament scope. These are derived from active/archived Postseason
facts without changing regular-season statistical semantics or adding
canonical historical summaries.

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

Awards & Honors V1 is accepted production behavior, not open work. Player
Identity work remains parked unless new evidence deliberately reopens it.
Dynamic Prestige remains rejected; the hierarchy/compression investigation
remains decision-complete.

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
