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
  Details, derived Program Dynasty histories, Following, News, Alumni, Season Preview, and a completed-Season
  first-class League History with Yearbooks, a Dynasty Record Book, and
  finalized national Recruiting class retrospectives;
- a deterministic 16-Team Tournament with automatic and at-large selection,
  accepted results-only résumé seeding, and fixed-bracket progression;
- Board + Focus + Offer Recruiting, Recruiting battles/readiness, stable-ID
  Recruit Details with factual next-Season natural-position outlook, Late
  Recruiting, class finalization, and Recruit-to-Player identity continuity;
- departures with graduating-senior career context, Player Development with
  top attribute gains and a Biggest Leap spotlight, incoming classes, exact
  next-season roster assembly, archived Seasons, and repeatable Dynasty rollover; and
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
- Recruit Talent Distribution V1 and the production Recruit POT Candidate B
  finalizer;
- Player Development V1, including the accepted high-POT/high-headroom
  realization opportunity;
- Rotation V1, role-aware defaults, Simple Rotation, Rotation Assistant V1 —
  Preserve & Fill, and Starting Five projection/presentation;
- Team Strength, Game Simulation, Player box scores, and current statistical
  projections;
- Tournament selection/seeding and progression;
- Dynasty archive, offseason, roster-assembly, and rollover behavior;
- Followed Players and Player Legacy resolver semantics; and
- Phase 7B News, Alumni/Historical Player Details, and Season Preview; and
- Phase 7C.1 Season Archive / Yearbook presentation and read-model boundaries;
  and
- Phase 7C.2 Dynasty Record Book, live Records overlay, and record-breaking
  Single Game News behavior and read-model boundaries; and
- Recruiting Class Retrospectives V1's finalized-signee projection and History
  presentation contract; and
- Program Legacy V1's all-Program historical projection and Team Details
  presentation contract.

Recruit POT Candidate B is the accepted production POT finalizer. It must not
be confused with the rejected historical **OVR Experiment B v1**.

## Current watchpoints

[PLAYTESTING.md](PLAYTESTING.md) owns empirical evidence. The active watch list
does not itself authorize implementation:

- low-prestige rebuild feel;
- elite Recruit offer coverage deep into a cycle;
- the longitudinal frequency of developed Players reaching approximately 95+
  OVR;
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

**No NEXT selected — Open Planning Checkpoint.**

Dynamic Prestige was rejected and rolled back; production uses immutable static
Program Prestige. The subsequent hierarchy/compression investigation is
**decision-complete**. Mature compression remains a known accepted/deferred
limitation for the current product scope, no targeted intervention is
recommended, and no compression work is selected. Detailed conditional-read
evidence lives in [DYNASTY_HIERARCHY_RESEARCH.md](DYNASTY_HIERARCHY_RESEARCH.md).

Rotation Assistant V1 — Preserve & Fill is **COMPLETE / ACCEPTED / FROZEN**.
The explicit action preserves edited MPG, fills the remaining legal 200-minute
Simple draft deterministically, and never commits before Apply. Apply and
Discard clear transient locked state; impossible constraints retain the draft
and show existing issue feedback. Phase 7C.3 remains PLANNED and valid, but is
not NEXT.

Next Season Position Outlook V1 is **COMPLETE / ACCEPTED**. Recruit Details
derives the controlled Program's projected natural-position group from current
returners, departing seniors, controlled commitments, and the viewed Recruit's
authoritative eligibility. Rows show current OVR/POT and projected class, while
ordering and tied rank use current OVR only. The projection adds no canonical
state and changes no Recruiting, Development, Rotation, or simulation behavior.

Team Details exposes every Program's history during the current Dynasty:
cumulative completed-Season record, Tournament appearances, championships,
runner-up finishes, best Tournament and regular-season results, and the five
most recent completed Seasons. One pure projection derives the presentation from
`CompletedSeasonArchive` facts and the existing canonical Tournament-outcome
semantics. Current static Prestige remains visible in the Team header. Programs
with no Tournament appearances show `No Tournament Appearances` at the résumé
level while their individual Recent Seasons still show `Did Not Qualify`.
National Champion receives restrained presentation-only emphasis.

Offseason Storytelling V1 remains a pure presentation projection over the
completed Season archive and canonical Offseason state. Every graduating senior
receives observed seasons with the Program, PPG/RPG/APG, and peak OVR from
existing Career History projections; the wording does not imply pre-Dynasty
history. Returning Players show up to three positive canonical attribute gains,
and the deterministic largest positive OVR increase receives one compact Biggest
Leap spotlight. No story state or Development mechanic was added.

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

**Recruiting Class Retrospectives V1 is COMPLETE / ACCEPTED / FROZEN.** League
History now includes Recruiting beside Yearbooks and Records. Finalized classes
appear newest first and contain every national signee—never unsigned surplus—
with target-Season and controlled-Program counts. One lean four-column table
shows Recruit rank/name/position/stars, signed Program, archived entry OVR/POT,
and Incoming, active class/current OVR, Former peak OVR, or a neutral
Unavailable invariant fallback. All Programs is the default; Your Program is a
local filter. Active/former stable IDs reuse Player Details while incoming and
unavailable rows remain unlinked, and class/filter context survives Back.

`completedRecruitingHistory` remains canonical. A pure read-model indexes
active and archived roster snapshots by stable Player ID and derives former
peak OVR; Zustand owns only transient History selection/filter state. No
retrospective registry, copied history, persistent cache, canonical Dynasty
state, Recruiting-mechanic visibility, persistence, or simulation behavior was
added. The compact table scrolls locally and does not create body overflow at
the accepted narrow target.

The Tournament non-qualifier Coaching recovery is **FIXED / MANUALLY VERIFIED**.
Qualified Programs use canonical postseason Coaching context; non-qualifiers
retain completed-Season roster/rotation Coaching without fabricated Tournament
participation or navigation mutation.

Exact Recruit OVR, POT, and individual ratings remain current production
visibility. Scouting grades, ranges, estimates, hidden information, and other
uncertainty remain future-only.

**Phase 7C.2 — Records & Milestones V1 is COMPLETE / ACCEPTED / FROZEN.**
History is the fifth League tab with Yearbooks / Records
sub-navigation. Records combine completed archives with a derived live overlay:
active regular-season games contribute authoritative Single Game results and
Career totals, while qualifying active Season rates rank provisionally with a
LIVE marker. Postseason Player statistics never contribute, and no record state
is stored. One shared projection derives every category and scope, while the UI
selects a category and presents Single Game, Single Season, and Career panels
together. Player links reuse active/former resolution and preserve the selected
category on Back.

After at least one completed Season, Around the Country also promotes strict
new Dynasty single-game regular-season records. Historical archive maxima seed
one running active-Season baseline; completed active games advance it in
canonical round/game order. One Player/game becomes one combined record story,
replacing that Player/game's generic performance story. Ties, postseason box
scores, and Season 1 never qualify.

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
