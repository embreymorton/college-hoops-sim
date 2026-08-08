# Roadmap

Milestones remain small enough to test independently. A later phase or unlisted system may not be implemented early without explicit scope discussion. Status labels are deliberate: **COMPLETE** is implemented and validated, **ACTIVE** is current work, **PLANNED** expresses intent without implementation, and **DEFERRED** is outside the core MVP.

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
| 015 | Schedule generation | NEXT |
| 016 | Season/Game state | PLANNED |
| 017 | AI game simulation and results progression | PLANNED |
| 018 | Standings | PLANNED |
| 019 | Season presentation | PLANNED |

## Phase 3 — League and Season Framework — ACTIVE

The single-game coaching loop is playable. League and season work now becomes active, while schedules and progression remain unimplemented.

### 3.1 Stable Fictional Basketball Universe V0 — COMPLETE

- A versioned `UniverseDefinition` with 32 permanent fictional Programs across four permanent V0 Conferences of eight
- Stable program identities and deterministic IDs
- Structured locations, presentation branding, fixed V0 Conference membership, and immutable base prestige
- Deterministic initial Team and default-Rotation generation through isolated per-Program RNG streams
- Stable same-seed reproduction and Program-order-independent roster generation
- Public `src/universe` API, definition validation, stable Team IDs, and valid initialized Rotations

Universe V0 now contains the validated 32-program/four-conference catalog, stable metadata, and deterministic order-independent initialization of Teams and default Rotations. Initialized Team IDs match their Program IDs, and initial Team prestige matches immutable Program base prestige. Its configured counts do not constrain the generic engine. The six-program exhibition catalog remains a presentation subset plus one development-only fixture.

### 3.2 Schedule Generation V0 — NEXT

> Given the stable Universe V0 Conference/Program structure, generate a deterministic regular-season schedule in which every Program receives a legal set of opponents and home/away assignments suitable for later Season State.

Exact game counts, Conference/non-Conference composition, calendar shape, and generation algorithm remain intentionally undecided until this milestone is implemented. Schedule Generation does not include Season State, game progression, standings, or presentation.

### 3.3 Season State and Progression — PLANNED

- Overall and conference records
- User schedule and results
- Advance-game or advance-date workflow

### 3.4 AI Game Simulation / Standings — PLANNED

- AI-vs-AI game simulation
- Complete scheduled results for all Teams
- Overall and conference standings derived from results

### 3.5 Season Presentation — PLANNED

- Season/dashboard home
- Schedule and results
- Standings
- Upcoming matchup

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
