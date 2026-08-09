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

Recruiting supports persistent 1–5 priorities, AI Programs, capacity-limited offers, final commitments, postseason continuation, Late Recruiting, and canonical period-by-period synchronization through ordinary progression or Super Sim. A commitment remains a future-roster fact and does not alter the current Team, Rotation, or Season. Recruit identity is already future Player identity and remains stable through the finalized incoming class; enrollment is Phase 5C.

## Remaining Dynasty MVP requirements

The single-season product, Phase 5A foundation, and Phase 5B Recruiting V0 are complete, but the repeatable Dynasty MVP is not. Season Rollover V0 is next:

- [x] In-season Recruiting for the next season, compatible with saved plans and Super Sim
- [x] Stable Recruit identity through commitment and finalized incoming class
- [ ] Incoming-Recruit enrollment preserving Player identity and remaining-opening resolution
- [ ] Roster finalization
- [ ] Fresh default Rotations and deterministic next-season Schedule
- [ ] Season 2 transition

Phase 5C will combine Phase 5A returning/developed Players with the finalized `CompletedRecruitingClass`, construct exact 12-Player rosters, and create the next Season. Its exact API and ordering remain intentionally unspecified until implementation. Full save/load and permanent history presentation may follow the core Dynasty MVP; the canonical basketball and Recruiting archive facts they will need are preserved.

## Not currently implemented

The project does not yet include Recruit enrollment, next-season roster finalization, Season 2, Dynasty/Recruiting UI-store integration, or save/load. Possession play-by-play, live coaching, injuries, transfers, basketball rankings, awards, and other optional depth are not Dynasty MVP requirements; see `FUTURE_FEATURES.md`.
