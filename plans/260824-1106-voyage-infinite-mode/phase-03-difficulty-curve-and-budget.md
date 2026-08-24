---
title: 'Phase 3: Difficulty curve and budget'
status: done
phase: 3
priority: P1
effort: '1d'
dependencies: [1]
---

# Phase 3: Difficulty curve and budget

## Overview

Build the pure math that turns a level index into a **difficulty target**, and that target into a
**point budget** spendable across gameplay dials. This is the engine the generator (Phase 4) draws
from: same target `D`, different spend = fair difficulty with visible variety.

## Requirements

- Functional:
  - `curve(index) → d` (a float, roughly `0..1.2`): rises over ~150 levels then plateaus; **within
    each block of 10** it adds a gentle intra-block rise (1→9), a **boss spike at 10** (`+0.35`), and
    a **relief dip at 11**. Deterministic — index in, number out, no RNG.
  - `budget(d) → D` where `D = round(10 · d)` — the integer points a level may spend.
  - `spend(D, profile, rng) → dials` distributes `D` across the priced dials, returning a concrete
    `{ colors, minChain, obstacleCount, movesTighten }` shaping vector. Pricing (approved model):
    colors cost **2 pts** each above the base of 3, an obstacle costs **1 pt**, tightening the move
    budget one step costs **1 pt**, raising `minChain` 3→4 costs **3 pts**.
  - A `profile` biases the spend toward one axis (e.g. "obstacle-heavy", "tight-moves") so equal-`D`
    levels feel different; unspent points fall back to the cheapest legal dial.
- Non-functional:
  - Pure TS in `src/core/voyage/`, zero RN/Skia imports, fully Vitest-tested. Deterministic given
    `(index)` for the curve and `(D, profile, seed)` for the spend.
  - Every emitted dial vector must stay inside the schema's legality envelope (`colors ≤ paletteSize`,
    `minChain ∈ [2,4]`, `colors × minChain ≤ rows × cols`) — the spender clamps, never emits illegal.

## Architecture

Three small pure modules under `src/core/voyage/`:

- `difficulty-curve.ts` — `curve(index)`: `base(index)` (a saturating ramp, e.g.
  `1.2 · (1 − e^(−index/60))`) plus the block modifier keyed on `index % 10`. One function, table-free.
- `difficulty-budget.ts` — `budget(d)` and `spend(D, profile, rng)`. The spender is a greedy priced
  allocator over the dial list, ordered by the profile's weights, clamped to legality.
- `voyage-config.ts` — the shared constants (`BASE_COLORS = 3`, dial prices, boss bump `0.35`, plateau
  length, base move budget) and the `DifficultyProfile`/`DialVector` types, so Phase 4 imports one
  source of truth. The color dial spends from `BASE_COLORS` up to the injected `paletteSize` — now the
  **extended palette (up to 5 hues, Phase 6)**, so colors give real difficulty headroom into mid-game
  rather than maxing out by ~level 3.

Determinism note: `spend` takes an explicit `rng` (the same seeded PRNG the core already uses) so the
generator can reproduce a level from its index alone.

## Related Code Files

- Create: `src/core/voyage/difficulty-curve.ts`, `src/core/voyage/difficulty-budget.ts`,
  `src/core/voyage/voyage-config.ts`
- Create: `src/core/voyage/difficulty-curve.test.ts`, `src/core/voyage/difficulty-budget.test.ts`
- Reference (do not change): `src/core/rng.ts` (or the shipped PRNG the core uses), `src/core/config.ts`
  (`DEFAULT_CONFIG` base board/move numbers), `src/core/level/level-script.ts` (the legality envelope
  the spender must respect)

## Implementation Steps

1. `voyage-config.ts` — constants + `DifficultyProfile`/`DialVector` types.
2. `difficulty-curve.ts` — `curve(index)` = saturating base + `index % 10` block modifier (rise 1→9,
   `+0.35` at 10, dip at 11).
3. `difficulty-budget.ts` — `budget(d) = round(10·d)`; `spend(D, profile, rng)` greedy priced
   allocator with legality clamps and cheapest-dial fallback.
4. Tests: curve monotone-then-plateau across a block; boss index is the local max; `spend` never
   exceeds `D`, never emits an illegal dial vector, and is deterministic for a fixed seed; different
   profiles at equal `D` produce different vectors.

## Success Criteria

- [x] `curve` is deterministic and shows the intra-block rise + boss spike + relief dip.
- [x] `budget(d) = round(10·d)`; `spend` respects prices and never overspends or emits an illegal dial.
- [x] Same `D`, different `profile` ⇒ measurably different dial vectors (variety lever proven in unit).
- [x] Zero RN/Skia imports; `npm test` + `npm run typecheck` green.

## Risk Assessment

- **Spend can request an illegal board** (too many colors for the grid, `minChain` out of range).
  Signal: a generated level fails `parseLevelScript` in Phase 4's CI sweep. Response: the spender
  clamps each dial to the legality envelope before emitting; a property test asserts every
  `(D, profile, seed)` in range yields a schema-legal vector.
- **Curve tuning is guesswork until playtested.** Signal: early levels feel too hard/soft on-device.
  Response: keep every constant in `voyage-config.ts` (one edit point); real values come from the Phase 5
  solver sweep + playtest, not from this draft.
