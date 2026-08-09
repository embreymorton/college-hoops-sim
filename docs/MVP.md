# MVP Scope

## Product target

The Dynasty MVP is one complete, repeatable college-basketball loop:

```text
choose Program
→ manage roster and Rotation
→ play a regular season
→ compete in the National Tournament
→ graduate and develop Players
→ recruit and finalize the next roster
→ begin Season 2
```

This file defines that playable target. It is not a general feature backlog; desirable non-blocking ideas live in `FUTURE_FEATURES.md`.

## Playable single-season product — implemented

The user can now:

```text
choose one of 32 fictional Programs across four Conferences
→ manage or simulate a deterministic 24-round regular season
→ inspect standings, schedules, results, Player/Team stats, and the wider League
→ reach automatic/at-large Tournament selection
→ manage or simulate a fixed 16-Team neutral-site Tournament
→ continue the bracket after elimination or non-qualification
→ reach a National Champion
```

The implemented foundation includes seeded Player/Team/roster generation, serializable Rotation and Team Strength systems, deterministic game outcomes and overtime, complete Player box scores, stable Universe and Schedule definitions, canonical Season/Postseason state, AI progression, Super Sim, historical results, Player Season Stats/game logs, Team Season Stats/averages, national Player leaders, Teams/Team Details/Player Details exploration, and complete Postseason presentation.

All game pacing paths use the same canonical simulation and result-recording systems.

### Fast game path

Applies to regular season and Postseason:

```text
SIMULATE GAME
→ remain on the current Hub
→ show inline FINAL, outcome/margin, and whole-game PTS/REB/AST leaders
→ optionally VIEW BOX SCORE
→ explicitly advance the round
```

Quick Sim resolves only the controlled Program's game. Its leaders are derived from both teams' stored `PlayerGameStats`; no summary data is regenerated or stored separately.

### Detailed game path

Applies to regular season and Postseason:

```text
GAME PREP
→ inspect matchup and edit the current legal Rotation
→ SIMULATE GAME
→ automatically open the full Box Score
→ return to the Hub or progress the round
```

The regular season and Postseason retain separate canonical Rotation state. Historical results are read-only views of stored `GameResult` facts.

## Remaining Dynasty MVP requirements

The single-season product is complete, but the Dynasty MVP is not. The next phase must add:

- [ ] Graduation
- [ ] Player development and class progression
- [ ] Recruiting
- [ ] Roster finalization
- [ ] Season 2 transition

Two architecture requirements apply before or during rollover:

- Returning Players retain their stable `playerId`; progression must not regenerate them as new identities.
- Completed Season and Postseason facts remain recoverable rather than being overwritten when the next active season begins.

Exact development formulas, recruiting mechanics, offseason sequencing details, and a Dynasty-state schema require their own design milestones. Full save/load and permanent history presentation may follow the core Dynasty MVP, but the rollover architecture must preserve the canonical facts those systems will need.

## Not currently implemented

The project does not yet include graduation, offseason development, recruiting, roster turnover/finalization, Season 2, or save/load. Possession play-by-play, live coaching, injuries, transfers, rankings, awards, and other optional depth are not Dynasty MVP requirements; see `FUTURE_FEATURES.md`.
