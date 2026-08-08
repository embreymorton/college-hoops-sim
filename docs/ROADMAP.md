# Roadmap

Each milestone should remain small enough to test independently. Starting a later milestone or adding a new system requires an explicit scope discussion.

## 0. Foundation — complete

- Establish React, TypeScript, Vite, Zustand, and Vitest tooling.
- Establish engine/UI boundaries and documentation.
- Verify lint, test, type-check, and build workflows.

## 1. Domain and deterministic generation — in progress

Seeded RNG and the initial Player model with derived positional overall ratings are complete. Team and rotation types and deterministic generation have not started.

- Define serializable player, attribute, position, team, and rotation types.
- Implement position-aware derived overall ratings.
- Implement and test seeded RNG.
- Generate only enough teams and players to exercise a game.

## 2. Single-game simulation

- Define `GameResult` and `PlayerGameStats`.
- Simulate a game between two generated teams.
- Produce consistent final scores and box scores.
- Tune broad realism using deterministic statistical tests.

## 3. Game presentation

- Connect the engine through an application-state adapter.
- Add a minimal matchup setup and box-score UI.
- Keep simulation behavior independent from React.

## 4. Season framework

- Define the fictional league of approximately 32 teams in four conferences.
- Add schedules, standings, season progression, and a national tournament.

## 5. Dynasty loop

- Add recruiting, player development, roster turnover, and offseason progression.
- Add save/load support and multi-season continuity.

## Deferred until explicitly scoped

Detailed play-by-play, injuries, transfers, finances, staff systems, real-world teams/data, multiplayer, and advanced coaching tactics are not part of the current plan.
