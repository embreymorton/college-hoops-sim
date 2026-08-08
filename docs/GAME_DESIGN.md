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

Potential is a separate 40–99 development rating. Overall rating is a rounded, position-weighted average of current-ability attributes. It is never stored as independently mutable state, and potential does not affect it.

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

`generatePlayer` accepts position, class year, a 40–99 talent level, and an explicit seeded RNG. Talent level is a target for current overall quality, not a uniform attribute value. Position-specific modifiers and bounded independent variance create strengths and weaknesses, after which the profile is shifted toward the target overall without removing those differences.

Height ranges use total inches:

| Position | Range |
| --- | --- |
| PG | 70–77 (5'10"–6'5") |
| SG | 73–79 (6'1"–6'7") |
| SF | 76–81 (6'4"–6'9") |
| PF | 78–83 (6'6"–6'11") |
| C | 80–86 (6'8"–7'2") |

Names come from small local fictional pools. IDs, names, height, attributes, and potential all consume only the supplied RNG. Potential is based on current overall: most players land from equal to 12 points above it, while a 15% branch lands 1–6 points below it. All ratings are clamped to 40–99. These distributions are initial tuning values, not recruiting or development rules.

## MVP world

The eventual MVP targets approximately 32 fictional teams in four conferences. This is a scale target, not authorization to generate the league during the game-simulation milestone.
