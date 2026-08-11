# UI Design

## Accepted visual direction

The implemented presentation combines modern collegiate athletics, broadcast graphics, and a management simulation. It is dark-first, competitive, serious, data-rich, and polished.

- Use condensed sports display typography with a readable data sans-serif.
- Prefer dense tables, strong hierarchy, and visually dominant scores.
- Use restrained Program accent colors; branding belongs to Universe presentation metadata rather than Team simulation state.
- Keep motion subtle and functional.
- Design desktop-first while preserving responsive narrow-screen use.
- Avoid generic SaaS dashboards, purple gradients, excessive rounded cards, huge empty whitespace, and sportsbook aesthetics.

## Primary Season experience — implemented

Program selection groups all 32 permanent Universe V0 Programs by Conference. The Season Hub is the primary product surface; Exhibition remains secondary development tooling.

```text
Season Hub
├── Matchup
│   ├── SIMULATE GAME
│   │   → Quick Sim
│   │   → remain on Hub
│   │   → inline FINAL and outcome/margin
│   │   → whole-game PTS / REB / AST leaders
│   │   → optional VIEW BOX SCORE
│   │
│   └── GAME PREP
│       → detailed matchup
│       → Rotation editing
│       → simulate
│       → Box Score
│
├── Round Progression
│   ├── Simulate Other Games / Advance to Next Round
│   └── Super Sim
│
├── Conference standings
├── Recent Results and Schedule history
└── League navigation
```

**SIMULATE GAME is the fast path. GAME PREP is the detailed path.** This distinction is intentional and should remain consistent. Quick Sim resolves the controlled game only, keeps the user on the Hub, and presents the stored final compactly. Game Prep exposes the current legal Season Rotation and deliberately opens the full Box Score after simulation.

Completed Quick Sim cards preserve HOME/AWAY and overtime context, show WIN/LOSS plus a restrained margin, and derive whole-game statistical leaders from the canonical result. Leaders may represent either Program and display their Program identity. View Box Score remains optional detail; advancement remains in the separate Round Progression card. Historical Schedule/Recent Results views never re-simulate.

Super Sim remains a confirmed secondary pacing control for Midseason (through Round 12) or End of Regular Season (through Round 24). It uses the same simulation pipeline and never enters Postseason automatically.

## Rotation and Box Score presentation

Game Prep reuses the accepted Rotation V1 Editor: five floor-position sections,
only legally eligible Players in each section, compact minute steppers, floor
and Team budgets, derived aggregate Player totals, engine-authored legality,
default/current OFF/DEF/OVR comparison, reset, and disabled simulation while
invalid. Legal secondary assignments may be made manually. A legal draft
commits to current competition state; temporary invalid drafts do not affect
Quick Sim.

Postgame and historical views use the accepted final-score and full Player box-score presentation. Historical results are read-only. Exhibition retains home-Team editing and deterministic re-simulation for isolated development testing, but it does not define the permanent Season workflow.

## Postseason experience — implemented

```text
Tournament Hub
├── Quick Sim → remain on Hub → inline result and whole-game leaders
├── Game Prep → Postseason Rotation → simulation → Box Score
├── fixed bracket and 16-Team field
├── advancement / elimination / did-not-qualify states
├── explicit round progression
└── National Champion
```

The controlled Program may be qualified/alive, eliminated, or did not qualify. These are distinct legitimate states; the wider Tournament remains simulatable after elimination or non-qualification. Tournament Quick Sim preserves NEUTRAL context and milestone language such as advancement, National Championship qualification, Tournament Run Ends, and National Champions. The bracket progressively resolves canonical participant sources and remains horizontally scrollable on narrow screens.

Postseason-specific styles live in `src/postseason.css` beside shared `src/styles.css`. React and Zustand present and orchestrate public Postseason facts; they do not recreate selection, advancement, or champion rules.

### Planned Postseason presentation polish

The bracket is accepted and should remain intact. The top Tournament/Season
Complete lifecycle composition remains a playtesting-driven near-term target:
on desktop, likely group Tournament/championship status and Season Complete
handoff coherently on the left, with Recruiting/Late-Recruiting context on the
right, avoiding the current large dead space. Fresh visual inspection should
refine the composition without redesigning the bracket.

This is presentation work. Tournament balance/seeding is a separate simulation
diagnostic and must not be conflated with layout polish.

## Dynasty lifecycle and Recruiting — implemented

Regular navigation is `SEASON / RECRUITING / LEAGUE`; Tournament navigation is `TOURNAMENT / RECRUITING / LEAGUE`. The Season Hub pairs weekly competition context with Recruiting controls. Recruiting provides a Board and National Class, positional-needs ledger, PRESEASON state, and Generate Draft Board onboarding before the first period can resolve.

After the championship, the player explicitly enters the distinct Late Recruiting mode, may make final legal Board/Offer changes, and finalizes the Recruiting class. A focused Offseason turnover screen presents departures, automatic Player Development, incoming Recruits, and the next roster before the explicit Season N+1 handoff returns to the normal Hub. These screens preserve the established modern-collegiate-athletics, broadcast-graphics, management-simulation visual direction rather than introducing a separate product style.

## League and Player exploration — implemented

```text
League
├── National Leaders (PPG / RPG / APG / SPG / BPG)
├── Teams directory
├── Team Details
│   ├── record
│   ├── OFF / DEF / OVR
│   ├── Team averages
│   ├── Team leaders
│   ├── recent results
│   └── roster / Player stats
└── Player Details
    ├── identity and ratings summary
    ├── regular-season statistics
    └── chronological game log
```

Conference standings, Tournament field rows, Team rosters, national leader rows, Player game-log opponents, and Program links support cross-League Team/Player exploration with context-aware return navigation. These views consume derived regular-season projections and stable Universe identities rather than duplicating statistical state in Zustand.
