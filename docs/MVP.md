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

## Playable Dynasty core — implemented

The user can now:

```text
choose one of 32 fictional Programs across four Conferences
→ manage or simulate a deterministic 24-round regular season
→ inspect standings, schedules, results, Player/Team stats, and the wider League
→ reach automatic/at-large Tournament selection
→ manage or simulate a fixed 16-Team neutral-site Tournament
→ continue the bracket after elimination or non-qualification
→ reach a National Champion
→ explicitly enter Late Recruiting and finalize the class
→ review Offseason departures, development, incoming Players, and the next roster
→ begin the next Season with a fresh Recruiting cycle
→ repeat
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

Completed `GameResult` and `PlayerGameStats` facts remain recoverable through history. Returning Players keep stable IDs while receiving new immutable Player values, so archived class years and attributes do not change. `deriveProjectedRosterOutlook()` exposes senior departures, returners, and projected openings from a current Team before the Season is complete, providing next-season capacity for accepted in-season Recruiting.

Complete MVP foundation items:

- [x] Dynasty lifecycle boundary and completed Season/Postseason preservation
- [x] Projected openings from current rosters
- [x] Senior graduation
- [x] Player development and class progression
- [x] Stable returning Player IDs and immutable historical snapshots
- [x] Serializable partial offseason rosters

## In-Season Recruiting V0 — implemented and accepted

The pure Dynasty layer now runs one national Recruiting market for Season N+1 alongside the current basketball year:

```text
projected positional openings
→ national Recruit class with rankings/stars
→ boards, priorities, Active Offers, and relationship progress
→ regular-season and Postseason commitments
→ Late Recruiting and finalization
→ CompletedRecruitingClass
```

Recruiting supports a 10-target Board, up to three Focus targets, independent capacity-limited Active Offers, AI Programs, final commitments, postseason continuation, Late Recruiting, and canonical period-by-period synchronization through ordinary progression or Super Sim. Every active Board target receives fixed baseline effort; Focus adds a fixed bonus without redistributing effort. A commitment remains a future-roster fact and does not alter the current Team, Rotation, or Season. Recruit identity is already future Player identity and Phase 5C preserves it through freshman enrollment.

## Season Rollover V0 — implemented and accepted

The backend completes the cross-season loop:

```text
completed competition and finalized Recruiting
→ graduation and returning-Player development
→ committed Recruits enroll as FR with stable identity
→ exactly 12 Players per Program
→ fresh Teams, default Rotations, and season-specific Schedule
→ empty next SeasonState
→ Recruiting targeting the following season
→ repeat
```

Complete backend Dynasty MVP items:

- [x] In-season Recruiting compatible with saved plans and Super Sim
- [x] Stable Recruit identity through commitment and freshman enrollment
- [x] Exact 12-Player next-season roster assembly
- [x] Fresh default Rotations and deterministic, season-specific Schedule
- [x] Atomic next-Season transition with preserved basketball/Recruiting history
- [x] Immediate next Recruiting-cycle initialization
- [x] Repeatable multi-season lifecycle and JSON-safe state

Long-run calibration across five deterministic seeds and 250 completed Seasons classified the current Recruiting + Development + graduation economy as stable, with no structural failures. React/Zustand now orchestrates the same accepted lifecycle without duplicating its domain facts.

## Dynasty Long-Run Calibration V0 — implemented and accepted

The backend loop reproducibly reaches a stable endogenous talent level under current V0 rules. The initial generated Universe transitions upward during the first several Seasons, while the Seasons 16–50 Team OVR slope averages approximately zero across seeds. Incoming and graduating populations have nearly identical average Potential, and Player Development creates the expected average progression from freshman to senior.

The simulation/domain and player-facing Dynasty MVP are complete, and the current talent economy is frozen. The player controls each major lifecycle checkpoint rather than being advanced automatically through Recruiting finalization, Offseason, or rollover.

## Not currently implemented

The project does not yet include persistence/save-load, Dynasty history browsing, career statistics, awards, possession play-by-play, live coaching, injuries, transfers, rankings, or deeper offseason decisions. These are future expansion, not playable-core requirements; see `FUTURE_FEATURES.md`.
