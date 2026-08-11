# Playtesting Log

`PLAYTESTING.md` records observations and hypotheses from actual gameplay. Each entry follows a small empirical loop; see `CALIBRATION.md` for the tuning and validation methodology:

```text
observation → evidence → question / hypothesis → next investigation → decision
```

It is not a raw notes dump or an issue tracker. A single playthrough observation is not automatically a confirmed problem.

When manual play changes product priorities, update this evidence first. Only
deliberately selected work moves into `ROADMAP.md`; follow
`DOCUMENTATION_POLICY.md` for acceptance-driven updates.

- `PLAYTESTING.md`: gameplay observations and hypotheses
- `KNOWN_ISSUES_AND_OPTIMIZATIONS.md`: confirmed technical or calibration problems, debt, and scaling risks
- `FUTURE_FEATURES.md`: intentionally deferred systems and features

## Statuses

- **OBSERVED** — noticed during manual play; not yet validated.
- **INVESTIGATING** — enough evidence exists to run diagnostics.
- **CONFIRMED** — diagnostics established a real problem.
- **RESOLVED** — implemented and validated.
- **WATCH** — currently acceptable, but worth monitoring in future play.

## What Is Working / Fun Right Now

- Recruiting creates real risk/reward choices rather than automatic elite classes.
- Pine Valley feels like a genuine multi-year grind instead of an instant rebuild.
- High-POT projects can bust, develop modestly, hit, or rarely become stars.
- Large offseason jumps and recognizable League leaders create memorable careers.
- Strong Programs can assemble scary rosters without remaining dominant forever.
- Tournament Cinderellas, upsets, and painful exits create distinct Season stories.
- Graduation, Recruiting, Development, and rollover make rebuilding cyclical and meaningful.

Preserve these strengths. A surprising outcome is evidence to interpret—not
automatically a defect.

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

## Player Development / Potential Realization — RESOLVED / WATCH

### Observation

Manual play produced examples including:

- a `54 OVR / 90 POT` Recruit reaching approximately `62 OVR` by senior year;
- a `73 / 89` Player remaining approximately `73` as a senior;
- a `73 / 99` freshman gaining about `+2` in the first offseason; and
- observed largest annual gains of roughly `+4` to `+5`.

### Player-facing concern

Visible Potential naturally creates an expectation that a high-Potential raw prospect has a meaningful chance to become impactful. Potential must not guarantee its ceiling, and busts should remain possible. Rare breakouts and major development trajectories should also be possible.

### Original investigation

**Phase 6E.3 — Development + League Talent Progression Diagnostic** was scoped to measure:

- senior OVR conditional on freshman OVR/Potential;
- high-Potential bust and good/star outcome rates;
- annual OVR-gain distribution, including whether `+6`, `+8`, or larger breakouts occur;
- how often Players approach Potential; and
- whether variance supports distinct career stories.

### Phase 6E.3 diagnostic result

The direct production-API diagnostic ran 5,500 deterministic careers: 500 for each of eleven readiness/Potential profiles. Current annual OVR-gain ranges are structurally capped at `+5` for FR→SO, `+4` for SO→JR, and `+3` for JR→SR. Across the diagnostic, annual gain median/P90/max was `+2 / +4 / +5`; `+6`, `+8`, and `+10` seasons were impossible.

Potential primarily acts as a ceiling. It constrains Players near their ceiling, but it does not increase the independently drawn class-based gain target for Players with large headroom. Representative median senior outcomes were `62` for actual-55/90, `72` for actual-65/90, `73` for actual-65/99, `82` for actual-75/99, and `92` for actual-85/99. Raw 55/90 and 65/90 prospects had no diagnostic HIT or BREAKOUT outcomes under the defined career-gain buckets.

This confirms a player-facing mismatch: visible high Potential permits upside but currently does not create meaningful upside-outcome variance for raw prospects. It does not mean Potential should guarantee its ceiling.

### Phase 6E.4 resolution

Development V1 is accepted. It combines class baseline, POT-headroom opportunity, a stable hidden Player tendency, annual variance, rare breakout draws, and the existing hard Potential cap. Direct 5,500-career validation now shows materially different equal-OVR outcomes by POT: 55/60 finished at senior median/P90 `60/60`, while 55/90 finished `69/81`; 65/90 finished `76/86`, and 65/99 finished `78/90`. High-POT busts remain, and raw high-POT hit/breakout outcomes now exist.

The full 5×10 acceptance run stayed structurally healthy and well below pre-Talent-V1 inflation. It improved the active upper tail modestly, while mature 85+ Team seasons remain uncommon because Recruit Talent V1 intentionally supplies a scarce high-Potential upper tail. Continue manual playtesting before treating that separate supply/league-shape question as a confirmed Recruit-generation defect.

### Playthrough 3 follow-up

Manual play now shows the intended career spread. Jayden Wright gained `+6` as a freshman; Lucas Webb (`68/87`) finished near `84` after gains of `+12`, `+3`, and `+1`; Aaron Jackson (`55/97`) made `+12` and `+10` jumps before reaching `84` as a senior; and Ashton Hunt (`69/80`) gained `+7`. Nolan Evans had a raw/upside rise of `+10` followed by `+6`, while Silas Matthews progressed from `57/85` freshman to `69`, `78`, and `82` as a senior. Omari Watson and Terrence Hines developed much less.

**Decision:** Development V1 now produces busts, modest outcomes, hits, and memorable breakouts. Freeze it unless new evidence identifies a structural failure.

## Mature League Powerhouse Ceiling — WATCH

### Observation

Around Season 8, the best observed Team was roughly `83 OVR`; most Programs were in the 70s; Pine Valley was around `65`, while the next-lowest Team was around `71`.

### Question

Talent Distribution V1 reduced league-wide inflation, but may have reduced the upper end too far. The desired qualitative shape is a few legitimately scary Teams, strong Tournament Teams, a large middle class, bad Teams, and an occasional disaster Team.

### Phase 6E.3 diagnostic result

The STANDARD 3×10 and ACCEPTANCE 5×10 production-Dynasty runs agreed. At Season 10, the five-seed sample had Team OVR P10/P25/P50/P75/P90/max of `70.7/74.5/77.1/78.7/80.3/83.0`, an average `0.0` Teams at 85+, `0.0` at 83+, and `4.4` at 80+. Champions averaged `80.5` Team OVR (median `80.3`, range `71.7–86.9`). Northbridge retained an average `4.4` 80+ Players and `1.2` 85+ Players at Season 10, but its Team OVR was `79.8`; Pine Valley averaged `66.7` with `0.2` 80+ Players.

The mature league does not collapse into one flat tier—Prestige separation and Tournament contender strength remain real—but 85+ Team seasons remain uncommon after the high-OVR Season 1 roster population turns over. Development V1 now converts high-headroom prospects into diverse outcomes and allows rare strong contenders; future manual play should determine whether the remaining scarce Team upper tail warrants a separate Recruit Talent supply investigation.

### Playthrough 3 follow-up

Northbridge reached roughly `87` Team OVR once, with three `90+` Players, three additional `85+` Players, and an `84` freshman. Later rosters were mostly in the 70s, with leaders around `81–83`.

Strong powerhouses are mechanically possible, but their frequency and persistence under Recruit Talent V1 remain a watchpoint. Development V1 can create strong upperclassmen without returning to the prior inflation; do not reopen Recruiting or Development from this evidence alone.

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

Playthrough 3 also showed missed commitments, early low-star commitments, and confusing headline counts. Players need to understand interest, standing, active battles, and material changes without reverse-engineering the system.

Useful future feedback includes a compact Focus-target table and events for commitments, lost targets, and meaningful standing changes.

**Design principle:** more feedback, not more Recruiting mechanics. Exact presentation is intentionally undesigned.

## Recruiting Assistant — Fill Remaining Board — OBSERVED — REPEATED HIGH-VALUE QOL REQUEST

Desired future behavior:

```text
User selects, focuses, and offers the Recruits they care about
↓
Assistant fills unused Board capacity with sensible backups
```

It must never replace user-selected targets or overwrite Focus choices or Offers. It should use existing deterministic AI/default planning where possible and remain separate from **Generate Draft Board**, which begins with an empty Board.

The assistant should fill only unused capacity; manual targets, Focus, and Offers remain authoritative.

## Elite Recruit POT Gap — WATCH

Manual classes included high-OVR recruits at their ceiling, such as `85/85`, `84/84`, and `87/87`. Recruit Talent V1 intentionally calculates `POT = max(OVR, ceiling)`, so this is permitted.

Future diagnostics should measure `POT === OVR` for all Recruits, 5★, 4★,
80+, 85+, and 90+, plus POT-gap buckets `0`, `1–3`, `4–7`, `8–12`, and
`13+`. Do not change Recruit Talent V1 from this observation alone.

## Generated Draft Board Ambition — WATCH

Pine Valley's generated Board sometimes immediately offers low-tier/2★ targets, while Charlotte Tech can appropriately pursue many 4★ recruits. This likely reflects Prestige scaling, not a bug. Future diagnostics should evaluate whether generated Boards have an appropriate reaches / realistic-targets / safe-backups mix for each Prestige level.

## Player Connection / Player Detail — OBSERVED — HIGH PRIORITY UX

Playthrough attachment formed around Lucas Webb, Aaron Jackson, Josiah Hughes, Nolan Evans, and Silas Matthews. Webb led the league in scoring and assists and had a 38-point game; Jackson rose from `55/97` to `84`; Silas rose from `57/85` to `82`; and Josiah led the league in scoring. Losing productive seniors made the rebuild feel meaningfully different.

The existing Player Details view should be extended as **Player Details +
Development History UX**, not replaced by a new Player system. Preserve identity,
natural/floor eligibility where useful, class, OVR/POT, nine attributes, season
stats, shooting splits, game log, and derivable highs. Add a career progression
view such as FR OVR, then SO/JR/SR OVR plus offseason gain. Derive history from
stable Player IDs and archived Dynasty Season snapshots rather than duplicate
mutable career state.

## Followed Players / Favorites — OBSERVED

Following Silas Matthews after he joined another Program was enjoyable. A future favorite/followed-player concept could surface current Team, class, OVR, statistics, development, and notable performances. Do not commit to notifications or permanent history design yet.

## Playtest Stories / Why This Is Fun

These are empirical examples, not permanent lore or guaranteed outcomes.

- **Lucas Webb — Pine Valley:** a `68 OVR / 87 POT` Recruit developed by
  `+12`, `+3`, and `+1` to roughly `84` as a senior, became a League leader in
  scoring and assists, and scored 38 in a win over Wasatch. Player careers can
  create attachment; the UI should make them easier to follow.
- **Aaron Jackson:** a raw `55 / 97` Recruit gained `+12` and `+10` before
  reaching roughly `84` as a senior. Talent V1 plus Development V1 can produce
  genuine long-term upside stories.
- **Silas Matthews:** approximately `57 / 85` at Pine Valley, then `69`, `78`,
  and `82` as a senior. Following him while controlling another Program was
  enjoyable, supporting League-wide Player following/history concepts.
- **Northbridge powerhouse:** one roster reached about `87` Team OVR with three
  `90+` Players, three more at `85+`, and an `84` freshman, yet did not remain
  permanently dominant and suffered an early Tournament upset. Powerhouses can
  exist without erasing memorable uncertainty.
- **Franklin Metro Cinderella:** a low seed upset #1 Northbridge, beat the
  controlled Team heavily in the semifinal, and lost the title game by two.
  Cinderellas are fun; repeated extreme seeds should prompt diagnosis of seeding
  quality versus actual variance, not automatic Game Sim tuning.

## Position / Rotation Flexibility — RESOLVED / WATCH

Manual rosters exposed a strict natural-position constraint: an `SG 69` could receive roughly 36 MPG behind a weak backup, while a `PG 78` received about five MPG because he could not play another spot. Multiple strong players at one natural position can therefore produce visibly inferior lineups.

Rotation V1 is canonical; manual legal secondary assignments and accepted
flexible deterministic AI/default generation are live.

### Phase 6E.5 diagnostic result

A direct production-path diagnostic sampled 288 deterministic rosters (three seeds at Seasons 1, 5, and 10). It defined a clear opportunity as a Player below 10 MPG whose current balanced OFF/DEF contribution exceeded an adjacent-position Player at 20+ MPG by at least five points. `38/288` Teams (`13.2%`) had at least one such opportunity; there were 63 player-pair opportunities with an average contribution gap of `7.54`. SF/PF/SG were the most common source positions (`21/16/13` opportunities); C was rare (`3`).

The diagnostic-only universal adjacent model increased Team OVR by `+2.21` mean (`+2.09` median, `+3.37` P90, `+6.21` max), but its unrestricted optimizer can place SG/SF/PF Players across three slots and produced visibly broad lineups. A narrower one-secondary-slot model retained most of the measured gain (`+1.92` mean, `+1.74` median, `+3.10` P90, `+5.13` max) with clearer basketball semantics. Both results are no-penalty allocation ceilings, not accepted balance changes.

Northbridge/Great Lakes improved `+1.88` under universal adjacency and `+1.67` under the narrow model; Pine Valley improved `+2.28` and `+2.05`. Rigidity can suppress elite rosters, but flexibility does not magically erase weak-team separation. The height audit found some small-wing/SF and undersized-C assignments in both simple tables, reinforcing the case for a future generated or explicit secondary-position model rather than universal adjacency.

At the end of 6E.5 this remained diagnostic evidence only. Its conservative
narrow-secondary recommendation was subsequently implemented, validated,
activated, and frozen through Rotation V1.

### Phase 6E.6F behavioral validation

The paired direct audit compared natural and flexible defaults on the same 96
generated Teams. Flexible rotations changed `41/96` Teams (`42.71%`), assigned
`264` secondary minutes to 51 Players, moved 11 buried Players from at most nine
minutes to at least ten, and brought two zero-minute Players into the Rotation.
Average Team OVR increased `+0.1142` (median `0`, P90 `+0.3423`, maximum
`+0.6956`) with zero regressions.

Rotation depth stayed stable: Players above zero minutes changed from `10.77`
to `10.78` per Team, while 10+ minute Players changed from `7.80` to `7.91`.
The meaningful watchpoint is the accepted 36-minute exception: 38 Players moved
from 36 to exactly 40 minutes. Interior/forward flexibility also dominated with
`PF→C 84`, `SF→PF 80`, and `C→PF 40` minutes versus `PG→SG 40` and `SG→SF 20`.

Paired QUICK (1 seed × 3 Seasons, 1,152 games per branch) and STANDARD (3 seeds
× 10 Seasons, 11,520 games per branch) comparisons used identical Teams,
Schedules, and game seeds. STANDARD movement was negligible: scoring `+0.012`
points per Team-game, Team OVR `+0.092`, FG% `+0.002` percentage points, close
games `+0.087` percentage points, blowouts `+0.052` percentage points, and win
spread `+0.004`. No accepted calibration band failed.

**Decision: RESOLVED / WATCH.** Phase 6E.6G activated the accepted generator for
fresh Universe, Exhibition, and new-season Dynasty defaults without changing
its behavior. Production structural and full-Season smoke tests passed. Monitor
exactly-40-minute frequency, the interior-heavy path mix, and rare large
incumbent displacement; current evidence does not justify tuning the cap,
threshold, eligibility mapping, or any frozen simulation system.

## Game Simulation — Shot Selection — OBSERVED

One Center attempted roughly ten three-pointers and shot poorly in a game. One game is not evidence of a bug. A future diagnostic should determine whether 3PA sufficiently reflects Shooting and position, whether low-Shooting bigs attempt too many threes, or whether this was a plausible poor game from a capable shooter. Do not tune Game Simulation yet.

## Coaching / Rotation Navigation — OBSERVED — REPEATED UX REQUEST

Playtesting suggests Rotation deserves a persistent home rather than existing only in Game Prep. A future navigation concept could be:

```text
SEASON | COACHING | RECRUITING | LEAGUE
```

Initial Coaching scope could be Rotation only. Rotation V1 now makes this a
useful information-architecture improvement; tactics and other coaching systems
remain uncommitted, and Game Prep may still link to Rotation.

## Round Complete Review — OBSERVED

Current friction:

```text
Simulate other games
→ controlled game simulates last
→ application immediately advances to the next week
```

A future review boundary could allow users to inspect their result, league results, standings movement, and Recruiting changes before manually advancing. Do not design or implement it here.

Round Review and League News could eventually complement one another:

```text
Round completes
→ review result
→ meaningful league/recruiting updates
→ Advance Round
```

Do not merge them into one committed feature yet.

## Tournament Balance / Seeding — CONFIRMED SEEDING ISSUE / GAME SIM CLOSED

Manual play saw multiple `16 > 1` upsets, two championship games between `16` and `14` seeds, and frequent upsets despite many Team OVR gaps being closer to `81` versus `77`. Northbridge fell early, while Franklin Metro made a Cinderella run.

Cinderellas are desirable; seed labels alone are not evidence that Game
Simulation variance is wrong. Phase 6E.7 therefore measured seed quality and
actual Team-strength outcomes separately through the production Dynasty,
Recruiting, Postseason, Development, and rollover lifecycle.

### Phase 6E.7 diagnostic result

The STANDARD `3 × 10` run captured 30 Tournament fields and 450 games; a
bounded `5 × 10` expansion captured 50 fields and 750 games after one OVR-gap
bucket remained sparse. Deterministic replay passed.

Across the expanded sample, seed quality correlated strongly with win
percentage (`0.858`) but only moderately with Team OVR (`0.509`). Mean absolute
seed-versus-OVR-rank error was `3.50`; the #1 seed was actually strongest by OVR
only `30.0%` of the time, and seeds 1–4 were actually top-four Teams only
`50.0%` of the time. The disconnect widened in fully endogenous Season 5+
fields: OVR correlation fell to `0.386`, mean rank error rose to `3.99`, seeds
1–4 were actually top-four only `42.5%`, and seeds 13–16 were actually top-eight
`27.5%` of the time.

Protected automatic qualifiers remained stronger on average than at-larges
(`80.77` versus `78.42` OVR), but an at-large Team exceeded an automatic
qualifier in `28.1%` of pairwise comparisons and `35.6%` in Season 5+. Mature
1/16, 2/15, and 3/14 median OVR gaps were only `3.68`, `2.90`, and `2.74`; the
lower seed was actually stronger in `10.0%`, `23.3%`, and `46.7%` of those
matchups.

Ignoring seeds, stronger-Team win rates by OVR gap were `50.4%`, `57.3%`,
`66.4%`, `68.2%`, and `82.8%` for `0–<2`, `2–<4`, `4–<6`, `6–<8`, and `8+`.
That is a sensible qualitative favorite curve: tiny gaps are competitive and
large gaps provide a strong advantage. Seed upsets (`45.6%`) exceeded strength
upsets (`40.9%`), proving that dramatic labels often overstate the underlying
result. Champions averaged `80.76` OVR and OVR rank `5.84`, although rare
low-strength champions remained part of the observed variance.

**Decision: Outcome A.** Poor seed/OVR alignment—especially in mature
Dynasties—plus a healthy actual-strength win curve points to a Tournament
seeding/ranking issue, not a Game Sim variance problem. Game Sim remains closed.
Select a separate 6E.7B Tournament Seeding Candidate; do not change selection,
seeding, automatic-bid treatment, or simulation behavior as part of this
diagnostic.

### Phase 6E.7B resolution

One isolated candidate preserved the exact four automatic qualifiers and 12
at-larges, then seeded all 16 together through the existing results-only résumé
comparator. Paired STANDARD `3 × 10` evidence improved Season 5+ seed/OVR
correlation from `0.386` to `0.448`, mean seed/OVR-rank error from `4.01` to
`3.80`, and top-four OVR accuracy from `38.9%` to `47.2%`, while résumé
correlation strengthened from `0.833` to `0.925`.

The FULL `5 × 10` acceptance audit confirmed the direction. In Season 5+,
seed/OVR correlation improved `0.386 → 0.439`, rank error `3.99 → 3.80`, #1-seed
OVR accuracy `26.7% → 33.3%`, and top-four accuracy `42.5% → 49.2%`. The
lower-seed-stronger rate in 3/14 games fell `46.7% → 33.3%`; 2/15 worsened
slightly `23.3% → 26.7%`, which reinforces that résumé seeding is not intended
to be perfect OVR ordering.

The candidate stronger-Team curve remained healthy and Cinderella outcomes
persisted. **Decision: ACCEPT / RESOLVED.** Automatic qualification now
guarantees entry but not a seed from 1–4. Freeze this results-only seeding rule;
Game Sim and Team Strength remain unchanged.

## Super Sim — Season Complete Target — OBSERVED / HIGH-VALUE QOL

Desired user-facing target:

```text
SIM TO SEASON COMPLETE
→ finish regular season
→ finish Tournament and National Championship
→ synchronize Recruiting to postseason Period 28
→ stop
```

It must not enter Late Recruiting, finalize Recruiting, run the offseason, develop Players, or assemble next season's roster. This should reuse the existing Super Sim target model, alongside Midseason and end-of-regular-season targets, so players can inspect the final state and make late-Recruiting decisions through the existing lifecycle.

That stopping point should expose final standings, bracket/champion, Player
stats and leaders, Recruiting status, and remaining Late Recruiting decisions
before any roster turnover.

## League News / Round Recap — OBSERVED

A future “Around the Country” recap could derive concise updates from canonical prior-round facts rather than storing permanent prose. Useful events include upsets, big performances, Recruit commitments or lost Focus targets, conference/milestone movement, and Cinderella runs.

## Offseason — Around the League — OBSERVED

Future offseason context could surface the biggest development jumps, notable returners, and incoming recruits from derived existing data. Do not implement or define a presentation yet.

## Program Records / Statistical History — OBSERVED

Future history could include program single-game points, season scoring, and career points/assists. It should follow Player Detail/development-history work rather than precede it.

## Season Hub Information Hierarchy — OBSERVED

Conference standings are rarely used in their current prominent placement and can push more meaningful information below the fold. A future hierarchy might prioritize the game and Recruiting context, important updates, schedule/recent results, and a smaller conference snapshot with a route to the full view. Do not redesign it here.

## Postseason Hub + Season-Complete Presentation Polish — PLANNED

Repeated feedback notes awkward Tournament Complete and Season Complete card
placement, excess dead space beneath Tournament Complete, and a visually
disconnected Late Recruiting handoff. The bracket is good and must remain
intact. A likely desktop direction groups Tournament/championship and Season
Complete status on the left and Recruiting/Late-Recruiting context on the
right. This presentation milestone is separate from Tournament balance/seeding.
It is near-term because the Tournament is the Season payoff and one of the
strongest generators of stories already present in the game.

## Minor UX Polish — OBSERVED

Keep below the foundational investigations:

- Quick Sim recap / Game Leaders layout feels awkward.
- “Last 5” is preferred to “Last 4.”
- Seeing current seed would be fun, potential to choose seed when starting dynasty (compete with others on same field)

## Repeated Playtest Friction

Highest-value repeated signals:

- interesting Player careers are difficult to follow across Seasons;
- Recruiting commitments, lost targets, and which signees were backups are easy to miss;
- Focus-target context is not visible enough on the Season Hub;
- users want Assistant Fill Remaining Board without losing manual choices;
- Rotation deserves a permanent Coaching home;
- Tournament/Season Complete composition and the Late Recruiting handoff feel
  awkward even though the bracket is good; and
- Season Complete needs a deliberate final inspection checkpoint before turnover.

Lower-priority friction: full Conference standings create substantial Hub
scrolling, Quick Sim leader composition is awkward, and Last 5 is preferred to
Last 4.

## Testing for Fun

After meaningful gameplay or UI changes, manual acceptance should ask:

- Did I understand what happened?
- Did I have an interesting decision?
- Did I care about the outcome?
- Did the system create a memorable Player, Team, or Season story?
- Did anything feel like busywork?
- Did anything important happen without me noticing?
- Did an unusual result feel exciting or merely random/confusing?
- Did I naturally want to inspect another screen, Player, or Recruit afterward?

These are product questions, not automated invariants.

## Currently Frozen Unless New Evidence Appears

- Board + Focus + Offer Recruiting
- AI Recruiting plan coherence
- Prestige / attraction
- Recruit Talent Distribution V1 (except the explicit POT-gap and mature-supply watchpoints)
- Player Development V1
- Rotation V1
- Tournament results-only résumé seeding
- Calibration methodology

Do not reopen these systems casually.

## Current Playtesting Priorities

1. Player Details + Development History UX
2. Postseason Hub + Season-Complete Presentation Polish
3. Recruiting Focus-target / commitment visibility
4. Assistant Fill Remaining Recruiting Board
5. Coaching navigation / permanent Rotation home
6. Super Sim — Season Complete target
7. Recruit POT-gap diagnostic
8. League News / Round Recap
9. Season Hub information hierarchy
10. Offseason around-the-league context
11. Followed Players / Favorites
12. Program records / deeper statistical history
13. Shot-selection diagnostic
14. Minor Quick Sim / Last 5 polish

This ordering remains playthrough-driven and may change with new evidence.
