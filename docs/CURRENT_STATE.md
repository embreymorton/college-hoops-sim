# Current Repository State

> **Fresh planning and engineering sessions must read this document first.**

This is the concise handoff for the repository as it exists today. It records accepted production truth, not future design. The repository is authoritative when this document and code disagree.

Then read [PLAYTESTING.md](PLAYTESTING.md) for why current priorities exist,
[ROADMAP.md](ROADMAP.md) for selected sequencing, [CALIBRATION.md](CALIBRATION.md)
before proposing simulation tuning, and
[COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md](COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md)
for project working style.

Before modifying documentation, follow
[DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md). Documentation is maintained
incrementally as part of milestone acceptance, not through routine broad syncs.

> **Fresh Context Rules**
>
> - Current repository state beats old chat history.
> - Read `PLAYTESTING.md` before choosing product priorities.
> - Frozen systems require new evidence to reopen.
> - `FUTURE_FEATURES.md` is an idea bank, not a roadmap.
> - `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` is not a feature backlog.
> - Simulation changes follow `CALIBRATION.md`.
> - Documentation changes follow `DOCUMENTATION_POLICY.md`.
> - Prefer small green milestones.
> - Inspect current code before proposing architecture.
> - Manual play is part of acceptance for meaningful gameplay work.

## Current product

The application supports a repeatable multi-season Dynasty:

```text
New Dynasty
→ Preseason
→ Regular Season
→ Recruiting alongside Season play
→ Tournament
→ Late Recruiting
→ Recruiting Finalization
→ Offseason
→ Player Development
→ Next Season
→ repeat
```

The player-facing product includes:

- deterministic game simulation, Hub Quick Sim, Game Prep, and Box Score presentation;
- floor-position-aware Rotation V1 editing, including derived legal secondary-position assignments and deterministic flexible defaults;
- schedules, standings, League exploration, and Player season statistics;
- the national Tournament;
- Board + Focus + Offer Recruiting, a generated national board, onboarding, Late Recruiting, and finalization;
- offseason turnover, incoming recruits, Player Development, next-season roster assembly, and Dynasty rollover;
- a unique stored seed for each normal interactive new Dynasty; and
- Super Sim to Midseason and to the end of the regular season.

Program and Conference identity remains fixed. A Dynasty seed is generated once for normal interactive creation; explicit-seed paths remain deterministic.

## Canonical architecture

```text
DynastyState = canonical multi-season domain state
Zustand      = application/session orchestration and presentation state
React        = presentation
Domain/simulation = deterministic pure TypeScript where practical
```

Canonical domain facts are not independently duplicated in Zustand. Domain generation and simulation use explicit deterministic seeded RNG streams; production code does not use `Math.random()`.

## Frozen Unless New Evidence Appears

Frozen does not mean impossible to change forever. It means do not casually
tune or refactor these systems during unrelated work; reopen them only when new
playtest or diagnostic evidence justifies it.

### Recruiting

Board + Focus + Offer is accepted:

```text
Board baseline effort = 3
Focus bonus = +3
Maximum Focus targets = 3
```

Priority `1–5` and normalized attention are removed. AI plans coherently align Focus and Offers and retain valid premium pursuits. Prestige/attraction is accepted.

Recruiting and roster construction continue using each Player's one natural
position. Rotation eligibility affects floor minutes only; it does not satisfy
another position's Recruiting opening or Offer capacity.

### Recruit Talent Distribution V1

Recruit Talent V1 uses partially independent readiness and ceiling, with `POT >= OVR`. National Rank uses `56% OVR / 44% POT`. It intentionally creates fewer immediately elite freshmen, raw high-upside prospects, ready-now lower-ceiling prospects, and a wider OVR/POT relationship.

### Player Development V1

Development is:

```text
class baseline
+ POT-headroom opportunity
+ stable hidden Player tendency
+ annual variance / rare breakouts
→ attribute-based development
→ hard POT cap
```

| Completed class | Baseline | Headroom multiplier | Target cap |
| --- | ---: | ---: | ---: |
| FR | 1–4 | 1.20 | 12 |
| SO | 1–3 | 0.90 | 10 |
| JR | 0–2 | 0.65 | 8 |

Tendency shares are weak `30%`, steady `50%`, and strong `20%`. There is no Prestige-based Development modifier. Development V1 is frozen unless new evidence appears.

### Rotation V1

Rotation V1 is implemented, activated, behaviorally validated, and frozen.
Phase 6E.9B reserves natural 36-minute defaults for Team top-three OVR Players,
uses a 32-minute ceiling for other Players with a backup, and prevents automatic
natural `36→40` secondary promotion. The candidate is accepted and frozen.
Manual Charlotte Tech/Northbridge play confirmed no default above 36, a
plausible elite-core `36/29/29/29` shape, and no universal 40-minute League
leaders. The exact-40 automatic-default watchpoint is closed.

### Calibration

[CALIBRATION.md](CALIBRATION.md) is the methodology source of truth: direct subsystem diagnostics first; deterministic paired trials; QUICK, STANDARD, ACCEPTANCE, and EQUILIBRIUM tiers; parallel seed execution; LIGHT/FULL audits; and full production fidelity for acceptance.

## Rotation V1 — current production truth

Rotation V1 is canonical, active, validated, and frozen. It stores minutes by
floor position:

```text
PG 40   SG 40   SF 40   PF 40   C 40
200 Team minutes; maximum 40 aggregate minutes per Player

PG → PG / SG
SG → SG / SF
SF → SF / PF
PF → PF / C
C  → C / PF
```

Natural position remains Player identity; eligibility is derived and no
`secondaryPosition` is stored. Flexible deterministic defaults and manual legal
secondary-floor assignments are live. Recruiting openings, Offers, and roster
construction remain natural-position based.

Universe, Exhibition, Season, Postseason, Dynasty, Zustand, and React use V1.
Existing assignments survive progression, Postseason transition, cloning,
archives, drafts, and simulation without regeneration. Rotation V0 remains only
at intentional compatibility, conversion, equivalence-test, and historical
diagnostic boundaries. Exact generator rules and validation live in
`SIMULATION.md`; representation boundaries live in `ARCHITECTURE.md`; migration
history lives in `ROADMAP.md`; causal evidence lives in `PLAYTESTING.md`.

RESOLVED / FROZEN: the exact-40/star-workload watchpoint was resolved by Phase
6E.9B without changing the legal/manual 40-minute maximum. Interior/forward-heavy
secondary paths and rare large incumbent displacement remain WATCH.

## Current playtesting and watchpoints

[PLAYTESTING.md](PLAYTESTING.md) is the detailed empirical source of truth. The
Tournament seeding now preserves the selected four automatic qualifiers and 12
at-larges, then seeds all 16 together through the accepted results-only résumé
comparator. Player Details + Development History UX (Phase 6E.8) is complete:
Player Details now shows a compact nine-attribute ratings grid, a prominent
Career Progression table, and a compact Recruiting Origin section, all derived
from existing canonical facts. Phase 6E.9B is accepted/frozen. Phase 6E.10
Postseason Hub + Season-Complete Presentation Polish is complete/accepted: the
completed-Tournament outcome banner, the Season Complete checkpoint, and the
Recruiting summary now compose inside one `hub-primary-grid` two-column layout
instead of the Season Complete handoff rendering as a separate full-width
section beneath it, removing the previous dead space and duplicated-message
composition across the controlled-champion, controlled-eliminated, and
did-not-qualify completed states. The accepted bracket, seeding, and Recruiting
mechanics are unchanged. Phase 6E.11 Super Sim to Season Complete is accepted:
it reuses canonical Season, Tournament, and Recruiting progression to finish
competitive basketball and synchronize Period 28, then stops at the existing
Season Complete checkpoint before Late Recruiting. Phase 6E.12 Recruiting
Battles + Commitment Visibility is complete/accepted: pure selectors
(`deriveRecruitingBattleView`, `deriveRecruitingCommitmentActivity` in
`src/dynasty/recruiting/battleView.ts`) derive coarse commitment readiness,
active Board pursuers and Offers, categorical controlled-Program standing, and
commitment outcomes without exposing raw attraction, thresholds, AI utility,
or probability; the Season Hub, Recruiting Hub, and a Quick-Sim/Super-Sim
commitment-activity banner now present that projection (`UI_DESIGN.md`).
Standing-movement events remain unavailable because canonical Recruiting
stores no historical standing snapshots, so only provable commitment events
are ever shown. Phase 6E.12C Recruiting Information Architecture + Visual
Hierarchy Polish is complete/accepted: manual playtesting after 6E.12B found
the same battle intelligence shown in too many places at too much visual
weight, so this presentation-only pass established Hub = status, Board =
management, Battles = intelligence, National = discovery. Focus targets now
compose inside `RecruitingHubSummary` (no standalone Hub module, no
competitor detail, no `Manage Recruiting` CTA); `RecruitingBoardTable` is
management-only again (no Battle column/competitor lists), with an
accessible `RecruitingReadinessInfo` hover/focus affordance explaining the
five Readiness categories; a new `Battles` mode
(`RecruitingModeTabs`/`RecruitingBattlesGrid`) presents a responsive card
grid built from the unchanged `deriveRecruitingBattleView` selector, with
Program identity reusing the Tournament bracket's `.team-color-dot` square;
and the `RecruitingCommitmentAlerts` recap lost its Dismiss control, since
`recruitingActivityBaselinePeriod` now always replaces (never holds) on
every simulation boundary. 6E.12A's domain contract and all Recruiting
mechanics are unchanged. Phase 6E.13 diagnosed the production behavior behind
the new signals: generated controlled plans Offered only `35.6%` of their Focus
targets versus `92.7%` for AI plans, earning a narrow generated-plan coherence
candidate; `Early` preceded `63.2%` of commitments because already-strong
battles reached their first decision window next period, earning a readiness
communication/projection follow-up rather than timing changes; and unsigned
5★/4★ Board pursuit became broadly contested while Offer scarcity primarily
reflected positional Offer allocation and other-target selection. Premium
Offer allocation remains WATCH pending a separate diagnostic. No Recruiting
behavior changed. Phase 6E.14A resolves the generated-plan coherence finding:
`Generate Draft Board` now aligns its initial Focus targets after the unchanged
Board/Offer plan is built, raising paired STANDARD Focus-with-Offer coherence
from `35.6%` to `90.0%` versus the unchanged `92.7%` AI reference. This is a
one-time generated-plan rule; manual Focus and Offer remain independent. The
generated-plan watchpoint is closed.

Phase 6E.14B-A resolves the readiness-communication finding at the read-model
boundary. Pre-window Recruits now project as `not-deciding`, except exactly one
period before eligibility when the current eligible leader already satisfies
the next window's production standing and separation gates; that narrow state
projects as `decision-soon`. Decision-ready states remain `developing`,
`serious`, and `decision-imminent`, followed by `committed`. The projection
continues to hide periods, totals, thresholds, probabilities, utility, and rolls;
commitment mechanics and persisted state are unchanged. Phase 6E.14B-B
completes the presentation side: the Hub, Board, and Battles all use the
final labels (`Not Yet Deciding`/`Decision Soon`/`Developing`/`Serious
Battle`/`Decision Imminent`/`Committed`) and a restrained quiet-to-urgent
visual ramp built only from existing ink/accent tokens, the Readiness
tooltip explains all six states without exposing hidden values, and the
retired `Early Interest` label is gone from the current UI. Phase 6E.14B is
fully resolved. Phase 6E.15 adds the explicit `Fill Remaining Board` action:
it reuses the accepted deterministic Board target planner to append only legal
targets up to unused capacity, while preserving every existing Board entry in
place with its exact Focus and Offer state. New targets are Board-only; the
action never runs automatically and does not alter Generate Draft Board or AI
Recruiting. Coaching/roster navigation, Followed Players,
offseason progression visibility, Awards, and Save/Persistence retain
future QOL evidence.

Manual Development V1 play produced the intended divergent stories: Lucas Webb moved from `68` OVR through `+12`, `+3`, and `+1` to roughly `84`; Aaron Jackson progressed from `55/97` through `+12` and `+10` to roughly `84`; Silas Matthews rose from about `57/85` to about `82` as a senior, while other Players developed much less. Development V1 is producing meaningful bust/hit/breakout variation and should not be reopened by default.

True powerhouse states can occur: one Northbridge roster reached roughly `87` Team OVR with multiple `90+` and `85+` Players. Mature seasons can still be mostly 70s with the best Teams in the low/mid 80s. Powerhouse frequency and persistence remain a WATCH; current evidence does not justify reopening Recruit Talent V1 or Development V1.

Phase 6E.7B resolved the measured seed-label issue by removing protected
automatic-qualifier seeds while preserving automatic entry and exact field
selection. Paired STANDARD and FULL evidence improved mature alignment without
adding OVR to seeding. The accepted results-only rule is frozen; Game Sim
remains closed.

## Planning From Here

1. Read `CURRENT_STATE.md` completely.
2. Read `PLAYTESTING.md`: What Is Working / Fun, Playtest Stories, Repeated
   Playtest Friction, and Current Playtesting Priorities.
3. Read the current Phase section of `ROADMAP.md`.
4. Inspect current relevant code before proposing implementation.
5. Identify what is already fun, repeated friction, frozen systems, genuinely
   unresolved questions, and future ideas that should remain deferred.
6. Recommend the smallest next milestone.
   State whether Codex, Claude Code, or Codex → Claude should own it, following
   the division of labor in `COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md`.
7. For simulation/balance, diagnose first and follow `CALIBRATION.md`.
8. Prefer small green implementation milestones.
9. Validate fully before acceptance.
10. Feed meaningful manual-play evidence back into `PLAYTESTING.md`.

Rotation V1, Tournament seeding, Player Details + Development History UX,
Postseason Hub + Season-Complete Presentation Polish (6E.10), Recruiting
Battles + Commitment Visibility (6E.12), and Recruiting Information
Architecture + Visual Hierarchy Polish (6E.12C) are accepted/frozen; Game Sim
remains closed. A fresh planning session should select the next milestone
from the current `PLAYTESTING.md` priorities.

## Documentation map

| Document | Purpose |
| --- | --- |
| [README](../README.md) | Project overview |
| [CURRENT_STATE](CURRENT_STATE.md) | What is true right now |
| [ROADMAP](ROADMAP.md) | Milestone sequencing |
| [ARCHITECTURE](ARCHITECTURE.md) | System boundaries |
| [SIMULATION](SIMULATION.md) | Accepted production formulas and rules |
| [GAME_DESIGN](GAME_DESIGN.md) | Accepted game rules |
| [UI_DESIGN](UI_DESIGN.md) | Implemented presentation patterns and selected near-term UI direction |
| [PLAYTESTING](PLAYTESTING.md) | Observations and evidence |
| [CALIBRATION](CALIBRATION.md) | Tuning methodology |
| [KNOWN_ISSUES_AND_OPTIMIZATIONS](KNOWN_ISSUES_AND_OPTIMIZATIONS.md) | Confirmed unresolved technical/calibration issues |
| [FUTURE_FEATURES](FUTURE_FEATURES.md) | Deferred feature ideas |
| [ASSISTANT OPERATING GUIDE](COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md) | How a fresh assistant should reason, plan, calibrate, and hand off work |
| [DOCUMENTATION POLICY](DOCUMENTATION_POLICY.md) | Event-driven ownership and acceptance rules for maintaining project docs |
