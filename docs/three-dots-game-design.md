# Three Dots — Game Design Document

**Date:** 2026-08-06 (concept, originally authored against a Swift/SpriteKit pivot); retargeted to
React Native 2026-08-16 after that pivot was reversed (history: branch `archive/swift-pivot-260816`).
**Status:** Design approved (brainstorm, `--advice` supervised). See "Status vs. shipped code" below
for what's actually built on `main` today.
**Working title:** **Three Dots**
**Supersedes the _concept_ in:** `docs/two-dots-game-design.md`, `docs/two-dots-gameplay-script.md` (kept for history).
**Tech authority:** `CLAUDE.md` (React Native + Expo + Skia + Reanimated + Gesture Handler).
**Consistency authority:** `docs/creative-bible.md`. **Compliance:** `docs/apple-compliance-checklist.md`.

---

## Status vs. shipped code

- **Endless is shipped in full** on `main`: 8-way adjacency, 6×6 board, 3 colors, ≥3-chain clear,
  2×2-loop sweep, the ≥5-line sweep (see "Shipped bonus mechanic" below), deadlock reshuffle, a
  persisted score, no fail state. See `src/core/`, `src/render/`, `src/input/`, `src/effects/`,
  `src/meta/`.
- **Journey (the timed, objective-driven mode described below) is designed here but not yet
  implemented on `main`** — there is no `src/core/journey/` or `src/core/level/` yet. Its contract
  (the level-script shape a loader will parse) is locked in `docs/level-script-schema.md`.
- This doc is written for the whole concept (both modes, the full country/economy vision); read the
  two bullets above before treating anything below as already true of the running app.

## Brainstorm contract

- **Outcome:** A polished casual puzzle game in the Two-Dots lineage — the player's own game,
  **Three Dots** — with a warm **paper-craft** look, **two modes** (relaxed Endless + timed Journey that
  conquers countries city-by-city), and an isometric city backdrop that grows as you progress. Built to a
  "AAA-polish on a simple mechanic" bar. iOS-first; Android ships from the same React Native codebase later
  (see `CLAUDE.md`).
- **Constraints:** **React Native + Expo + Skia + Reanimated** (see `CLAUDE.md`); content/UX **safe for a
  13+ age rating**; **no monetization in the v1 build** (designed but deferred —
  see `docs/monetization-and-roadmap.md`); no backend, online, accounts, or leaderboards in v1.
- **Non-goals (v1 build):** monetization / ads / IAP (designed, deferred); online / leaderboards /
  accounts / cloud-save; narrative or per-country characters; 3D or physics simulation. Architecture must
  not block these later.
- **Acceptance criteria:**
  - Core drag-link-clear-gravity loop runs at **60fps during drag + cascade** on a mid-tier iPhone (device, not sim).
  - **Endless** plays as a calm, un-timed flow experience; **Journey** plays as a timed challenge where a
    mistake subtracts time — both feel distinct and intentional.
  - The **v1 vertical slice** (Endless + one country's first city) is playable end-to-end on device
    and every applicable compliance item is satisfied before first TestFlight submission.

---

## Core mechanic — "Three Dots"

Same drag-to-link family as Two Dots, tuned to the "three" identity:

- The board is a grid of colored dots on a **paper-craft surface**.
- Drag through **adjacent same-color dots** — **8-way (orthogonal AND diagonal)** — to build a chain.
  **Locked decision:** the original concept spec called for 4-way/no-diagonals; the shipped core
  (`src/core/hot/adjacency.ts`) is 8-way, and code wins — this doc was corrected to match, not the
  other way around. Any future adjacency change is a bugfix with a regression test first, never a
  silent doc edit.
- A chain **clears on release** once it meets the length rule.
- **The "three" rule:** a chain must be **≥3** dots to clear (vs Two Dots' ≥2) — the game's namesake
  identity and its core difficulty knob. This already ships as `DEFAULT_CONFIG.minChain = 3`
  (`src/core/config.ts`); the engine treats it as a config value, not a constant, so a per-mode
  override remains possible without a code change.
- **Loop clear (signature move):** closing a loop (a chain that encloses a square of that color) **clears
  every dot of that color** on the board — the big, satisfying payoff.
- **Shipped bonus mechanic — straight-line sweep.** A straight run of **≥5** linked dots (any of the 8
  directions; `lineLength` in `GameConfig`) also sweeps every dot of that color board-wide, exactly
  like a loop clear. This mechanic was not in the original concept spec — it shipped ahead of this
  doc (`ChainKind: 'line'`, `ClearReason: 'color-sweep'` — see `src/core/resolve/classify-chain.ts`
  and `src/core/resolve/collect-cleared.ts`) and is kept as a deliberate addition. **Flagged for
  on-device tuning:** with only 3 colors on a 6×6 board, a straight run of 5 is easy to draw by
  accident, so expect to raise `lineLength` or lower `sweepMultiplier` (see the tuning comment in
  `src/core/config.ts`) once more colors and Journey levels are in play.
- After any clear: **gravity** (survivors fall) → **refill** (new dots drop from the top). Cascades can chain
  into combos.

> **Note — namesake vs feel:** ≥3 is the shipped default and the identity hook. If it hurts the relaxed
> Endless feel, the minimum is a per-mode config (e.g. Endless ≥2 for flow, Journey ≥3 for challenge) rather
> than a code change.

## The two modes (and the timed-play decision)

**Named design decision — timing is scoped, not global.** The brief asked for both "relaxed like Two Dots"
_and_ "limited time, a mistake reduces time." Those are opposite feels, so they are **split by mode** on
purpose:

|                         | **Endless** (relaxed)                            | **Journey** (timed challenge)                          |
| ----------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Feel                    | Calm, flow-state — the reason Two Dots is loved  | Goal-driven pressure; the game's "conquer" spine       |
| Timer                   | **None.** Score-attack; play as long as you like | **Yes.** Per-level time budget                         |
| Mistakes                | No penalty                                       | An **invalid attempt subtracts time** (small, tunable) |
| Goal                    | High score / personal best (local)               | Complete each city's objective before time runs out    |
| Economy home (deferred) | —                                                | "Buy more time" tokens, obstacle-clearing power-ups    |
| Progression             | Endless single board                             | World map → countries → cities → capital               |

Rationale: two distinct feels widen appeal (calm players _and_ challenge players), preserve the beloved
relaxed niche, and give the future economy a clean home in Journey without taxing Endless.

## Journey structure — conquer the world

- **World map:** a stylized paper map of the world. Countries unlock left-to-right along a route.
- **Chapter = country.** Each country is a chapter of **10–15 levels**. _(Build order: ship the first
  city as the playtest slice, then fill to 10–15 — see v1 scope.)_
- **Level = city.** Each city is a distinct hand-authored challenge (unique board size, colors, objective,
  obstacle mix) — the reason we need a **level-script schema** (`docs/level-script-schema.md`) and a
  `level-designer` agent, not procedural levels.
- **Capital = chapter finale.** The last level of each country is its capital — the hardest, most decorated board.
- **City backdrop that grows:** beneath the playfield sits a **2D isometric city** (the "lego-metropolis"
  concept). Buildings unlock/light up as the player clears that city's levels, so progress is visible in the
  world, not just a number. Rendered as parallax isometric sprite layers on the same Skia canvas the board
  uses — no 3D engine.

## Timed-play rules (Journey only)

- Each city level starts with a **time budget** `T` (per-level, authored in the level script).
- **Objectives** (authored per level): e.g. _clear N red dots_, _free all caged dots_ — Two-Dots/Candy-lineage
  goals, one or more per city. See `docs/level-script-schema.md` for the exact objective kinds a level can
  author today. A `clearColor` objective counts only an **actual pop** of its color: chipping a multi-layer
  cage of the target color (peeling a layer without freeing the dot) does **not** advance it — only the pop
  when the cage finally breaks, plus any uncaged dots cleared, counts.
- **Mistake penalty:** an invalid link attempt (wrong color / non-adjacent, or a chain shorter than
  `minChain` on release) subtracts a small amount of time. Exact value tuned on-device; authored as a
  level/global config.
- **Win:** objective met before time hits 0. **Lose:** time hits 0 with objective unmet.
- **Stars/score:** time remaining and efficiency drive a 1–3 star rating (feeds the deferred economy and replay).
- **Fair-loss principle (13+ / App Review):** losses come from the clock and the player's choices, never from
  randomized paywalled outcomes. Power-ups (deferred) are **deterministic** — see monetization doc.

## Obstacle catalog (v1 seed — extend per country)

Obstacles live in the level script and are introduced gradually (one new idea per early city):

| Obstacle            | Behavior                                                                                                                                                                                                                                                                                      | Clears when                                                                                                                                                                                                                                                                                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caged dot**       | A dot wrapped in a paper cage of 1+ layers. It **stays linkable** — a caged dot can be part of a same-color chain. Each clear of its color that includes it peels one layer (a "chip"); it pops and frees only when the last layer is peeled. The remaining layer count is drawn on the cage. | Peeled by clears of its color — a normal chain, a loop-sweep, or a line-sweep. A loop/line color-sweep peels one layer from EVERY same-color cage at once (freeing any then on their last layer). A 1-layer cage frees on the first such clear (unchanged from the original intro). See `docs/level-script-schema.md` for the `layers` field and exact freeing semantics. |
| **Anchor / weight** | Occupies a cell, falls with gravity but isn't linkable                                                                                                                                                                                                                                        | Cleared by an adjacent chain per rule (tunable)                                                                                                                                                                                                                                                                                                                           |
| **Locked tile**     | A cell that can't hold a dot until unlocked                                                                                                                                                                                                                                                   | Unlock condition met (e.g. N nearby clears)                                                                                                                                                                                                                                                                                                                               |
| **Color lock**      | Region temporarily restricted to certain colors                                                                                                                                                                                                                                               | Objective/step reached                                                                                                                                                                                                                                                                                                                                                    |

The v1 slice ships **one** obstacle (the **caged dot**) fully; the rest are catalog entries the
`level-designer` and schema support in design but aren't yet in the validated schema (see
`docs/level-script-schema.md`'s obstacle-type note). Keep the catalog small until the timed loop is proven.

**Layered cages & first teach.** A cage carries 1+ layers (see the `layers` field in
`docs/level-script-schema.md`). The Voyage ladder derives cage depth by band — `{ teach: 1, mid: 2, boss: 3 }`,
boss-first, so the whole first (teaching) episode is 1-layer except an authored override — while the multi-layer
mechanic is introduced **gently, pre-boss**: a low-stakes seeded 2-layer teaching cage on the pre-boss level
(and Journey's japan-01), **not** on the L10 Caged Core boss. The first time a player meets any `layers ≥ 2`
cage, a one-time, dismissible popup ("don't show again", per install) explains that clearing the color peels a
layer. Every generated + boss level, and any curated level carrying a multi-layer cage, is solver-swept to stay
provably winnable under its budget (see `docs/tech-stack-and-infra.md`).

## Art direction (summary — full rules in the creative bible)

- **Paper-craft world:** dots, board, cages, and city read as cut/folded textured paper — warm, tactile, handmade.
- **Characters = dot & board skins + one light mascot.** No narrative or per-country characters. Personality
  lives in the dots, the paper board, the isometric cities, and a single simple mascot used for branding /
  app icon / light Journey framing (map intro, win/lose reaction). Smallest, most focused art scope.
- **Accessibility (HIG + 13+):** never rely on color alone — dots carry a **shape/pattern** as well as color
  (colorblind-safe); ≥44×44pt touch targets; reduced-motion respected. **This is a design target, not a
  shipped guarantee** — the current renderer draws plain circles; see `docs/creative-bible.md` §2.2 for the
  shipped-status annotation.
- All look/feel/tone rules and the locked palette live in `docs/creative-bible.md` (the anti-drift authority).

## v1 vertical-slice scope

**In:** Endless (relaxed, score + local best — **shipped**) · Journey with **one country (Japan)**, built
**one city first** (then filled toward 10–15) · caged-dot obstacle · timed-level + mistake-penalty loop ·
paper-craft board + one isometric city backdrop that grows · dot/board skins + mascot · title / world-map /
level / results / settings screens · local persistence (best score, stars, unlocks).

**Explicitly out (deferred, not blocked):** monetization/ads/IAP · additional countries · additional
obstacles beyond caged dot · Game Center · online.

**Build order (de-risk the timed loop first):**

1. Pure-TS core: grid, adjacency, ≥3 chain, loop-clear, gravity, refill, scoring (+ unit tests). **Shipped.**
2. Skia render + drag input (Reanimated worklets + Gesture Handler) on device; prove 60fps drag+cascade. **Shipped.**
3. Endless mode (relaxed) end-to-end + persisted score. **Shipped.**
4. Journey timing: timer, mistake penalty, objectives, one caged-dot city — **playtest the feel** on device.
5. Isometric city backdrop that grows; world map; results/stars; more cities.
6. Polish pass (juice, audio, haptics) → fill toward 10–15 cities.

Steps 4–6 are not yet built (see "Status vs. shipped code" above).

## Deferred vision (designed, post-v1)

More countries (each a chapter) · full obstacle catalog · deferred economy (remove-ads, extra-time tokens,
deterministic power-ups — `docs/monetization-and-roadmap.md`) · Game Center. The pure-TS core and the
level-script schema are built to accommodate all of these without rework.

## Open questions

1. **Exact minimum chain length** (≥3 global vs per-mode ≥2/≥3) — resolve on-device during tuning.
2. **Timer/penalty constants** (start `T`, per-mistake seconds, star thresholds) — tune on-device.
3. **Board size / color count per city** — authored per level; seed defaults set during core build.
4. ✅ **Resolved — v1 slice country = Japan** (origami / washi synergy with the paper-craft identity; iconic
   isometric landmarks — Tokyo = capital finale). Palette + building kit drawn from the Japan reference.
