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

Players have a position and serializable attributes. Planned positions are point guard, shooting guard, small forward, power forward, and center.

Initial attributes:

- Offense: finishing, shooting, playmaking, ball handling
- Defense: perimeter defense, interior defense, rebounding
- Physical: athleticism, stamina
- Development: potential

Overall rating is a derived, position-aware view of attributes. It is never an independently mutable source of truth. Potential affects development, not current on-court ability.

## MVP world

The eventual MVP targets approximately 32 fictional teams in four conferences. This is a scale target, not authorization to generate the league during the game-simulation milestone.

