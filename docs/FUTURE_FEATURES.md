# Future Features

This file contains desirable product/gameplay ideas that are intentionally unscheduled and non-blocking for the current Dynasty MVP.

Inclusion does not mean commitment, priority, or an implementation date. An idea may move into `ROADMAP.md` only after it is deliberately selected as planned work. Bugs, technical debt, maintainability risks, and current-design scaling watchpoints belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` instead.

## Recruiting boundary

In-season Recruiting V0—including national-class generation, rankings/stars, boards, priorities, Active Offers, round-based advancement, commitments, AI Recruiting, Late Recruiting, and finalized incoming classes—is implemented and accepted in Roadmap Phase 5B. Phase 5C is also complete: committed Recruits enroll, next-season rosters are assembled, and the pure backend lifecycle initializes the next Season and Recruiting cycle. Recruiting UI, Dynasty rollover presentation, historical browsing, and persistence remain separate future product work. See `ROADMAP.md` for sequencing and `GAME_DESIGN.md` / `ARCHITECTURE.md` / `SIMULATION.md` for accepted behavior.

### Recruiting depth — future and non-blocking

- Campus visits and signing-day presentation
- Geography and home-state preferences
- Recruiting pipelines and facilities
- NIL
- Playing-time promises
- Deeper recruit personality and preferences
- Dynamic interest from Tournament success
- Depth-chart opportunity effects
- Coaching/staff recruiting bonuses
- Decommitments
- Scouting uncertainty and hidden ratings/Potential
- Transfer-portal interactions
- Recruiting battles, class-history UI, and retrospectives
- Recruiting class rankings, awards, and recognition

These enhancements are intentionally unscheduled and are not Recruiting V0 or Dynasty MVP requirements. Current V0 exposes exact ratings/Potential, gives no winning or Tournament attraction bonus, and treats commitments as final.

## Statistics and League immersion

### Postseason Player Stats

Tournament `GameResult` values already retain full `PlayerGameStats`. Future pure projections could provide Postseason Player totals/averages, Program postseason Player tables, and Tournament leaders without changing regular-season `PlayerSeasonStats` semantics.

### Combined regular-season and Postseason Stats

A future presentation could distinguish `REGULAR SEASON`, `POSTSEASON`, and `OVERALL`. Prefer a distinct projection rather than silently expanding existing regular-season APIs.

### Postseason Team Stats

Derive Tournament Team totals and rates from Postseason results, analogous to current regular-season `TeamSeasonStats`.

### Additional leader views

- National Team statistical leaders: PPG, opponent PPG, margin, RPG, APG, and FG%
- Conference-filtered Player leaders
- Player season/game highs for PTS, REB, and AST
- Shooting-percentage leaders with deliberately designed minimum-attempt qualifications

## Awards and recognition

- Player of the Year
- All-Conference and Conference awards
- All-American teams
- Postseason or Tournament honors

Award formulas and voting logic are intentionally undesigned.

## Rankings and world context

- Top 25 and ranking history
- Strength-of-schedule and résumé systems
- Conference strength or reputation

These require separate basketball and presentation design; they are not cosmetic extensions of current leaderboards.

## Tournament depth

- Conference tournaments
- Postseason statistical leaderboards
- Regional structure if the universe expands
- More sophisticated selection and seeding after scaling

For protected Conference-champion seed scaling and first-round Conference-rematch avoidance, see `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`; those are current-design scaling/quality watchpoints rather than duplicate feature entries here.

## Roster and coaching depth

- Redshirts
- Injuries, fatigue, morale, and chemistry
- Playing-time expectations
- Generic roster spots or scholarship accounting
- Multi-position eligibility
- Position changes
- Roster cuts and walk-ons
- Transfer portal
- Early professional departures
- Fifth-year eligibility
- Deeper tactics, schemes, and live coaching
- Rotation-preference carryover between seasons
- Staff and coaching carousel

None is required for the current Dynasty MVP. These systems may eventually loosen Recruiting V0's strict natural-position capacity, but they are not implicit in Phase 5C.

### Player-development depth

Player Development V0 is accepted. Optional later depth may include:

- age/class-based regression
- playing-time or statistical-performance development effects
- coaching, staff, or facility development modifiers
- user-selected training focus
- position changes
- dynamic Potential or scouting uncertainty

These are unscheduled enhancements, not prerequisites for the accepted Season Rollover V0. Redshirts, transfers, and early professional departures remain separate optional roster-depth systems above.

## Presentation and broader modes

- Dynasty lifecycle and Recruiting UI over the accepted backend domain
- Completed-season, offseason, rollover, and next-season transition presentation
- Save/load and persistence UX
- Starting-five, matchup-comparison, or positional-insight presentation
- Explicit Player or Team archetype presentation
- Multiplayer or online leagues

These are optional product directions, not current UI defects.

## History and immersion

- Career Player statistics
- Season-archive and previous-champion presentation
- Record books and historical League leaderboards
- Program history pages
- Retired-Player and historical Player pages

The accepted Dynasty archive and stable returning Player identity preserve the source facts needed to keep these ideas possible; their projections and presentation remain unimplemented.

## Universe expansion

- More Programs and Conferences
- A larger National Tournament
- Conference realignment
- Prestige evolution

Expansion details remain intentionally high-level and must not turn Universe V0's `32 / 4 / 8` configuration into generic engine assumptions.
