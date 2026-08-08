# MVP Scope

## Product MVP

The product MVP should support one complete dynasty-season loop:

- Select one of approximately 32 fictional teams across four conferences.
- Review a roster and set a legal rotation.
- Simulate believable games and inspect final scores and box scores.
- Progress through a season and national tournament.
- Recruit and develop players.
- Advance into the next season with persistent, serializable state.

## Current milestone: foundation

This milestone delivers only:

- A React, TypeScript, and Vite application shell
- A framework-independent `src/engine` boundary
- Zustand available for later application state, but no store yet
- Vitest and Testing Library configuration
- Source-of-truth design and architecture documentation
- Lint, type-check, test, and production-build commands

The milestone explicitly excludes players, teams, RNG implementation, game simulation, league generation, schedules, recruiting, development, saves, and gameplay UI.

## Next milestone acceptance target

Before expanding the dynasty loop, two generated teams must be simulatable entirely through TypeScript and produce a plausible final score plus internally consistent player and team box scores. Identical inputs and seed must produce identical output.

