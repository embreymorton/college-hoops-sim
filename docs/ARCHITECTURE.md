# Architecture

## Dependency rule

Dependencies point inward toward the engine:

```text
React presentation → Zustand application state/adapters → engine public API
                                      tests/tools → engine public API
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

The six deterministic demo-program definitions live in `src/demo/demoPrograms.ts`, a neutral presentation fixture module shared by the store and React components. Their names, prestige values, generation seeds, and colors are not an implemented league or engine data model.

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Within the engine, modules may import only other engine modules or platform-neutral utilities. Avoid circular dependencies and avoid a catch-all `utils` directory; place a helper with the domain that owns it.

Game Presentation V0 and Rotation Management V0 are complete. React renders deterministic demo matchups, engine-generated rosters, an editable home Rotation, a read-only default away Rotation, Team Strength comparisons, validation feedback, final scores, overtime, and both Teams' Player box scores. It does not calculate basketball outcomes, ratings, or Rotation legality.

The engine was not changed for Rotation Management. Editable Rotation state lives in the application layer, while legality remains defined by engine validation and Team Strength remains an engine derivation. The Stable Fictional Basketball Universe is next; it must preserve the same dependency direction and must not turn presentation fixtures into engine-owned UI metadata.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.
