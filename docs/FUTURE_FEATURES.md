# Future Features

This file contains desirable product/gameplay ideas that are intentionally unscheduled and non-blocking for the current Dynasty MVP.

Inclusion does not mean commitment, priority, or an implementation date. An idea may move into `ROADMAP.md` only after it is deliberately selected as planned work. Bugs, technical debt, maintainability risks, and current-design scaling watchpoints belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md` instead.

This file is a parking lot: an idea may remain here indefinitely. When repeated
Playtesting evidence supports it and the project deliberately selects it, move
the selected work into Roadmap and remove or reword duplicate future-only text.
See `DOCUMENTATION_POLICY.md`.

## Recruiting boundary

Board + Focus + Offer Recruiting, its player-facing UI, Late Recruiting,
finalization, freshman enrollment, Offseason presentation, and repeatable Dynasty
rollover are implemented. Historical browsing and persistence remain future
product work. See `ROADMAP.md` for deliberately selected sequencing.

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

These enhancements are intentionally unscheduled and are not Dynasty MVP
requirements. Current Recruiting exposes exact ratings/Potential, gives no
winning or Tournament attraction bonus, and treats commitments as final.

Recruit Talent Distribution V1 and the current talent economy are accepted and frozen. Transfer-portal behavior, NIL, facilities, staff modifiers, NBA/early-departure rules, or other future Recruiting inputs may require a new long-run calibration after their design is implemented; their possibility is not a reason to retune the present system.

## Statistics and League immersion

### Player Profile / Statistical Identity

Most Players should remain recognizably shaped by their listed position, so PGs
normally lead assist production and PFs/Centers normally lead rebounding. A
future direction could add greater rare variability within those norms:
unusually tall or strong-rebounding guards, playmaking bigs, point-forward
wings, stretch Centers, undersized skilled bigs, and other cross-positional
statistical anomalies. These should emerge from unusual combinations of
attributes, physical profile, position, minutes, production, and any later
earned involvement concepts—not from named-player templates. Rarity is a design
requirement because an exception is valuable precisely when it is memorable.
No frequency or formula is selected.

Potential presentation labels include `Playmaking Big`, `Point Forward`,
`Jumbo Creator`, `Rebounding Guard`, `Stretch Five`, and `Combo Guard`.
Prefer deriving any label after the fact from a Player's actual profile and
production rather than storing an archetype flag first and forcing generation
to match it. Thresholds and formal archetype rules remain undesigned.

This direction could strengthen several separate future features:

- Followed Players/Favorites by creating rare careers users naturally track;
- League News/Round Recap through unusual leaderboard positions, triple-double
  profiles, and statistical milestones;
- Awards, Career History, and Program Records by making accomplishments more
  distinct than comparisons among similar positional prototypes;
- Recruiting by making unusual Recruit profiles memorable targets without
  changing current Recruiting mechanics; and
- the shot-selection/statistical-identity investigation, so stretch bigs,
  pass-first guards, scoring PGs, and playmaking Centers may eventually produce
  differently for evidence-supported reasons.

Diagnose before designing or tuning. Candidate multi-season characterization
includes APG/RPG leaderboard position shares; highest C/PF APG and PG/SG RPG;
within-position attribute/production correlations; frequency of high-
Playmaking bigs and high-Rebounding guards; height/RPG relationship; unusual
height-position combinations; and cross-position outlier frequency/magnitude.
Current generation uses position-specific height and attribute profiles, while
box-score assists/rebounds use position baselines plus attributes and minutes;
height directly affects blocks but not rebounds. A diagnostic should determine
whether any rigidity comes from profile supply, statistical translation, or
both before either frozen system is reopened.

Tentative conceptual sequencing is:

```text
Followed Players / Favorites
→ Player Statistical Identity diagnostic (characterization only)
→ locate profile-generation vs statistical-translation constraints
→ evidence-supported variability/identity candidates, if earned
→ derived archetype presentation and News/Awards/history amplification later
```

This sequence is not an active Roadmap commitment and does not displace current
priorities.

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

For first-round Conference-rematch avoidance, see
`KNOWN_ISSUES_AND_OPTIMIZATIONS.md`; that is a current-design quality watchpoint
rather than a duplicate feature entry here.

## Roster and coaching depth

- Redshirts
- Injuries, fatigue, morale, and chemistry
- Playing-time expectations
- Generic roster spots or scholarship accounting
- Roster-size changes
- Persistent Player secondary-position identity beyond current derived Rotation V1 eligibility
- Position changes
- Roster cuts and walk-ons
- Transfer portal
- Early professional departures
- Fifth-year eligibility
- Deeper tactics, schemes, and live coaching
- Rotation-preference carryover between seasons
- Staff and coaching carousel

None is required for the current Dynasty MVP. Rotation V1 already permits
derived adjacent-position floor minutes, but Recruiting openings, roster
construction, Offers, and Player identity still use natural position. These
future systems would change that deeper boundary.

### Player-development depth

Player Development V1 is accepted and frozen. Optional later depth may include:

- age/class-based regression
- playing-time or statistical-performance development effects
- coaching, staff, or facility development modifiers
- user-selected training focus
- position changes
- dynamic Potential or scouting uncertainty

These are unscheduled enhancements, not prerequisites for the accepted Season Rollover V0. Redshirts, transfers, and early professional departures remain separate optional roster-depth systems above.

## Presentation and broader modes

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
- Dynamic Program prestige

Expansion details remain intentionally high-level and must not turn Universe V0's `32 / 4 / 8` configuration into generic engine assumptions.

Systems that change departures, eligibility, roster capacity, Player Development,
position capacity, or prestige should rerun long-run talent calibration when
implemented. Ordinary presentation work should not reopen frozen Talent V1,
Development V1, Recruiting, or Rotation V1.
