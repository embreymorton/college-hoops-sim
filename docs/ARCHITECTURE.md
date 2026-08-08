# Architecture

## Dependency rule

Dependencies point inward toward the engine:

```text
React UI → Zustand/application adapters → engine
                         tests/tools → engine
```

`src/engine` must not import React, React DOM, Zustand, components, application stores, browser/DOM APIs, or other UI-specific code. The engine accepts data and configuration, then returns data. UI code may import the engine.

## Folder structure

```text
docs/                    Product and technical source of truth
src/
  app/                   React application composition and screens
  components/            Reusable presentational UI
  store/                 Zustand stores and engine adapters
  engine/
    domain/              Serializable domain types and derived ratings
    generation/          Player/team generation and default rotation derivation
    random/              Seeded RNG abstraction and implementation
    simulation/          Pure game outcomes and Player box-score allocation
    index.ts             Engine's public API
  test/                  Shared test setup
```

Folders describe ownership, not permission to implement future systems early.

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

## Public API and imports

Consumers import `simulateGame`, `GameResult`, and `PlayerGameStats` through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Within the engine, modules may import only other engine modules or platform-neutral utilities. Avoid circular dependencies and avoid a catch-all `utils` directory; place a helper with the domain that owns it.

Game Presentation is the next active milestone. Its application-state adapter and UI may consume these public serializable outputs but must not reimplement or mutate simulation rules.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.
