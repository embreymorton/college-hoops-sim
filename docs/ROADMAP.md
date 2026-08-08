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

## Phase 2 — First Playable Coaching Loop — ACTIVE

### 2.1 Game Presentation V0 — COMPLETE

- Six deterministic demo-program fixtures with presentation metadata
- Distinct home/away matchup selection
- Engine-generated rosters and displayed default Rotation minutes
- Displayed Team OFF, DEF, and OVR
- Real `simulateGame()` integration through Zustand application orchestration
- Final score, winner, overtime, and both Teams' Player box scores
- Deterministic re-simulation using a stable matchup-and-sequence seed scheme
- Change Matchup workflow

The demo catalog is not a league, and displayed Rotations are not editable.

### 2.2 Rotation Management — NEXT

> The coach can change who plays and how many minutes they receive, see the consequences of those choices, and simulate the game using the edited legal rotation.

Plan:

- Display editable Player minutes.
- Preserve the v0.1 natural-position restriction.
- Enforce exactly 40 minutes at each position and 200 total Team minutes.
- Provide immediate validation feedback.
- Allow reset to the generated/default Rotation.
- Derive Team Strength from the currently edited Rotation.
- Make OFF, DEF, and OVR changes visible.
- Simulate using the user's legal Rotation.
- Preserve seeded deterministic game behavior.

The exact editing controls remain an upcoming UI-design decision.

### 2.3 Pregame Coaching Polish — PLANNED

Keep this optional and small after Rotation Management. Candidate improvements include a clearer starting-five or primary-Player presentation derived from minutes, matchup comparison, positional strengths and weaknesses, and refined coaching feedback.

Advanced tactics are not required here. Pace, schemes, zone defense, presses, shot profiles, live substitutions, and similar systems remain outside the active MVP.

## Near-term planning horizon

These identifiers are planning aids, not immutable contracts. Later implementation discoveries may reshape them.

| Task | Intended slice | Status |
| --- | --- | --- |
| 010 | Rotation Management application/state support | NEXT |
| 011 | Rotation Editor UI | PLANNED |
| 012 | Rotation validation and UX polish | PLANNED |
| 013 | Stable 32-program fictional league | PLANNED |
| 014 | Conference model | PLANNED |
| 015 | Schedule generation | PLANNED |
| 016 | Season/Game state | PLANNED |
| 017 | AI game simulation and progression | PLANNED |
| 018 | Standings | PLANNED |
| 019 | Season presentation | PLANNED |

## Phase 3 — League and Season Framework — PLANNED

This phase begins after the single-game coaching loop is playable.

### 3.1 Fictional League

- Approximately 32 fictional programs across four conferences
- Stable deterministic program definitions
- Program presentation metadata and branding
- Generated starting rosters

The current six-program demo catalog is presentation scaffolding, not the full league.

### 3.2 Schedule

- Regular-season schedule generation
- Conference and non-conference games
- Home/away assignments
- Upcoming opponents for the user's Team

The first schedule need not reproduce the exact current NCAA format.

### 3.3 Season State and Progression

- Overall and conference records
- User schedule and results
- AI-vs-AI game simulation
- Advance-game or advance-date workflow
- Standings

### 3.4 Season Presentation

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
- Player roles, playing-time expectations, happiness, and redshirts
- Transfer portal, injuries, and NBA Draft declarations
- Coaching career, job offers, firing/hiring, and assistant coaches
- Offensive and defensive schemes
- Explicit Player or Team archetype systems
- Deeper box-score event reconciliation

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
