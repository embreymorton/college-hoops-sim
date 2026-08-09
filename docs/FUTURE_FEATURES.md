# Future Features

This file contains desirable product/gameplay ideas that are intentionally unscheduled and non-blocking for the current Dynasty MVP.

Inclusion does not mean commitment, priority, or an implementation date. An idea may move into `ROADMAP.md` only after it is deliberately selected as planned work. Bugs, technical debt, maintainability risks, and current-design scaling watchpoints belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` instead.

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

- Transfer portal and redshirts
- Injuries, fatigue, morale, and chemistry
- Playing-time expectations
- Multi-position eligibility
- Deeper tactics, schemes, and live coaching
- Staff and coaching carousel
- NBA Draft declarations

None is required for the current Dynasty MVP.

## Presentation and broader modes

- Starting-five, matchup-comparison, or positional-insight presentation
- Explicit Player or Team archetype presentation
- NIL-related dynasty depth
- Multiplayer or online leagues

These are optional product directions, not current UI defects.

## History and immersion

- Career Player statistics
- Season archives and previous champions
- Record books and historical League leaderboards
- Program history pages
- Retired-Player and historical Player pages

Dynasty architecture should preserve stable Player identity and canonical completed-season facts now so these ideas remain possible later.

## Universe expansion

- More Programs and Conferences
- A larger National Tournament
- Conference realignment
- Prestige evolution

Expansion details remain intentionally high-level and must not turn Universe V0's `32 / 4 / 8` configuration into generic engine assumptions.
