---
phase: 4
title: 'Solver winnability and recalibration'
status: done
priority: P1
effort: '1d'
dependencies: [2, 3]
---

# Phase 4: Solver winnability and recalibration

## Overview

Teach the winnability solver that a caged cell now takes N clears, not one, then re-run the generation
sweep and re-calibrate per-band move/time/mistake budgets so every **generated + boss** ladder level —
plus any curated level carrying a `layers ≥ 2` cage — still proves `won: true`. (Purely 1-layer curated
non-boss levels return raw from `generate-level.ts:214-221` and are NOT swept — behaviourally unchanged;
red-team F9. The **seeded pre-boss Voyage teaching cage** from Validation S1 is a `layers: 2` curated
level, so it is now the exception routed through `calibrateLevel` and swept.) This is the guard that
layered cages didn't quietly make a level impossible.

<!-- Updated: Validation Session 1 - curated levels with a multi-layer cage route through calibrateLevel; boss-unwinnable fallback = reduce cage count first, keep 3 layers -->

## Requirements

- Functional:
  - The solver carries the caged **Map** (layers), not a Set, through its search state, mirroring the
    runtime fold from Phase 3.
  - **The real seam is `solver.ts:148`** — today `resolveChain(settled.game, pickBest(...).chain)` is
    called with **no protected set** (red-team F2). It must become `resolveChain(game, chain,
protectedOf(caged))`, the identical call the hook makes via `resolveCagedChain`. Without this the
    solver clears caged cells in one hit while the runtime chips them — the sweep would pass while the
    boss ships unwinnable.
  - `objectiveGain` (`solver.ts:61-80`) currently reads `caged.has(cell)` — change to **`caged.get(cell)`**
    and credit **layer removals / chips**, not only frees (red-team F2): `has()` over a Map is truthy for
    a multi-layer cage that only chipped, over-crediting a full free. The per-move objective delta counts
    `(layers before − layers after)` summed across cages, so a 3-layer cage contributes 3 units of
    `freeCaged` progress over its life. `scoreMove` (`:92-104`) builds its cleared set locally
    (`cellsOfColor`/`new Set(move.chain)`); feed those same index sets to the pure **`chipLayersInner`**
    helper from Phase 3 so the solver's alloc-free heuristic and the runtime share ONE freeing rule (the
    level-83 divergence lesson).
  - **`clearColor` in the solver counts only actual pops** — mirror the runtime (red-team F13, user
    decision): the solver's `clearColor` objective delta reads only cells in the resolved `cleared` set,
    never chipped (protected) cells, exactly as `foldObjectives` does. Document the shared rule at both
    sites so they can't drift.
  - **Curated levels recalibrate only when they carry a multi-layer cage** (red-team F9, Validation S1):
    `generate-level.ts:214-221` today returns curated non-boss levels **raw**
    (`isBossIndex(index) ? calibrateLevel(...) : level`). Widen that condition so a curated level
    containing any `layers ≥ 2` cage ALSO routes through `calibrateLevel`
    (`isBossIndex(index) || hasMultiLayerCage(level) ? calibrateLevel(...) : level`); purely 1-layer
    curated levels still return raw (byte-identical). The **seeded pre-boss teaching cage** (default L5,
    `layers: 2`) is the concrete instance — it must be proven `won: true` once protection is live, not
    left unchecked. Prefer this predicate over hard-coding a level index so future authored multi-layer
    curated cages are covered automatically.
  - Re-run `generation-sweep.test.ts` and `calibration.test.ts`; recalibrate budgets with the existing
    `calibrateBudget` / `calibrateConstraint` helpers until every **generated + boss** level wins. Boss
    (3-layer × 8 cages) needs the largest bump; mid (2-layer) a moderate one; teach (1-layer) none.
- Non-functional: budgets live where they already live (`voyage-config.ts` / difficulty tables); do
  NOT re-price the obstacle in `difficulty-budget.ts` (Phase 2 decision — layers are a separate axis,
  the solver expresses their cost through required clears, not a static point). No `any`.

## Architecture

The solver is a mirror of the runtime resolution loop; the single most important property is that it
resolves chains through the SAME `resolveChain(game, chain, protectedOf(caged))` + `chipLayers` fold
as the hook. If the solver used a private freeing rule, a level could pass the sweep and be unwinnable
on device (or vice-versa). So Phase 3's `chipLayers`/`protectedOf` are imported, not re-implemented.

Recalibration is mechanical: run the sweep, read which levels fail and by how much (moves short / time
short), bump that band's budget via the calibration helper, re-run, converge. Record the final
per-band numbers in the phase result so Phase 7 docs can cite them.

## Related Code Files

- Modify: `src/core/voyage/solver.ts` (caged Map in search state; **`:148` resolve call gains
  `protectedOf(caged)`**; `objectiveGain` `:61-80` reads `caged.get` + counts chips via shared
  `chipLayersInner`; `scoreMove` `:92-104` feeds its local cleared/protected sets to `chipLayersInner`;
  `clearColor` counts only pops)
- Modify: `src/core/voyage/voyage-config.ts` (recalibrated per-band budgets, if the numbers move)
- Reference (do not edit for pricing): `src/core/voyage/difficulty-budget.ts`
- Modify: `src/core/voyage/generate-level.ts:214-221` (widen the curated-bypass so a level with any
  `layers ≥ 2` cage routes through `calibrateLevel`; purely 1-layer curated levels still return raw —
  Validation S1)
- Tests: `solver.test.ts` (chip-aware objectiveGain), `generation-sweep.test.ts`,
  `calibration.test.ts` (all levels `won: true`)

## Implementation Steps (test-first)

1. **Red:** `solver.test.ts` — on a tiny hand-built level with one 2-layer cage, assert the solver
   reports `won: true` only when the plan clears that cage's colour **twice**, and that `objectiveGain`
   returns 1 unit of freeCaged progress per chip (not 0 until the final pop, not the full N at once).
2. **Red (parity — pin the REAL seam, red-team F2):** the naive "solver board == `applyVoyageResolution`
   board" check is worthless — `solver.ts` imports the same `applyVoyageResolution`, so it compares a
   function to itself and passes even if the solver never passes protection. Instead assert the two
   things that actually diverge: (a) the solver's resolve call returns `protectedHits` for a multi-layer
   caged chain — i.e. it really calls `resolveChain(game, chain, protectedOf(caged))`, not the 2-arg form
   (a solver that dropped protection yields empty `protectedHits` and pops the cage → test fails); and
   (b) `objectiveGain` returns exactly `(layersBefore − layersAfter)` for a chip (1 for a 2-layer cage's
   first hit, not 0 and not 2), computed through the shared `chipLayersInner`.
3. **Green:** thread the Map, import `chipLayers`/`protectedOf`, update `objectiveGain`.
4. **Green:** run `generation-sweep.test.ts`; for each failing level, bump its band budget via
   `calibrateBudget`/`calibrateConstraint`; re-run until all green. Capture final numbers.
5. Run full `npm test` + `npm run coverage:diff` (winnability suites are the coverage anchor here).

## Success Criteria

- [x] `objectiveGain` reads `caged.get` and credits each chip as one unit of freeCaged progress (test)
- [x] `clearColor` in the solver counts only actual pops, never chips — matches `foldObjectives` (test)
- [x] Solver resolve passes `protectedOf(caged)` — parity test proves it returns `protectedHits`
      for a multi-layer chain (not the trivial applyVoyageResolution-vs-itself check)
- [x] `generation-sweep.test.ts` + `calibration.test.ts`: every generated + boss level `won: true`,
      plus the seeded `layers: 2` curated teaching level (routed through `calibrateLevel`, Validation S1)
- [x] If the boss proves unwinnable, cage count was reduced first (3 layers kept); layer reduction only
      as a last resort — the pulled lever + value recorded (Validation S1). **Not exercised** — boss
      converged at the full 8 cages × 3 layers (see Completion notes).
- [x] Recalibrated per-band budgets recorded in the phase result (see Completion notes — budgets are
      solver-derived at runtime, so recorded qualitatively, not as pinned constants)
- [x] No change to `difficulty-budget.ts` obstacle pricing (working tree confirms it untouched)
- [x] `npm test` + `coverage:diff` green; no `any`

## Completion notes (2026-08-25)

Recorded qualitatively on purpose: the per-band budgets are **solver-derived at runtime** by
`calibrateLevel` (widening from the `SOLVER_*` knobs until `won: true`), not stored as a per-band
budget table. The test suites assert **winnability** (`won: true`) and `movesUsed > 0`, not specific
move/time counts — so specific numbers are not test-pinned facts and are deliberately not asserted here.

- **Solver/runtime parity (F2) — verified in source, not just tests.** `solver.ts` imports
  `chipLayersInner` + `protectedOf` from `../obstacles/caged-dot` (one shared freeing rule, no private
  copy). The resolve seam passes `protectedOf(settled.caged)` into `resolveChain` — the identical
  protected set the runtime hook feeds via `resolveCagedChain`. `objectiveGain` builds
  `protectedOf(caged)` and credits `(layersBefore − layersAfter)` per chip via `chipLayersInner`;
  `clearColor` counts only true pops (never protected/chipped cells), mirroring `foldObjectives` (F13).
- **Winnability sweep passes** for every generated + boss ladder level and the seeded `layers: 2`
  curated pre-boss teaching level (routed through `calibrateLevel` because `hasMultiLayerCage` is true).
- **Sweep palette aligned to the shipped runtime palette (6).** Code review flagged that
  `generation-sweep.test.ts` / `calibration.test.ts` proved winnability at `PALETTE = 5` while the app
  ships at `DOT_COLORS.length = 6`. Verified empirically that all 1..200 ladder levels (including the
  cage-free color-rush bosses, the only palette-divergent case) still solve `won: true` at palette 6,
  then set both sweeps to `PALETTE = 6` (literal, to keep core tests RN-free). The winnability proof now
  covers the exact artifact the player sees. Test-only change; no runtime behaviour touched.
- **Boss converged at full depth — S1 fallback NOT triggered.** "The Caged Core" ships its full
  `CAGED_CORE_CAGES = 8` bottom-anchored cages, all at `CAGE_LAYERS.boss` (= 3 layers → 24 required
  chips), and is proven `won: true` at that depth. `boss.test.ts` asserts `obstacles` has length 8, so
  neither lever from the Validation S1 fallback (reduce cage count first, then layers) was pulled —
  no cage-count or layer reduction was needed.
- **Config knobs unchanged from their designed values:** `SOLVER_PERCENTILE = 0.75`,
  `SOLVER_SLACK = 0.5`, `SOLVER_BOSS_SLACK = 0.8`, `CAGE_LAYERS = { teach: 1, mid: 2, boss: 3 }`.
- **On-device feel flag (watch, not a pinned assertion):** the default L5 pre-boss teaching level was
  hand-authored generously but is now solver-calibrated to a tighter move budget once layer-protection
  is live. Because that budget is solver-derived at runtime, treat it as a feel item to confirm on
  device — a tight-but-fair 2-layer teaching moment, not a walkover and not a wall — rather than a fixed
  number. (Per the Risk Assessment "budget inflation" note: flag any band that needed an outsized bump.)

## Risk Assessment

- **Solver/runtime divergence (level-83 lesson).** Two freeing rules drift and the sweep lies. Signal:
  a level passes the sweep but on-device the cage won't free (or frees early). Response: there must be
  exactly ONE `chipLayers`/`protectedOf`; the parity test in step 2 is the tripwire — if it fails,
  stop and unify before touching budgets.
- **Budget inflation makes levels trivial.** Over-bumping a band to force `won: true` could make the
  level a walkover. Signal: solver wins with large slack (moves/time remaining far above the intended
  tension). Response: bump to the minimum that wins, keep the calibration helper's target tension band;
  note any level that needed an outsized bump as a design flag for on-device feel-check.
- **Boss unwinnable at 3×8.** 24 required chips may exceed any reasonable budget. Signal: boss can't
  reach `won: true` at a sane move count. Response (Validation S1, ordered): **reduce cage count first,
  keeping 3 layers** — preserves the boss as the peak of the layer mechanic, distinct from the 2-layer
  mid band. Reduce the layer count (3 → 2) only as a last resort if fewer-cages alone can't converge.
  Either lever is a Phase-2 constant; re-sweep and record which was pulled and to what value.
