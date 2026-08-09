# MVP Scope

## Product target

The Dynasty MVP is one complete, repeatable college-basketball loop:

```text
choose Program
→ manage roster and Rotation
→ play a regular season while recruiting for the next one
→ compete in the National Tournament
→ graduate and develop Players
→ enroll commitments and finalize the next roster
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

## Dynasty Foundation + Progression V0 — implemented

The pure Dynasty layer can now take a fully completed regular season and Tournament through the accepted cross-season boundary:

```text
completed Season + Postseason
→ canonical CompletedSeasonArchive
→ senior graduation
→ returning Player development and class advancement
→ temporary incomplete OffseasonState rosters
```

Completed `GameResult` and `PlayerGameStats` facts remain recoverable through history. Returning Players keep stable IDs while receiving new immutable Player values, so archived class years and attributes do not change. `deriveProjectedRosterOutlook()` can expose senior departures, returners, and projected openings from a current Team before the Season is complete, providing next-season capacity for future in-season Recruiting.

Complete MVP foundation items:

- [x] Dynasty lifecycle boundary and completed Season/Postseason preservation
- [x] Projected openings from current rosters
- [x] Senior graduation
- [x] Player development and class progression
- [x] Stable returning Player IDs and immutable historical snapshots
- [x] Serializable partial offseason rosters

## Remaining Dynasty MVP requirements

The single-season product and Phase 5A foundation are complete, but the repeatable Dynasty MVP is not. Next comes in-season Recruiting V0, followed by Season Rollover V0:

- [ ] In-season recruiting for the next season, compatible with saved plans and Super Sim
- [ ] Stable recruit identity through commitment and freshman enrollment
- [ ] Incoming-recruit enrollment and remaining-opening resolution
- [ ] Roster finalization
- [ ] Fresh default Rotations and deterministic next-season Schedule
- [ ] Season 2 transition

Recruiting belongs to the cross-season Dynasty layer and targets Season N+1. A current-season commitment must not change the current Team, Rotation, or `SeasonState`. Recruiting budgets/allocations, board limits, interest and commitment rules, offer mechanics, AI behavior, recruiting-period timing, and roster-completion fallbacks remain deliberately unspecified pending Phase 5B design. Full save/load and permanent history presentation may follow the core Dynasty MVP; the canonical archive facts they will need are now preserved.

## Not currently implemented

The project does not yet include recruiting, incoming recruits, roster finalization, Season 2, Dynasty UI/store integration, or save/load. Possession play-by-play, live coaching, injuries, transfers, rankings, awards, and other optional depth are not Dynasty MVP requirements; see `FUTURE_FEATURES.md`.
