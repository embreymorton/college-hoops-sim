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
Dynasty. Pure read models resolve each ID through active regular-season rosters,
then completed regular-season archives, producing `active | former | unknown`.
Active rows compose `calculateOverall()` and current
`derivePlayerSeasonStats()`; former rows compose archived identity and
regular-season career projections. Unknown IDs remain explicit without being
mislabeled Former. Intent survives rollover, clears for a new Dynasty, stores
no Player/Team snapshots, and has no simulation effect.

Followed Recruits begins as separate application intent. Zustand
stores a duplicate-free, first-followed ordered list of stable Recruit/future-
Player IDs for the current Dynasty. The foundation resolves those IDs only
against the active canonical `RecruitingState`:

```text
stable followed Recruit IDs + canonical RecruitingState
→ pure Following Recruits projection
→ Recruiting Following UI with resolved current-class Recruit Details
  + explicit unresolved IDs
```

The projection composes the existing safe Recruit Details/battle read models,
stores no Recruit snapshot, and exposes no hidden Recruiting inputs. Recruiting
updates and commitments do not clear intent; a new Dynasty does.

At successful season rollover, after canonical next-season rosters exist, the
session boundary performs stable-ID continuity:

```text
followedRecruitIds + canonical Recruit → Player stable identity + rollover
→ verify the same ID on an active Player roster
→ append to followedPlayerIds if absent
→ retire that ID from followedRecruitIds
```

Existing Player-follow order remains unchanged; newly verified IDs append in
first-followed Recruit order. Already-followed Player IDs are not duplicated.
IDs absent from all new active rosters remain unresolved Recruit intent rather
than being deleted or fabricated. No name matching, migration flag, copied
follow object, navigation side effect, or Recruiting-mechanics change exists.
Recruit Details is the only V1 surface that adds Recruit-follow intent before
the Following table's direct Unfollow action; Board, Battles, and National Class
remain discovery/management entry surfaces rather than parallel Follow controls.

Rotation edits may be temporarily invalid in the Game Prep draft. Only a legal draft is committed through `updateProgramRotation()` to the controlled Program's current `SeasonProgramState.rotation`. That committed Rotation persists across games and is the only Rotation used by Hub Quick Sim and Super Sim; neither operation reads a stale invalid draft.

Game Prep reuses the Coaching Simple transient fields and competition-aware
Advanced actions without adding canonical state. Entry initializes aggregate
Simple and positional drafts from the controlled Program's current Season or
Postseason Rotation and clears transient preservation/issues. Simple intent
remains draft-only until Apply; a dirty Simple draft cannot be hidden behind
Advanced or used for simulation. Invalid positional intent cannot be hidden
behind Simple. Successful commits refresh the other presentation, and
Tournament Game Prep writes only through the accepted Postseason boundary.

Permanent Coaching navigation uses the same session drafts and validated write
boundaries rather than owning another Rotation. `goToCoaching()` performs no
catch-up, simulation, Recruiting setup, or lifecycle transition: it only selects
the `coaching` session view and refreshes the relevant draft from canonical
basketball state. When the controlled Program has `PostseasonProgramState`,
Coaching reads and writes its postseason Rotation through
`updatePostseasonProgramRotation()`; otherwise it reads and writes the retained
active/completed Season Rotation through `updateProgramRotation()`. Invalid drafts remain in
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

Rotation Assistant V1 adds only transient preserved-Player IDs beside that
Simple draft. Editing a Player marks his current MPG as preserved; the explicit
Fill Remaining operation treats those totals as hard constraints and returns a
legal draft or structured issues. It never writes Season/Postseason state.
Successful Apply or Discard clears preserved intent, while Apply remains the
only canonical commit boundary.

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

Matchup Scout V1 is a pure read-model boundary shared by regular-season and
Tournament Game Prep:

```text
canonical Season/Postseason facts
→ deriveMatchupScout()
→ shared MatchupScoutSection
```

The projection ranks existing regular-season Team and Player statistics
deterministically to select zero to three nonredundant league-relative opponent
observations. Zero games yields no statistical profile; one or two games yields
limited-data presentation without rankings; three to five allows a restrained
early-Season profile; six or more uses normal selection. Players to Watch are
production-first across qualified PPG/RPG/APG leaders, deduplicated by stable
Player ID, with committed-Rotation fallback and compact Top-10 distinctions.
Observation families cover scoring offense/defense, shooting, assists,
turnovers and turnover forcing, rebounding differential, rim protection, and a
point-differential fallback; rank-relative extremity, family suppression, and
stable tie-breaks avoid redundant or forced copy.
Game Context derives recent form, streaks of at least two games, and the latest
regular-season prior meeting. During Tournament Game Prep, Tournament results
may precede regular-season results in recent form, but never enter the league
rankings or opponent statistical profile.

The Scout stores no report, scouting accuracy, fog of war, tactical advice, or
persistent assignment. It introduces no RNG and changes no simulation, AI,
ratings, Recruiting, or competition lifecycle behavior. Broader rankings,
prior-meeting box-score navigation/notable-performer copy, opponent archetypes,
schemes, assignments, tempo controls, and matchup-specific AI remain outside
the accepted V1 boundary.

```text
Game Prep
→ Simple aggregate draft or Advanced positional draft
→ accepted compiler / validateRotationV1()
→ competition-aware Season or Postseason Rotation update
→ one canonical competition RotationV1
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

Each completed tournament result is canonical and preserves the existing full
home/away `PlayerGameStats` arrays. Postseason Quick Sim derives the same compact
whole-game leader projection from that stored result. Regular-season Former
Player career aggregation is implemented from completed Season archives;
Postseason Player aggregates, combined regular/postseason career statistics,
Tournament résumés, and Tournament records are not. Future projections should
derive them from retained results rather than introduce competing truth.

The application session retains the completed `SeasonState` alongside the active `PostseasonState`; Tournament initialization and progression do not replace or mutate regular-season facts. Zustand coordinates Postseason navigation, Rotation drafts, controlled-game actions, AI round progression, and historical-result context, but delegates bracket participant resolution, ready-game semantics, result recording, elimination, and champion derivation to the public Postseason API. Bracket presentation may query each canonical participant source independently, while simulation continues to require both resolved Programs in designated-home orientation.

Permanent Coaching context depends on controlled-Program participation, not
merely on the existence of `activePostseason`. A qualified Program reads and
writes its copied canonical Postseason team/rotation. A non-qualified Program
has no `PostseasonProgramState`, so Coaching reads and writes the retained
completed-Season team/rotation instead. Neither path requires a Tournament game
or opponent, and navigation does not create participation or mutate Tournament
facts.

Tournament-complete handoff eligibility comes from the one canonical Dynasty
progression resolver, including both synchronized Period 28 and the recoverable
Period 24 boundary. Tournament presents the shared progression bar below its
navigation; changing session views cannot strand the lifecycle or require a
duplicated presentation boolean. Separately, the completed-Hub recap is a pure
projection over the canonical championship game and controlled Program ID. It
derives champion, runner-up, oriented score, overtime, box-score game ID, and
controlled finish without depending on last-played or selected-game session
state.

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
    └── developmentExplosions: OffseasonDevelopmentExplosion[]
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

The Dedicated Offseason Experience does not subdivide this canonical mutation.
`deriveOffseasonExperience()` in `src/app/offseasonExperience.ts` is the pure
application projection that maps Dynasty lifecycle facts plus
`OffseasonPresentationCursor` into Season transition identity, the six
player-facing stages, completed/current/locked status, `furthestUnlockedStage`,
`viewedStage`, safe revisit targets, stage facts, and the appropriate progression
action. `furthestUnlockedStage` remains the actual progression position while
`viewedStage` may point to an eligible completed stage; reviewing never regresses
or recreates an earlier action.

Zustand owns `offseasonPresentationCursor` as transient session state with an
`offseasonKey`, `furthestStage`, and `viewedStage`. It is normalized against the
canonical completed/target Season identity, survives exploration navigation,
and resets at rollover. It is not persisted in `DynastyState`, cannot authorize
domain mutation, cannot rerun Development or regress Recruiting, and creates no
parallel lifecycle truth. Canonical mutation remains exclusively in the
existing `enterLateRecruiting()`, `finalizeRecruitingClass()`,
`beginDynastyOffseason()`, and `beginNextSeason()` store commands and their
existing pure Dynasty operations. Exploration and stage review only change
navigation/presentation state; the route-independent Offseason fallback keeps
the current action recoverable without executing progression.

`CompletedSeasonArchive` stores the season number plus complete cloned `SeasonState` and `PostseasonState` values. Their schedules, fields, bracket sources, Teams, Rotations, `GameResult` values, and complete home/away `PlayerGameStats` rows remain canonical historical source facts. Player career presentation, Program Legacy/Trajectory, the Season Yearbook, and the Record Book are pure projections over canonical history; Awards additionally persist only their judged semantic outcomes under a rules version, as defined below. Program Trajectory aggregates any stable Program ID across completed archives for Team Details, deriving archived Team OVR from the archived Team + Rotation through existing Team Strength and reusing canonical record, Conference-standings, and Tournament-outcome projections. It joins only the finalized class with the displayed Season's target number from `completedRecruitingHistory`. It stores no Program-history facts or trajectory cache, mutates no archive, and does not infer historical Prestige.

Stable identity does not mean shared mutable state. A returning Player may appear as `playerId X`, JR, 84 OVR in the archived Season and as the same `playerId X`, SR, 87 OVR in offseason. Development creates a new Player and attributes object, so the archived version remains JR and 84 OVR. Returning identity preserves ID, first and last name, height, position, and Potential; class and attributes may change, and OVR changes only through the existing derived calculation.

For each Program, offseason construction uses the latest competitive Team snapshot: the Postseason Team for a qualified Program, otherwise its regular-season Team. `Team.prestige` is copied unchanged. Seniors are omitted; non-seniors are developed and advanced. The implementation guarantees returning Player IDs remain unique across the Universe.

`OffseasonState` contains completed and target season numbers, one
`OffseasonProgramState` per Program, and immutable
`OffseasonDevelopmentExplosion` facts created after ordinary Development for
official exceptional outcomes. Each Program state contains `programId`, the
unchanged static Prestige, and returning Players. `beginOffseason()` copies
Prestige from the latest completed competitive Team snapshot; rollover copies
it into the next Team. It deliberately contains no Rotation and is not a
`Team`:

```text
12 current Players − 3 seniors
→ 9 returning Players in OffseasonProgramState
→ derive 3 open roster spots
```

Incomplete offseason rosters are valid while the existing `Team` invariant remains exactly 12 Players. `deriveOffseasonRosterOutlook()` calculates open spots from `12 - returningPlayers.length`; open spots are not stored as duplicate state.

Explosion resolution preserves ordinary Development as the first authoritative
result, then uses separate deterministic event-roll, magnitude, and exceptional-
allocation namespaces. React consumes the immutable event fact and never
reconstructs an Explosion from a development delta.

Work Ethic is likewise not stored on `Player`. The domain derives the stable
ordinary-development tendency from typed Dynasty seed plus Player ID, and a
pure application projection combines that identity with lifecycle/class facts
to return `Unknown` or the revealed label. React contains no duplicated RNG
logic, and no mutable `workEthicRevealed` flag is necessary.

`OffseasonDevelopmentExplosion` currently belongs only to the active/current
offseason. Rollover clears `OffseasonState`; no durable historical Explosion
archive exists. Career Progression therefore cannot reliably label prior
Explosions, and a large historical DEV delta must not be used as a substitute
for the missing event fact. Any future historical recognition requires a
deliberate durable lifecycle-event design.

`deriveProjectedRosterOutlook(team)` is an in-season pure projection over current roster facts:

```text
SR           → projected departure
FR / SO / JR → projected returner
12 − projected returners → projected openings
```

It returns current roster size plus departing and returning Player IDs and projected openings by natural position. It does not require Season completion, Postseason, OffseasonState, graduation, or RNG. Recruiting V0 consumes this projection rather than reimplementing graduation rules; board capacity remains distinct from offer/signing capacity.

Recruit Details composes a separate pure `deriveRecruitPositionOutlook()` read
model rather than expanding generic `ProjectedRosterOutlook` with hypothetical
Recruit facts. It reads the controlled active Team, canonical Recruit identities
and commitments, plus authoritative target status. The result contains natural-
position returners, departing seniors, controlled incoming commitments, and an
optional viewed-Recruit hypothetical. It promotes returner class labels only;
current OVR/POT remain current facts, and current OVR alone determines ordering
and competition rank. No projection is cached or stored.

Recruiting belongs exclusively to the Dynasty/cross-season domain. The basketball Engine, Schedule, Season, and Postseason layers remain unaware of Recruiting. Recruiting may read Program identity, current `Team.prestige`, projected roster outlook, and completed-round state, but a Season N commitment is a future-roster fact and never mutates the current Team, Rotation, or `SeasonState`.

`Recruit.player` is the future Player value, not a disposable profile. Its stable Player ID survives Recruit generation, commitment, the finalized incoming class, and Phase 5C freshman enrollment.

Recruit Details remains a projection-driven application destination:

```text
RecruitingState + Recruit.player stable future Player identity
→ deriveRecruitDetailsView() safe projections
→ transient selected Recruit Player ID + parent Recruiting mode
→ Recruit Details UI
```

The selected ID and parent Recruiting mode are presentation state in Zustand;
the screen resolves the canonical profile, exact ratings, Recruiting status,
pursuing-Program context, controlled-Program context, and next-Season natural-
position outlook on demand and stores no
Recruit snapshot or duplicate canonical Recruiting data. Contextual Board,
Focus, and Offer controls call the existing Recruiting transitions, so Recruit
Details adds no parallel eligibility or simulation rules. Committed Recruits
resolve to a non-actionable committed state. Stale IDs recover locally to the
preserved Recruiting parent mode.

The canonical `RecruitingState` stores the national Recruit class/profiles and class rankings, each Program's projected positional openings and Board targets, Focus flags, and Active Offer intent, accumulated Recruit/Program relationship progress, commitments with period/late timing, current phase, and last resolved period. Current standings, standing order, target status, remaining positional need, Active Offer counts, available offer capacity, and Focus counts are pure projections. This follows the same rule as Season state: store facts, derive summaries.

Recruiting advancement attaches to fully completed basketball rounds rather than individual controlled-game completion:

```text
entire Round 7 completes
→ recruiting period 7 resolves once
→ Round 8 begins
```

This prevents simulation order from creating extra recruiting progress. Synchronization resolves every missing period canonically in order, so a saved plan behaves identically under ordinary advancement and Super Sim. Periods 1–24 follow the regular season; periods 25–28 follow completed Tournament rounds for every Program. Recruiting randomness uses explicit typed Dynasty-seed namespaces and stable target-season, Recruit, Program, and stream identities; it never uses `Math.random()` or shared iteration-order-dependent RNG state.

Finalization stores an immutable cloned final `RecruitingState` in `CompletedRecruitingClass`, keyed by target season number, inside `completedRecruitingHistory`. This is the single historical source for finalized incoming-class facts and future Recruit history. It is deliberately separate from `CompletedSeasonArchive`, which owns basketball competition history. Finalized active Recruiting state and its history are not competing representations: finalization preserves the accepted current state as the archived class for enrollment and future historical projections.

Recruiting Class Retrospectives adds a read-only boundary over that canonical
history:

```text
completedRecruitingHistory + active/archive roster snapshots
  → pure finalized-signee retrospective projection
  → transient History class/filter and exploration state
  → React presentation
```

Commitments define membership, so unsigned generated Recruits are excluded.
Stable Player ID remains the only Recruit → Player identity seam; active and
archived roster lookup structures resolve enrolled outcomes and historical
snapshots derive former peak OVR. A class finalized before enrollment resolves
as Incoming, while malformed post-enrollment identity yields a neutral
unavailable result and never fabricates a replacement by name or Program.
`completedRecruitingHistory` remains the sole Recruiting-history source: no
retrospective registry, copied canonical facts, persistent cache, new Dynasty
state, or simulation behavior exists. Zustand retains only presentation and
navigation context. Archived relationship progress, attraction/standing,
thresholds, probabilities, quality/readiness values, and Board/Focus/Offer
internals remain outside the player-facing projection.

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

The explicit Tournament → Late Recruiting handoff has one authoritative,
pure progression resolver in `src/dynasty/progression.ts`. It derives the next
action from canonical Tournament completion and either recoverable boundary:
Recruiting already synchronized in its postseason phase, or the genuine
completed-Tournament lag state at regular-season Period 24. The application
shell renders the action on ordinary routes, while Season/Postseason hubs place
the same action contextually and suppress the shell duplicate. Both dispatch
the single store command. That command idempotently synchronizes any missing
completed-Tournament Recruiting rounds before entering Late Recruiting;
repeated navigation cannot consume the action, and repeated invocation after a
completed transition is a no-op.

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

When completed history exists, the same projection derives record-breaking
regular-season stories without new state. It scans completed archives once for
the five Single Game maxima, then processes completed active games in canonical
round/game order. A value must strictly exceed the running maximum; each
qualifying Player/game emits one combined major story and suppresses that
Player/game's generic performance candidate. All Players in one game compare
against the same pregame baseline; the running maximum advances after the game,
including non-story rows, preserving deterministic same-round behavior.
Postseason performances never enter this path.

Phase 7B.2 adds a pure stable-identity read boundary:

```text
stable Player ID
   ↓
active regular-season rosters, then completed regular-season archives
   ↓
active | former | unknown
```

Active identity takes priority; historical identity and final Program come
from the greatest matching canonical Season number, independent of archive
array order. `derivePlayerCareerHistory()` remains the Season-row source, and a
separate pure summary aggregates its regular-season counting totals before
deriving career rates and shooting percentages. Following and Player Details
consume these projections. No Alumni registry, copied Player snapshot,
historical index, cache, RNG, or new canonical state exists.

Phase 7B.3 adds `deriveSeasonPreview()` as a pure active-Season read-model. For
Season 1 it ranks established Players and freshmen from active rosters. For
Season N > 1 it requires the exact N-1 completed regular-season archive and the
exact completed Recruiting class targeting N, compares returners by stable ID,
derives prior PPG from archived GameResults, and takes freshman stars/rank and
destination from canonical Recruit/commitment records. Followed rows preserve
Follow order. Missing, duplicate, or mismatched lifecycle inputs fail as
structural invariants. No Preview snapshot, viewed/dismissed state, cache, RNG,
or canonical mutation exists; Zustand stores only the transient
`seasonPreview` route in the existing exploration history.

Phase 7C.1 adds a pure completed-Season Yearbook boundary:

```text
CompletedSeasonArchive
  → pure Yearbook projections
  → transient/local selection and exploration state
  → React presentation
```

The archive remains the sole historical source of Season, standings, Player
statistics, and Tournament facts. Conference/stat-category selection and
Yearbook return context are presentation state; no summary snapshot, historical
Player copy, cache, RNG draw, or season-specific Player route is persisted.
Stable Player IDs resolve through the existing active/former/unknown boundary.

Phase 7C.2 extends the same boundary without adding canonical state:

```text
CompletedSeasonArchive[] + active SeasonState
  → pure completed-regular-season record projection
  → transient History/category selection
  → React presentation
```

Single Game records read completed scheduled-game box scores, Season records
reuse national-leader qualification and rate semantics, and Career records sum
Season totals by stable Player ID. Completed active regular-season games form a
derived live overlay: Single Game and Career facts are authoritative, while
active Season rates are marked provisional. An active Season is omitted when
its Season number is already archived, preventing rollover duplication;
postseason Player statistics are never inputs. Sorting includes stable
fact-based tie keys, so archive order cannot change output. The projection
traverses each Season once for game candidates and derives Season statistics
once for shared use across all five categories and Career aggregation; it
returns all three scopes for all categories together. React memoizes that pure
result by stable history, Universe, and active-Season references, making a
category switch cheap while completed-round state naturally invalidates it.

Player Records Expansion V1 reuses that traversal through one internal,
explicitly regular-season candidate corpus. The existing Dynasty Record Book
remains a behavior-preserving consumer. `derivePlayerCareerHighs()` filters
single-game candidates by stable Player ID and returns one deterministic
canonical maximum plus its equal-value occurrence count.
`deriveProgramPlayerRecords()` filters Single Game and qualified Single Season
candidates by Program and aggregates Career totals by `(programId, playerId)`,
so only production accumulated while representing that Program contributes.
Completed active games overlay archives immediately; only active Season rates
are provisional, and duplicate active/archive Season numbers remain excluded.

Both projections expose a `regular-season` game-scope contract and never read
Postseason results. They add no record registry, achievement state, cache,
persistence, RNG, or lifecycle ownership. A future Tournament-stat initiative
can add coordinated competition-source semantics without silently changing the
accepted regular-season career boundary. Team and Player Details consume these
read models behind local two-tab presentation state; that IA adds no route or
Zustand ownership and leaves stable exploration history unchanged.

## Awards & Honors ownership

Awards are deterministic judged Season outcomes owned by `src/dynasty`. The
accepted `awards-v1` evaluator consumes canonical regular-season `GameResult`
history and Program records; Tournament MOP consumes canonical Tournament
results. Live projections and archive creation call the same evaluator, so the
announced outcome cannot drift from eventual persistence.

`CompletedSeasonArchive.awards` stores the rules version and semantic honor
records keyed by stable Player, Program, and optional Conference identity. It
does not duplicate Player snapshots, statistics, names, or display copy.
`beginOffseason()` remains the single canonical persistence boundary. Nothing
is persisted at the Final Four reveal or championship completion; those live
surfaces remain pure projections. Historical resolution composes stored honor
identity with the archived Season and Universe, allowing honors to survive
graduation and later Seasons.

Awards presentation statistics are derived from the same canonical Season or
Tournament aggregation used elsewhere. Awards add no state to Season,
Postseason, or Zustand and have no dependency back into simulation, Team
Strength, Recruiting, Development, roster lifecycle, Prestige, Tournament
progression, or Offseason behavior.

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
