# UI Design

## Accepted visual direction

The implemented Game Presentation establishes the visual baseline: modern collegiate athletics combined with broadcast graphics and a management simulation. It is dark-first, competitive, serious, data-rich, and polished.

- Use condensed sports display typography with a readable data sans-serif.
- Prefer dense tables, strong hierarchy, and visually dominant scores.
- Use restrained Team accent colors. Demo branding remains presentation-layer metadata.
- Keep motion subtle and functional.
- Design desktop-first while preserving responsive use at narrower widths.
- Borrow arena-center-court and broadcast-scoreboard language without directly imitating ESPN, the NCAA, or another real brand.

Avoid generic SaaS dashboards, purple gradients, excessive rounded cards, huge empty whitespace, and sportsbook or gambling aesthetics.

## Game Presentation V0 — implemented

The accepted presentation includes:

- Pregame home/away demo-program selection
- Generated roster and read-only default Rotation-minute tables
- Team OFF, DEF, and OVR presentation
- A clear game-simulation action
- Postgame final score, winner, and overtime presentation
- Full Player box scores with a control for inspecting either Team
- Deterministic Simulate Again and Change Matchup workflows

The six demo programs support this vertical slice; they do not define the eventual league. Season, recruiting, rankings, standings, tournaments, coach profiles, and a dynasty dashboard are not current screens.

## Rotation Management V0 — implemented

Extends the accepted visual system rather than replacing it. The accepted presentation includes:

- An editable home Rotation grouped by natural position, with each Player's minutes controlled by a compact [-] numeric-input [+] stepper (one-minute precision, keyboard editable, non-negative integers; no drag-and-drop, no sliders).
- Each position's current-minutes-of-40 total and a plain-language status ("Valid", "N minutes remaining", "N minutes over").
- The Team's current-minutes-of-200 total.
- A Team Strength comparison (Default / Current / Change) for OFF, DEF, and OVR, updated from a legal edited Rotation and explicitly marked pending rather than shown while the Rotation is invalid.
- A disabled Simulate Game action with a concise reason while the Rotation is invalid.
- A Reset to Default action, enabled only when the Rotation differs from the generated default.

The away Team's Rotation remains read-only. Player-level invalid minutes are surfaced adjacent to the affected Player rather than as raw validation codes.

## Future screens

Season dashboards, schedules, results, standings, upcoming matchups, postseason brackets, recruiting, and dynasty history should extend this same collegiate broadcast-management language. They should not introduce a disconnected generic-dashboard aesthetic.
