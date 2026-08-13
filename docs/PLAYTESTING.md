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

## Recruiting Feedback / Visibility — RESOLVED (Phase 6E.12)

Repeated playtesting asked for clearer Recruiting feedback:

- the three Focus targets on the Season Hub;
- current standing, leader, and major competitors for Focus targets;
- clear Offer/Focus status;
- updates when a Board or Focus target commits elsewhere; and
- final national Recruiting results/classes after Late Recruiting.

Playthrough 3 also showed missed commitments, early low-star commitments, and confusing headline counts. Players needed to understand interest, standing, active battles, and material changes without reverse-engineering the system. The Great Lakes Dynasty repeated this friction while quick-simming.

**Design principle:** more feedback, not more Recruiting mechanics. Board + Focus + Offer and AI Recruiting mechanics remain frozen and unchanged.

Phase 6E.12A (COMPLETE) established the player-safe domain contract:
`deriveRecruitingBattleView` and `deriveRecruitingCommitmentActivity` in
`src/dynasty/recruiting/battleView.ts` project the real decision, standing,
and separation gates into coarse readiness (`early`/`developing`/`serious`/
`decision-imminent`/`committed`), active Board pursuers, Offer presence,
categorical leading/competitive/trailing context, and commitment-to-us versus
commitment-elsewhere outcomes, without exposing raw attraction, relationship
totals, thresholds, probabilities, AI utility, other Programs' Focus choices,
or hidden rolls.

Phase 6E.12B (COMPLETE) presents that contract. The Season Hub now leads with
a compact `SeasonHubFocusTargets` module showing every Focused Recruit's
readiness, controlled standing, Offer status, and top competitors before the
existing Board/Offer summary. The Recruiting Hub board table gained Readiness
and Battle columns using the same selector and deterministic competitor
ordering. `RecruitingCommitmentAlerts` surfaces commitment-only activity
(`deriveRecruitingCommitmentActivity`) across a Quick Sim / Super Sim
simulation boundary — captured as a transient `recruitingActivityBaselinePeriod`
session field in `useDynastyStore`, never a persisted history log — and
distinguishes commitments to the controlled Program from commitments
elsewhere, including for tracked (non-Focused) Board Recruits. No standing
movement or "moved into first" language is produced, because canonical state
still has no period-by-period standing snapshots; only provable commitment
events cross a simulation boundary. See `UI_DESIGN.md` for the accepted
presentation.

### Recruiting Battle Health — DIAGNOSED (Phase 6E.13)

A production-lifecycle QUICK run and STANDARD `3 × 10` LIGHT diagnostic tested
the new UX signals without changing Recruiting. Generated controlled plans had
only `32/90` Focus targets Offered (`35.6%`) versus `2585/2790` (`92.7%`) for AI
plans. Just `3.3%` of generated user plans were 3/3 coherent; `56.7%` were 1/3
and `20.0%` were 0/3. Every unsupported user Focus target was observable as the
position's Offer capacity being assigned to a different generated target. This
confirms a narrow generated-user-plan coherence issue, not a reason to couple
manual Focus and Offers globally.

Of `1944` commitments, `63.2%` had shown `early` one period earlier (`55.6%` of
5★ and `52.1%` of 4★). Every such transition occurred at the first
decision-ready period; `93.5%` already had the eventual winner leading, `97.7%`
already met the next-window standing gate, and `100%` met separation before the
window opened. The mechanics are internally coherent, but `Early Interest`
does not communicate an already-settled battle whose decision window opens next
period. Retain commitment timing and earn a narrow readiness communication or
projection follow-up.

Premium Board competition was sparse at preseason but expanded through real AI
refreshes. Among unsigned Recruits at Period 20, `91.8%` of 5★ and `94.6%` of
4★ had 3+ active Board pursuers. Offer competition was less broad: 5★ were
`16.0%` zero / `12.3%` one / `71.7%` two-plus Offers, while 4★ were `53.3%`
zero / `9.9%` one / `36.7%` two-plus. For premium low-Offer observations,
strongest observable constraints were another target consuming positional
Offer capacity (`43.7%` of 5★, `81.3%` of 4★) and Programs with need choosing
other targets (`52.6%` of 5★, `13.4%` of 4★); broad Board-capacity saturation
was rare. Premium pursuit itself is healthy, but premium Offer allocation
remains a watch and requires a separate narrow diagnostic before any change.

### Generated User Plan Coherence — RESOLVED (Phase 6E.14A)

Phase 6E.14A reused the accepted AI Focus-alignment concept only at controlled
Draft Board generation: Board → Offers → one-time Focus alignment. The Board
and Offer set remain exact; Offered targets are preferred for the three Focus
slots, with the strongest active Board target retained only when fewer than
three generated Offers are legal. Manual Focus without Offer, Offer without
Focus, Focus changes, and Offer withdrawal remain independent afterward.

Paired STANDARD `3 × 10` LIGHT evidence moved generated user Focus-with-Offer
coherence from `32/90` (`35.6%`) to `81/90` (`90.0%`), alongside the unchanged
AI reference of `2585/2790` (`92.7%`). Fully coherent 3/3 plans improved from
`3.3%` to `70.0%`; the other `30.0%` were 2/3 because only two generated
Offers were legal. No candidate plan remained 1/3 or 0/3. The 6E.13 generated
plan watchpoint is closed; readiness communication and premium Offer allocation
remain separate follow-ups.

### Recruiting Readiness Clarity — DOMAIN ACCEPTED (Phase 6E.14B-A)

The readiness read model now distinguishes `not-deciding` from the narrow
`decision-soon` state. `Decision Soon` requires the Recruit to be exactly one
period before decision eligibility and the current eligible leader to already
meet the next window's production standing and separation gates. Once eligible,
the existing `developing`, `serious`, and `decision-imminent` states retain their
exact gate meanings; `committed` still requires canonical commitment state.

STANDARD `3 × 10` LIGHT replay classified `1200/1933` prior-period observations
as `decision-soon` and `28/1933` as `not-deciding`. Of cases formerly shown as
`early`, `97.7%` became `decision-soon` and `2.3%` remained `not-deciding`; the
conversion was `100%` for 5★ and `97.9%` for 4★. No `decision-soon` observation
fell outside the exact next-period eligibility boundary, and
`decision-imminent` remains identical to the current production standing plus
separation gates. The common `Early` → commitment surprise is resolved without
predicting a commitment or changing Recruiting behavior. Final labels, tooltip
copy, and presentation remain open for Phase 6E.14B-B. Premium Offer allocation
remains a separate watchpoint.

### Recruiting Readiness Presentation — RESOLVED (Phase 6E.14B-B)

Phase 6E.14B-B applied final player-facing copy and a restrained visual
hierarchy for the accepted six-state contract across the Hub, Board, and
Battles surfaces, with no Recruiting domain or mechanic changes. The accepted
labels are `Not Yet Deciding`, `Decision Soon`, `Developing`, `Serious
Battle`, `Decision Imminent`, and `Committed`; `Not Yet Deciding` reads as a
decision-timeline fact rather than low Program interest, and `Decision Soon`
names the real near-term risk without predicting a winner. Visual weight now
forms a quiet-to-urgent ramp using only existing ink/accent tokens (muted →
unmarked → brighter/bolder → accent → accent-strong with a marker), applied
identically to the Board's compact badge, the Hub's Focus row (with a thin
left-edge accent cue reserved for `Decision Soon`/`Decision Imminent` only),
and the Battles card (readiness above the grouped standing, with a matching
border tint for the same two states). The Readiness tooltip now opens with a
line stating readiness describes decision-timeline/battle-state proximity,
not a probability, and explains all six states without exposing periods,
thresholds, or probabilities. The retired `Early Interest` label no longer
appears anywhere in the current UI. Manual play across Not Yet Deciding,
Decision Soon, Serious Battle, Decision Imminent, and Committed Recruits, a
mixed-readiness Board, a mixed-readiness Battles grid, and the tooltip at
desktop and narrow widths confirmed the hierarchy reads correctly and stays
secondary to Recruit identity and Board actions. Phase 6E.14B (readiness
communication) is now fully resolved; premium Offer allocation remains a
separate watchpoint. See `UI_DESIGN.md` for the accepted presentation.

### Assistant Fill Remaining Board — ACCEPTED (Phase 6E.15)

The Recruiting Board now offers an explicit `Fill Remaining Board` convenience
action. It passes the current controlled Board into the same deterministic,
need-aware target-selection loop used by the accepted default planner, preserves
all existing entries and their order, and appends only enough legal targets to
use available capacity. Existing Focus and Offer combinations remain exact;
new targets begin as Board-only entries with neither Focus nor an Offer.

Focused empty, partial, nearly-full, full, unavailable-entry, and insufficient-
candidate cases confirm the action never regenerates the player's plan, creates
duplicates, changes AI plans, or runs without a click. Same-state replay returns
the same added Recruit set and order. This closes the repeated Assistant Fill
Remaining Board QOL friction without reopening generated-plan coherence or any
Recruiting mechanic.

### Recruiting Information Architecture + Visual Hierarchy — RESOLVED (Phase 6E.12C)

Manual playtesting after 6E.12B confirmed the new battle/readiness/commitment
information itself was useful, but reopened the presentation layer only: the
same intelligence was shown in too many places at too much visual weight. The
standalone `SeasonHubFocusTargets` Hub module felt detached from the
existing Recruiting panel and showed more battle detail than a dashboard
needs; the Board mixed management actions with full battle intelligence and
had no natural place for competitor detail; too many labels/badges/accent
colors competed for attention; and `RecruitingCommitmentAlerts` felt like an
inbox notification requiring acknowledgement rather than a recap of the most
recent simulation action.

Phase 6E.12C (COMPLETE — ACCEPTED) is a presentation-only re-shape — it did
not touch 6E.12A's domain contract or any Recruiting mechanic — that
establishes the current canonical separation: Hub = status, Board =
management, Battles = intelligence, National = discovery. Focus targets now
compose inside the existing `RecruitingHubSummary` instead of a second Hub
surface, condensed to identity, readiness, our standing, an actionable
"Needs Offer" state, and a single outcome line once resolved, with no
competitor detail and no `Manage Recruiting` CTA (primary Dynasty navigation
already exposes Recruiting). `RecruitingBoardTable` returned to
management-only columns with an accessible `RecruitingReadinessInfo`
hover/keyboard-focus affordance replacing the removed Battle column and
competitor lists. A new `Battles` mode
(`RecruitingModeTabs`/`RecruitingBattlesGrid`/`RecruitingBattleCard`)
presents a responsive 2-column/1-column card grid built from the unchanged
`deriveRecruitingBattleView` selector via `deriveBattleCardSummaries`, with
our Program identified first using the Tournament bracket's existing
`.team-color-dot` square (replacing the previous bespoke circular
competitor-dot styling) ahead of deterministically ordered, capped
competitors, and committed cards collapsing to identity plus one outcome
line. `RecruitingCommitmentAlerts` lost its Dismiss control and became a
compact "Recruiting Update · N Decisions" recap; `recruitingActivityBaselinePeriod`
now always replaces (never holds) its baseline on every Quick Sim / Super
Sim / Tournament-round boundary, so a later quiet simulation automatically
clears an earlier unseen commitment instead of requiring acknowledgement.
See `UI_DESIGN.md` for the accepted presentation pattern.

Follow-up manual playtesting of 6E.12C's Battles cards found the controlled
Program still pinned to a fixed row ahead of the competitor list regardless
of whether it was actually `leading`, `competitive`, or `trailing`, which
made a card's real battle position ambiguous at a glance; the Readiness
tooltip was also observed overflowing the viewport. Phase 6E.12D (COMPLETE —
ACCEPTED) resolved both: the controlled Program now renders inside its
actual standing group marked `YOU`, the redundant upper-right We Lead/Trail
badge is gone since the grouping itself communicates standing, and the
tooltip is centered/width-capped to the viewport (a bottom-sheet anchor
below 560px). No domain/mechanic change; see `UI_DESIGN.md`.

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

## Player Connection / Player Detail — RESOLVED (Phase 6E.8)

Playthrough attachment formed around Lucas Webb, Aaron Jackson, Josiah Hughes, Nolan Evans, and Silas Matthews. Webb led the league in scoring and assists and had a 38-point game; Jackson rose from `55/97` to `84`; Silas rose from `57/85` to `82`; and Josiah led the league in scoring. Losing productive seniors made the rebuild feel meaningfully different.

Phase 6E.8 extended the existing Player Details view as **Player Details +
Development History UX** rather than replacing it with a new Player system.
Identity, natural position, class, OVR/POT, the nine current-ability
attributes, current-season stats, shooting splits, and game log are preserved.
A prominent Career Progression table (Season/Class/OVR/Dev/PPG/RPG/APG) and a
compact Recruiting Origin section were added, both derived purely from stable
Player IDs plus archived Dynasty Season snapshots, the active Season, and
finalized Recruiting history — no mutable career state was introduced. See
`UI_DESIGN.md` for the accepted presentation and `src/dynasty/careerHistory.ts`
for the read-model.

Manual acceptance play confirmed the intended effect across four cases: a
breakout upperclassman's Career Progression table made a large multi-Season
OVR jump immediately legible; an ordinary upperclassman's flatter table read
correctly as unremarkable rather than broken; a freshman recruit showed one
career row plus a populated Recruiting Origin section; and an original
Universe Player with no canonical Recruiting record showed one career row with
Recruiting Origin cleanly omitted, with no placeholder or fake data. In every
case a fresh viewer could reconstruct the Player's career without recalling
prior Seasons themselves.

The Great Lakes follow-up reinforced the value of 6E.8. Mason Webb progressed
from roughly `89/99` to `96` OVR and finished his senior Season at `22.7 PPG`,
`4.1 RPG`, `9.3 APG`, `1.8 SPG`, and `0.0 BPG` with `48.4/41.9/84.0`
shooting splits.
The added career facts were useful in real play. A minor presentation watch is
that current-season production may deserve greater hierarchy directly beneath
Player identity, potentially as a denser horizontal summary rather than the
current compact cards. This is polish, not a failure or reopening of 6E.8.

## Followed Players / Favorites — OBSERVED — REPEATED QOL SIGNAL

Following Silas Matthews after he joined another Program was enjoyable. The
Great Lakes Dynasty repeated the behavior with Jalen Crawford at Pine Valley: a
roughly `57/82`, three-star, #97 Recruit progressed through approximately
`69`, `75`, and `81` OVR while his scoring rose from about `3` to `12`, `14`,
and `23 PPG`, eventually reaching roughly fifth in League scoring. The user
repeatedly checked his career across Seasons.

Following/Favorites is therefore evidence-supported future QOL rather than a
speculative idea. Northbridge's young core and a Pine Valley `48/89` freshman
project repeated the same behavior: an interesting Player on another Team
naturally creates a desire to track his development across Seasons. This signal
now spans Silas Matthews, Jalen Crawford, Northbridge, and Pine Valley. Do not
commit to notifications or permanent history design yet or move it ahead of
Phase 6E.10.

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
- **Christian Douglas — Northbridge:** roughly `97/99` as a sophomore, about
  `25 PPG`, and 36 MPG before reaching 99 OVR. Northbridge absorbed early
  Tournament exits while its young core developed, then won the championship
  in Douglas's senior Season. Development continues to create memorable
  multi-year stars; do not reopen Development V1.
- **Northbridge young core:** Douglas developed alongside Khalil Black
  (`91/99`, freshman C), Rashad Webb (`90/97`, freshman PG), and Justin Wright
  (`81/90`, sophomore PF). Their progression strengthened offseason recap and
  Following/Favorites demand without creating new Development mechanics.
- **Pine Valley project:** a weak Pine Valley signed a roughly `48/89`
  freshman who immediately became interesting to follow. The recruit → develop
  → follow-career loop is working without changing Recruit Talent or Development.
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

### Great Lakes follow-up — exact-40-minute usage

Repeated real play showed Paul Martin, Mason Webb, and multiple League leaders
playing exactly 40 minutes every game across multiple Seasons. The frequency
was noticeable and felt unrealistic rather than merely exceptional.

**Status: Rotation V1 remains accepted/frozen overall.** Only the
exact-40-minute default-usage watchpoint has enough evidence for a narrow
diagnostic. Phase 6E.9 should measure prevalence, star/leader concentration,
natural-default versus flexible `36→40` origins, secondary-position
contribution, and Season 1 versus Season 5+ behavior. Do not prescribe a new
minute cap, fatigue, reduced secondary usage, or a Rotation redesign first.

### Phase 6E.9 diagnostic result

Production-lifecycle QUICK `1 × 3` and STANDARD `3 × 10` LIGHT runs passed
deterministic replay. STANDARD observed `301/10,297` active Rotation Players
at exactly 40 assigned minutes (`2.9%`) across `281/960` Team-Seasons
(`29.3%`); `20/960` Teams had two and none had three. Every exact-40 case was
natural `36 → 40` through exactly four legal secondary-position minutes;
natural allocation produced zero exact-40 Players. Contributions were spread
across every production path: `C→PF 73`, `PF→C 64`, `SF→PF 61`, `SG→SF 57`,
and `PG→SG 46` Players.

The small population rate understates visibility. Exact-40 usage reached
`219/960` Team-highest-OVR Players (`22.8%`), `153/300` top-10 scorers
(`51.0%`), `121/300` top-10 rebounders (`40.3%`), `45/300` top-10 assist
leaders (`15.0%`), and `50/97` Players rated 90+ (`51.5%`). Season 5+ was not
worse than Season 1 (`2.7%` versus `3.0%` of active Rotation Players), so
Dynasty maturity is not the source. Assigned-40 Players averaged `40.035 MPG`
with a `40.000–40.208` range; no simulation behavior reduced them below 40,
while overtime explains values above 40.

**Decision: OUTCOME A + C / CONFIRMED.** The issue is narrow flexible-default
behavior concentrated among visible elite Players, not natural allocation or a
broad Rotation failure. Phase 6E.9B should test one isolated candidate:
remove natural-36 Players from the flexible generator's automatic secondary
recipient path while preserving the legal 40-minute maximum, manual Rotation,
natural defaults, and buried-Player flexibility. Do not implement or accept
that candidate without paired validation.

### Phase 6E.9B Starter Minutes Realism Candidate

Baseline STANDARD characterized `845` natural-36 Players: average/median OVR
`80.9/81`, only `41.3%` were Team-highest OVR, `27.2%` were outside the Team top
three, and `41.3%` were below 80 OVR. Every starter with a 15+ OVR backup gap
received 36; 10–14 gaps produced 36 at `73.8%`. Backup weakness was therefore
too influential by itself.

The accepted candidate reserves the 36-minute natural ceiling for each Team's
deterministic top three Players by OVR; other Players with a backup use a
32-minute ceiling. The flexible pass no longer promotes natural-36 Players and
may replace the candidate's positive weak-backup shares of at most eight
minutes under the existing legal-path and five-point improvement safeguards.
The manual 40-minute maximum and sole-position 40-minute defaults remain legal.

Paired-seed STANDARD reduced natural-36 Players `845 → 615`; every remaining
case was Team top-three, average/median OVR rose to `83.1/83`, and below-75
share fell `15.0% → 4.4%`. Exact-40 defaults fell `301 → 0`. Direct evidence
preserved flexibility: `34/96` Teams changed, 275 secondary minutes reached 39
Players, 30 buried Players reached 10+ minutes, eight zero-minute Players
entered, and average Team OVR improved `+0.104` with zero regressions. Paired
STANDARD natural-versus-flexible movement remained negligible (`+0.094` Team
OVR, `+0.010` points per Team-game, effectively unchanged close/blowout rates).

FULL `5 × 10` acceptance passed deterministic replay and structural audits. It
observed zero exact-40 defaults across `16,717` active Rotation Players and
`1,109` natural-36 Players, all Team top-three, averaging `83.3` OVR. **Decision:
ACCEPT / RESOLVED / FROZEN.** Rotation V1 remains broadly frozen. Continue
watching secondary-path mix and rare large displacement; do not add fatigue or
reduce the legal/manual 40-minute maximum.

Manual Charlotte Tech/Northbridge play then confirmed the accepted shape:
Charlotte Tech had no default above 36; Northbridge's elite young core used a
plausible distribution—Christian Douglas `36`, Khalil Black `29`, Rashad Webb
`29`, and Justin Wright `29`—and League leaders were no longer universally
assigned 40. The user explicitly found the distribution reasonable. **Manual
acceptance: PASS.** The exact-40 automatic-default watchpoint is closed; reopen
starter-minute realism only with genuinely new, repeated evidence.

## Game Simulation — Shot Selection — OBSERVED

One Center attempted roughly ten three-pointers and shot poorly in a game. One game is not evidence of a bug. A future diagnostic should determine whether 3PA sufficiently reflects Shooting and position, whether low-Shooting bigs attempt too many threes, or whether this was a plausible poor game from a capable shooter. Do not tune Game Simulation yet.

## Coaching / Rotation Navigation — RESOLVED (Phase 6E.17B)

Playtesting suggests Rotation deserves a persistent home rather than existing only in Game Prep. A future navigation concept could be:

```text
SEASON | COACHING | RECRUITING | LEAGUE
```

Initial Coaching scope could be Rotation only. Rotation V1 now makes this a
useful information-architecture improvement; tactics and other coaching systems
remain uncommitted, and Game Prep may still link to Rotation.

The Great Lakes follow-up repeated the desire for both a persistent Coaching
home and easier current-roster review. Phase 6E.17A now establishes the
application foundation: side-effect-free Coaching entry refreshes the existing
editable draft from the current canonical regular-season or Postseason Rotation,
and valid edits commit through that same canonical state. It adds no second
Rotation, changes no Rotation V1 mechanic, and leaves Game Prep intact.

Phase 6E.17B implements the permanent presentation: Coaching is now a fourth
`DynastySectionNav` destination (`SEASON/TOURNAMENT | COACHING | RECRUITING |
LEAGUE`) reachable from every existing Dynasty screen, opened only through the
side-effect-free `goToCoaching()`. The screen's `Roster | Rotation` tabs reuse
`TeamDetailsHeader`, `TeamStatsTable`, and `RotationEditorPanel` unchanged — no
new Rotation mechanic, Player-role concept, or canonical representation. Manual
review confirmed the hierarchy at desktop and mobile widths, correct Postseason
precedence (the Rotation tab showed the controlled Program's actual committed
Postseason Rotation, distinct from its regular-season values, once a Dynasty
reached the completed-Tournament checkpoint), a valid Rotation edit committing
normally, an invalid edit (a Player total pushed past 40) blocking simulation
with a clear per-row indicator, Player-click reuse into Player Details with a
correctly labeled "Back to Coaching" return, and that entering Coaching left
Recruiting period, standings, and every other Dynasty fact unchanged. This
closes the repeated Coaching/Rotation-navigation friction; Game Prep and
Tournament Game Prep are unchanged and remain additive alongside Coaching.

### Simple Rotation UI — RESOLVED (Phase 6E.18C)

Phase 6E.18C presents the 6E.18A/6E.18B foundation and closes this friction
thread. Simple is now the default Coaching Rotation editor: one row per
roster Player with a single total-MPG stepper, grouped into Rotation
Players/Reserves purely by whether the current draft's minutes are positive
or zero — no exact positional bookkeeping required for the common case. The
existing exact positional editor remains available as Advanced, one click
away, for users who want precise position-by-position control.

Manual acceptance across default entry, editing across the Reserves boundary,
an under-200 draft, an over-200 draft, reaching exactly 200 and applying, a
translated infeasible-positional-coverage failure (draft preserved, canonical
unchanged, no raw issue code shown), Discard restoring committed values, and
the same flow during an active Postseason all read as intended: the user
thinks in Player minutes, not position buckets, and the screen requires
substantially less scrolling than the prior default. Starting Five and
Auto/rotation-size presets remain deferred pending further playtesting
evidence — this milestone deliberately tested whether one-total-MPG-per-Player
is already enjoyable before considering either.

### Simple Rotation intent — FOUNDATION COMPLETE (Phase 6E.18A)

The permanent Coaching screen exposed a narrower follow-up friction: exact
position-bucket editing is powerful but makes Players recur at multiple eligible
positions and asks the user to solve 40-minute positional bookkeeping manually.
Phase 6E.18A establishes only the domain foundation for a future simpler editor.
Aggregate Player MPG intent now compiles deterministically into legal existing
Rotation V1 when feasible, globally preferring natural minutes and using
secondary minutes only where necessary. Invalid or incomplete intent produces
structured issues and no canonical-ready Rotation.

Generated production-style evidence round-tripped all 32 sampled legal default
Rotations: collapsing each to Player totals and recompiling produced a legal V1
Rotation with identical Player totals in every case. Positional splits may
differ when several equally preferred solutions exist. Rotation V1, default
generation, commits, and simulation remain unchanged. Starting Five has no
separate simulation meaning, and Auto/rotation-size presets plus the visible
Simple/Advanced editor remain future UX work.

Phase 6E.18B completes the application-state integration without presenting the
new editor. Coaching now keeps a roster-complete Player→MPG draft, including
explicit zeroes from which the future UI can derive Reserves. Temporary totals
such as 198 or 204 remain local until explicit Apply. Only a successful 6E.18A
compile reaches the existing canonical Season/Postseason update boundary;
failure preserves intent and exposes structured issues. Successful Simple and
Advanced commits refresh one another, while invalid drafts remain isolated.
Starting Five, Auto/size presets, and the visible Simple/Advanced experience are
still deferred.

### Projected Starting Five — FOUNDATION COMPLETE (Phase 6E.18D)

Simple Rotation removed positional bookkeeping, but presenting every positive-
minute Player as a peer still obscures the recognizable basketball lineup.
Phase 6E.18D adds a domain projection—not a starter mechanic—that derives one
unique Player at PG/SG/SF/PF/C from the last committed Rotation V1. The exact
assignment is grounded in actual positional minutes and deterministically
resolves dual-position collisions; it is not based merely on OVR, natural label,
or aggregate MPG. It remains stable during uncommitted Simple edits and changes
only after canonical Apply or a valid Advanced commit.

Characterization produced complete unique fives for all 64 generated legal
defaults and all 64 Rotations reconstructed from their aggregate MPG through the
Simple compiler. The position-keyed Player-ID result leaves a clean boundary if
starter status later earns canonical gameplay meaning, but today it is derived,
unpersisted, and simulation-neutral. Manual Starting Five selection and any
starter effects remain future/WATCH; the visible Starting Five/Bench/Reserves
hierarchy is deferred to the frontend phase.

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

Great Lakes follow-up outcomes remained consistent with that decision: Great
Lakes lost in the semifinal as #1 to an approximately `85` OVR #5 Northbridge,
which won the title over #3 Golden Bay; later Great Lakes lost in the
quarterfinal as a #3 automatic qualifier; and a #15 won a title over #12
despite being the League's highest-rated Team after a poor regular season. The
#15 champion illustrates résumé seeding versus roster strength—it does not
reopen seeding or Game Sim.

Great Lakes falling from roughly `89` to `78` Team OVR while Pine Valley rose
from the mid-60s into the low-70s is healthy Dynasty turnover evidence. Recruit
Talent V1 and Development V1 remain closed.

The Charlotte Tech/Northbridge follow-up added more plausible variance:
Charlotte Tech went `24-0` without winning the title; a young Northbridge lost
in Round 1 to a #14, then an `88` OVR Northbridge lost to an approximately `78`
OVR #15, before winning the title in Douglas's senior Season. These anecdotes
do not supersede the accepted Tournament diagnostics or reopen seeding/Game Sim.

## Super Sim — Season Complete Target — IMPLEMENTED / ACCEPTED

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

Phase 6E.11 implemented this exact stop condition through the existing Super
Sim target model and canonical Season/Postseason/Recruiting operations. Focused
lifecycle coverage includes early Season, active Tournament, eliminated and
did-not-qualify controlled Programs, and the already-complete no-op. A paired
deterministic test produced identical regular-season results, Tournament
field/bracket/results/champion, and Recruiting state through Period 28 for
stepwise progression and Super Sim. Automated acceptance is green; no separate
manual playtest was required for this lifecycle-only convenience.

## League News / Round Recap — OBSERVED

A future “Around the Country” recap could derive concise updates from canonical prior-round facts rather than storing permanent prose. Useful events include upsets, big performances, Recruit commitments or lost Focus targets, conference/milestone movement, and Cinderella runs.

Paul Martin's 51-point Season opener was experienced as a missed storytelling
opportunity, not evidence of a Game Sim problem. This strengthens the case for
derived League News/Round Recap, but does not make News the next milestone.

## Offseason — Around the League — OBSERVED

Future offseason context could surface the biggest development jumps, notable returners, and incoming recruits from derived existing data. Do not implement or define a presentation yet.

Northbridge's young core strengthened this signal: the user wanted to inspect
its development changes immediately after the offseason rather than wait for
the next Season, navigate back to Northbridge, and open Players individually.
Treat this as progression visibility from existing outcomes, not new
Development mechanics.

## Awards / Season Honors — OBSERVED — EVIDENCE-SUPPORTED FUTURE

Christian Douglas's elite multi-Season career naturally created an expectation
of Player of the Year, All-Conference, All-American-style, or similar honors.
Awards are now evidence-supported future storytelling, but their rules and
presentation remain undesigned and they do not move ahead of current QOL work.

## Save / Persistence — OBSERVED FUTURE CONCERN

Using browser Back lost an active Dynasty. Current Dynasty progress is
session/in-memory limited, so browser navigation or reload can lose unsaved
progress. Future Save/Persistence work should restore an active Dynasty and
validate navigation/reload behavior, but this anecdote is not evidence that
normal intended in-app navigation destroys state. Do not prescribe storage,
save-slot, backend, or routing architecture here or promote this above 6E.10.

## Program Records / Statistical History — OBSERVED

Future history could include program single-game points, season scoring, and career points/assists. It should follow Player Detail/development-history work rather than precede it.

## UI Polish Checkpoint — RESOLVED (Phases 6E.16A + 6E.16B)

The current Recruiting page has too much vertical separation between navigation,
identity, needs, and Board management. Board capacity is duplicated, the
Positional Needs table carries more visual weight than its importance warrants,
and scattered Board/Focus/Offer guidance is easy to miss. Readiness help also
needs a more coherent long-term home than a large tooltip. The selected direction
is one concise Recruiting overview plus one clear guide/help destination covering
Board, Focus, Offers, Readiness, and standing language. Preserve Board =
management, Battles = intelligence, National Class = discovery; Battles is
working well and National Class needs no redesign.

Phase 6E.16A resolved all of the above: a Recruiting-screen-local wrapper
tightens the vertical rhythm, `RecruitingOverview` replaces the Positional
Needs table with one compact Board/Signed/Openings/Offers/Needs snapshot with
the Board count shown exactly once, and a new `Guide` mode is the one
permanent, discoverable explanation destination for Board, Focus, Offers,
Readiness, and battle standing, replacing the retired Board tooltip and the
scattered helper copy beneath the old Positional Needs section. Board,
Battles, and National Class responsibilities are unchanged.

Late Recruiting has one narrow copy issue: when projected openings are zero,
automatic-resolution warning language is unnecessary. The required Finalize
Class action remains, but the state should read as a completed class with all
projected openings filled. This is presentation only. Phase 6E.16A resolved
this too — the banner and the Finalize Class confirmation dialog both read as
a quiet completed class ("Recruiting Class Complete — All projected roster
openings are filled.") with no auto-resolution warning once openings reach
zero, while the existing warning is preserved when openings remain.

The Season Hub similarly has excess space before primary content. Its Quick Sim
result card changes footprint materially and presents leaders awkwardly; pregame
and result states should read as two dense, stable states of one game card. Focus
rows have an unnecessary gutter, and Recruiting Update remains useful but feels
detached from the Recruiting module. The desired information split is unresolved
Focus Targets versus controlled-Program Commits; a signed Focus Recruit should
move to a compact Commits status instead of remaining presented as active. The
update recap should retain its current session semantics while composing inside
the Recruiting module.

The Hub needs only the controlled Conference snapshot. Recent Results and that
snapshot are narrow enough to compose side-by-side on desktop. League remains
the league-wide destination: Teams already groups Programs by Conference in
standings order, so a new Conference Standings tab would duplicate useful
information. Root League navigation/context chrome can be reduced because the
primary Dynasty nav already establishes location, while Team/Player detail Back
navigation remains useful.

Postseason bracket, National Class, Recruiting Class Complete, and Offseason
received positive/no-action feedback and stay outside this checkpoint, apart
from the narrow zero-openings Late Recruiting copy above.

Phase 6E.16B resolved the Season Hub/League friction above, in two manual-play
passes. First pass: a local `.season-hub` wrapper tightened the Hub's
top-of-page rhythm; `CompletedMatchupCard`'s Game Leaders became a dense
row strip instead of three oversized bordered columns; `RecruitingHubSummary`
gained a `commits` prop (`deriveHubCommitSummaries`) so signed Recruits move
to a distinct Commits list once `deriveFocusTargetSummaries` stops counting
them as unresolved Focus (the filter now requires `status === 'active'`);
`RecruitingCommitmentAlerts` (the Recruiting Update recap) moved inside the
Recruiting module; `ConferenceStandingsSection` dropped its Conference-switch
tabs to show only the controlled Program's standings, composed side-by-side
with Recent Results in a new `.hub-secondary-grid`; and root `LeagueScreen`
dropped its redundant Back button and duplicate `League` heading.

A second manual-play pass then found four remaining rough edges, all now
resolved: (1) the completed Quick Sim card was still visibly taller than the
pregame card, so `Advance to Next Round` jumped down after every simulated
game — fixed by further compacting the completed-game scoreboard and Game
Leaders (narrower ~21rem measure, tighter padding, smaller score/value type)
and giving `.next-game-card` a shared 21rem desktop `min-height` floor sized
to the compacted completed state, so pregame stretches up to meet it;
verified pixel-identical (`round-progress` top offset unchanged) before and
after Quick Sim at desktop width. (2) The completed-game score line had a lot
of dead space between each Team name and its final score because
`.next-game-card__final-scores` spanned the full card width — constrained to
the same ~21rem measure as Game Leaders, so it now reads as one intentional
scoreboard column. (3) Game Leaders also repeated the same Program name and
color dot on all three rows whenever every leader belonged to one Team —
`CompletedMatchupCard` now states that identity once beside the "Game
Leaders" heading and only falls back to per-row Program tags when leaders
actually span multiple Teams. (4) The Hub's Focus Targets `<ul>` still
carried default browser list padding/indentation (`.recruiting-hub-focus__list`
and `.recruiting-hub-commits__list` were missing `margin/padding/list-style`
resets) — both lists now align flush with the rest of the Recruiting module.
The Hub's Conference Standings heading also now names the actual Conference
("Southern Crescent Conference Standings") instead of a generic label.

Manual play confirmed Recruiting's Board/Battles/National Class/Guide, League
Leaders/Teams, Team/Player Details Back navigation, the Postseason Hub's
shared Recruiting/game-card presentation, and narrow-width stacking all
remain healthy after both passes — nothing in this checkpoint reopened
Recruiting mechanics, Conference calculations, League projections, or any
simulation system.

Manual play during this pass also surfaced a **future** signal, not acted on
here: Game Prep feels busy, and a longer-term Coaching information
architecture may make `Roster → Rotation` a more natural stable organization
than `Set Rotation → Roster View` inside Game Prep. This is recorded as
future Coaching-screen/navigation evidence only — Game Prep, Rotation,
Roster, and Coaching navigation are unchanged in 6E.16B.

## Postseason Hub + Season-Complete Presentation Polish — RESOLVED (Phase 6E.10)

Repeated feedback noted awkward Tournament Complete and Season Complete card
placement, excess dead space beneath Tournament Complete, and a visually
disconnected Late Recruiting handoff. Phase 6E.10 moved `SeasonCompleteHandoff`
from a separate full-width section beneath `hub-primary-grid` to a panel
stacked directly under the Tournament outcome banner inside the grid's left
`hub-primary-grid__game` column, and added an `isSeasonComplete` hint
("Late Recruiting is next — this board carries forward.") to
`RecruitingHubSummary` in the right column. The bracket itself is unchanged.

Manual play confirmed the composition for all three controlled-Program
completed states — National Champion, eliminated with another Program
champion, and did-not-qualify — on both desktop (two-column, no meaningful
dead space) and a narrow single-column layout (Tournament outcome → Season
Complete → Recruiting → bracket/field, in that order). This presentation
milestone stayed separate from Tournament balance/seeding; no bracket,
seeding, or Recruiting mechanic changed.

## Minor UX Polish — OBSERVED

Keep below the foundational investigations:

- “Last 5” is preferred to “Last 4.” — RESOLVED by Phase 6E.16B (`RECENT_RESULTS_COUNT` is now 5).
- Seeing current seed would be fun, potential to choose seed when starting dynasty (compete with others on same field)

## Repeated Playtest Friction

Highest-value repeated signals:

- interesting Player careers are difficult to follow across Seasons;
- Recruiting commitments, lost targets, and which signees were backups are easy to miss;
- Focus-target context is not visible enough on the Season Hub;
- Assistant Fill Remaining Board without losing manual choices (RESOLVED by
  Phase 6E.15);
- Rotation deserves a permanent Coaching home (RESOLVED by Phase 6E.17B); and
- Tournament/Season Complete composition and the Late Recruiting handoff
  (RESOLVED by Phase 6E.10 — see above).

Recruiting-page density and guidance friction is RESOLVED by accepted Phase
6E.16A. Hub/League information hierarchy and Quick Sim card stability is
RESOLVED by accepted Phase 6E.16B — Recent Results now shows Last 5 as part
of that pass, closing the separate "Last 5" polish request below. This
deliberate two-milestone UI polish checkpoint is complete; the next
milestone should come from a fresh planning pass over current priorities.

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

1. Followed Players / Favorites
2. Recruit POT-gap diagnostic
3. League News / Round Recap
4. Offseason around-the-league context
5. Program records / deeper statistical history
6. Shot-selection diagnostic
7. Minor Player Details polish

Player Details + Development History UX, Postseason Hub +
Season-Complete Presentation Polish, and Recruiting Focus-target /
commitment visibility presentation (6E.12) are RESOLVED — see above.
Assistant Fill Remaining Board is also RESOLVED by accepted Phase 6E.15.
Coaching / Rotation Navigation is RESOLVED by accepted Phase 6E.17B.
Recruiting Page Density + Guidance Polish is RESOLVED by accepted Phase
6E.16A. Season Hub + League Information Hierarchy Polish is RESOLVED by
accepted Phase 6E.16B.

Premium Offer allocation remains WATCH only and is not part of either UI polish
milestone. Existing future product ideas remain future rather than promoted by
this audit.

Awards, offseason progression visibility, and Save/Persistence have stronger
future evidence but are intentionally not promoted into the active horizon.

This ordering remains playthrough-driven and may change with new evidence.
