# Playtesting Log

`PLAYTESTING.md` records observations and hypotheses from actual gameplay. Each entry follows a small empirical loop; see `CALIBRATION.md` for the tuning and validation methodology:

```text
observation → evidence → question / hypothesis → next investigation → decision
```

It is not a raw notes dump or an issue tracker. A single playthrough observation is not automatically a confirmed problem.

- `PLAYTESTING.md`: gameplay observations and hypotheses
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`: confirmed technical or calibration problems, debt, and scaling risks
- `FUTURE_FEATURES.md`: intentionally deferred systems and features

## Statuses

- **OBSERVED** — noticed during manual play; not yet validated.
- **INVESTIGATING** — enough evidence exists to run diagnostics.
- **CONFIRMED** — diagnostics established a real problem.
- **RESOLVED** — implemented and validated.
- **WATCH** — currently acceptable, but worth monitoring in future play.

## Recruiting concentration exploit — RESOLVED

### Observation and evidence

Charlotte Tech could select a tiny group of elite Recruits, assign equal/high Priority, and sign nearly all of them. Pine Valley could do the same despite being the weakest, lowest-Prestige Program. Diagnostics measured approximately `85–100%` target signing for concentrated Boards, compared with roughly `20–35%` for generated Boards.

### Root cause and decision

Normalized Recruiting attention made a three-target Board assign about one-third of total attention to each target, while AI Programs usually spread attention across broad Boards.

The accepted resolution is **Board + Focus + Offer**:

```text
Board baseline effort = 3
Focus bonus = +3
Maximum Focus targets = 3
No Priority 1–5
No normalized attention
```

Accepted AI coherence work ensures valid Offers strongly align with Focus, valid premium Focus+Offer pursuits persist through refreshes, and controlled manual strategies remain untouched. Prestige/attraction was evaluated and left unchanged.

**Decision:** Recruiting architecture, Focus, and Prestige are frozen unless new playtest evidence appears.

## Recruit Talent Distribution V1 — RESOLVED / WATCH

### Observation and evidence

The previous class distribution contained too many immediately strong freshmen, compressed league talent, made National Rank/OVR/Potential close to one quality ladder, and effectively produced no raw high-upside prospects.

| Measure | Pre-V1 | V1 |
| --- | ---: | ---: |
| 85+ Recruit OVR / class | 8.62 | 3.84 |
| 80+ Recruit OVR / class | 25.50 | 14.02 |
| 55–64 OVR with 85+ POT / class | 0.00 | 5.04 |
| Rank ↔ OVR | -0.979 | -0.889 |
| Rank ↔ POT | -0.962 | -0.685 |
| OVR ↔ POT | 0.957 | 0.342 |

### Decision

V1 uses partially independent **readiness** and **ceiling**. Readiness generates the position-aware Player attributes and derived OVR; ceiling determines Potential while preserving `POT ≥ OVR`. National Rank uses `56% OVR / 44% POT`.

The change is accepted: it creates meaningful ready-now, developmental, and raw high-upside prospect types while preserving useful National Rank and star tiers.

### Watchpoints

- Mature-league high-end talent may now be somewhat sparse.
- Season 1 still uses the older initial-roster generator and may differ from the mature V1 ecosystem.
- Do not retune Recruit generation without additional playthrough evidence.

## Player Development / Potential Realization — INVESTIGATING

### Observation

Manual play produced examples including:

- a `54 OVR / 90 POT` Recruit reaching approximately `62 OVR` by senior year;
- a `73 / 89` Player remaining approximately `73` as a senior;
- a `73 / 99` freshman gaining about `+2` in the first offseason; and
- observed largest annual gains of roughly `+4` to `+5`.

### Player-facing concern

Visible Potential naturally creates an expectation that a high-Potential raw prospect has a meaningful chance to become impactful. Potential must not guarantee its ceiling, and busts should remain possible. Rare breakouts and major development trajectories should also be possible.

### Next investigation

**Phase 6E.3 — Development + League Talent Progression Diagnostic** will measure:

- senior OVR conditional on freshman OVR/Potential;
- high-Potential bust and good/star outcome rates;
- annual OVR-gain distribution, including whether `+6`, `+8`, or larger breakouts occur;
- how often Players approach Potential; and
- whether variance supports distinct career stories.

No Development tuning is approved. These observations do not establish that the system is broken.

## Mature League Powerhouse Ceiling — INVESTIGATING

### Observation

Around Season 8, the best observed Team was roughly `83 OVR`; most Programs were in the 70s; Pine Valley was around `65`, while the next-lowest Team was around `71`.

### Question

Talent Distribution V1 reduced league-wide inflation, but may have reduced the upper end too far. The desired qualitative shape is a few legitimately scary Teams, strong Tournament Teams, a large middle class, bad Teams, and an occasional disaster Team.

Do not prescribe Team-OVR targets or retune Recruit generation yet. Diagnose this alongside Potential realization.

## Low-Prestige Rebuild Experience — WATCH

Pine Valley is now genuinely difficult: `2–22`-type seasons can occur, generated plans may produce mostly 2★/3★ classes, elite Recruits are no longer automatic, and multi-season improvement requires real Recruiting success.

The concern is that a hard rebuild must not become a structurally trapped rebuild. Future playtesting should determine whether strong manual Recruiting, high-upside projects, Development, and time can create a contender without weakening Prestige. Do not reopen Recruiting difficulty yet.

## Recruiting Feedback / Visibility — OBSERVED

Repeated playtesting asks for clearer Recruiting feedback:

- the three Focus targets on the Season Hub;
- current standing, leader, and major competitors for Focus targets;
- clear Offer/Focus status;
- updates when a Board or Focus target commits elsewhere; and
- final national Recruiting results/classes after Late Recruiting.

**Design principle:** more feedback, not more Recruiting mechanics. Exact presentation is intentionally undesigned.

## Recruiting Assistant — Fill Remaining Board — OBSERVED

Desired future behavior:

```text
User selects, focuses, and offers the Recruits they care about
↓
Assistant fills unused Board capacity with sensible backups
```

It must never replace user-selected targets or overwrite Focus choices or Offers. It should use existing deterministic AI/default planning where possible and remain separate from **Generate Draft Board**, which begins with an empty Board.

## Generated Draft Board Ambition — WATCH

Pine Valley's generated Board sometimes immediately offers low-tier/2★ targets. This is not a bug. Future diagnostics should evaluate whether generated Boards have an appropriate reaches / realistic-targets / safe-backups mix for each Prestige level.

## Player Connection / Player Detail — OBSERVED

High-value playtest needs include inspecting individual attributes, understanding Player behavior, viewing Season statistics, following development, and building attachment to long-term projects. Examples include following a `54/90` prospect's progression or assessing whether a Center attempting ten threes has enough Shooting to justify it.

A future Player detail view may show identity, position/class, OVR/POT, nine attributes, current-season statistics, and development history where it exists. Do not assume career-stat persistence or design the full screen here.

## Game Simulation — Shot Selection — OBSERVED

One Center attempted roughly ten three-pointers and shot poorly in a game. One game is not evidence of a bug. A future diagnostic should determine whether 3PA sufficiently reflects Shooting and position, whether low-Shooting bigs attempt too many threes, or whether this was a plausible poor game from a capable shooter. Do not tune Game Simulation yet.

## Coaching / Rotation Navigation — OBSERVED

Playtesting suggests Rotation deserves a persistent home rather than existing only in Game Prep. A future navigation concept could be:

```text
SEASON | COACHING | RECRUITING | LEAGUE
```

Initial Coaching scope could be Rotation only. Tactics and other coaching systems are not committed; Game Prep may still link to Rotation.

## Round Complete Review — OBSERVED

Current friction:

```text
Simulate other games
→ controlled game simulates last
→ application immediately advances to the next week
```

A future review boundary could allow users to inspect their result, league results, standings movement, and Recruiting changes before manually advancing. Do not design or implement it here.

## Minor UX Polish — OBSERVED

Keep below the foundational investigations:

- Quick Sim recap / Game Leaders layout feels awkward.
- “Last 5” is preferred to “Last 4.”

## Current Playtesting Priorities

1. Development / Potential realization diagnostic
2. Mature league powerhouse ceiling
3. Player detail / player connection UX
4. Recruiting Focus-target and Recruiting-update visibility
5. Assistant fill remaining Recruiting Board
6. Shot-selection diagnostic
7. Coaching / Rotation navigation
8. Round-complete review
9. Minor Quick Sim / Last 5 polish

This order may change as new evidence emerges.
