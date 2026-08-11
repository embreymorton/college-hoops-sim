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

## Current product

The application supports a repeatable multi-season Dynasty:

```text
New Dynasty
→ Regular Season
→ Recruiting
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

## Accepted / Frozen Unless New Evidence Appears

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

## Current Rotation production baseline — critical

Current production uses **Rotation V1** as its canonical live representation.

```text
RotationV1 stores minutes by floor position and Player ID.

PG = 40
SG = 40
SF = 40
PF = 40
C  = 40
Total = 200
```

Phase 6E.6A introduced the engine/domain representation:

`RotationV1.minutesByPosition[Floor Position][Player ID] = minutes`.

Every floor position must total 40 minutes, the Team must total 200, and a
Player may total at most 40. Rotation eligibility is derived from the Player's
canonical natural position (`PG → PG/SG`, `SG → SG/SF`, `SF → SF/PF`,
`PF → PF/C`, `C → C/PF`); it is not persisted on `Player`. Aggregate Player
minutes are derived from floor assignments rather than stored independently.
A valid Rotation V0 can be losslessly converted to natural-position-only V1.

Phase 6E.6B adds a representation-neutral engine read boundary. Team Strength,
game simulation, and box-score allocation can consume either valid V0 or V1 by
converging both into derived aggregate Player minutes before basketball math.
Paired deterministic tests prove natural-position-converted V1 produces exactly
the same OFF/DEF/OVR, scores, overtime, winners, and complete Player box scores
as V0, including mixed V0/V1 matchups. Legal true-secondary assignments also
flow through the boundary while natural Player position continues to determine
ratings and statistical tendencies.

Phase 6E.6C adds the opt-in deterministic `generateDefaultRotationV1(team)`.
It starts from the unchanged V0 default, converts it losslessly to V1, and then
applies only clear legal secondary-position substitutions. The pass uses the
Phase 6E.5 five-point balanced OFF/DEF contribution threshold, focuses on
buried or V0-capped eligible Players displacing 20-plus-minute incumbents, and
limits each Player to eight secondary minutes and 40 total minutes. If no
qualifying opportunity exists, it returns the exact converted V0 allocation.

At the 6E.6C checkpoint the generator was an isolated callable engine capability;
Phase 6E.6G later activates it at the fresh-default production boundaries
documented below.

Phase 6E.6D adds the centralized persistence compatibility boundary
`normalizeRotationToV1(team, rotationLike)`. The repository currently has no
Zustand persistence middleware, browser storage, save import/export, hydration
pipeline, or formal save schema version; state is in-memory and domain values
are only required to survive cloning and ordinary JSON serialization.
Accordingly, the boundary uses the unambiguous existing structural distinction
between V0 `minutes` and V1 `minutesByPosition` rather than adding a dormant
version marker. It validates before migrating or copying, rejects malformed and
ambiguous data explicitly, losslessly converts legacy V0 through the established
adapter, and preserves valid V1 secondary assignments in an isolated copy.

Phase 6E.6E makes Rotation V1 canonical throughout Universe, Exhibition,
Season, Postseason, Dynasty, Zustand drafts, and the React Rotation editor.
Existing V1 assignments are deep-cloned across state transitions, including
Season-to-Postseason.

The editor now treats its five groups as floor positions, lists Players through
the shared derived-eligibility rules, edits one floor bucket at a time, and
shows derived aggregate Player totals. Legal manual secondary minutes can be
committed and simulated; temporary invalid drafts remain isolated from
canonical state. The 40-minute aggregate Player cap is enforced by V1
validation. No `secondaryPosition` field was added to `Player`.

The engine simulation boundary continues to accept V0 and V1 for compatibility
and equivalence testing. Legacy V0 can still be validated and losslessly
normalized via `normalizeRotationToV1()`. There is still no persistence,
hydration, browser-storage, import/export, or formal save-schema boundary.

Phase 6E.6F behaviorally validates the dormant flexible generator as
**WATCH / ACCEPT**. A paired 96-Team direct audit changed 41 Teams, assigned
264 secondary minutes to 51 Players, improved average Team OVR by `+0.1142`,
and produced zero strength regressions. QUICK (1×3) and STANDARD (3×10) paired
Season comparisons found only negligible movement in scoring, shooting,
standings spread, close games, and blowouts. Real generated congestion cases
gave buried Players meaningful adjacent-position minutes.

Two post-activation watchpoints remain: 38 of 96 sampled Teams moved a V0-capped
36-minute Player to exactly 40, and interior/forward paths supplied 204 of 264
secondary minutes. Neither shortened overall rotations or caused broader
simulation harm in the paired validation, so no constants were changed.

Phase 6E.6G activates and freezes the accepted flexible generator. Fresh
Universe Teams, Exhibition defaults/resets, and Dynasty rollover/new-season
rosters now use `generateDefaultRotationV1(team)`. Season-to-Postseason,
cloning, archives, drafts, simulation, and manual updates continue preserving
existing V1 assignments exactly and never regenerate them. The natural-default
helper remains available only for paired diagnostics and equivalence evidence.
Rotation V0 remains intentional compatibility, conversion, and historical-test
infrastructure; it is no longer a live production default path.

## Position-flexibility diagnostic

Phase 6E.5 is accepted evidence, not an accepted implementation.

- Sample: 288 deterministic rosters across three seeds at Seasons 1, 5, and 10.
- `38` Teams (`13.2%`) had a clear adjacent-position congestion case.
- `63` buried-player pairs had an average contribution gap of `7.54`.
- Candidate Team OVR changes: universal adjacent `+2.21` mean; narrow secondary candidate `+1.92` mean, `+1.74` median, `+5.13` maximum.
- Northbridge / Great Lakes gained approximately `+1.67` under the narrow candidate. Pine Valley gained approximately `+2.05`, without erasing the broader talent hierarchy.

Conclusion: strict natural-position defaults were a confirmed gameplay
limitation. Manual and deterministic AI/default flexibility are now live and
accepted, subject to the documented WATCH metrics.

## Current playtesting and watchpoints

[PLAYTESTING.md](PLAYTESTING.md) is the detailed empirical source of truth. The
next unresolved simulation question is Tournament balance/seeding. Leading UX
opportunities are Player Details + Development History and Postseason Hub +
Season-Complete Presentation Polish. Recruiting feedback and Assistant Fill
Remaining Board are high-value QOL candidates. Rotation implementation is no
longer active work.

Manual Development V1 play produced the intended divergent stories: Lucas Webb moved from `68` OVR through `+12`, `+3`, and `+1` to roughly `84`; Aaron Jackson progressed from `55/97` through `+12` and `+10` to roughly `84`; Silas Matthews rose from about `57/85` to about `82` as a senior, while other Players developed much less. Development V1 is producing meaningful bust/hit/breakout variation and should not be reopened by default.

True powerhouse states can occur: one Northbridge roster reached roughly `87` Team OVR with multiple `90+` and `85+` Players. Mature seasons can still be mostly 70s with the best Teams in the low/mid 80s. Powerhouse frequency and persistence remain a WATCH; current evidence does not justify reopening Recruit Talent V1 or Development V1.

Repeated play has produced 1/16 upsets, low-seed championship runs, and memorable Cinderella outcomes, but extreme seed differences can sometimes hide modest Team OVR differences. Tournament variance is **not** confirmed broken. Diagnose seeding quality versus actual game upset variance before tuning Game Sim.

## Planning From This State

1. Read `CURRENT_STATE.md`.
2. Read current priorities and unresolved evidence in `PLAYTESTING.md`.
3. Check `ROADMAP.md` for completed work and intentional sequencing.
4. Inspect the current relevant code before proposing architecture.
5. Use `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` only for confirmed engineering risks.
6. Use `FUTURE_FEATURES.md` only as an unscheduled idea bank.
7. If work changes simulation or balance, follow `CALIBRATION.md`.
8. Preserve frozen systems unless new evidence justifies reopening them.
9. Prefer small green milestones.
10. Feed observations from meaningful manual play back into `PLAYTESTING.md`.

## For the Next Planning Session

Start here. Read this file completely, then `PLAYTESTING.md`—especially Current
Playtesting Priorities and Playtest Stories / Design Signals—then Roadmap Phase
6E. Inspect current code before designing implementation. Treat frozen systems
as closed without new evidence; use Future Features for optional discovery, not
priority, and Known Issues for confirmed risks, not a feature backlog.

Rotation V1 is complete and frozen. The next unresolved simulation question is
Tournament seeding versus actual upset behavior. The next major UX/storytelling
opportunities are Player Details + Development History and Postseason Hub +
Season-Complete Presentation Polish. Use Playtesting and Roadmap to select later
QOL work.

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
