# College Hoops Simulator

A deterministic fictional college basketball dynasty simulator built with React, TypeScript, Vite, Zustand, and Vitest.

## Current status

The complete single-season experience is playable from Program selection through a National Champion:

- **Basketball Engine V0:** deterministic Player and 12-Player roster generation, Rotation Management, derived Player/Team ratings, game simulation, overtime, and complete Player box scores.
- **Fictional Universe V0:** 32 stable Programs across four Conferences with a deterministic 24-round regular-season Schedule.
- **Season experience:** canonical Season progression, AI simulation, Conference standings, Quick Sim, detailed Game Prep, Super Sim, historical results, and full box-score inspection.
- **Statistics and exploration:** regular-season Player and Team Season Stats, Player game logs, Team averages, national PPG/RPG/APG/SPG/BPG leaders, Teams directory, Team Details, Player Details, and cross-Program navigation.
- **National Tournament:** a deterministic 16-Team field with automatic and at-large bids, protected Conference-champion seeds, neutral-site simulation, fixed-bracket progression, Postseason presentation, and National Champion derivation.
- **Repeatable Dynasty backend:** serializable cross-season state, immutable Season/Recruiting histories, graduation and Player development, finalized Recruiting, exact next-season roster construction, fresh Teams/Rotations/Schedules, and automatic initialization of the following Recruiting cycle.

> **Next backend validation: Dynasty Long-Run Calibration V0.** The domain can run consecutive Dynasty seasons; React/Zustand has not yet migrated to this cross-season lifecycle, and save/load remains unimplemented.

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

Project constraints live in [`docs/`](docs/). Start with the [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [game design](docs/GAME_DESIGN.md). Optional product ideas belong in [future features](docs/FUTURE_FEATURES.md); engineering risks and follow-ups belong in [known issues and optimizations](docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md).
