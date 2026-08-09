# Architecture

## Dependency rule

Dependencies point inward toward pure domain layers:

```text
React / Zustand application session
              ↓
         Postseason public API
          ↙              ↘
Season public API     Universe public API
     ├─ Schedule public API    ↓
     └──────────────→ Engine public API

Schedule public API → Universe public API + Engine public API

tests / inspection tools → the relevant public API at each boundary
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
  season/                Serializable Season facts, operations, and derivations
  postseason/            Selection, fixed bracket, tournament state, and progression
  engine/
    domain/              Serializable domain types and derived ratings
    generation/          Player/team generation and default rotation derivation
    random/              Seeded RNG abstraction and implementation
    simulation/          Pure game outcomes and Player box-score allocation
    index.ts             Engine's public API
  test/                  Shared test setup
```

Folders describe ownership, not permission to implement future systems early.

## Implemented application flow

```text
React Season + Postseason Presentation
→ Zustand application session / navigation
→ Season and Postseason public APIs
→ Schedule + Universe + Engine outputs
→ stored GameResult facts and derived projections
```

The engine owns basketball generation, ratings, Rotation legality, game outcomes, and Player box scores. The Season layer composes those capabilities with a Schedule and current Program basketball state; Postseason composes the completed Season with selection, a fixed bracket, and tournament progression. Zustand owns the controlled Program, completed `SeasonState`, active `PostseasonState`, navigation, Rotation drafts, viewed-result IDs, and transient confirmation/completion UI. React presents that state and dispatches user intent back through the store.

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
- `SeasonState` stores its immutable Schedule, current Team/Rotation state by stable Program ID, and complete `GameResult` facts once by stable ScheduledGame ID. Current round, completion, Program records, and Conference records are derived rather than stored.
- Store facts and derive summaries. Season State does not maintain authoritative wins, losses, Conference records, games played, current-round counters, completion flags, standings, Player season totals/rates, or Player game logs alongside the Schedule and results that determine them.
- Randomness enters through an explicit seeded RNG or seed. Engine code never calls `Math.random()`.
- Prefer pure functions. If an operation evolves state, make inputs and returned state explicit.
- Zustand owns application/UI workflow state, not basketball rules.

The Season store is not authoritative for Program records, Conference records, standings, current round, next opponent, Recent Results, or Player statistics. Those values are projections over the active `SeasonState`, its immutable Schedule, and its recorded `GameResult` values. Transient Super Sim confirmation and completion-summary state is presentation state, not Season truth.

Rotation edits may be temporarily invalid in the Game Prep draft. Only a legal draft is committed through `updateProgramRotation()` to the controlled Program's current `SeasonProgramState.rotation`. That committed Rotation persists across games and is the only Rotation used by Dashboard Quick Sim and Super Sim; neither operation reads a stale invalid draft.

```text
Manage Rotation
→ Zustand draft
→ validateRotation()
→ updateProgramRotation()
→ canonical Season Rotation
→ scheduled-game simulation
```

The separate Exhibition workflow still owns demo matchup selection and an editable home Rotation for isolated game testing. It is retained as development tooling and does not define the permanent Season architecture.

The versioned `src/universe` layer owns four stable Conference definitions, 32 stable Program definitions, Universe V0 configuration, validation, and deterministic Team/Rotation initialization. Its 32/4/8 counts are constraints of `UNIVERSE_V0`, never generic engine assumptions.

```text
ProgramDefinition = stable world identity and configuration
Team              = current generated basketball state
```

Program identity, structured location, permanent V0 conference membership, immutable `basePrestige`, and branding stay outside Team. Initialization generates current basketball state through the engine, then guarantees `Team.id === ProgramDefinition.id` and initially sets `Team.prestige === ProgramDefinition.basePrestige`. Schedules reference these same stable Program IDs rather than names, array positions, object identity, or embedded Team snapshots.

The six-program exhibition catalog remains a presentation adapter. Charlotte Tech, Capital State, Great Lakes, Pine Valley, and Coastal Plains source permanent metadata from Universe V0; National Tech remains explicitly development-only. This preserves the accepted UI workflow without duplicating permanent metadata or presenting the exhibition list as a season.

## Season State and progression

`SeasonProgramState` owns the current `Team` and legal current `Rotation` needed to play games for one Program. Universe definitions remain stable world configuration outside Season basketball state, while the regular-season Schedule remains unchanged structural data inside the Season. `resultsByGameId` is the single canonical completed-game collection and preserves each full engine-produced `GameResult`, including Player box scores.

Season operations are pure: `recordGameResult()` and `updateProgramRotation()` return new Season values without mutating their inputs. Recorded results are immutable facts and cannot be silently overwritten. Result recording validates the ScheduledGame ID, exact home/away orientation, score/winner consistency, and that Player points reconstruct each Team score. Rotation updates delegate legality to the engine's existing `validateRotation()` contract.

Partial rounds and out-of-order result insertion are supported. Current round is the lowest Schedule round with a pending game; round completion, regular-season completion, overall Program records, and Conference records are projections over Schedule plus recorded results. `controlledProgramId` is intentionally absent because user ownership belongs to future application or Dynasty state rather than the generic Season domain.

The accepted autonomous regular-season pipeline composes existing boundaries rather than bypassing them:

```text
ScheduledGame
      ↓
Season Team + current Rotation
      ↓
independent deterministic game seed
      ↓
simulateGame()
      ↓
recordGameResult()
      ↓
Season projections
      ↓
records / standings / current round
```

Individual and pending-round simulation both write full results through `recordGameResult()`. Already-completed games remain unchanged, generic Program exclusions can leave a user-facing game pending, and completing the final pending game naturally changes the derived current round. Conference standings are transient `StandingRow` projections over Schedule and results, never canonical mutable Season state.

All Season simulation entry points converge on this pipeline:

```text
Game Prep play / Dashboard Quick Sim / AI rest-of-round / Super Sim
                              ↓
                simulateScheduledGame()
                              ↓
                     simulateGame()
                              ↓
                  recordGameResult()
```

Game Prep is optional. Dashboard Quick Sim runs the controlled Program's next ScheduledGame from the Hub with the last committed legal current Season Rotation. Super Sim calls `simulatePendingGamesThroughRound()` as a pacing convenience: Midseason resolves pending games through Round 12, and End of Regular Season resolves pending games through Round 24. It preserves completed results, uses every Program's current Team and Rotation, and creates the same full `GameResult` values as ordinary progression for identical state and seed.

Completed games are final. The postgame and historical-result screens read the already-recorded `GameResult`; opening a Schedule or Recent Results entry never re-simulates it. Recent Results is likewise derived from completed Schedule/results facts.

## Postseason State and progression

The framework-independent `src/postseason` layer depends on the public Season, Universe, and Engine APIs. It requires a valid completed regular season, but it does not embed or mutate the completed `SeasonState`. Season, Schedule, Universe, and Engine do not import Postseason; the Engine remains unaware of qualification, seeds, brackets, tournament rounds, and champions.

```text
React / Zustand
        ↓
     Postseason
      ↙      ↘
   Season   Universe
      \       /
        Engine
```

Neutral-site behavior is an Engine-level game-location option. Postseason chooses `site: "neutral"`; the Engine applies zero normal home-court modifier without knowing why the game is neutral or what a seed means.

`PostseasonState` stores only the canonical tournament facts needed to continue play:

```text
selected TournamentEntry field
+ fixed NationalTournamentBracket
+ copied Team / current Rotation state for qualified Programs
+ completed GameResults keyed by Tournament game ID
```

At initialization, each qualified Program's exact end-of-regular-season Team and legal current Rotation are copied into Postseason basketball state. Teams and rosters are not regenerated, and later legal Rotation changes are pure Postseason operations. Tournament progression cannot mutate the completed regular season.

The complete 15-game bracket is fixed when Postseason begins. Round-of-16 slots reference seeds; later slots reference stable prior-game winner sources. Completed `GameResult` facts resolve those sources without rebuilding or reseeding the bracket. The current tournament round, ready games, remaining or eliminated Programs, tournament completion, and National Champion are derived projections rather than parallel mutable flags or counters.

Each completed tournament result is canonical and preserves the existing full home/away `PlayerGameStats` arrays. Postseason Player aggregates, combined regular/postseason statistics, career statistics, and tournament records are not yet implemented; future projections should derive them from retained results rather than introduce competing statistical truth.

The application session retains the completed `SeasonState` alongside the active `PostseasonState`; Tournament initialization and progression do not replace or mutate regular-season facts. Zustand coordinates Postseason navigation, Rotation drafts, controlled-game actions, AI round progression, and historical-result context, but delegates bracket participant resolution, ready-game semantics, result recording, elimination, and champion derivation to the public Postseason API. Bracket presentation may query each canonical participant source independently, while simulation continues to require both resolved Programs in designated-home orientation.

## Player Season Stats projections

Player Season Stats V0 is a pure Season projection over canonical completed-game facts:

```text
SeasonState
   ↓
stored GameResults
   ↓
stored PlayerGameStats
   ↓
Player Season Stats projection
   ├─ PlayerSeasonStats
   └─ PlayerGameLogEntry[]
```

`PlayerSeasonStats` and Player game logs are not canonical mutable `SeasonState`. The raw home/away `PlayerGameStats` arrays inside recorded `GameResult` values remain authoritative. The public Season surface exposes `derivePlayerSeasonStats()`, `deriveProgramPlayerSeasonStats()`, `deriveSeasonPlayerStats()`, and `getPlayerGameLog()`. These pure APIs project one current-roster Player, one Program's full current roster, the entire Season's current rosters, or one Player's chronological completed-game log. Pending games contribute nothing, while result-object insertion order cannot affect aggregation or log order.

Game logs include every completed Team game for the Player's Program. A stored zero-minute row is represented as `didPlay: false`; it remains visible as a DNP but does not increment the derived `gamesPlayed` count. All projection outputs are plain serializable data and add no caching, incremental indexes, or stat-specific randomness.

Future Player Stats UI should consume these public Season APIs rather than importing implementation internals or creating Zustand-owned totals. Awards, completed-season history, and career systems must likewise reuse canonical GameResult history and stable Player IDs rather than inventing parallel statistical truth.

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Universe consumers use the public `src/universe/index.ts` surface for `UNIVERSE_V0`, definition validation, deterministic dynasty initialization, and public universe types. Schedule consumers use `src/schedule/index.ts`, which exposes the accepted V0 configuration and version, schedule generation, structured validation, Program-game lookup, and schedule domain types. Season consumers use `src/season/index.ts` for initialization, strict result recording, legal Rotation replacement, structured validation, round/program queries, completion checks, record derivation, scheduled-game, round, and through-round simulation, derived Conference standings, derived Player Season Stats, and Player game logs. Postseason consumers use `src/postseason/index.ts` for deterministic selection, bracket creation, initialization, validation, participant and round queries, Rotation replacement, tournament simulation, and National Champion derivation. Schedule and Universe remain independent from mutable Season results, while Season depends only on their public APIs and the engine's Team, Rotation, validation, and GameResult contracts. No lower layer imports Postseason.

Game Presentation V0, Rotation Management V0, Season Presentation V0, Season UX Polish V0, Super Sim V0, Player Season Stats V0, Postseason Domain / Simulation V0, and Postseason Presentation V0 are complete. React renders regular-season and Tournament context, matchup actions, Rotation management, standings, brackets, final scores, historical full box scores, and the National Champion without calculating basketball outcomes, ratings, records, selection, advancement, or Rotation legality. Player Season Stats currently has no React presentation.

The engine was not changed for Rotation Management, Universe V0, Schedule Generation V0, or Season State V0. Editable exhibition Rotation state lives in the application layer, while Season Rotations live in `SeasonProgramState`; both rely on engine validation. The universe consumes only the engine public API; `src/engine` never imports universe, schedule, or Season definitions. Universe initialization uses an isolated deterministic RNG stream per Program, so one Program's roster is reproducible and unaffected by Program definition order or unrelated Programs. It also produces a valid default Rotation for every initialized Team. The Schedule module remains structure-only; the Season layer composes its output with initialized basketball state and completed results.

The accepted 32 Programs, 24 rounds, 16 games per round, and 384 total games are consequences of Universe V0 membership plus Schedule V0 configuration; they are not assumptions in the generic engine. Postseason is a framework-independent layer above public Season, Universe, and Engine APIs; its accepted 16-Team field and 15-game fixed bracket are Postseason V0 configuration, not generic engine assumptions. Together the regular season and accepted Postseason backend can progress one basketball season through a derived National Champion.

## Enforcement

ESLint rejects framework, store, UI-layer imports, and common browser globals in `src/engine`. It also prevents the engine from importing `src/universe` or `src/postseason`, prevents Season, Schedule, and Universe from importing Postseason, and keeps framework, presentation, ambient randomness, and browser dependencies out of all pure domain layers. Tests cover domain invariants, serialization, aggregation consistency, and deterministic seeded behavior.
