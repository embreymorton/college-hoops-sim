# College Hoops Simulator

A deterministic fictional college basketball dynasty simulator built with React, TypeScript, Vite, Zustand, and Vitest.

## Current status

The playable Dynasty loop is repeatable from Program selection through consecutive Seasons:

- **Basketball Engine V0:** deterministic Player and 12-Player roster generation, Rotation Management, derived Player/Team ratings, game simulation, overtime, and complete Player box scores.
- **Fictional Universe V0:** 32 stable Programs across four Conferences with a deterministic 24-round regular-season Schedule.
- **Season experience:** canonical Season progression, AI simulation, Conference standings, Quick Sim, detailed Game Prep, Super Sim, historical results, and full box-score inspection.
- **Statistics and exploration:** regular-season Player and Team Season Stats, Player game logs, Team averages, national PPG/RPG/APG/SPG/BPG leaders, Teams directory, Team Details, Player Details, and cross-Program navigation.
- **National Tournament:** a deterministic 16-Team field with automatic and at-large bids, protected Conference-champion seeds, neutral-site simulation, fixed-bracket progression, Postseason presentation, and National Champion derivation.
- **Playable Dynasty:** choose a Program, manage Recruiting alongside Season play, compete in the National Tournament, enter Late Recruiting, finalize the class, review departures/development/incoming Players in Offseason, begin the next Season, and repeat.
- **Deterministic replayability:** each interactive Dynasty receives one unique creation seed; all rosters, schedules, Recruiting, and simulations remain deterministic from that stored seed. Explicit-seed tests and inspection workflows remain repeatable.

The current playable core is complete. Intentionally deferred systems include persistence/save-load, Dynasty history browsing, career stats, awards, transfers, injuries, staff, rankings, and deeper offseason decisions.

## Commands

- `npm run dev` — start Vite
- `npm test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks
- `npm run build` — type-check and create a production build
- `npm run check` — run lint, tests, and build

### Deterministic inspection reports

- `npm run sim:players`, `sim:rosters`, `sim:rotations`, and `sim:strength`
- `npm run sim:games` and `sim:boxscores`
- `npm run sim:universe` and `sim:schedule`
- `npm run sim:season-state`, `sim:season`, and `sim:player-stats`
- `npm run sim:postseason`
- `npm run sim:dynasty-foundation`
- `npm run sim:recruiting`
- `npm run sim:roster-rollover` and `sim:season-rollover`
- `npm run sim:dynasty-long-run`

Project constraints live in [`docs/`](docs/). Start with the [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [game design](docs/GAME_DESIGN.md). Optional product ideas belong in [future features](docs/FUTURE_FEATURES.md); engineering risks and follow-ups belong in [known issues and optimizations](docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md).
