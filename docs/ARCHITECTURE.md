# Architecture

## Dependency rule

Dependencies point inward toward pure domain layers:

```text
Current application:
React → Zustand session orchestration → Dynasty / Season / Postseason → Schedule / Universe / Engine

Cross-season domain:
Dynasty → Season / Postseason / Universe → Schedule / Engine

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
  dynasty/               Cross-season ownership, Recruiting, archives, offseason rosters, and Player development
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
React Dynasty presentation
→ Zustand application session / navigation
→ canonical DynastyState + Season and Postseason public APIs
→ Schedule + Universe + Engine outputs
→ stored GameResult facts and derived projections
```

The engine owns basketball generation, ratings, Rotation legality, game outcomes, and Player box scores. The Season layer composes those capabilities with a Schedule and current Program basketball state; Postseason composes the completed Season with selection, a fixed bracket, and tournament progression. `DynastyState` is the canonical multi-season domain state. Zustand owns application/session orchestration—navigation, Rotation drafts, viewed-result IDs, and transient confirmation/completion UI—and commits pure returned Dynasty values without separate canonical Late Recruiting, Offseason, next-Season, history, or Recruiting state. React presents that state and dispatches user intent back through the store.

Phases 5A–5C add the pure `src/dynasty` layer above those accepted domains; Phases 6A–6D wire that lifecycle into React/Zustand without changing domain rules. The lifecycle is explicit: active Season → Postseason → Late Recruiting → finalized Recruiting → Offseason → rollover → next Season.

`DynastyState` is the serializable owner of cross-season lifecycle and identity:

```text
dynastyId + dynastySeed + controlledProgramId + universe
activeSeason: SeasonState | null
activePostseason: PostseasonState | null
recruiting: RecruitingState | null
history: CompletedSeasonArchive[]
completedRecruitingHistory: CompletedRecruitingClass[]
offseason: OffseasonState | null
```

Season and Postseason own one competitive year's basketball facts. Recruiting owns a future class and its relationships. Dynasty alone coordinates transitions among those states and immutable histories; lower layers do not know about rollover.

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
- `SeasonState` stores its immutable Schedule, current Team/Rotation state by stable Program ID, and complete `GameResult` facts once by stable ScheduledGame ID. Current round, completion, Program records, Conference records, Player/Team Season Stats, and leaderboards are derived rather than stored.
- Store facts and derive summaries. Season State does not maintain authoritative wins, losses, Conference records, games played, current-round counters, completion flags, standings, Player season totals/rates, or Player game logs alongside the Schedule and results that determine them.
- Randomness enters through an explicit seeded RNG or seed. Engine code never calls `Math.random()`.
- Prefer pure functions. If an operation evolves state, make inputs and returned state explicit.
- Zustand owns application/UI workflow state, not basketball rules.

The Season store is not authoritative for Program records, Conference records, standings, current round, next opponent, Recent Results, or Player statistics. Those values are projections over the active `SeasonState`, its immutable Schedule, and its recorded `GameResult` values. Transient Super Sim confirmation and completion-summary state is presentation state, not Season truth.

Followed Players is application intent rather than basketball truth. Zustand
stores only a duplicate-free ordered list of stable Player IDs for the current
Dynasty. A pure application read model resolves those IDs against current
Season rosters and Universe Program definitions, returning an explicit
unresolved result after a Player leaves the active universe. Intent survives
Season rollover, clears when a new Dynasty is initialized, never stores Player
or Team snapshots, and has no simulation effect.

The Phase 7A.3A Following view projection composes that low-level resolution
with `calculateOverall()` and the canonical `derivePlayerSeasonStats()` path.
It returns active current-roster rows in first-followed order plus unresolved
Player IDs and a total-followed count, allowing presentation to distinguish no
follow intent from follow intent with no active Players. OVR and Season rates
remain derived numeric facts rather than stored or preformatted UI state.

Rotation edits may be temporarily invalid in the Game Prep draft. Only a legal draft is committed through `updateProgramRotation()` to the controlled Program's current `SeasonProgramState.rotation`. That committed Rotation persists across games and is the only Rotation used by Hub Quick Sim and Super Sim; neither operation reads a stale invalid draft.

Permanent Coaching navigation uses the same session drafts and validated write
boundaries rather than owning another Rotation. `goToCoaching()` performs no
catch-up, simulation, Recruiting setup, or lifecycle transition: it only selects
the `coaching` session view and refreshes the relevant draft from canonical
basketball state. While `activePostseason` exists, Coaching reads and writes the
controlled Program's `PostseasonProgramState.rotation` through
`updatePostseasonProgramRotation()`; otherwise it reads and writes the active
Season Rotation through `updateProgramRotation()`. Invalid drafts remain in
Zustand and never replace either canonical Rotation. Phase 6E.17B implemented
the permanent Coaching screen and navigation against this exact boundary —
`CoachingScreen`'s `Roster | Rotation` tabs reuse `TeamStatsTable` and
`RotationEditorPanel` unchanged — and introduced no new state ownership.

Canonical live rotation state is `RotationV1`, with isolated Player-minute maps
for each floor position. Aggregate minutes and legal secondary eligibility are
derived. Universe, Season, Postseason, Dynasty, Exhibition, Zustand drafts, and
React editing use V1; the engine's broader `RotationInput` and
`normalizeRotationToV1()` exist only at intentional compatibility/migration
boundaries. Fresh Universe, Exhibition, and rollover defaults use the accepted
flexible V1 generator. Existing assignments are deep-cloned and preserved rather
than regenerated.

Simple Rotation intent is a pure adapter above that representation, not another
canonical format. `compileSimpleRotationIntent(team, minutesByPlayerId)` accepts
aggregate Player MPG only at an explicit compile boundary. Complete 200-minute
intent is solved as deterministic exact min-cost flow: Player totals and five
40-minute position capacities are hard constraints, existing eligibility
supplies graph edges, and secondary-position edges cost more than natural ones.
A successful result is revalidated by `validateRotationV1()`; invalid totals,
Player requests, unknown IDs, or infeasible coverage return structured issues
and no Rotation. The adapter is not stored in Season, Postseason, Dynasty, or
Zustand, and existing commit/simulation paths remain unchanged.

Phase 6E.18B integrates that adapter only into Coaching session state.
`coachingSimpleMinutesByPlayerId` is a roster-complete aggregate draft, with
zero representing the presentation-only Reserves grouping; it is never a Player
role or canonical basketball fact. Edits may temporarily total above or below
200 without touching V1. Explicit Apply compiles the draft and commits only a
successful result through the existing Season/Postseason Rotation replacement
APIs; compiler issues remain available in session state after failure. A
successful Simple commit refreshes the existing positional draft, and a
successful Coaching positional commit re-aggregates Simple. Invalid edits in
either draft remain isolated. Entering Coaching and Simple discard/reset both
rebuild aggregate MPG from the active Postseason Rotation when present,
otherwise from the active Season Rotation.

Projected Starting Five is another pure read boundary over committed Rotation
V1. `deriveProjectedStartingFive(team, rotation)` returns Player IDs keyed by
canonical `Position`; it stores no starter fact and has no simulation effect.
An exact five-position assignment maximizes the sum of each selected Player's
actual minutes at the projected position while enforcing five unique Players.
Ties prefer natural-position assignments, then higher aggregate Player minutes,
then lexicographically smaller stable Player IDs in canonical `POSITIONS` order.
Invalid Rotations or an unexpected inability to form a unique five return a
structured failure. Uncommitted Simple MPG intent is deliberately excluded:
Starting Five changes only after Simple Apply or an Advanced edit successfully
changes canonical Rotation V1.

```text
Game Prep
→ Zustand draft
→ validateRotationV1()
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

Season operations are pure: `recordGameResult()` and `updateProgramRotation()` return new Season values without mutating their inputs. Recorded results are immutable facts and cannot be silently overwritten. Result recording validates the ScheduledGame ID, exact home/away orientation, score/winner consistency, and that Player points reconstruct each Team score. Rotation updates delegate legality to the engine's `validateRotationV1()` contract.

Partial rounds and out-of-order result insertion are supported. Current round is the lowest Schedule round with a pending game; round completion, regular-season completion, overall Program records, and Conference records are projections over Schedule plus recorded results. `controlledProgramId` is intentionally absent because user ownership belongs to application session state or future Dynasty state rather than the generic Season domain.

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
Game Prep play / Hub Quick Sim / AI rest-of-round / Super Sim
                              ↓
                simulateScheduledGame()
                              ↓
                     simulateGame()
                              ↓
                  recordGameResult()
```

Game Prep is optional. Hub Quick Sim runs the controlled Program's next ScheduledGame with the last committed legal current Season Rotation, remains on the Hub, and shows the stored result inline. Super Sim calls `simulatePendingGamesThroughRound()` as a pacing convenience: Midseason resolves pending games through Round 12, and End of Regular Season resolves pending games through Round 24. It preserves completed results, uses every Program's current Team and Rotation, and creates the same full `GameResult` values as ordinary progression for identical state and seed.

Completed games are final. The postgame and historical-result screens read the already-recorded `GameResult`; opening a Schedule or Recent Results entry never re-simulates it. Recent Results is likewise derived from completed Schedule/results facts.

Hub Quick Sim adds no alternate result state. Its compact whole-game PTS/REB/AST leaders are pure presentation projections over the controlled game's canonical home and away `PlayerGameStats`. A leader may represent either Program; Player identity and Program identity are resolved from the participating Teams, and deterministic ties use minutes then stable Player ID. The result card does not store leader summaries in Zustand.

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

Each completed tournament result is canonical and preserves the existing full home/away `PlayerGameStats` arrays. Postseason Quick Sim derives the same compact whole-game leader projection from that stored result. Postseason Player aggregates, combined regular/postseason statistics, career statistics, and tournament records are not yet implemented; future projections should derive them from retained results rather than introduce competing statistical truth.

The application session retains the completed `SeasonState` alongside the active `PostseasonState`; Tournament initialization and progression do not replace or mutate regular-season facts. Zustand coordinates Postseason navigation, Rotation drafts, controlled-game actions, AI round progression, and historical-result context, but delegates bracket participant resolution, ready-game semantics, result recording, elimination, and champion derivation to the public Postseason API. Bracket presentation may query each canonical participant source independently, while simulation continues to require both resolved Programs in designated-home orientation.

## Accepted Dynasty and Recruiting ownership

`src/dynasty` is the serializable cross-season lifecycle owner. Its accepted state shape is:

```text
DynastyState
├── dynastyId / dynastySeed
├── controlledProgramId
├── UniverseDefinition
├── activeSeason: SeasonState | null
├── activePostseason: PostseasonState | null
├── recruiting: RecruitingState | null
├── history: CompletedSeasonArchive[]
├── completedRecruitingHistory: CompletedRecruitingClass[]
└── offseason: OffseasonState | null
```

The dependency direction is:

```text
Dynasty
   ↓
Season / Postseason / Universe
   ↓
Schedule / Engine
```

Season, Postseason, Universe, Schedule, and Engine do not depend on Dynasty. The Dynasty lint boundary also excludes React, React DOM, Zustand, UI/store imports, browser globals, and `Math.random()`.

`initializeDynastyState()` validates Dynasty identity, seed, controlled Program, Universe compatibility, and active Season/Postseason ownership. It creates an initial lifecycle value with empty basketball and Recruiting histories and no offseason. It does not migrate the application store or initialize future seasons.

`beginOffseason()` is the accepted pure completed-year transition:

```text
complete, valid SeasonState
+ complete, valid PostseasonState
+ derived National Champion
→ clone both competitions into one CompletedSeasonArchive
→ clear activeSeason and activePostseason
→ graduate seniors
→ develop and advance returning Players
→ create OffseasonState for the target season
```

The transition rejects incomplete regular seasons, incomplete Tournaments, missing champions, mismatched or invalid competition state, and duplicate archived season numbers. The returned Dynasty does not intentionally retain the completed competitions in both active and historical slots: active competition becomes `null` after the archive is created.

`CompletedSeasonArchive` stores the season number plus complete cloned `SeasonState` and `PostseasonState` values. Their schedules, fields, bracket sources, Teams, Rotations, `GameResult` values, and complete home/away `PlayerGameStats` rows remain canonical historical source facts. Historical presentation, career totals, records, and awards are not implemented, but the facts needed for later projections are preserved.

Stable identity does not mean shared mutable state. A returning Player may appear as `playerId X`, JR, 84 OVR in the archived Season and as the same `playerId X`, SR, 87 OVR in offseason. Development creates a new Player and attributes object, so the archived version remains JR and 84 OVR. Returning identity preserves ID, first and last name, height, position, and Potential; class and attributes may change, and OVR changes only through the existing derived calculation.

For each Program, offseason construction uses the latest competitive Team snapshot: the Postseason Team for a qualified Program, otherwise its regular-season Team. `Team.prestige` is copied unchanged. Seniors are omitted; non-seniors are developed and advanced. The implementation guarantees returning Player IDs remain unique across the Universe.

`OffseasonState` contains completed and target season numbers plus one `OffseasonProgramState` per Program. Each Program state contains `programId`, preserved current prestige, and returning Players. It deliberately contains no Rotation and is not a `Team`:

```text
12 current Players − 3 seniors
→ 9 returning Players in OffseasonProgramState
→ derive 3 open roster spots
```

Incomplete offseason rosters are valid while the existing `Team` invariant remains exactly 12 Players. `deriveOffseasonRosterOutlook()` calculates open spots from `12 - returningPlayers.length`; open spots are not stored as duplicate state.

`deriveProjectedRosterOutlook(team)` is an in-season pure projection over current roster facts:

```text
SR           → projected departure
FR / SO / JR → projected returner
12 − projected returners → projected openings
```

It returns current roster size plus departing and returning Player IDs and projected openings by natural position. It does not require Season completion, Postseason, OffseasonState, graduation, or RNG. Recruiting V0 consumes this projection rather than reimplementing graduation rules; board capacity remains distinct from offer/signing capacity.

Recruiting belongs exclusively to the Dynasty/cross-season domain. The basketball Engine, Schedule, Season, and Postseason layers remain unaware of Recruiting. Recruiting may read Program identity, current `Team.prestige`, projected roster outlook, and completed-round state, but a Season N commitment is a future-roster fact and never mutates the current Team, Rotation, or `SeasonState`.

`Recruit.player` is the future Player value, not a disposable profile. Its stable Player ID survives Recruit generation, commitment, the finalized incoming class, and Phase 5C freshman enrollment.

The canonical `RecruitingState` stores the national Recruit class/profiles and class rankings, each Program's projected positional openings and Board targets, Focus flags, and Active Offer intent, accumulated Recruit/Program relationship progress, commitments with period/late timing, current phase, and last resolved period. Current standings, standing order, target status, remaining positional need, Active Offer counts, available offer capacity, and Focus counts are pure projections. This follows the same rule as Season state: store facts, derive summaries.

Recruiting advancement attaches to fully completed basketball rounds rather than individual controlled-game completion:

```text
entire Round 7 completes
→ recruiting period 7 resolves once
→ Round 8 begins
```

This prevents simulation order from creating extra recruiting progress. Synchronization resolves every missing period canonically in order, so a saved plan behaves identically under ordinary advancement and Super Sim. Periods 1–24 follow the regular season; periods 25–28 follow completed Tournament rounds for every Program. Recruiting randomness uses explicit typed Dynasty-seed namespaces and stable target-season, Recruit, Program, and stream identities; it never uses `Math.random()` or shared iteration-order-dependent RNG state.

Finalization stores an immutable cloned final `RecruitingState` in `CompletedRecruitingClass`, keyed by target season number, inside `completedRecruitingHistory`. This is the single historical source for finalized incoming-class facts and future Recruit history. It is deliberately separate from `CompletedSeasonArchive`, which owns basketball competition history. Finalized active Recruiting state and its history are not competing representations: finalization preserves the accepted current state as the archived class for enrollment and future historical projections.

## Accepted next-season roster assembly and rollover

Phase 5C.1's pure `assembleNextSeasonRosters()` boundary consumes exactly one lifecycle-compatible `OffseasonState`, finalized `CompletedRecruitingClass`, matching `CompletedSeasonArchive`, and `UniverseDefinition`:

```text
accepted developed/class-advanced returners
+ committed Recruits from the finalized class
→ NextSeasonRosterAssembly
```

It does not rerun graduation, Development, Recruiting, or destination selection and does not generate emergency Players, repair positions, make cuts, or handle transfers. Every Program must exist in all canonical sources, target seasons must agree, and `returners + incoming commitments` must equal exactly 12. Failure is explicit rather than repaired.

Enrollment clones the Recruit's Player value, sets `classYear: "FR"`, and preserves Player ID, name, height, position, attributes, and Potential. Unsigned Recruits remain historical facts and do not enroll. Output rosters sort by natural-position order then Player ID and remain plain serializable values.

One stable Player ID represents one basketball person across immutable snapshots. A historical Recruit and his active freshman intentionally share an ID but not a mutable object; an archived JR and his developed SR successor do likewise. An unrelated Recruit may never reuse that ID. Assembly validates returner continuity, Recruit enrollment, graduate exclusion, Program ownership, roster-wide and Dynasty-wide uniqueness, Player ratings/height/classes, and positional composition without treating legitimate historical continuity as a collision.

Phase 5C.2's pure `rolloverDynastyToNextSeason()` is the single atomic orchestration operation. It requires no active Season/Postseason, one prepared `OffseasonState`, one matching completed Season archive, one matching finalized Recruiting class, finalized active Recruiting facts equal to that history, unique history season keys, and a valid 5C.1 assembly. Any failure throws before returning a replacement Dynasty and does not mutate the source.

On success it:

```text
assembled rosters
→ fresh Team snapshots using Program identity and preserved offseason prestige
→ fresh generated default Rotations
→ deterministic season-specific Schedule and Game IDs
→ empty SeasonState N+1
→ initialize Recruiting targeting N+2 from the new rosters
```

The returned `DynastyState` preserves `controlledProgramId`, `history`, and `completedRecruitingHistory`; sets `activeSeason` to N+1; keeps `activePostseason` null; clears `offseason`; and replaces finalized active Recruiting with a fresh period-zero `RecruitingState` for N+2. New Recruit IDs are audited against completed Seasons, active Players, and all prior Recruiting-class identities. Season, Schedule, Postseason, Universe, and Engine remain unaware of this orchestration.

The application can repeat Season → Recruiting → Postseason → Late Recruiting → Offseason → rollover. A new interactive Dynasty receives one unique creation seed; all domain systems remain deterministic from that stored seed, while explicit-seed test, inspection, and calibration workflows retain their fixed behavior. Interactive rollover clears only the controlled Program's fresh Recruiting board/offers; autonomous/default domain Recruiting plans remain unchanged for AI Programs.

The immutable full-snapshot architecture remained correct and JSON-serializable through accepted 50-Season Dynasty runs: no history overwrite, identity collision, Schedule/Game-ID collision, or serialization failure occurred. Full snapshots have a measurable storage cost, however. One canonical serialized `DynastyState` measured `30.57 MB` after Season 10, `76.20 MB` after Season 25, and `152.27 MB` after Season 50—approximately linear growth near 3 MB per completed Season. Persistence architecture must evaluate this before production-scale saves or very long user Dynasties, without prematurely prescribing compression, pruning, database storage, or another representation.

Long-run calibration changes no ownership boundary. Board + Focus + Offer,
Recruit Talent Distribution V1, Player Development V1, Rotation V1, Prestige,
and roster rollover are frozen unless new evidence or a future system changes
their underlying assumptions. Ordinary UI integration does not reopen them.

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

The current League, Team Details, and Player Details UI consumes these public Season projections. National Player leaderboards, Team leaders, Player summaries, and game logs are derived rather than stored in Zustand. Awards, completed-season history, and career systems must likewise reuse canonical `GameResult` history and stable Player IDs rather than inventing parallel statistical truth.

Phase 7B.1 adds `deriveNewsFeed()` as another pure Dynasty read-model. It scans
canonical regular-season results, Postseason results/seeds, Recruiting
commitments, and caller-provided Followed Player IDs; only fully completed
round checkpoints publish. Stable IDs, family/source ordering, exact detector
thresholds, and presentation templates make repeated derivation deterministic.
Player-performance projections carry the canonical game outcome needed for
win/loss copy, and the feed exposes its latest fully completed competition
checkpoint separately from story groups so the UI can identify a storyless
latest round without creating a fake event. No news item, checkpoint, cache,
RNG draw, or event record is persisted. Zustand
stores only transient `leagueTab` navigation context so detail Back restores the
originating tab and fresh League entry resets to News.

## Team Season Stats and exploration projections

The current regular-season presentation follows one facts-to-projections pipeline:

```text
SeasonState
   ↓
completed GameResults
   ↓
PlayerGameStats
   ↓
├── PlayerSeasonStats
├── PlayerGameLog
├── TeamSeasonStats
├── national Player leader projections
├── Team Player leaders
└── Quick Sim whole-game leaders
        ↓
League / Team / Player / Quick Sim presentation
```

`TeamSeasonStats` is a pure projection, not mutable Team or `SeasonState` data. It derives one Program's games played, scoring totals/rates, Player box-score totals/rates, and shooting percentages from completed regular-season results. National Player leaderboards and Team Player leaders project existing `PlayerSeasonStats`; they are not authoritative tables in Zustand.

Player Season Stats and Team Season Stats remain regular-season-only. Postseason `GameResult` values are separate canonical facts inside `PostseasonState`; no current projection silently combines the two competitions.

## Public API and imports

Consumers import engine capabilities and types through `src/engine/index.ts`; the box-score allocator remains an internal simulation detail. Universe consumers use the public `src/universe/index.ts` surface for `UNIVERSE_V0`, definition validation, deterministic dynasty initialization, and public universe types. Schedule consumers use `src/schedule/index.ts`, which exposes the accepted V0 configuration and version, schedule generation, optional lifecycle Game-ID namespacing, structured validation, Program-game lookup, and schedule domain types. Season consumers use `src/season/index.ts` for initialization, strict result recording, legal Rotation replacement, structured validation, round/program queries, completion checks, record derivation, scheduled-game, round, and through-round simulation, derived Conference standings, Player/Team Season Stats, national/Team leader projections, and Player game logs. Postseason consumers use `src/postseason/index.ts` for deterministic selection, bracket creation, initialization, validation, participant and round queries, Rotation replacement, tournament simulation, and National Champion derivation. Dynasty consumers use `src/dynasty/index.ts` for initialization, offseason transition, roster assembly/validation, atomic Season rollover, projected/offseason roster outlooks, returning-Player development, Recruiting class/board/offer operations, period synchronization, finalization, queries, and public Dynasty/Recruiting/archive/offseason types. No lower layer imports Dynasty.

Rotation V1, Season presentation, Super Sim, Player/Team Season Stats, League and
Player exploration, Postseason, Recruiting UI, Late Recruiting, Offseason,
rollover presentation, and the repeatable player-facing Dynasty loop are
complete. Rollover preserves canonical history and controlled Program identity
while resetting stale season-specific session presentation state.

The engine was not changed for Rotation Management, Universe V0, Schedule Generation V0, or Season State V0. Editable exhibition Rotation state lives in the application layer, while Season Rotations live in `SeasonProgramState`; both rely on engine validation. The universe consumes only the engine public API; `src/engine` never imports universe, schedule, or Season definitions. Universe initialization uses an isolated deterministic RNG stream per Program, so one Program's roster is reproducible and unaffected by Program definition order or unrelated Programs. It also produces a valid default Rotation for every initialized Team. The Schedule module remains structure-only; the Season layer composes its output with initialized basketball state and completed results.

The accepted 32 Programs, 24 rounds, 16 games per round, and 384 total games are consequences of Universe V0 membership plus Schedule V0 configuration; they are not assumptions in the generic engine. Postseason is a framework-independent layer above public Season, Universe, and Engine APIs; its accepted 16-Team field and 15-game fixed bracket are Postseason V0 configuration, not generic engine assumptions. Together the regular season and accepted Postseason backend can progress one basketball season through a derived National Champion.

## Enforcement

ESLint rejects framework, store, UI-layer imports, ambient randomness, and common browser globals across pure domain layers. It prevents lower layers from importing Postseason or Dynasty and keeps Dynasty framework-independent. Tests cover domain invariants, serialization, aggregation consistency, immutable archive behavior, stable Player/Recruit identity, Potential ceilings, deterministic/order-independent progression, offer capacity, commitments, period synchronization, and Recruiting finalization.
