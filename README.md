# College Hoops Simulator

A deterministic fictional college basketball dynasty simulator built with React, TypeScript, Vite, Zustand, and Vitest.

## Current status

- Basketball Engine V0: seeded Player/Team/roster generation, Rotation Management, derived Team Strength, deterministic game simulation, overtime, and complete Player box scores.
- Fictional Universe V0: 32 stable Programs across four Conferences with a deterministic 24-round regular-season Schedule.
- Season experience: serializable Season State, AI round simulation, Conference standings, Dashboard Quick Sim, Super Sim, historical results, and derived Player Season Stats/game logs.
- Postseason Domain / Simulation V0: four Conference-champion automatic bids, 12 at-large bids, protected champion seeds 1–4, a fixed 16-Team bracket, neutral-site simulation, full tournament box scores, and National Champion derivation.

The React application currently exposes the complete regular season, but not the accepted tournament backend. **Postseason Presentation V0 is the next UI milestone.** The Dynasty Loop is the next major systems phase after the single-season experience is fully exposed; persistence and history remain later work.

## Commands

- `npm run dev` — start Vite
- `npm test` — run Vitest once
- `npm run test:watch` — run Vitest in watch mode
- `npm run lint` — run ESLint
- `npm run typecheck` — run TypeScript checks
- `npm run build` — type-check and create a production build
- `npm run check` — run lint, tests, and build

### Deterministic inspection reports

- `npm run sim:players` — print the deterministic player-generation inspection report
- `npm run sim:rosters` — print deterministic roster examples and prestige validation
- `npm run sim:rotations` — print default rotations, aggregate validation, and invalid examples
- `npm run sim:strength` — inspect player OFF/DEF and rotation-weighted team strength
- `npm run sim:games` — inspect deterministic team-level games and outcome distributions
- `npm run sim:boxscores` — inspect deterministic player box scores and distributions
- `npm run sim:universe` — inspect Universe V0 definitions and deterministic initialization
- `npm run sim:schedule` — inspect deterministic Schedule V0 structure and validation
- `npm run sim:season-state` — inspect Season initialization, partial rounds, records, and Rotation persistence
- `npm run sim:season` — inspect deterministic round simulation, standings, and complete regular seasons
- `npm run sim:player-stats` — inspect derived regular-season Player totals, rates, and game logs
- `npm run sim:postseason` — inspect selection, the fixed bracket, tournament progression, validation, determinism, and balance diagnostics

Project scope and source-of-truth constraints live in [`docs/`](docs/). Start with the [roadmap](docs/ROADMAP.md), [architecture](docs/ARCHITECTURE.md), and [game design](docs/GAME_DESIGN.md).
