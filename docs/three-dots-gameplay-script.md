# Three Dots — Gameplay Script (Beat-by-Beat)

**Date:** 2026-08-18
**Status:** Current gameplay walkthrough for the shipped **Endless** experience.
**Supersedes:** [`docs/two-dots-gameplay-script.md`](./two-dots-gameplay-script.md) (kept for history —
that script was built around a countdown timer + game-over, which **Endless does not have**).
**Design authority:** [`docs/three-dots-game-design.md`](./three-dots-game-design.md).
**Look/feel authority (LOCKED):** [`docs/creative-bible.md`](./creative-bible.md).
**Engine map:** [`docs/tech-stack-and-infra.md`](./tech-stack-and-infra.md) → _`src/` architecture map_.

> **Scope.** This walkthrough covers **Endless** — the mode shipped on `main`: score-attack,
> **no fail state**, no timer, no game-over screen. **Journey** (timed, objective-driven, world-map)
> is designed and its timed beats live in the design doc (§ _Timed-play rules_); they are **not**
> duplicated here. This script reflects the shipped rules; where a number is tunable it links the
> config, it does not re-decide it.

## Legend — engine layers (where each beat lives)

| Tag         | Layer                                  | Responsibility                                                                                             |
| ----------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **core**    | `src/core/` (pure TS, RN-free)         | grid model, 8-way adjacency, chain/loop/line validation, clear→gravity→refill, scoring, deadlock reshuffle |
| **render**  | `src/render/` (Skia)                   | draw dots + the active link path                                                                           |
| **input**   | `src/input/` (Gesture Handler worklet) | touch xy → cell; build/commit/cancel chain                                                                 |
| **effects** | `src/effects/` (Reanimated + Skia)     | pop, fall/spawn slide, shuffle slide, reduce-motion                                                        |
| **meta**    | `src/meta/` + `src/app/`               | title, HUD (score only), settings, persistence                                                             |
| **persist** | MMKV (`score-storage.ts`)              | the score (key `'score'`) — no separate "best"                                                             |

Shipped board = **6×6**, **3 colors** (`DEFAULT_CONFIG` in `src/core/config.ts`; both tunable).

---

## Section A — Screen flow (Endless)

| #   | Screen                  | Player action               | System response                                          | Juice / FX                   | Maps to                   |
| --- | ----------------------- | --------------------------- | -------------------------------------------------------- | ---------------------------- | ------------------------- |
| SF1 | Title (`app/index.tsx`) | (app launch)                | Title shows logo, **Play**, **Settings**                 | logo settle, buttons fade-in | meta                      |
| SF2 | Title → Game            | tap **Play**                | navigate to Game; board fills; HUD shows score           | staggered dot drop-in        | meta, render, core (init) |
| SF3 | Game (`app/game.tsx`)   | (play — Section B)          | —                                                        | —                            | all                       |
| SF4 | Game ↔ Settings         | tap **Settings** / **Back** | Settings (e.g. reduce-motion, reset score); Back returns | slide                        | meta, effects             |

There is **no Game-Over screen** — Endless never ends by failure. (A separate **Journey** screen,
`app/journey.tsx`, hosts the timed mode; see the design doc.)

---

## Section B — Gameplay beats (inside the Game screen)

| #    | Phase                 | Player action                                                               | System response                                                          | Juice / FX                           | Maps to                                                                    |
| ---- | --------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------ | -------------------------------------------------------------------------- |
| GP1  | Board fill            | —                                                                           | 6×6 grid spawns random-color dots (3 colors)                             | dots drop + settle bounce            | core (init), render, effects                                               |
| GP2  | Idle                  | —                                                                           | HUD shows the **score** (no timer, no best)                              | calm ambient                         | meta (HUD)                                                                 |
| GP3  | Chain start           | press a dot                                                                 | dot highlights + scales; chain = `[cell]`                                | ring + scale-up                      | input, effects                                                             |
| GP4  | Extend chain          | drag to an **adjacent same-color** dot — **8-way (orthogonal OR diagonal)** | cell appended; **link path** drawn between centers                       | link line animates in                | input, core (`hot/adjacency`, `can-append`), render                        |
| GP5  | Grow                  | keep dragging valid cells                                                   | chain grows                                                              | path extends; dots pulse in sequence | input, core, render                                                        |
| GP6  | Invalid               | drag to a different color / non-adjacent cell                               | cell **rejected**; nothing appended                                      | brief muted cue on the cursor dot    | input, core (`can-append`), effects                                        |
| GP7  | Backtrack             | drag back onto the previous dot                                             | chain pops its last cell (un-links)                                      | link segment retracts                | input, core                                                                |
| GP8  | Clear (chain **≥3**)  | release                                                                     | the chained dots **pop/clear**; score += `f(length)`                     | scale-out + burst per dot            | core (`resolve/scoring`, `collect-cleared`), effects, render               |
| GP9  | Cancel (chain **<3**) | release below `minChain`                                                    | no clear; chain resets                                                   | dots ease back to rest               | input, core (`config.minChain`), effects                                   |
| GP10 | **Loop sweep**        | close a loop enclosing a 2×2 square of that color                           | **every dot of that color on the board clears**                          | flash + mass burst                   | core (`hot/closes-square`, `collect-cleared`), effects, render             |
| GP11 | **Line sweep**        | draw a **straight run of ≥5** linked dots (any of the 8 directions)         | **every dot of that color clears** — same big payoff as a loop           | flash + mass burst                   | core (`hot/is-line`, `classify-chain`, `collect-cleared`), effects, render |
| GP12 | Gravity               | (auto, after any clear)                                                     | survivors fall to fill the gaps                                          | fall + bounce ease                   | core (`resolve/gravity`), effects, render                                  |
| GP13 | Refill                | (auto, after gravity)                                                       | new dots drop from the top into empty cells                              | staggered drop-in                    | core (`resolve/refill`), render, effects                                   |
| GP14 | Combo                 | a cascade immediately clears again from the refill                          | chained clears stack; bonus points                                       | combo flair                          | core (scoring), effects, meta (HUD)                                        |
| GP15 | Deadlock              | board reaches a state with **no legal chain**                               | board **reshuffles** in place (no fail, no penalty)                      | shuffle slide                        | core (`deadlock`, `shuffle`), effects, render                              |
| GP16 | Score persist         | (auto)                                                                      | the current score is written to MMKV (`'score'`) so it survives relaunch | —                                    | meta, persist                                                              |
| GP17 | Reduce motion         | OS "reduce motion" on                                                       | juice tweens are softened/skipped; play unaffected                       | reduced FX                           | effects (`use-reduce-motion`)                                              |

---

## Scoring & flow rules (shipped core)

- **Chain score:** grows with chain length; the signature payoff is a **color sweep** (loop or ≥5-line),
  scaled by how many dots it wipes (`sweepMultiplier`). Exact curve is a config value, tuned on-device.
- **The "three" rule:** a chain must be **≥3** to clear (`DEFAULT_CONFIG.minChain = 3`) — the namesake
  identity and the core difficulty knob; treated as config so a per-mode override needs no code change.
- **No timer, no fail:** Endless is zen. A dead board reshuffles rather than ending the run.
- **Line-sweep tuning flag:** with only 3 colors on 6×6, a straight run of 5 is easy to draw by accident —
  expect to raise `lineLength` or lower `sweepMultiplier` once more colors / Journey levels land
  (`src/core/config.ts`).

## Out of scope (this artifact)

Journey's timed beats + objectives + obstacles (owned by the design doc + `level-script-schema.md`);
final art/audio (LOCKED rules in the creative bible); exact tuning constants (on-device).

## Open questions

- Chain minimum — global ≥3 vs per-mode ≥2 (Endless) / ≥3 (Journey). Resolve on-device (design doc Q1).
- Line-sweep threshold / sweep multiplier once color count rises (design doc § core mechanic).
