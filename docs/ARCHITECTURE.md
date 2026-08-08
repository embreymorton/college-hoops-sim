# Architecture

## Dependency rule

Dependencies point inward toward the engine:

```text
React presentation → Zustand application state/adapters → engine public API
                                      tests/tools → engine public API

Application / future Dynasty state
                  ↓
             Season State
            ↙      ↓       ↘
      Schedule  Universe  Engine outputs
                            Team / Rotation / GameResult
```

`src/engine` must not import React, React DOM, Zustand, components, application stores, browser/DOM APIs, or other UI-specific code. The engine accepts data and configuration, then returns data. UI code may import the engine.

## Folder structure

```text
docs/                    Product and technical source of truth
src/
  app/                   React application composition and screens
  components/            Reusable presentational UI
  demo/                  Presentation fixtures and demo-program metadata
  store/                 Zustand workflow state and engine orchestration
  universe/              Stable world definitions and deterministic initialization
  schedule/              Pure regular-season structure, generation, and validation
  season/                Serializable Season facts, operations, and derivations
  engine/
    domain/              Serializable domain types and derived ratings
    generation/          Player/team generation and default rotation derivation
    random/              Seeded RNG abstraction and implementation
    simulation/          Pure game outcomes and Player box-score allocation
    index.ts             Engine's public API
  test/                  Shared test setup
```

Folders describe ownership, not permission to implement future systems early.

## Implemented vertical-slice flow

```text
Generated Players
→ Generated Teams / Rosters
→ Default Rotations
→ Player OFF / DEF
→ Team Strength
→ Game Simulation
→ Player Box Scores
→ Zustand application state
→ React Game Presentation
```

The engine owns every step through Player box scores. The application layer selects demo inputs, invokes the public API, and retains workflow state and engine outputs. React presents that state and dispatches user intent back to the store.

## Domain and state rules

- Domain objects and game state use JSON-serializable data: plain objects, arrays, numbers, strings, booleans, and null where meaningful.
- Do not put functions, class instances, DOM objects, `Map`, `Set`, or implicit global state into persisted domain objects.
- Stable string IDs connect entities. Do not rely on object identity.
- Current ability lives in player attributes. Player overall, player offense, and player defense are derived from attributes and positional context; none are mutable Player fields.
- Team offense and defense are derived from Player ratings and a valid Rotation. Team overall is derived from Team offense and defense. None are mutable Team fields.
- Game simulation accepts explicit Teams, Rotations, and a seed, then returns a plain serializable outcome with full-roster Player box-score rows without retaining hidden RNG or game state.
- `GameResult` is serializable engine output containing Team IDs, final scores, winner, overtime count, reproduction seed, and home/away `PlayerGameStats` arrays. Each `PlayerGameStats` row contains only a Player ID and numeric traditional box-score fields.
- `RegularSeasonSchedule` is serializable schedule output containing one canonical collection of unplayed games. `ScheduledGame` references stable Program IDs and contains no Team snapshots, results, records, or progression state.
- A schedule round is a one-based abstract progression unit, not a date. Universe V0 has 24 complete rounds, with all 32 Programs appearing exactly once among the 16 games in each round.
- `SeasonState` stores its immutable Schedule, current Team/Rotation state by stable Program ID, and complete `GameResult` facts once by stable ScheduledGame ID. Current round, completion, Program records, and Conference records are derived rather than stored.
- Store facts and derive summaries. Season State does not maintain authoritative wins, losses, Conference records, games played, current-round counters, completion flags, or standings alongside the Schedule and results that determine them.
- Randomness enters through an explicit seeded RNG or seed. Engine code never calls `Math.random()`.
- Prefer pure functions. If an operation evolves state, make inputs and returned state explicit.
- Zustand owns application/UI workflow state, not basketball rules.

The current Game Presentation store owns matchup selections, pregame/postgame phase, generated Team setups, deterministic game-sequence seeds, and the latest `GameResult`. It calls the public engine API to generate Teams and default Rotations, derive Team Strength, and simulate games. Its in-memory setup cache is an application detail, not persisted domain state.

Rotation Management V0 adds the coach's editable home-Team `Rotation` to that Zustand workflow state. Temporary invalid values are allowed during editing. The application asks the engine to validate the current Rotation, derives current Team Strength through the engine only when it is legal, and blocks simulation otherwise. A legal simulation passes that exact edited home Rotation and the away Team's generated default Rotation to `simulateGame()`.

```text
UI interaction
→ Zustand application workflow state
→ validateRotation()
→ calculateTeamStrength()
→ simulateGame()
```

The home Rotation persists through Simulate Again and the return from postgame to pregame. Reset restores the generated default, and selecting a different home program installs that program's default. HOME is the coached Team only for the current exhibition workflow; this is not yet a permanent dynasty user-Team model.

The versioned `src/universe` layer owns four stable Conference definitions, 32 stable Program definitions, Universe V0 configuration, validation, and deterministic Team/Rotation initialization. Its 32/4/8 counts are constraints of `UNIVERSE_V0`, never generic engine assumptions.

```text
ProgramDefinition = stable world identity and configuration
Team              = current generated basketball state
```

Program identity, structured location, permanent V0 conference membership, immutable `basePrestige`, and branding stay outside Team. Initialization generates current basketball state through the engine, then guarantees `Team.id === ProgramDefinition.id` and initially sets `Team.prestige === ProgramDefinition.basePrestige`. Schedules reference these same stable Program IDs rather than names, array positions, object identity, or embedded Team snapshots.

The six-program exhibition catalog remains a presentation adapter. Charlotte Tech, Capital State, Great Lakes, Pine Valley, and Coastal Plains source permanent metadata from Universe V0; National Tech remains explicitly development-only. This preserves the accepted UI workflow without duplicating permanent metadata or presenting the exhibition list as a season.

## Season State and progression

`SeasonProgramState` owns the current `Team` and legal current `Rotation` needed to play games for one Program. Universe definitions remain stable world configuration outside Season basketball state, while the regular-season Schedule remains unchanged structural data inside the Season. `resultsByGameId` is the single canonical completed-game collection and preserves each full engine-produced `GameResult`, including Player box scores.

Season operations are pure: `recordGameResult()` and `updateProgramRotation()` return new Season values without mutating their inputs. Recorded results are immutable facts and cannot be silently overwritten. Result recording validates the ScheduledGame ID, exact home/away orientation, score/winner consistency, and that Player points reconstruct each Team score. Rotation updates delegate legality to the engine's existing `validateRotation()` contract.

Partial rounds and out-of-order result insertion are supported. Current round is the lowest Schedule round with a pending game; round completion, regular-season completion, overall Program records, and Conference records are projections over Schedule plus recorded results. `controlledProgramId` is intentionally absent because user ownership belongs to future application or Dynasty state rather than the generic Season domain.

The accepted autonomous regular-season pipeline composes existing boundaries rather than bypassing them:

```text
ScheduledGame
      ↓
Season Team + current Rotation
      ↓
independent deterministic game seed
      ↓
simulateGame()
      ↓
recordGameResult()
      ↓
Season projections
      ↓
records / standings / current round
```

Individual and pending-round simulation both write full results through `recordGameResult()`. Already-completed games remain unchanged, generic Program exclusions can leave a user-facing game pending, and completing the final pending game naturally changes the derived current round. Conference standings are transient `StandingRow` projections over Schedule and results, never canonical mutable Season state.

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Universe consumers use the public `src/universe/index.ts` surface for `UNIVERSE_V0`, definition validation, deterministic dynasty initialization, and public universe types. Schedule consumers use `src/schedule/index.ts`, which exposes the accepted V0 configuration and version, schedule generation, structured validation, Program-game lookup, and schedule domain types. Season consumers use `src/season/index.ts` for initialization, strict result recording, legal Rotation replacement, structured validation, round/program queries, completion checks, record derivation, scheduled-game/round simulation, and derived Conference standings. Schedule and Universe remain independent from mutable Season results, while Season depends only on their public APIs and the engine's Team, Rotation, validation, and GameResult contracts. No lower layer imports Season.

Game Presentation V0 and Rotation Management V0 are complete. React renders deterministic demo matchups, engine-generated rosters, an editable home Rotation, a read-only default away Rotation, Team Strength comparisons, validation feedback, final scores, overtime, and both Teams' Player box scores. It does not calculate basketball outcomes, ratings, or Rotation legality.

The engine was not changed for Rotation Management, Universe V0, Schedule Generation V0, or Season State V0. Editable exhibition Rotation state lives in the application layer, while Season Rotations live in `SeasonProgramState`; both rely on engine validation. The universe consumes only the engine public API; `src/engine` never imports universe, schedule, or Season definitions. Universe initialization uses an isolated deterministic RNG stream per Program, so one Program's roster is reproducible and unaffected by Program definition order or unrelated Programs. It also produces a valid default Rotation for every initialized Team. The Schedule module remains structure-only; the Season layer composes its output with initialized basketball state and completed results.

The accepted 32 Programs, 24 rounds, 16 games per round, and 384 total games are consequences of Universe V0 membership plus Schedule V0 configuration; they are not assumptions in the generic engine. Season State and Progression V0 and AI Round Simulation and Standings V0 are complete and accepted. Season Presentation V0 is the next application-layer milestone; it should consume these public projections and operations without creating UI-owned basketball truth.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. It also prevents the engine from importing `src/universe`, and keeps framework, presentation, ambient randomness, and browser dependencies out of the universe, schedule, and season layers. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.
