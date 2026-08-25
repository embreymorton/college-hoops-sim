# College Hoops Simulator

A deterministic fictional college basketball dynasty simulator built with React, TypeScript, Vite, Zustand, and Vitest.

## Current status

The playable Dynasty loop is repeatable from Program selection through consecutive Seasons:

- **Basketball engine:** deterministic Player and 12-Player roster generation, floor-position-aware Rotation V1 with legal secondary-position flexibility, derived Player/Team ratings, game simulation, overtime, and complete Player box scores.
- **Fictional Universe V0:** 32 stable Programs across four Conferences with a deterministic 24-round regular-season Schedule.
- **Season experience:** canonical Season progression, AI simulation, Conference standings, Quick Sim, detailed regular-season/Tournament Game Prep with Matchup Scout and Simple/Advanced Rotation preparation, Super Sim, historical results, compact Postgame Meaning consequences, and full box-score inspection.
- **Statistics and exploration:** regular-season Player and Team Season Stats, Player game logs, Team averages, national PPG/RPG/APG/SPG/BPG leaders, Teams directory, Team Details with derived Program Dynasty history and Program Player Records, and active/former Player Details with separate Regular Season and Tournament career history, achievements, game logs, and Career Highs. Cross-Program navigation and followed Players retain stable identity across the Dynasty.
- **Season history:** a first-class League History destination with completed-
  Season Yearbooks and a Dynasty Record Book with separate regular-season and
  Tournament scopes, plus finalized national Recruiting
  class retrospectives connecting signees' entry evaluations to later outcomes,
  deterministic national/Conference/Tournament Awards, and Season-grouped
  Player Career Honors, all derived from canonical facts.
- **National Tournament:** a deterministic 16-Team field with automatic and at-large bids, unified results-only résumé seeding, neutral-site simulation, fixed-bracket progression, Postseason presentation, and National Champion derivation.
- **Playable Dynasty:** choose a Program, manage Recruiting alongside Season play, compete in the National Tournament, then use the dedicated Hybrid Offseason Timeline to progress through Late Recruiting, Recruiting Class, Departures, Development, Roster Review, Ready for Season, and the next Season.
- **Player development stories:** ordinary Development V1 is supplemented by
  rare Explosive Offseasons, while a Player's stable Work Ethic is hidden as a
  Recruit, shown as Unknown as a freshman, and revealed after his first
  offseason.
- **Recruit inspection and Board management:** open stable-ID Recruit Details
  from Board, Battles, or National Class, organize canonical manual and
  assistant Board entries in counted groups, clear unavailable targets without
  automatic refill, manage jointly feasible Active Offers against Required and
  shared Flexible scholarship capacity, and return to the same Recruiting mode.
- **Next-season roster planning:** inspect a factual read-only Recruiting Roster
  Outlook with promoted returners, committed incoming freshmen, Required needs,
  Flexible openings, Full positions, departing seniors, and current ratings
  before Offseason Development. Completed rosters remain 12 Players with 2–3 at
  every natural position while their exact `3/3/2/2/2` shape may evolve.
- **Recruit following and continuity:** follow prospects independently from Board management, track their live status in Recruiting Following, and carry that attachment into existing Player Following after stable-ID enrollment is verified.
- **Deterministic replayability:** each interactive Dynasty receives one unique creation seed; all rosters, schedules, Recruiting, and simulations remain deterministic from that stored seed. Explicit-seed tests and inspection workflows remain repeatable.

The current playable core is complete. Targeted Dynasty history exists through
Season Yearbooks, Program Legacy and Program Player Records on Team Details,
Followed Former Players, Historical Player Details, regular-season career
aggregation, Career Progression, and Career Highs. Intentionally
deferred systems include persistence/save-load, broader historical Team/game
details, combined career aggregation, additional award families,
transfers, injuries, staff, rankings, and deeper offseason decisions. The existing
cross-season lifecycle is presented through a dedicated six-stage Offseason
experience from Late Recruiting through the next-Season handoff.

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
- `npm run sim:rare-development-breakouts`

Project constraints live in [`docs/`](docs/). For ongoing work, read
[current state](docs/CURRENT_STATE.md), the Roadmap's
[Current Selected Horizon](docs/ROADMAP.md#current-selected-horizon),
[Current Playtesting Priorities and Live WATCH](docs/PLAYTESTING.md), and the
[assistant operating guide](docs/COLLEGE_SIM_ASSISTANT_OPERATING_GUIDE.md), in
that order.
Read [calibration](docs/CALIBRATION.md) when changing simulation/balance and the
[documentation policy](docs/DOCUMENTATION_POLICY.md) when updating docs.
Optional ideas belong in
[future features](docs/FUTURE_FEATURES.md); confirmed risks belong in
[known issues and optimizations](docs/KNOWN_ISSUES_AND_OPTIMIZATIONS.md).
Parked Player Identity experiments live in
[the historical research archive](docs/PLAYER_IDENTITY_RESEARCH.md) and are not
part of normal feature-session reading.
Closed gameplay evidence lives in the conditional
[playtesting archive](docs/PLAYTESTING_ARCHIVE.md), also outside the normal read set.
The decision-complete hierarchy/compression investigation lives in
[Dynasty Hierarchy Research](docs/DYNASTY_HIERARCHY_RESEARCH.md); read it only
when deliberately reopening that question, when a future feature materially
changes the talent economy, or when its historical evidence is specifically
needed.
