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
Its documented watchpoints—36→40-minute stars, interior/forward-heavy
secondary usage, and rare large incumbent displacement—are not blockers.

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

WATCH—not blockers: 36→40-minute star frequency, interior/forward-heavy
secondary paths, and rare large incumbent displacement.

## Current playtesting and watchpoints

[PLAYTESTING.md](PLAYTESTING.md) is the detailed empirical source of truth. The
Tournament seeding now preserves the selected four automatic qualifiers and 12
at-larges, then seeds all 16 together through the accepted results-only résumé
comparator. Player Details + Development History UX (Phase 6E.8) is complete:
Player Details now shows a compact nine-attribute ratings grid, a prominent
Career Progression table, and a compact Recruiting Origin section, all derived
from existing canonical facts. The leading remaining UX opportunity is
Postseason Hub + Season-Complete Presentation Polish. Recruiting feedback and
Assistant Fill Remaining Board are high-value QOL candidates. Rotation
implementation is no longer active work.

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

Rotation V1, Tournament seeding, and Player Details + Development History UX
are complete. Game Sim remains closed. The next major UX/storytelling
opportunity is Postseason Hub + Season-Complete Presentation Polish. Use
Playtesting and Roadmap to select later QOL work.

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
