# Game Design

## Vision

Build an approachable fictional college basketball dynasty simulator in which roster construction and player development create understandable long-term stories. Strategic choices should matter, while the underlying systems remain legible enough to tune and extend.

## Core loop

Choose a school → manage the current roster/Rotation while recruiting for the next season → complete the regular season and national tournament → preserve history → graduate/develop returning Players → enroll recruits and finalize rosters → advance to the next season.

## Design principles

- Decisions should create visible tradeoffs rather than hidden complexity.
- Results should be believable across many games, without trying to model every possession detail at first.
- The same inputs and seed must reproduce the same outcome.
- Fictional schools and players avoid dependence on real-world data.
- Simulated production should naturally create recognizable Players and Program identities without requiring manually authored star or archetype narratives.
- New systems must earn their complexity and be discussed before entering the active milestone.

## Initial player model

Players are plain serializable records. Positions are `PG`, `SG`, `SF`, `PF`, and `C`; class years are `FR`, `SO`, `JR`, and `SR`. Height is stored as total inches.

Current-ability attributes use an inclusive 40–99 rating scale:

- Offense: finishing, shooting, playmaking, ball handling
- Defense: perimeter defense, interior defense, rebounding
- Physical: athleticism, stamina

Potential is a separate 40–99 estimate of a player's developmental ceiling. It is never lower than current overall, but it does not affect current ability. Overall rating is a rounded, position-weighted average of current-ability attributes and is never stored as independently mutable state.

Initial overall weights:

| Position | Finishing | Shooting | Playmaking | Ball handling | Perimeter defense | Interior defense | Rebounding | Athleticism | Stamina |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| PG | 8% | 18% | 22% | 22% | 14% | 2% | 3% | 6% | 5% |
| SG | 18% | 24% | 8% | 15% | 17% | 3% | 4% | 7% | 4% |
| SF | 14% | 14% | 10% | 10% | 13% | 10% | 11% | 11% | 7% |
| PF | 20% | 7% | 5% | 5% | 7% | 17% | 19% | 14% | 6% |
| C | 19% | 3% | 4% | 3% | 5% | 23% | 23% | 14% | 6% |

These weights are an understandable tuning baseline, not a final balance model.

## Initial player generation

`generatePlayer` accepts position, class year, a 40–99 talent level, and an explicit seeded RNG. Talent level is the center of an expected overall distribution, not a guaranteed overall or a uniform attribute value. Fixed position corrections keep average quality comparable, while position-specific modifiers and independent bounded variance create natural strengths, weaknesses, and roughly two overall points of standard deviation. Individual players are not forced back to the requested talent value.

Ratings landing at or below the lower bound during generation are redistributed across a narrow 40–46 band. This keeps intentionally weak skills weak while avoiding large populations collapsed to exactly 40. The rating bounds remain 40–99.

Height ranges use total inches:

| Position | Range |
| --- | --- |
| PG | 70–77 (5'10"–6'5") |
| SG | 73–79 (6'1"–6'7") |
| SF | 76–81 (6'4"–6'9") |
| PF | 78–83 (6'6"–6'11") |
| C | 80–86 (6'8"–7'2") |

Names come from local fictional pools containing 99 first names and 155 last names, providing 15,345 combinations without enforcing global uniqueness. IDs, names, height, attributes, and potential all consume only the supplied RNG.

Potential is generated from current overall as an approximate development ceiling and is capped at 99:

| Class year | Generated upside |
| --- | --- |
| FR | 6–15 points |
| SO | 4–11 points |
| JR | 1–7 points |
| SR | 0–3 points |

These ranges describe initial generation only. They do not implement or guarantee future progression outcomes.

## Initial team and roster model

A Team is a plain serializable record containing ID, name, abbreviation, prestige, and exactly 12 players. It does not store overall rating, record, ranking, rotation, coaching, recruiting, conference, or schedule state.

Prestige is static long-term Program reputation on an inclusive 1–100 scale. Immutable `basePrestige` initializes each Team's Prestige; Offseason and rollover preserve that value across Seasons, and Recruiting consumes it through the established attraction and planning formulas. Prestige does not modify Player Development V1.

Each roster contains two players at every natural position plus one extra player at two distinct, seeded positions. Position counts therefore vary between two and three while always covering `PG`, `SG`, `SF`, `PF`, and `C`.

Class-year construction starts with two players in every year, then adds four seeded selections from a bag containing two of each year. A roster therefore has two to four players in each class without forcing the same distribution on every team.

Roster quality uses a tunable program baseline:

```text
baseline talent = 42 + (prestige × 0.42) + team variance (-3 to +3)
```

Twelve ordered slot offsets (`+9, +6, +4, +3, +2, +1, 0, -1, -2, -3, -5, -7`) create a star-to-depth hierarchy. Each slot also receives `-3` to `+3` variance. The top slot has a 12% chance of an additional `+4` to `+9` breakout, allowing occasional standout players at lower-prestige programs. Final player talent inputs remain bounded to 40–99 and are passed through the existing Player generator unchanged.

## Accepted Rotation V1 model

Rotation V1 stores Player minutes by floor position. PG, SG, SF, PF, and C each
require exactly 40 minutes, for 200 total; a Player may receive at most 40
aggregate minutes. Aggregate Player minutes are derived rather than stored.

Legal floor eligibility is derived from natural position: `PG → PG/SG`,
`SG → SG/SF`, `SF → SF/PF`, `PF → PF/C`, and `C → C/PF`. Player retains only
his natural position—there is no stored secondary-position field. Users may
assign legal secondary minutes manually. Fresh defaults use the accepted
deterministic flexible generator, while existing rotations persist exactly
through Season/Postseason progression and history.

The generator begins with the historical natural-position allocation and makes
only accepted conservative substitutions. A 36-minute natural default is
reserved for Players in their Team's top three by OVR; other Players with a
natural-position backup use a lower ceiling, leaving weak-backup shares
available for useful legal secondary Players. Natural-36 Players do not
automatically become 40-minute flexible defaults. Manual legal assignments may
still reach 40. Exact constants, validation, and behavioral evidence live in
`SIMULATION.md`.

In Simple Rotation, **Fill Remaining** is explicit draft assistance. MPG values
the coach edits are visibly locked, remain exact during the fill, and the rest
of the roster is completed into a legal 200-minute Rotation when possible.
Nothing becomes canonical until **Apply Rotation**; **Discard Changes** restores
the committed Rotation. Impossible locked constraints are never overridden and
instead retain the draft with player-facing correction feedback. Advanced
Rotation and AI Rotation strategy are unchanged.

## Initial derived team strength

Current ability can differ meaningfully between offense and defense. Positional context changes how attributes translate into each rating: perimeter creation and defense matter more for guards, while finishing, interior defense, and rebounding matter more for frontcourt players.

Team offense and defense weight active players by their share of the valid 200-minute rotation, so rotation choices can create real offensive and defensive tradeoffs. Potential, class year, and stamina do not directly enter the skill formulas, and the ratings are never stored on Player or Team. The tunable v0.1 weights and exact aggregation formulas are documented in `SIMULATION.md`.

Generated-team offense and defense currently remain fairly correlated because roster generation primarily varies talent rather than explicit style. Stronger naturally generated identities may be explored during future tuning; this is not a defect in the accepted Team Strength layer.

## Initial team-level game outcome

Single-Game Simulation V0 converts two valid Rotations and their derived Team strengths into a deterministic final score, winner, and overtime count. Each Team's expected score responds separately to its own offense and the opponent's defense. A small home advantage changes the expected margin, while seeded shared and Team-specific variance keep outcomes uncertain. Tied games play repeated overtime periods until a winner is produced.

The accepted Team scores remain authoritative. A deterministic allocation layer explains them with full-roster Player rows containing minutes, points, rebounds, assists, steals, blocks, turnovers, and traditional shooting lines. Player points always reconstruct the Team score, while shooting makes always reconstruct Player points. The layer does not represent possessions, pace, substitutions, fatigue, or play-by-play.

This supports individual statistical storytelling beneath Team outcomes: stars can carry an offense or have quiet games, role players can spike, frontcourt Players retain stronger rebounding identities, guards tend to create more assists, and shooting efficiency varies from game to game. These performances explain the accepted result without becoming a second outcome simulation.

Game Presentation V0 exposes this information through deterministic demo matchups, generated rosters, the editable home/default away Rotations, Team Strength, final scores, overtime, and both Teams' Player box scores. It adds no basketball rules to the presentation layer.

## Initial coaching agency — implemented

Rotation Management is the first direct coaching decision available to the user. In the current exhibition workflow, HOME is the coached Team and AWAY retains its generated default Rotation. The coach distributes 200 minutes across five 40-minute floor positions using Rotation V1's derived legal eligibility and 40-minute aggregate Player cap.

Because Team Strength weights Player influence by assigned minutes, a legal Rotation change alters Team OFF, DEF, and OVR and therefore affects game outcomes probabilistically. Better Players should usually deserve more minutes, but differences between Player offense, Player defense, and roster depth can make choices contextual. The interface exposes those consequences without declaring one Rotation strategically correct.

The goal is understandable basketball choice, not broad tactical complexity. Pace, offensive and defensive schemes, pressing, shot profiles, live substitutions, fatigue, morale, Player happiness, chemistry, and playing-time consequences are not implemented. Additional tactical systems must earn their complexity after the season and dynasty loops work. A displayed or minute-derived starting five has no separate gameplay effect.

## MVP world

Stable Fictional Basketball Universe V0 defines 32 permanent fictional programs across four conferences of eight. Stable Program configuration owns identity, structured city/state location, conference membership, branding, and immutable base prestige. Current dynasty `Team.prestige` is initialized from base prestige but remains basketball state that may evolve only in a later scoped system.

Base prestige establishes the starting long-term Program hierarchy; it does not prescribe an exact roster. Individual opening rosters retain deterministic Player and Team-generation variance. Conference identities are descriptive world-building only and currently grant no engine bonuses. Universe V0 conference membership is fixed for the MVP, while conference realignment and changes to current `Team.prestige` are deferred to later Dynasty systems.

New-dynasty initialization derives an isolated seeded RNG from the universe version, roster-generation version, typed dynasty seed, and Program ID. It generates each roster through the accepted Team generator, assigns the stable Program ID to Team, and derives a legal default Rotation. The full Program dataset remains canonical in `src/universe`; the six-program exhibition catalog is still only a UI subset plus one development fixture.

## Accepted MVP regular season

Schedule Generation V0 gives every Program a 24-game regular season: 14 Conference games from a double round robin and 10 distinct non-Conference matchups. Every Conference opponent is played once at home and once away, no non-Conference pairing is duplicated, no games are neutral-site, and each Program finishes with exactly 12 home and 12 away games.

The schedule uses 24 abstract rounds rather than real dates. All 32 Programs play exactly once in each round. Seeded variation changes legal non-Conference pairings, home/away orientation where choices exist, and ordering without making scheduling depend on prestige, Team Strength, or geography. Universe V0 Conference membership remains fixed.

These choices favor fairness, reproducibility, and manageable dynasty pacing over exact replication of the current NCAA season. Regular-season Schedule Generation remains structural only. Calendar dates and calendar-based tournament scheduling remain future work; the accepted fixed Postseason bracket is documented below.

## Accepted Season State and progression

Season State and Progression V0 combines the initialized Universe basketball state with the accepted Schedule. Every Program begins with its generated Team and default legal Rotation. Team rosters, Player ratings, and Team prestige remain fixed during Season V0; the current Rotation is the only basketball input exposed for legal in-season replacement. AI Programs keep their default Rotations because no automatic AI Rotation behavior exists. No injury, fatigue, development, recruiting, or prestige-evolution system is implied.

Completed games are immutable facts stored once by stable ScheduledGame ID. Each result retains the complete existing `GameResult`, including both Teams' full Player box scores. A round may be partially complete, and results may be recorded out of order without changing the meaning of earlier or later games.

The design rule is **store facts, derive summaries**. Current round, round completion, regular-season completion, overall Program records, and Conference records are derived from the Schedule and recorded results rather than maintained as separate mutable counters or flags.

## Accepted AI round simulation and standings

AI Round Simulation and Standings V0 uses each Program's current Season Team and Rotation. Every ScheduledGame receives independent deterministic randomness derived from the explicit Season simulation seed, Season identity, and ScheduledGame identity, so executing games in a different order does not change unrelated results. Pending-round execution preserves completed games and may exclude Programs generically; completed results are immutable and are never automatically replayed.

Conference standings first compare Conference winning percentage. An exact two-Team tie group uses completed head-to-head games when decisive. Split, unplayed, and three-or-more-Team ties fall through to overall winning percentage and then stable Program ID. Rankings and polls are separate concepts and remain deferred.

The accepted 50-season diagnostic showed a strong relationship between initial Team Strength and long-run wins while individual seasons still produced upsets and over- or underperformance. This is an observational health check, not a tuning requirement.

## Accepted regular-season experience

The permanent Season flow is the primary playable experience. Game Prep is optional rather than a required stop before every game. The coach may progress at three speeds:

- **Detailed:** Game Prep, inspect/edit the Rotation, then Simulate Game into the full Box Score.
- **Fast:** Quick Sim from the Season Hub, remain on the Hub for the inline result and whole-game leaders, then advance explicitly.
- **Bulk:** Super Sim to Midseason, End of Regular Season, or Season Complete.

Dynasty regular-season and Tournament full postgames add a compact Postgame
Meaning layer between the final scoreboard and Player Box Score. At most three
facts communicate competitive consequences, newly broken accepted Records,
threshold-qualified Career Highs, accepted notable streaks, Tournament upsets,
or updated regular-season records. Tournament and regular-season statistical
scopes remain isolated; record ties and first appearances do not create new
milestone claims. Historical views reconstruct the canonical game checkpoint
and remain read-only.

Hub Quick Sim uses the controlled Program's last committed legal current Season Rotation. A legal change made in Game Prep persists into future games; a temporary invalid draft does not replace that canonical Rotation. Super Sim also uses every Program's current Team and Rotation and changes only pacing, not basketball rules, randomness, or result detail.

Midseason means all pending regular-season games through Round 12. End of Regular Season means all pending games through Round 24. Season Complete finishes the remaining regular season, initializes and completes the Tournament through the canonical Postseason path, synchronizes Recruiting through Period 28, and stops at the existing Season Complete inspection checkpoint. It never enters Late Recruiting or the offseason. Already-completed games are preserved, and every newly completed game records its full `GameResult` and Player box scores.

Completed results are final. Opening a completed Schedule entry or Recent Results entry reads the stored result and full historical box score without re-simulation. Recent Results, records, standings, and round progress are derived from Schedule plus completed results.

The fast/detailed distinction also applies in Postseason. Tournament Quick Sim stays on the Tournament Hub and presents the canonical final, advancement/elimination context, and whole-game PTS/REB/AST leaders. Tournament Game Prep exposes the current legal Postseason Rotation and deliberately opens the complete Box Score after simulation. The basketball result is identical in authority; only presentation and navigation differ.

Quick Sim's whole-game leaders support emergent League familiarity. For example:

```text
Quick Sim
→ opposing Player scores 34
→ user recognizes the name and Program
→ League Leaders / Player Details
→ broader Program exploration
```

This is factual storytelling from stored simulated production, not a separate authored-star system. The regular-season leaderboards, Team averages/leaders, Player profiles, and game logs likewise reflect canonical completed games.

## Accepted Dynasty Foundation and Player Development V1

The accepted Dedicated Offseason Experience presents this unchanged lifecycle
as a Hybrid Offseason Timeline:

```text
Tournament Complete → Late Recruiting → Recruiting Class → Departures
→ Development → Roster Review → Ready for Season → Start Next Season
```

The furthest/current stage owns progression while eligible completed stages are
safe factual reviews; future stages remain visible but unavailable. Departures
and Development still execute
atomically at `beginOffseason()`; their separate stages are factual presentation
reveals, not separate turns or decisions. Reviewing a completed stage never
replays a mechanic or changes the next legal progression action.

Phase 5A establishes the first implemented cross-season gameplay boundary:

```text
complete regular season and National Tournament
→ preserve canonical competition history
→ graduate seniors
→ develop returning Players
→ advance classes
→ expose partial offseason rosters and open spots
```

This creates recognizable multi-year Player arcs without requiring training micromanagement. Freshmen generally have the greatest development opportunity, sophomores less, and juniors the least before their senior year. Potential distinguishes longer-term upside through deterministic headroom-sensitive opportunity, while a hidden stable Player tendency and annual variance permit busts, modest outcomes, hits, and rare breakouts among otherwise similar Players.

Development changes current basketball attributes rather than adding a mutable OVR bonus. It is deliberately uneven and position-aware instead of applying `+1` to every skill. Returning Players keep their stable ID, name, height, position, and Potential; class and attributes advance in new immutable Player values. Overall remains derived from the accepted positional formula. Players do not regress in Development V1.

Development uses the class just completed:

```text
FR development → SO
SO development → JR
JR development → SR
SR → graduates
```

Graduation V0 is the entire departure model: seniors leave and freshmen, sophomores, and juniors return. Transfers, early professional departures, fifth years, redshirts, hardship exemptions, and dismissals are deferred rather than implicit Phase 5A rules.

Potential is a fixed ceiling, not a promised destination. Low headroom constrains growth, Players at the ceiling receive no attribute development, and Players may graduate below Potential. Playing time, starts, box-score production, Team success, Postseason results, Program prestige, conference, user control, coaching, and facilities do not affect Development V1.

Development V1 remains younger-player-heavy while allowing high-headroom opportunities above the former hard annual ceilings. Its accepted direct diagnostic confirms visible Potential creates meaningful, but non-guaranteed, career-outcome variance. Exact constants and validation results live in `SIMULATION.md`.

The stable identity and archive rules support the intended long-term roster story:

```text
recruit
→ commit
→ enroll
→ develop
→ retain
→ graduate
```

Recruiting through a finalized incoming class and freshman enrollment during rollover are accepted.

### Accepted Player-development information model

Player development now communicates three distinct ideas:

- **POT** is visible and represents the Player's theoretical development
  capacity. It remains an absolute ceiling, not a promise of reaching it.
- **Work Ethic** represents the stable underlying ordinary-development profile.
  It is already determined while the Player is a Recruit but remains hidden
  then; Player Details shows **Unknown** for freshmen and reveals
  **Inconsistent**, **Steady**, or **Strong** after the first offseason. The
  value is fixed for the Player's life and does not guarantee an annual gain.
- An **Explosive Offseason** is a separate, exceptionally rare annual event:
  something extraordinary happened that summer. Its probability is independent
  of Work Ethic, so an Inconsistent Player may explode and a Strong Player may
  never do so.

Work Ethic does not mean game effort, personality, morale, coachability,
performance, POT, an exact annual outcome, or Explosion likelihood.

> POT tells possibility. Work Ethic informs ordinary trajectory. Explosive
> Offseasons preserve surprise.

## Accepted In-Season Recruiting V0

Recruiting is an ongoing Dynasty layer that runs alongside current-season basketball while targeting Season N+1. One shared national class exposes exact Player attributes, OVR, POT, National Rank, Position Rank, and 2–5-star classification. V0 has no scouting uncertainty or hidden Potential; Recruit rankings are immutable class-history facts and do not change when the future Player develops.

The player-facing annual rhythm is:

```text
Preseason
→ Regular Season + Recruiting
→ National Tournament
→ Late Recruiting
→ Final Recruiting Class
→ Offseason turnover
→ Next Season
```

```text
maintain Board, Focus, and Active Offers
→ complete basketball rounds
→ recruiting periods advance
→ relationships and standings evolve
→ recruits commit for Season N+1
→ Late Recruiting finalizes the incoming class
```

The saved plan supports both pacing styles already established by Quick Sim and Game Prep:

- A hands-on user may revisit and adjust the recruiting plan frequently.
- A fast user may set persistent choices and allow them to advance automatically through ordinary round progression or Super Sim.

### Positional needs, Board, Focus, and Offers

New flexible-capacity Recruiting cycles construct every completed roster within
one accepted envelope:

```text
12 Players total
2–3 Players at each natural position (PG / SG / SF / PF / C)
```

Every legal final shape is therefore a permutation of `3/3/2/2/2`, but the two
extra depth positions are not inherited permanently from S0. Projected
shortages below two create exact-position **Required** needs; every remaining
scholarship is shared **Flexible** capacity that may land at any position still
below three. Commitments determine the final shape. Recruiting itself is the
roster-construction experience—there is no preseason plan or slot-assignment
screen. Rotation V1 floor-position eligibility does not change a Player's
natural-position Recruiting identity.

Recruiting's accepted **Roster Outlook** sibling mode presents the controlled
Program's factual Season N+1 roster: non-senior returners with next-class labels,
controlled commitments as incoming freshmen, current OVR/POT, Required needs,
shared Flexible openings, Full positions, and separate departing seniors. A
position below two may show both its Required need and `Flex +1` headroom after
the minimum is satisfied; this never creates a separate flexible scholarship
for every eligible position. It is available through
regular-season, postseason, and Late Recruiting, including embedded Late
Recruiting, then yields to the finalized Recruiting Class flow. It does not
include unsigned targets or forecast Development, future OVR, Rotation, depth,
minutes, roles, Team Strength, or subjective roster quality.

Recruit Details gives factual next-Season context for that same natural
position. It shows projected returners with next-Season class and current
OVR/POT, controlled incoming commitments, the viewed Recruit when still legal,
and departing seniors. Current OVR alone determines ordering and tied rank; POT
is display context only. This is not a future Rotation, depth chart, role or
playing-time promise, Development forecast, or Recruiting-interest input.

A Program may place up to 10 Recruits on its board, including backups and
reaches beyond available scholarships. Board membership means the Program is
recruiting/following that Player. An Active Offer reserves real capacity. The
complete Offer set must be jointly feasible: all offered Recruits could commit
without exceeding 12 Players, creating a fourth projected Player at a position,
or consuming scholarships needed for remaining Required positions. Withdrawing
an Offer or losing that Recruit releases the reservation. Only an active board
target with a valid Active Offer may commit; an unoffered backup may still build
relationship progress.

Board targets receive normal recruiting effort. A Program may Focus up to three active Board targets for extra attention; the Focus bonus is fixed and does not grow when the Board is smaller or Focus slots are unused. Inactive, committed, or position-filled targets receive no effort and cannot remain effective Focus targets. There is no points budget or normalized allocation mechanic.

When the game generates the controlled Program's initial Draft Board, it first
builds the Board and legal Offers, then selects up to three Focus targets from
that generated strategy with Offered targets preferred. If fewer than three
generated Offers are legal, the strongest remaining active Board targets fill
the unused Focus slots. This one-time alignment does not couple the controls:
after generation, the player may independently Focus, Offer, withdraw, and
change the Board as before.

`Fill Remaining Board` is a separate explicit convenience action for a partial
controlled-Program Board. It preserves existing membership, order, Focus, and
Offers exactly, then appends deterministic legal recommendations up to Board
capacity. Added targets receive normal Board membership only. Removing or
losing a target, advancing a period, or simulating never triggers an automatic
refill.

Board-entry provenance keeps player-selected targets distinguishable from
assistant/system additions without changing how either target recruits. A
manually added Recruit remains in the manual group; generated and Fill-added
Recruits enter the assistant group. Focus, Offers, and later player management
do not relabel that entry—a useful assistant suggestion can become a meaningful
player-managed pursuit while retaining the history of how it entered the Board.

`Clear Unavailable` reduces repetitive Board maintenance by removing targets
who committed elsewhere or whose exact position is already filled. It never
removes a Recruit committed to the controlled Program, preserves relationship
history, and deliberately leaves the resulting Board slots open. The player may
then add targets manually or make the separate explicit choice to use `Fill
Remaining Board`; cleanup introduces no new Recruiting mechanic or automatic
strategy decision.

When an offered Recruit becomes unavailable while a controlled Program still has positional need, autonomous progression may promote an eligible same-position backup already on that user's board. Selection is deterministic: Focus status, current standing descending, National Rank ascending, then Player ID. This preserves the user's Board and relationship history, adds no new target, and does not invent a new Focus strategy. Explicit user offer withdrawals are not treated as losses to replace, and AI management does not casually overwrite a controlled Program's otherwise valid offers.

### Competition, commitments, and calendar

Lower-ranked prospects are generally less prestige-sensitive, more attainable, and earlier-deciding. Elite prospects are generally more prestige-sensitive, later-deciding, and more contested. Early identification plus Focus gives a lower-prestige Program a real chance at an attainable Player, while a higher-prestige Program entering before commitment may overtake it. Standing leaders may change before a decision.

Player-facing readiness is categorical. Before eligibility, a Recruit is `not-deciding`
unless the next Recruiting period opens the decision window and the current
eligible leader already satisfies that next window's standing and separation
gates; only then is the Recruit `decision-soon`. Eligible battles progress from
`developing` (standing gate unmet), to `serious` (standing met but separation
unmet), to `decision-imminent` (both production gates met), then `committed`
only when a canonical commitment exists. These categories do not expose the
exact decision period, relationship totals, thresholds, probability, or rolls,
and they do not alter commitment behavior.

A commitment is final. V0 has no decommitments, post-commitment flips, or reopened recruitment. A current-season commitment remains a future-roster fact only:

```text
Season 1: Marcus Hill commits to Charlotte Tech
Season 1 Team / Rotation: unchanged
finalized incoming class: same Marcus Hill Player ID
Season 2 enrollment: same Marcus Hill Player ID, class FR
```

Recruiting progress aligns with globally completed basketball rounds, not completion of the controlled Program's individual game:

```text
Periods 1–24  → regular-season Rounds 1–24 complete
Period 25     → Round of 16 complete
Period 26     → Quarterfinals complete
Period 27     → Semifinals complete
Period 28     → National Championship complete
Late          → distinct final phase after Period 28
```

All 32 Programs continue Recruiting during the postseason regardless of Tournament qualification or elimination. Tournament wins, advancement, and the Championship add no Recruiting attraction in V0; the Tournament advances only the global Recruiting clock.

After competition, the accepted Phase 5A transition produces the actual partial next-season construction state:

```text
graduation + returning-Player development
→ OffseasonState returning Players + actual openings
plus CompletedRecruitingClass incoming Recruits
→ exact 12-Player next-season roster
```

Late Recruiting is a distinct, user-reviewed final signing phase. After the
Tournament completes, Continue → Late Recruiting remains available across
normal navigation until the canonical phase advances; the action may
synchronize any still-missing postseason Recruiting periods first. It
deterministically concludes the existing market, satisfying remaining Required
needs before shared Flexible scholarships from the originally generated class,
and preserves unmatched lower-tier Players as unsigned once League capacity is
exhausted. No emergency Players are generated. Major lifecycle checkpoints
never advance automatically. Exact formulas and accepted calibration are
documented in `SIMULATION.md`.

## Accepted Dynasty Season Rollover V0

At the season boundary, seniors leave; freshmen, sophomores, and juniors have already developed and advanced class; and committed Recruits enroll as freshmen without rerolled identity, ratings, or Potential. Every Program must return to exactly 12 Players. V0 has no cuts, transfers, redshirts, fifth-year Players, early professional departures, walk-ons, or position changes.

Offseason V0 is a focused review/turnover phase, not a decision-heavy system: the player reviews departures, automatic Development, the incoming class, and the next roster before explicitly beginning the next Season. Returning Players retain their IDs across Seasons; enrolled Recruits preserve their Recruit/Player identity.

Every new roster receives a fresh generated default Rotation, including the controlled Program. Prior user/AI minute distributions are not carried between seasons. Rotation preference carryover is future depth.

`Team.prestige` remains fixed through rollover. Championships, losing seasons, and Recruiting classes do not modify it in V0; dynamic prestige is deferred.

Each Season receives a fresh deterministic Schedule under the accepted 24-game format: 14 Conference and 10 non-Conference games across 24 rounds, split 12 home and 12 away. The new Season begins with zero results and default Rotations, while the prior Season remains historical.

Once Season N+1 exists, Recruiting targeting N+2 initializes immediately from
that roster's frozen projected-returner capacity basis. Prior needs are not
reused. Interactive play begins that new controlled Program board empty while
AI plans remain autonomous; the user again chooses when to create a strategy.
This closes the repeatable player-facing loop.

## Accepted long-run Dynasty economy

Across 250 completed Seasons, the current Recruiting, graduation, Development, and rollover rules settled into a stable long-run talent level. Upperclassmen were stronger on average (`FR < SO < JR < SR`), prestige created a meaningful but non-absolute Program hierarchy, better Teams won more often, and 26 of 32 Programs won at least one simulated championship.

The current talent economy is frozen around Recruit Talent Distribution V1,
its calibrated elite POT finalization, and Player Development V1. Eligible
78+ OVR Recruits whose sampled ceiling does not exceed current ability retain
zero POT gap for a deliberate minority of profiles and otherwise receive a
small bounded runway; natural higher ceilings remain untouched. The earlier
simple POT-floor behavior and long-run V0 evidence remain historical,
but its talent-generation and Development behavior was superseded after manual
playtesting. Do not casually retune Recruiting, Talent V1, Development V1, or
rollover without new evidence or a future system that materially changes talent
flow.

## Accepted Player Season Stats V0

Season-long Player production emerges from actual simulated games; it is not generated separately at the Season level. Game Prep simulation, Hub Quick Sim, AI round simulation, and Super Sim all record the same canonical `PlayerGameStats` history and therefore feed the same derived Player totals, averages, percentages, and game logs.

Stats can be derived at any point in a partial or complete Season. Each current roster Player receives a row, including Players with no games played. A completed Team game with a zero-minute box-score row appears in that Player's chronological log as a DNP but does not increment `gamesPlayed`:

```text
gamesPlayed = completed games where Player minutes > 0
```

Game logs retain Schedule chronology, opponent, home/away context, final score, W/L result, and the stored traditional box-score line. This supports performance history without inventing Season-level events or new randomness.

Current outputs are limited to the traditional facts already produced by Player Box Scores V0: games played; minutes; points; rebounds; assists; steals; blocks; turnovers; field goals, three-pointers, and free throws made/attempted; per-game versions of minutes and the counting stats; and aggregate shooting percentages. These facts now power national Player leaders, Team/Player Details, Team leaders, Player game logs, and the separately accepted Awards model. Rankings, advanced metrics, and additional statistical depth belong in `FUTURE_FEATURES.md` rather than accepted game rules.

Acceptance inspection produced a plausible scoring hierarchy and believable game-to-game variance. Those observations are not calibration targets and require no simulation tuning.

Stable Player identity now extends this regular-season truth across completed
Dynasty Seasons. A Followed Player resolves as active, former, or unknown.
Former Player Details aggregates archived regular-season career production and
shows Final/Peak OVR, Final Ratings, Career Progression, and Recruiting Origin
when canonical. Player Career keeps that Regular Season context intact and adds
a separate Tournament context for postseason career production, achievements,
season runs, career highs, game history, and existing MOP association. Combined
regular-season/Tournament totals, broad Alumni browsing, and global historical
search remain outside the accepted system. Records and Season-grouped Career
Honors are accepted derived surfaces.

Season Preview introduces the active Season's cast from existing facts before
current results create News. It does not change progression, Player ratings,
Recruiting, or simulation and stores no Preview history.

## Accepted Awards & Honors V1

Awards & Honors V1 recognizes National Player of the Year, National Freshman
of the Year, a five-Player First Team All-America, Conference Player and
Freshman of the Year, a five-Player First Team All-Conference in each
Conference, and Tournament Most Outstanding Player. Honor teams have no
positional quotas. Defensive awards, coach awards, additional honor teams, and
specialty awards remain deferred.

Regular-season honors use deterministic `awards-v1` evaluation:

```text
ProductionScorePerGame =
  (PTS + 0.70×REB + 0.70×AST + 1.50×STL + 1.50×BLK
   - 0.70×TOV - 0.70×missedFG - 0.30×missedFT) / GP

TeamBonus = 2.00 × ProgramWinPercentage
AwardScore = ProductionScorePerGame + TeamBonus
```

Eligibility requires positive-minute appearances in at least half of the
Program's regular-season games and at least 12.0 MPG; freshman honors also
require `classYear === 'FR'`. National, Conference, and freshman honors use the
same absolute model. OVR, POT, ratings, Prestige, Recruiting status, and
Tournament performance do not influence regular-season Awards.

Tournament MOP is Champion-only and uses Tournament performance only. An
eligible Player must record positive minutes in at least three Tournament games
including the championship. Selection uses the same individual production
coefficients without Team Bonus and deterministic tie-breaking. Awards evaluate
existing outcomes and have no gameplay effects.

## Accepted Postseason V0

A completed 32-Program regular season feeds a 16-Team single-elimination national tournament. No Conference tournaments exist in V0.

Qualification and seeding are determined only by completed basketball results:

- Each of the four Conferences receives one automatic bid. Its automatic qualifier is the regular-season Conference champion produced by the existing Conference standings ordering.
- The remaining 12 places are at-large bids. Candidates are ordered by overall winning percentage; an exact two-Team tie uses completed head-to-head results when decisive, then Conference winning percentage and stable Program ID. A tie group of three or more skips direct head-to-head and uses Conference winning percentage followed by Program ID.
- Prestige, Team Strength, Player ratings, Conference reputation, geography, and hidden selection ratings do not enter selection.
- After the four automatic qualifiers and 12 at-larges are selected, all 16
  Programs are seeded together using the same accepted résumé ordering: overall
  winning percentage; decisive head-to-head for an exact two-Team tie; then
  Conference winning percentage and stable Program ID. Automatic qualification
  guarantees entry, not a protected seed.

Team OVR, Team Strength, Prestige, and Conference reputation remain excluded
from seeding. Seed labels represent the accepted results-only résumé ordering,
not a direct power ranking.

The fixed bracket contains eight Round-of-16 games, four quarterfinals, two semifinals, and one Championship: 15 games total. The first-round seed pairings are `1–16`, `8–9`, `5–12`, `4–13`, `3–14`, `6–11`, `7–10`, and `2–15`, with winners advancing through fixed paths. There is no reseeding, third-place game, regional placement, Conference separation, or rematch avoidance. Same-Conference tournament matchups are legal.

Every tournament game is neutral-site. The lower numerical seed is designated home only to preserve stable `GameResult` orientation and future presentation semantics; it receives no normal basketball home-court modifier. The current Team, roster, ratings, and legal Rotation carry forward unchanged from the completed regular season. Legal Rotations may be changed between tournament games, but there are no tournament-specific fatigue, injury, development, or tactics systems.

Tournament results are final canonical facts and retain both Teams' complete Player box scores. The current round, resolved future participants, remaining or eliminated Programs, tournament completion, and National Champion are derived from the fixed bracket and completed results rather than stored as mutable summaries.

Player Season Stats V0 remains regular-season-only. Tournament Player history
is a sibling derived context over Postseason `GameResult` values: GP and an
individual Tournament appearance require positive minutes, while a zero-minute
qualified-roster Player may retain the Program's finish or championship
association. Starts are not tracked. No combined public statistical scope is
defined.

The Tournament Record Book covers PTS, REB, AST, STL, and BLK counting totals
for Single Game, one cumulative Tournament Run, and Tournament Career. It is
explicitly separate from regular-season Single Game, qualified Single Season,
and Career records; deeper runs naturally provide more opportunity in the
Tournament Run grouping.

Postseason Presentation V0 exposes the accepted single-season lifecycle from the completed regular season through National Champion. The Tournament Hub presents the selected field and canonical bracket, focuses the controlled Program's next neutral-site matchup while it is qualified and alive, supports Tournament Quick Sim and legal Rotation changes, and retains completed results for historical box-score inspection.

The controlled Program has three legitimate Tournament outcomes: qualified/alive, eliminated, or did not qualify. Elimination and non-qualification receive distinct presentation states but do not stop the wider Tournament; AI progression remains available until the bracket derives a National Champion. React and Zustand present and orchestrate these states without owning selection, advancement, or champion rules.
