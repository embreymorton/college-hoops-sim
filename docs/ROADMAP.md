# Roadmap

Milestones remain small enough to test independently. A later phase or unlisted system may not be implemented early without explicit scope discussion. Status labels are deliberate: **COMPLETE** is implemented, validated, and accepted; **ACTIVE** is implemented or being validated in the current milestone; **NEXT** is the immediate future milestone; **PLANNED** expresses later intent without implementation; and **DEFERRED** is outside the core MVP.

Exact formulas and constants become source-of-truth documentation after implementation and validation, not before. Validation sample outputs inform acceptance but are not roadmap requirements.

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
| 022 | Player Season Stats V0 | NEXT |

## Phase 3 — League and Season Framework — COMPLETE

The single-game coaching loop, regular-season structure, canonical Season State, autonomous AI round execution, derived standings, permanent Season presentation, regular-season UX polish, and Super Sim are complete. A user can now play or rapidly simulate all 24 rounds through one canonical pipeline.

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

- Dashboard Quick Sim directly plays the controlled Program's next ScheduledGame from the Hub.
- Manage Rotation remains the optional hands-on path; legal changes persist as the Program's current Season Rotation.
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

## Player Season Stats V0 — NEXT

> Derive useful Player season totals, averages, percentages, and game logs from the full `PlayerGameStats` already retained in completed Season `GameResult` values.

The initial derived surface should preserve and aggregate minutes, PTS, REB, AST, STL, BLK, TO, FGM/FGA, 3PM/3PA, and FTM/FTA. The accepted data flow is:

```text
recorded GameResults
→ PlayerGameStats rows
→ future derived PlayerSeasonStats / game logs
```

Do not add duplicate mutable Player-stat counters to `SeasonState`. Postseason remains planned after this milestone.

## Phase 4 — Postseason — PLANNED

- Postseason qualification and seeding
- Initial 32-Team national tournament
- Bracket, round advancement, and championship
- Postseason history

Conference tournaments are a later or optional addition unless explicitly scoped. The initial national tournament is not the real NCAA 68-Team structure.

## Phase 5 — Dynasty Loop — PLANNED

### 5.1 Player progression and roster turnover

- Advance class years and graduate seniors
- Apply potential-informed offseason development
- Create roster openings

### 5.2 Recruiting

- Recruit domain model and recruiting-class generation
- Recruiting board and Player preferences
- Recruiting resources and decisions
- AI recruiting, commitments, and incoming freshmen

Exact recruiting mechanics remain intentionally undecided.

### 5.3 Offseason transition

```text
Season ends
→ postseason complete
→ seniors graduate
→ Players develop
→ recruiting resolves
→ incoming Players join
→ new season begins
```

Acceptance target: the dynasty can advance indefinitely across multiple seasons.

## Phase 6 — Persistence and History — PLANNED

- Serializable dynasty `GameState`
- Save and load
- Season and program history
- Previous champions
- Player career statistics

Persistence should not be implemented before the evolving dynasty-state model is ready.

## Phase 7 — Post-MVP Depth — DEFERRED

- Multi-position eligibility and more advanced automatic Rotations
- Optional pregame polish such as starting-five presentation, matchup comparison, and positional insights
- Stable Player ordering during Rotation edits if reordering proves distracting
- Stronger live-region announcements for dynamic Rotation validation
- Player roles, playing-time expectations, happiness, and redshirts
- Transfer portal, injuries, and NBA Draft declarations
- Coaching career, job offers, firing/hiring, and assistant coaches
- Offensive and defensive schemes
- Explicit Player or Team archetype systems
- Deeper box-score event reconciliation

These are non-blocking polish or depth candidates. None precedes the League and Season Framework.

## Far-future / optional

- NIL
- Conference realignment
- Hundreds of real-world-style programs
- Real NCAA Teams, logos, or data
- Detailed possession play-by-play
- Manual live substitutions and real-time in-game coaching
- Multiplayer or online leagues

None of these are required to complete the core game.

## Non-binding development-agent fit

Codex is well suited to engine/domain systems, validation, simulation, and league/schedule/season state. Claude Code is well suited to presentation and interaction implementation against existing engine/application contracts. This is a planning convenience, not an architectural requirement; either agent must obey the same boundaries and source-of-truth documentation.
