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
    generation/          Seeded player/team generation
    random/              Seeded RNG abstraction and implementation
    simulation/          Pure game simulation and box-score aggregation
    index.ts             Engine's public API
  test/                  Shared test setup
```

Folders describe ownership, not permission to implement future systems early.

## Domain and state rules

- Domain objects and game state use JSON-serializable data: plain objects, arrays, numbers, strings, booleans, and null where meaningful.
- Do not put functions, class instances, DOM objects, `Map`, `Set`, or implicit global state into persisted domain objects.
- Stable string IDs connect entities. Do not rely on object identity.
- Current ability lives in player attributes. Overall rating is computed from attributes and position.
- Randomness enters through an explicit seeded RNG or seed. Engine code never calls `Math.random()`.
- Prefer pure functions. If an operation evolves state, make inputs and returned state explicit.
- Zustand owns application/UI workflow state, not basketball rules.

## Public API and imports

Consumers should eventually import engine capabilities from `src/engine/index.ts`. Within the engine, modules may import only other engine modules or platform-neutral utilities. Avoid circular dependencies and avoid a catch-all `utils` directory; place a helper with the domain that owns it.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. Tests must cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior as those features are added.

