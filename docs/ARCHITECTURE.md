# Architecture

## Dependency rule

Dependencies point inward toward the engine:

```text
React presentation → Zustand application state/adapters → engine public API
                                      tests/tools → engine public API

React / Zustand / future Season State
                 ↓
       Schedule public API ─────→ Engine public API (seeded RNG only)
                 ↓
          Universe public API
                 ↓
       Universe initialization
                 ↓
      Engine Teams / Rotations
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

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Universe consumers use the public `src/universe/index.ts` surface for `UNIVERSE_V0`, definition validation, deterministic dynasty initialization, and public universe types. Schedule consumers use `src/schedule/index.ts`, which exposes the accepted V0 configuration and version, schedule generation, structured validation, Program-game lookup, and schedule domain types. Schedule logic depends only on the Universe public model and the engine's seeded RNG, never on generated Teams or UI state. Within the engine, modules may import only other engine modules or platform-neutral utilities. Avoid circular dependencies and avoid a catch-all `utils` directory; place a helper with the domain that owns it.

Game Presentation V0 and Rotation Management V0 are complete. React renders deterministic demo matchups, engine-generated rosters, an editable home Rotation, a read-only default away Rotation, Team Strength comparisons, validation feedback, final scores, overtime, and both Teams' Player box scores. It does not calculate basketball outcomes, ratings, or Rotation legality.

The engine was not changed for Rotation Management, Universe V0, or Schedule Generation V0. Editable Rotation state lives in the application layer, while legality remains defined by engine validation and Team Strength remains an engine derivation. The universe consumes only the engine public API; `src/engine` never imports universe or schedule definitions. Universe initialization uses an isolated deterministic RNG stream per Program, so one Program's roster is reproducible and unaffected by Program definition order or unrelated Programs. It also produces a valid default Rotation for every initialized Team. Schedule Generation V0 remains structure-only and introduces no Season State.

The accepted 32 Programs, 24 rounds, 16 games per round, and 384 total games are consequences of Universe V0 membership plus Schedule V0 configuration; they are not assumptions in the generic engine. The next Season State layer should treat the schedule as immutable structure and associate completed `GameResult` values with stable `ScheduledGame.id` values. Records and later standings should be derived from completed results where practical rather than stored as duplicate mutable truth. Exact Season State interfaces remain undecided.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. It also prevents the engine from importing `src/universe`, and keeps framework, presentation, ambient randomness, and browser dependencies out of the universe and schedule layers. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.
