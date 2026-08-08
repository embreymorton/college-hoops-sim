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

## Next interaction milestone — Rotation Management

Extend the accepted visual system rather than replacing it. Priorities are:

- Keep roster and Rotation interaction information-dense.
- Make each Player's minutes immediately legible.
- Make each position's required 40-minute total immediately legible.
- Make the Team's required 200-minute total immediately legible.
- Make invalid states obvious without making valid editing visually noisy.
- Show OFF, DEF, and OVR changes while the Rotation is edited.
- Provide a clear reset-to-default path.
- Prioritize precise, accessible interaction over decorative complexity.

The exact editing control has not been accepted. Do not assume drag-and-drop, sliders, steppers, or numeric inputs before interaction design and implementation are explicitly scoped.

## Future screens

Season dashboards, schedules, results, standings, upcoming matchups, postseason brackets, recruiting, and dynasty history should extend this same collegiate broadcast-management language. They should not introduce a disconnected generic-dashboard aesthetic.
