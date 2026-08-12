# Roadmap

Milestones remain small enough to test independently. A later phase or unlisted system may not be implemented early without explicit scope discussion. Status labels are deliberate: **COMPLETE** is implemented, validated, and accepted; **ACTIVE** is implemented or being validated in the current milestone; **NEXT** is the immediate future milestone; **PLANNED** expresses later intent without implementation; and **DEFERRED** is outside the core MVP.

Exact formulas and constants become source-of-truth documentation after implementation and validation, not before. Validation sample outputs inform acceptance but are not roadmap requirements.

This file contains work intentionally placed in the development sequence. It is not a wishlist: unscheduled product ideas live in `FUTURE_FEATURES.md`, while engineering bugs, debt, and scaling watchpoints live in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

Empirical priority changes originate in `PLAYTESTING.md`; only deliberately
selected work moves here. Documentation updates follow
`DOCUMENTATION_POLICY.md`.

## Phase 0 — Foundation — COMPLETE

- React, TypeScript, Vite, Zustand, Vitest, and Testing Library foundation
- Lint, type-check, test, and production-build workflows
- Framework-independent `src/engine` boundary with enforced dependency rules
- Seeded deterministic randomness and serializable domain conventions
- Source-of-truth product, architecture, simulation, and UI documentation

## Phase 1 — Basketball Engine V0 — COMPLETE

### Players and deterministic generation

- Serializable Player model, positions, class years, height, attributes, and potential
- Position-aware derived overall rather than mutable stored ratings
- Deterministic fictional identity, height, attribute, and class-aware potential generation
- Player-generation calibration and invariant coverage

### Teams, prestige, and rosters

- Serializable Team model and program prestige
- Deterministic 12-Player roster generation
- Prestige-driven quality, star-to-depth structure, class balance, and positional coverage

### Rotations

- Serializable Rotation model and structured validation
- Deterministic default Rotation generation
- Accepted v0.1 constraint of 40 minutes at each natural position and 200 Team minutes

### Player OFF/DEF and Team Strength

- Position-aware derived Player offense and defense
- Rotation-weighted Team offense and defense
- Derived Team overall

### Game Simulation V0

- Deterministic Team-level outcomes, final scores, winner, and reproduction seed
- Home-court advantage, seeded game variance, and terminating overtime

### Player Box Scores V0

- Full-roster traditional Player statistics and shooting lines
- Exact Player-points-to-Team-score reconciliation
- Regulation/overtime minute reconciliation, shooting arithmetic, determinism, serialization, and non-mutation invariants

## Phase 2 — First Playable Coaching Loop — COMPLETE

### 2.1 Game Presentation V0 — COMPLETE

- Six deterministic demo-program fixtures with presentation metadata
- Distinct home/away matchup selection
- Engine-generated rosters, an editable home Rotation, and a displayed default away Rotation
- Displayed Team OFF, DEF, and OVR
- Real `simulateGame()` integration through Zustand application orchestration
- Final score, winner, overtime, and both Teams' Player box scores
- Deterministic re-simulation using a stable matchup-and-sequence seed scheme
- Change Matchup workflow

The demo catalog is not a league. HOME is the coached side only for the current exhibition workflow; this is not yet a permanent dynasty user-Team model.

### 2.2 Rotation Management V0 — COMPLETE

> The coach can change who plays and how many minutes they receive, see the consequences of those choices, and simulate the game using the edited legal rotation.

- Exact numeric home-Team Player-minute editing within the v0.1 natural-position restriction
- Temporary invalid editing states with visible position and 200-minute Team budgets
- Engine-authoritative Rotation validation and blocked simulation while invalid
- Default/current OFF, DEF, and OVR comparison for legal edits
- Reset to generated default Rotation
- Simulation using the actual edited legal home Rotation and default away Rotation
- Custom Rotation preservation through postgame return and Simulate Again
- Default Rotation restoration when the coached home program changes
- Deterministic matchup-and-sequence simulation seeds

## Near-term planning horizon

These identifiers are planning aids, not immutable contracts. Later implementation discoveries may reshape them.

| Task | Intended slice | Status |
| --- | --- | --- |
| 010 | Rotation Management application/state support | COMPLETE |
| 011 | Rotation Editor UI | COMPLETE |
| 012 | Rotation validation and UX polish | COMPLETE |
| 013 | Stable 32-program fictional program catalog | COMPLETE |
| 014 | Four-conference model and universe assembly | COMPLETE |
| 015 | Schedule generation | COMPLETE |
| 016 | Season State and progression | COMPLETE |
| 017 | AI Round Simulation and Standings V0 | COMPLETE |
| 019 | Season Presentation V0 | COMPLETE |
| 020 | Season UX Polish V0 | COMPLETE |
| 021 | Super Sim V0 | COMPLETE |
| 022 | Player Season Stats V0 | COMPLETE |
| 023 | Postseason Domain / Simulation V0 | COMPLETE |
| 024 | Postseason Presentation V0 | COMPLETE |
| 025 | League & Player Exploration V0 | COMPLETE |
| 026 | Team Stats / Exploration V0.1 | COMPLETE |
| 027 | Season + Postseason Game Flow QOL | COMPLETE |
| 028 | Quick Sim Result / Game Leaders polish | COMPLETE |

## Phase 3 — League and Season Framework — COMPLETE

The single-game coaching loop, regular-season structure, canonical Season State, autonomous AI round execution, derived standings, permanent Season presentation, regular-season UX polish, Super Sim, and derived Player Season Stats/game logs are complete. The current regular-season simulation and backend feature set is functionally complete for MVP scope.

### 3.1 Stable Fictional Basketball Universe V0 — COMPLETE

- A versioned `UniverseDefinition` with 32 permanent fictional Programs across four permanent V0 Conferences of eight
- Stable program identities and deterministic IDs
- Structured locations, presentation branding, fixed V0 Conference membership, and immutable base prestige
- Deterministic initial Team and default-Rotation generation through isolated per-Program RNG streams
- Stable same-seed reproduction and Program-order-independent roster generation
- Public `src/universe` API, definition validation, stable Team IDs, and valid initialized Rotations

Universe V0 now contains the validated 32-program/four-conference catalog, stable metadata, and deterministic order-independent initialization of Teams and default Rotations. Initialized Team IDs match their Program IDs, and initial Team prestige matches immutable Program base prestige. Its configured counts do not constrain the generic engine. The six-program exhibition catalog remains a presentation subset plus one development-only fixture.

### 3.2 Schedule Generation V0 — COMPLETE

> Given the stable Universe V0 Conference/Program structure, generate a deterministic regular-season schedule in which every Program receives a legal set of opponents and home/away assignments suitable for later Season State.

The accepted implementation uses 24 complete abstract rounds with all 32 Programs playing once among 16 games per round. Each Program receives 14 double-round-robin Conference games, 10 distinct cross-Conference games, and an exact 12-home/12-away split. It creates 384 canonical unplayed games with deterministic IDs and stable Program references, but no dates, results, records, or progression.

Validation confirms reciprocal Conference hosting, zero duplicate non-Conference matchups, cross-Conference-only non-Conference play, same-seed reproduction, Program/Conference input-order independence, and different-seed schedule variation. The inspection sample produced valid schedules for 100 of 100 deterministic seeds.

### 3.3 Season State and Progression V0 — COMPLETE

> Combine an initialized Universe with a generated Schedule into serializable Season state that can progress round by round, record completed `GameResult` values, and expose enough derived information for records, Conference records, upcoming games, and later standings.

The accepted implementation stores immutable Schedule structure, current Team/Rotation state by Program ID, and complete GameResults once by ScheduledGame ID. It supports legal Rotation updates, out-of-order and partial-round result recording, Program schedule/result queries, derived current-round and completion queries, and derived Program and Conference records without duplicate counters. Operations are pure, Season validation is structured and serializable, and state survives JSON round-tripping.

The accepted inspection begins with 32 Programs, 24 rounds, 384 ScheduledGames, zero completed games, current Round 1, and valid Season state. Five recorded Round 1 games leave the current round at 1; all 16 advance it to 2. A legal custom Rotation preserves the Team and Season validity, while duplicate results, mismatched Teams, unknown ScheduledGames, and invalid Rotations are rejected.

### 3.4 AI Round Simulation and Standings V0 — COMPLETE

> Given the current Season State, deterministically simulate pending scheduled games using each Program's current Team and Rotation, record the resulting GameResults, advance naturally through rounds, and derive Conference standings from completed results.

- Give each ScheduledGame an independent deterministic simulation identity so execution order cannot change outcomes.
- Use each Program's current Season Team and Rotation.
- Record results through the existing `recordGameResult()` behavior and never re-simulate already-completed games.
- Preserve partial-round progression.
- Derive standings rather than storing them, using the accepted V0 ordering below.

The accepted implementation provides independent per-game seeds, current-Rotation scheduled-game simulation, partial-round execution with generic Program exclusions, and derived Conference standings. Its V0 tiebreak order is Conference win percentage, decisive head-to-head only for an exact two-Team tie group, overall win percentage, then stable Program ID. Standings and records remain derived rather than stored.

Validation confirmed that excluded pending games survive AI round execution, all 384 ScheduledGames can complete through production APIs, Season completion and validation pass, same-seed full seasons reproduce, game execution order does not affect individual outcomes, and different simulation seeds change Season outcomes. The 50-season strength diagnostic is observational rather than normative.

### 3.5 Season Presentation V0 — COMPLETE

> The user selects and controls a Program, sees the current Season context, manages its Rotation, plays or simulates its scheduled game, simulates remaining AI games in the round, and views updated schedule/results and Conference standings through the existing React application.

- Program selection across the 32 permanent Universe V0 Programs, grouped by Conference
- A Season Hub: program-identity header, next-game preview, round-progress and regular-season-complete states, Conference standings, and schedule/results
- Game prep and postgame reusing the accepted Rotation Editor, scoreboard, and box-score presentation
- `controlledProgramId` and a deterministic session seed live in application state, never in `SeasonState`

Season Presentation consumes the existing Universe, Schedule, Season, simulation, and standings APIs rather than reimplementing basketball state or rules. The six-program exhibition workflow remains as a secondary sandbox behind a mode toggle.

### 3.6 Season UX Polish V0 — COMPLETE

- Hub Quick Sim directly plays the controlled Program's next ScheduledGame and presents the result inline.
- Game Prep remains the optional hands-on path; legal changes persist as the Program's current Season Rotation.
- Quick Sim uses that committed legal Rotation and is unaffected by a stale invalid Game Prep draft.
- Completed Schedule and Recent Results entries reopen the stored read-only result with its full historical box score.
- Recent Results and its Last-N record are derived from completed Season results.
- The permanent Season flow is primary; Exhibition remains useful secondary development tooling.

### 3.7 Super Sim V0 — COMPLETE

- **Sim to Midseason** resolves every pending regular-season game through Round 12.
- **Sim to End of Regular Season** resolves every pending game through Round 24.
- Confirmation and one-time completion feedback remain Zustand presentation state.
- Bulk progression preserves completed games and uses every Program's current Team and Rotation.
- Normal progression and Super Sim produce identical `GameResult` values for identical Season state, simulation seed, Teams, and Rotations.
- Every path retains full `PlayerGameStats`; Super Sim is a pacing convenience, not a separate simulation model.
- Super Sim stops at regular-season completion and does not create or enter postseason play.

### 3.8 Player Season Stats V0 — COMPLETE

> Derive useful Player season totals, averages, percentages, and game logs from the full `PlayerGameStats` already retained in completed Season `GameResult` values.

The derived surface preserves and aggregates minutes, PTS, REB, AST, STL, BLK, TO, FGM/FGA, 3PM/3PA, and FTM/FTA. The accepted data flow is:

```text
recorded GameResults
→ PlayerGameStats rows
→ derived PlayerSeasonStats / game logs
```

The accepted pure projections support individual, Program-wide, and Season-wide Player stat rows for partial or complete Seasons plus chronological Player game logs with opponent, location, result, and DNP context. `gamesPlayed` counts only completed games with positive Player minutes. Totals reconcile to canonical `PlayerGameStats`, percentages use aggregate makes and attempts, zero denominators produce numeric zero, and result insertion order cannot change the output.

No Player totals, averages, percentages, or game logs are stored as mutable `SeasonState` counters. Inspection completed all 384 regular-season games, derived 384 current-roster Player lines, and passed raw-total reconciliation, games-played, finite-number, chronological-order, and JSON-serialization checks.

### 3.9 League & Player Exploration V0 — COMPLETE

- National regular-season PPG, RPG, APG, SPG, and BPG leaderboards
- Complete 32-Program Teams directory
- Team Details with record, OFF/DEF/OVR, recent results, roster, and Player statistics
- Player Details with identity, ratings, regular-season statistics, and chronological game log
- Cross-Program navigation from standings, leaderboards, rosters, schedules, and Player links

All statistical and navigation summaries are derived from stable Universe identity plus canonical Season facts. Zustand stores navigation context, not leaderboard or Player-stat truth.

### 3.10 Team Stats / Exploration V0.1 — COMPLETE

- Pure regular-season `TeamSeasonStats` totals and rates over completed `GameResult` values
- Team averages for scoring, opponent scoring, margin, counting stats, and shooting percentages
- Team PTS/REB/AST leaders derived from existing Player Season Stats
- Team Details presentation of these projections without mutable Team-stat state

## Phase 4 — Postseason V0 — COMPLETE

> Feed a completed regular season into the accepted fixed 16-Team national tournament through deterministic selection, seeding, neutral-site simulation, and result-derived advancement.

Postseason Domain / Simulation V0 is implemented, validated, reviewed, and accepted. A valid completed regular season supplies one automatic qualifier per Conference through the existing Conference standings leader and 12 at-large selections. Phase 6E.7B superseded protected automatic-qualifier seeds: after selection, all 16 Programs are seeded together using overall winning percentage, decisive head-to-head only for an exact two-Team tie, Conference winning percentage, and stable Program ID; three-or-more-Team ties skip direct head-to-head.

The complete fixed bracket contains eight Round-of-16 games, four quarterfinals, two semifinals, and one Championship. It permits same-Conference matchups, never reseeds, and simulates every game at a neutral site. Qualified Programs carry forward exact Team and current legal Rotation state, can make legal Rotation changes between games, and retain full `GameResult` / `PlayerGameStats` facts. Future participants, current round, remaining Programs, completion, and National Champion are derived rather than stored.

Accepted validation completed 384 of 384 regular-season games, selected 16 Programs with four automatic and 12 at-large bids, completed and validated all 15 tournament games, reproduced same-seed tournaments, preserved ready-game execution-order independence, changed outcomes under a different simulation seed, derived the National Champion, retained complete Player box scores, and confirmed neutral-site simulation removes the normal home-court modifier.

The core single-season basketball experience is now complete from Program initialization through National Champion.

### Postseason Presentation V0 — COMPLETE

The completed regular season now transitions into a React Tournament Hub backed by an active `PostseasonState`. The browser presents the 16-Team field, bid types and seeds, canonical fixed bracket, controlled Program matchup and neutral-site Quick Sim, Tournament Rotation Management, AI rest-of-round progression, eliminated and did-not-qualify states, historical Tournament box scores, and the derived National Champion endpoint. The wider Tournament remains playable when the controlled Program loses or does not qualify.

Zustand retains the completed `SeasonState` alongside the active `PostseasonState` and coordinates navigation, drafts, and user actions. It delegates selection, participant resolution, progression, results, and champion derivation to the public Postseason API, so presentation does not duplicate Tournament rules or mutate completed regular-season facts.

### Season + Postseason Game Flow QOL — COMPLETE

Both competition Hubs now expose the same intentional pacing contract:

```text
SIMULATE GAME → remain on Hub → inline canonical result → optional Box Score
GAME PREP → Rotation/detail flow → simulate → Box Score
```

Quick Sim resolves only the controlled game. Round progression remains explicit and uses the accepted pending-game APIs; completed results are preserved. Regular-season Super Sim remains in the separate Round Progression card, and Postseason adds no Super Sim-to-Championship path.

### Quick Sim Result / Game Leaders polish — COMPLETE

Completed Quick Sim cards preserve site and overtime context, show outcome/margin, and derive whole-game PTS/REB/AST leaders from both teams' canonical stored `PlayerGameStats`. Each leader retains Player and Program identity; deterministic ties use minutes and stable Player ID. The Hub remains a compact summary rather than a replacement Box Score.

The complete single-season game loop is implemented and exposed through the UI, from Program selection through National Champion.

## Phase 5 — Dynasty Loop Backend — COMPLETE

> The backend and application now support the complete repeatable cross-season lifecycle.

The intended high-level lifecycle is:

```text
Season N begins
→ Recruiting Class for Season N+1 exists

REGULAR SEASON
├── basketball rounds
└── recruiting advances alongside completed rounds
→ Postseason (recruiting may continue or finalize)
→ Late Recruiting finalizes every projected opening
→ archive completed Season + Postseason
→ seniors graduate
→ returning Players develop and classes advance
→ committed recruits enroll as freshmen
→ every Program finalizes a 12-Player roster
→ fresh default Rotations + new deterministic Schedule
→ Season N+1 + Recruiting targeting N+2
→ repeat
```

### Phase 5A — Dynasty Foundation + Progression V0 — COMPLETE

- Serializable `DynastyState` lifecycle owner above Season, Postseason, Universe, and Engine
- Full `CompletedSeasonArchive` snapshots retaining canonical regular-season and Tournament `GameResult` / `PlayerGameStats` facts
- Strict completed-year transition requiring a complete regular season, complete Tournament, and derived National Champion
- Stable returning Player identity with immutable historical Player snapshots
- In-season `deriveProjectedRosterOutlook()` for deterministic senior departures, returners, and next-season openings
- Senior graduation; `FR → SO`, `SO → JR`, and `JR → SR` class advancement
- Deterministic, position-aware, Potential-constrained Player Development V1
- Temporary incomplete `OffseasonState` rosters with preserved current Program prestige and derived open spots

The accepted canonical inspection archived all 384 regular-season and 15 Postseason games, graduated 92 of 384 Players, and created 292 returning Player values across all 32 Programs without changing IDs or historical snapshots. All Dynasty/archive/offseason values passed JSON serialization; same-seed reproduction and Program/Player-order independence passed. The observed development curve was approximately +3.6 OVR for FR→SO, +2.6 for SO→JR, and +1.3 for JR→SR, with 10.3% stagnation. These are calibration observations for one deterministic population, not guaranteed outcomes.

Phase 5A intentionally stops at partial offseason rosters. Phase 5C consumes those values with finalized incoming classes; Phase 6 exposes the lifecycle through the player-facing application.

### Phase 5B — In-Season Recruiting V0 — COMPLETE / ACCEPTED

- One deterministic national Recruiting Class targeting Season N+1, with national/position rankings and 2–5-star classifications
- Strict projected positional needs, boards of up to 10 targets, and capacity-limited Active Offers; the original Priority 1–5 mechanic was later superseded by Phase 6E.2A's accepted Board + Focus + Offer model
- Fixed Board baseline effort plus capped Focus bonuses, quality-dependent decision timing, final commitments, and autonomous AI Recruiting
- Recruiting periods 1–24 synchronized to regular-season completion and periods 25–28 synchronized to Postseason completion
- Canonical period-by-period Super Sim equivalence, including offer invalidation and controlled-Program backup promotion from the existing board
- Distinct Late Recruiting and deterministic finalization using the original class, producing a complete `CompletedRecruitingClass`
- Stable Recruit Player identity through generation, commitment, and the finalized incoming class

Commitments remain future-roster facts and do not mutate the current Team, Rotation, or `SeasonState`. Recruiting is owned by the Dynasty layer and stores its finalized history separately from completed basketball-season archives. Exact accepted mechanics and formulas live in `GAME_DESIGN.md`, `ARCHITECTURE.md`, and `SIMULATION.md`.

### Phase 5C — Season Rollover V0 — COMPLETE / ACCEPTED

- **5C.1 — Next-Season Roster Assembly V0:** combines accepted returners and finalized commitments into exact 12-Player rosters, enrolls Recruits as freshmen without changing identity or attributes, rejects malformed lifecycle inputs, and preserves every source snapshot.
- **5C.2 — Dynasty Season Rollover V0:** atomically creates fresh Team snapshots, default Rotations, a season-specific Schedule and Game IDs, a clean `SeasonState`, and Recruiting targeting N+2 while preserving histories and the controlled Program.
- Same-state determinism, Program-order independence, JSON serialization, cross-cycle identity safety, and five consecutive completed Dynasty seasons are accepted.

The backend lifecycle is now repeatable:

```text
Season N → Recruiting N+1 → Postseason → Offseason
→ exact next roster → Season N+1 → Recruiting N+2 → repeat
```

## Dynasty Long-Run Calibration V0 — COMPLETE / ACCEPTED

Five deterministic Dynasty seeds completed 50 Seasons each for 250 Season observations with deterministic replay. Average Team OVR rose during the initial generated-roster transition, then stabilized: Seasons 1–5 averaged `77.55` with a `+2.041` slope/Season; Seasons 6–15 averaged `81.13` with a `−0.085` slope; and Seasons 16–50 averaged `81.25` with a `+0.003` slope. The late slopes across individual seeds ranged from `−0.016` to `+0.012`.

Recruiting, Player Development, graduation, and rollover produced a stable endogenous V0 talent economy. All 250 lifecycle iterations retained valid rosters, Rotations, Schedules, Recruiting completion, identity/history integrity, and serialization. No gameplay calibration changed. Exact observations live in `SIMULATION.md`.

This historical V0 equilibrium established lifecycle stability, but its Recruit
talent distribution and Development behavior were intentionally superseded by
Phase 6E.2B and Phase 6E.4 after manual playtesting. Current frozen production
truth is Recruit Talent Distribution V1 plus Player Development V1.

## Phase 6 — Dynasty Application Loop — COMPLETE

- **6A — Dynasty Application State Integration:** Zustand adopts one canonical `DynastyState` for Season, Postseason, Recruiting, and session navigation.
- **6B — Recruiting Management UI:** Board/National Class, positional needs, Focus, and Active Offers are playable.
- **6B.1 — Recruiting Setup Workflow:** the controlled Program can begin with an empty board while AI plans remain autonomous; first-period progression is guarded until the user chooses a plan.
- **6B.2 — Recruiting Onboarding + Hub Polish:** clear preseason onboarding and Season/Tournament Recruiting entry points.
- **Unique interactive Dynasty seed:** each normal new Dynasty receives a unique stored seed while explicit-seed development, tests, and calibration remain deterministic.
- **6C — Dynasty Transition Orchestration:** explicit championship, Late Recruiting, finalization, Offseason, and rollover boundaries use canonical domain transitions and reset stale session presentation state.
- **6D — Late Recruiting + Offseason UX:** Late Recruiting, finalized-class feedback, departures, development, incoming class, next-roster preview, and the Season N+1 handoff are player-facing.

## Phase 6E — Playthrough-Driven Calibration & Polish — ACTIVE

This phase uses manual playthrough observations and targeted diagnostics rather than a predetermined feature schedule. `PLAYTESTING.md` is the detailed source of truth for current observations, hypotheses, and next investigations; `CALIBRATION.md` defines the validation methodology.

### Historical completed implementation sequence

- **6E.1 — Recruiting + Talent Balance Investigation:** COMPLETE.
- **6E.2A — Recruiting Focus Model:** COMPLETE.
- **6E.2A.2 — AI Recruiting Plan Coherence:** COMPLETE.
- **6E.2B — Recruit Talent Distribution V1:** COMPLETE.
- **6E.3 — Development + League Talent Progression Diagnostic:** COMPLETE. Direct careers and 3×10/5×10 production-Dynasty runs found capped annual growth, weak high-headroom differentiation, and a thin mature powerhouse tier; see `PLAYTESTING.md`.
- **6E.4 — Player Development V1:** COMPLETE. Class baseline, headroom-sensitive opportunity, stable hidden tendency, annual variance, rare breakouts, and the Potential cap now create deterministic career diversity without a Prestige multiplier; see `SIMULATION.md` and `PLAYTESTING.md`.
- **6E.5 — Position / Rotation Flexibility diagnostic:** COMPLETE. At this checkpoint the strict natural-position limitation was confirmed and narrow secondary flexibility remained diagnostic-only; its recommendation was subsequently implemented and accepted through Rotation V1 in 6E.6.
- **6E.6A — Rotation V1 Engine Foundation:** COMPLETE. A parallel floor-position-aware domain representation, natural-position-derived eligibility, structured validation, aggregate-minute projections, and a lossless V0-to-natural-only-V1 adapter now exist. Production state, simulation, default Rotation generation, and UI remain on Rotation V0.
- **6E.6B — Engine Read Boundary + V0/V1 Equivalence:** COMPLETE. Team Strength, game simulation, and box-score allocation accept V0 or V1 through one aggregate Player-minute read path. Paired normal, strength-gap, overtime, mixed-representation, and true-secondary tests preserve exact deterministic results and natural-position ratings/tendencies.
- **6E.6C — Opt-In Rotation V1 Default Generator:** COMPLETE. The isolated deterministic generator begins with the unchanged V0 default and applies conservative legal secondary substitutions only for clear five-point balanced-contribution upgrades, with incumbent, secondary-minute, and total-minute safeguards. Production generation and persisted/application state remain V0.
- **6E.6D — Rotation Persistence / Compatibility Foundation:** COMPLETE. One structurally discriminated normalization boundary losslessly migrates valid legacy V0 allocations to canonical natural-only V1, preserves valid V1 secondary assignments, and explicitly rejects malformed state. No live persistence mechanism or production V1 state exists yet; the application migration inventory is recorded in `CURRENT_STATE.md`.
- **6E.6E — Rotation V1 Production Representation Migration:** COMPLETE. Universe, Exhibition, Season, Postseason, Dynasty, Zustand, and React now store/edit canonical V1; existing assignments deep-clone across transitions, while all new production defaults preserve V0 behavior through lossless V0-to-V1 conversion. Manual legal secondary assignments are supported. The flexible V1 generator remains opt-in and inactive.
- **6E.6F — Rotation V1 Generator Behavioral Validation:** COMPLETE — WATCH / ACCEPT. Paired direct, QUICK 1×3, and STANDARD 3×10 comparisons found real congestion relief, zero Team Strength regressions, stable rotation depth, and negligible ecosystem movement. Monitor the frequency of 36→40-minute stars and the interior-heavy secondary-position mix after activation; no generator tuning was warranted.
- **6E.6G — Rotation V1 Production Activation + Freeze:** COMPLETE. Fresh Universe, Exhibition, and Dynasty rollover defaults now use the accepted deterministic flexible generator. Existing V1 rotations remain exact across cloning, Season/Postseason transitions, archives, drafts, and simulation. Its original 40-minute watchpoint was subsequently resolved by 6E.9B; interior-path and rare-displacement watches remain. V0 remains only at intentional compatibility/equivalence boundaries.
- **6E.7 — Tournament Balance / Seeding Diagnostic:** COMPLETE — OUTCOME A. Production-lifecycle STANDARD `3 × 10` evidence plus a bounded `5 × 10` expansion separated seed upsets from strength upsets. Seed quality tracked win percentage strongly but Team OVR only moderately, with weaker alignment in Season 5+; the stronger-Team win curve rose from competitive tiny gaps to an `82.8%` win rate at `8+` OVR. The evidence identifies a likely seeding/ranking issue while leaving Game Sim closed. No production behavior changed.
- **6E.7B — Tournament Seeding Candidate:** COMPLETE — ACCEPTED / FROZEN. The exact same four automatic qualifiers and 12 at-larges are now seeded together through the existing deterministic results-only résumé comparator. Paired STANDARD and FULL `5 × 10` evidence improved mature seed/OVR alignment and extreme 3/14 matchup truthfulness while strengthening résumé correlation, preserving Tournament variance, and leaving Game Sim and Team Strength unchanged.
- **6E.8 — Player Details + Development History UX:** COMPLETE. Player Details now shows a compact nine-attribute ratings grid, a prominent Career Progression table (Season/Class/OVR/Dev/PPG/RPG/APG) derived purely from archived Dynasty Season snapshots plus the active Season, and a compact Recruiting Origin section for Players resolved from finalized Recruiting history. No new persisted history state was added; `derivePlayerCareerHistory` in `src/dynasty/careerHistory.ts` connects existing canonical facts by stable Player ID. Existing current-season stats, shooting splits, game log, and Team/Player navigation are unchanged. See `UI_DESIGN.md` and `PLAYTESTING.md`.
- **6E.9 — Rotation Minutes Realism Diagnostic:** COMPLETE — OUTCOME A + C. Production-lifecycle STANDARD `3 × 10` evidence found exact-40 defaults uncommon across active Rotation Players (`2.9%`) but common among top-10 scorers (`51.0%`) and 90+ OVR Players (`51.5%`). All `301` cases were natural `36 → 40` through four flexible secondary minutes; none originated at natural 40. Season 5+ incidence was slightly lower than Season 1, and assigned-40 Players averaged `40.035 MPG`. Rotation V1 remains accepted/frozen overall; no production behavior changed.
- **6E.9B — Starter Minutes Realism Candidate:** COMPLETE — ACCEPTED / FROZEN. Team top-three OVR role now gates the 36-minute natural ceiling; other Players with a backup use 32, natural-36 Players are excluded from automatic secondary promotion, and useful legal secondary Players may absorb positive weak-backup shares up to eight minutes. STANDARD improved natural-36 quality and removed all `301` baseline exact-40 defaults while preserving secondary access and Team Strength; FULL `5 × 10` observed zero exact-40 defaults across `16,717` active Rotation Players with deterministic structural health.
- **6E.10 — Postseason Hub + Season-Complete Presentation Polish:** COMPLETE — ACCEPTED. The completed-Tournament outcome banner, the `SeasonCompleteHandoff` checkpoint, and the Recruiting summary now compose inside the same `hub-primary-grid` two-column layout instead of `SeasonCompleteHandoff` rendering as a separate full-width section: the Tournament outcome banner and Season Complete checkpoint stack together in the left/game column, and `RecruitingHubSummary` gains an `isSeasonComplete` hint ("Late Recruiting is next — this board carries forward.") in the right column. This removes the large dead space and duplicated-message full-width panel previously seen after Tournament completion, for the controlled-champion, controlled-eliminated, and did-not-qualify completed states alike, without changing the accepted bracket, seeding, or any Tournament/Recruiting mechanics. Manual play confirmed the composition across all three outcome states and both desktop and narrow layouts.

### Current planning horizon

- **6E.11 — Super Sim to Season Complete:** NEXT — CANDIDATE. The next-highest repeated-friction QOL priority in `PLAYTESTING.md` once Postseason presentation is resolved; a fresh planning session should confirm scope before implementation.

Repeated near-term QOL priorities include Recruiting Focus/commitment
visibility, Assistant Fill Remaining Board, Coaching/roster navigation, and
Followed Players. League News, Season Hub hierarchy, offseason
progression/League context, Awards, Save/Persistence, records, shot-selection
investigation, and minor presentation polish remain observed/later rather than
a fixed feature schedule.

This order is evidence-driven: Tournament seeding and Game Sim remain closed;
Player Details is complete and positively received; the narrow Rotation
candidate is accepted/frozen; and Postseason Hub + Season-Complete Presentation
Polish is now accepted/complete.

## Non-binding development-agent fit

Codex is well suited to engine/domain systems, validation, simulation, and league/schedule/season state. Claude Code is well suited to presentation and interaction implementation against existing engine/application contracts. This is a planning convenience, not an architectural requirement; either agent must obey the same boundaries and source-of-truth documentation.
