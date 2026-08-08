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

The six deterministic demo-program definitions live in `src/demo/demoPrograms.ts`, a neutral presentation fixture module shared by the store and React components. Their names, prestige values, generation seeds, and colors are not an implemented league or engine data model.

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Within the engine, modules may import only other engine modules or platform-neutral utilities. Avoid circular dependencies and avoid a catch-all `utils` directory; place a helper with the domain that owns it.

Game Presentation V0 is complete. React renders deterministic demo matchups, engine-generated rosters and default Rotation minutes, Team Strength, final scores, overtime, and both Teams' Player box scores. It does not calculate basketball outcomes or ratings.

Rotation Management is the next active milestone. Editable Rotation state may live in the application layer, but legality is defined by the engine's Rotation validation rules and Team Strength must continue to come from engine derivation. A legal edited Rotation becomes an input to the existing strength and simulation pipeline; the UI must not duplicate or redefine those rules.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.
