# Future Features

This is an unscheduled, non-blocking idea bank. Inclusion is not commitment,
priority, or a date. Only deliberate selection in `ROADMAP.md` creates planned
work; this file never owns **NEXT**.

Selected Roadmap features receive at most a short pointer here. Completed
features are removed unless a genuinely future extension remains. Confirmed
defects/debt belong in `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`.

## Selected elsewhere

- **History & Recognition:** Season Archive / Yearbook, Records & Milestones,
  and Awards & Honors are selected under Phase 7C in `ROADMAP.md`.
- **Recruit Attachment:** Recruit Details, Follow Recruits, and Recruit → Player
  continuity are selected under Phase 7D in `ROADMAP.md`.

The Roadmap owns their order and scope. They are not specified again here.

## Recruiting depth

- campus visits and signing-day presentation;
- geography, home-state preference, and pipelines;
- facilities, NIL, staff/recruiting bonuses, and program resources;
- playing-time promises and depth-chart opportunity;
- personality and deeper Recruit preferences;
- a future, unscheduled scouting/uncertainty system that could replace exact
  numeric Recruit attributes, OVR/current ability, and/or Potential/upside with
  player-facing grades, bands, ranges, or similar estimates. Before any design
  or implementation, explicitly define what is known versus estimated or
  hidden; exact grade thresholds and scouting mechanics remain undecided, and
  current exact-value visibility remains unchanged;
- decommitments and transfer-portal interactions;
- recruiting class rankings and retrospective class evaluation; and
- dynamic interest from winning or Tournament success.

These ideas would require explicit player-facing rules and, where they affect
attraction/AI/talent movement, fresh calibration. Their existence is not a
reason to retune accepted Recruiting now.

High-school statistics remain model-undefined because no canonical high-school
season is simulated. If revisited, decide whether displayed values are scouting
context, attribute-derived estimates, competition-adjusted production, or
intentional uncertainty before treating them as facts.

## Player and statistical depth

### Player Identity / statistical variety — PARKED

Rare cross-position identities, Development identity retention, Passing/Steals
translation, and profile labels remain ideas rather than selected work. No
Player Identity phase is scheduled. Canonical generation and OVR remain active;
full historical evidence and reopening criteria live in
`PLAYER_IDENTITY_RESEARCH.md`.

### Postseason and combined statistics

- postseason Player totals, averages, leaders, and game logs;
- combined regular-season + Tournament statistics;
- postseason Team statistics; and
- explicit Tournament résumés and signature games.

Current Former Player career aggregation is regular-season-only. These future
projections should reuse retained Tournament `PlayerGameStats` without changing
current regular-season semantics.

### Additional leader views

- shooting percentage with minimum-attempt qualification;
- three-pointers, minutes, efficiency, and class/position filters;
- Conference and freshman leaderboards; and
- historical Season leaderboards once an archive experience exists.

## History and immersion beyond selected work

- broad Program Alumni browser and global historical Player search;
- richer Program history, rivalries, banners, and prestige history;
- signature games and player-facing Tournament career summaries;
- polls/rankings and richer résumé context;
- broadcast-style story packages and Season retrospectives;
- Conference history and Tournament records; and
- coach career records and legacy.

Records, Awards, and the initial Season Archive are already selected in Phase
7C; the ideas above are extensions, not expanded 7C scope by default.

## Tournament depth

- bracket-pool or spectator tools;
- bubble/selection-show presentation;
- historical bracket browsing;
- richer neutral-site presentation;
- Conference Tournament systems; and
- expanded fields or alternate formats only after deliberate product design.

## Roster and coaching depth

- manual canonical starters or role definitions with simulation meaning;
- redshirts, medical redshirts, and eligibility exceptions;
- injuries, fatigue, morale, chemistry, and discipline;
- transfers and early professional departures;
- coaching staffs, schemes, practices, and player-development choices;
- substitution patterns and rotation presets; and
- possession-level/live coaching.

These systems would materially change simulation or lifecycle behavior and need
their own selected phases and validation.

## Presentation and broader modes

- save/load and Dynasty management;
- accessibility and localization expansion;
- spectator / League Observer mode;
- richer responsive/mobile navigation;
- optional presentation themes; and
- export/share tools for Seasons, brackets, and careers.

## Universe expansion

- additional Programs or Conferences;
- configurable league sizes and schedules;
- generated Universes; and
- custom Program/conference editing.

Universe expansion must preserve stable identity, validation, deterministic
generation, and generic engine boundaries.
