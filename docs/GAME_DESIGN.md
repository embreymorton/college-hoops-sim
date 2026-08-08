# Game Design

## Vision

Build an approachable fictional college basketball dynasty simulator in which roster construction and player development create understandable long-term stories. Strategic choices should matter, while the underlying systems remain legible enough to tune and extend.

## Core loop

Choose a school → manage roster and rotations → simulate games → complete a season → compete in a national tournament → recruit players → develop the roster → advance to the next season.

## Design principles

- Decisions should create visible tradeoffs rather than hidden complexity.
- Results should be believable across many games, without trying to model every possession detail at first.
- The same inputs and seed must reproduce the same outcome.
- Fictional schools and players avoid dependence on real-world data.
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

Prestige is long-term program quality and reputation on an inclusive 1–100 scale. It will eventually inform recruiting, expectations, and program progression; in the current milestone it affects only initial roster talent.

Each roster contains two players at every natural position plus one extra player at two distinct, seeded positions. Position counts therefore vary between two and three while always covering `PG`, `SG`, `SF`, `PF`, and `C`.

Class-year construction starts with two players in every year, then adds four seeded selections from a bag containing two of each year. A roster therefore has two to four players in each class without forcing the same distribution on every team.

Roster quality uses a tunable program baseline:

```text
baseline talent = 42 + (prestige × 0.42) + team variance (-3 to +3)
```

Twelve ordered slot offsets (`+9, +6, +4, +3, +2, +1, 0, -1, -2, -3, -5, -7`) create a star-to-depth hierarchy. Each slot also receives `-3` to `+3` variance. The top slot has a 12% chance of an additional `+4` to `+9` breakout, allowing occasional standout players at lower-prestige programs. Final player talent inputs remain bounded to 40–99 and are passed through the existing Player generator unchanged.

## Initial rotation model

A Rotation is a plain serializable mapping from player ID to assigned minutes. Missing player IDs mean zero minutes; generated rotations omit zero-minute entries. Total minutes, positional totals, starters, roles, and depth-chart ranks are derived rather than stored.

The v0.1 model assigns each natural position exactly 40 minutes, for 200 total player-minutes. Players may consume minutes only at their listed position. This restriction is intentionally temporary: flexible positional eligibility can replace it in a later explicitly scoped milestone.

Default rotations are deterministic and allocate each position independently. Player overall feeds a softmax weighting with a quality temperature of 5, so larger talent gaps produce more top-heavy minutes while close players split more evenly. The top two natural-position players remain eligible; a third-or-deeper player must project to at least five initial weighted minutes or remains at zero. When backups exist, a player is capped at 36 minutes; a sole player at a position may play all 40. Integer rounding preserves exactly 40 minutes per position. Stamina is not weighted separately because it already contributes to derived overall, and no fatigue behavior exists yet.

Rotation validation returns structured, serializable issues for unknown players, non-finite or out-of-range player minutes, positional totals other than 40, and team totals other than 200.

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

Rotation Management is the first direct coaching decision available to the user. In the current exhibition workflow, HOME is the coached Team and AWAY retains its generated default Rotation. The coach distributes the home Team's available 200 player-minutes within the v0.1 natural-position constraint: exactly 40 minutes at each position.

Because Team Strength weights Player influence by assigned minutes, a legal Rotation change alters Team OFF, DEF, and OVR and therefore affects game outcomes probabilistically. Better Players should usually deserve more minutes, but differences between Player offense, Player defense, and roster depth can make choices contextual. The interface exposes those consequences without declaring one Rotation strategically correct.

The goal is understandable basketball choice, not broad tactical complexity. Pace, offensive and defensive schemes, pressing, shot profiles, live substitutions, fatigue, morale, Player happiness, chemistry, and playing-time consequences are not implemented. Additional tactical systems must earn their complexity after the season and dynasty loops work. A displayed or minute-derived starting five has no separate gameplay effect.

## MVP world

Stable Fictional Basketball Universe V0 defines 32 permanent fictional programs across four conferences of eight. Stable Program configuration owns identity, structured city/state location, conference membership, branding, and immutable base prestige. Current dynasty `Team.prestige` is initialized from base prestige but remains basketball state that may evolve only in a later scoped system.

New-dynasty initialization derives an isolated seeded RNG from the universe version, roster-generation version, typed dynasty seed, and Program ID. It generates each roster through the accepted Team generator, assigns the stable Program ID to Team, and derives a legal default Rotation. The six-program exhibition catalog is still only a UI subset plus one development fixture; no schedule or season exists yet.
