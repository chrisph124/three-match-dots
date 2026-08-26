---
phase: 4
title: 'Solver + generator (winnability)'
status: done
priority: P1
effort: '5h'
dependencies: [3]
---

# Phase 4: Solver and generator (winnability)

## Overview

Teach the Voyage engine about anchors so generated levels are provably winnable (R2): the solver must
treat anchors as unlinkable AND count adjacency-removals toward `clearAnchors`, the move enumerator
must never route a chain/sweep through an anchor, the generator must place anchors per difficulty band,
and the winnability sweep must be re-run + budgets recalibrated. The removal rule stays the SINGLE
`removeAdjacent` from Phase 1 — the solver heuristic and the runtime seam call the same function.

## Requirements

### Functional

**Move enumeration (must match `hasLegalMove` exactly — soundness):**

- [ ] `enumerateMoves` (`src/core/voyage/enumerate-moves.ts:253`) gains an optional
      `anchors: ReadonlySet<CellIndex>` param (default empty). Every path/neighbour helper skips anchor
      cells: `sameColorNeighbours` (`:90`), `findChain` (`:126`), `greedyPath` (`:73`), plus the line-run
      and square-loop detectors. An anchor is never a chain member, a sweep seed, or a neighbour.
- [ ] The anchor-skip rule here MUST be identical to `hasLegalMove`'s (Phase 3). The soundness note at
      `enumerate-moves.ts:16-24` (enumerator vs deadlock agreement) is load-bearing: if they disagree,
      the solver false-halts and the generator rejects winnable levels (level-83 lesson).

**Solver model:**

- [ ] `stepOnce` (`src/core/voyage/solver.ts:187-191`) switches its actual resolve from
      `resolveChain(settled.game, ..., protectedOf(settled.caged))` to
      `resolveAnchorChain(settled.game, chain, settled.caged, settled.anchors)` (Phase 2 bridge), so the
      solver plays with the exact runtime rule.
- [ ] Add an `anchorMoveEffect(anchors, clearedIndices, cols)` heuristic using `removeAdjacent`
      (Phase 1), mirroring `cageMoveEffect` (`src/core/voyage/solver.ts:74`).
- [ ] `objectiveGain` (`src/core/voyage/solver.ts:105`) gains a `clearAnchors` branch: gain = number of
      anchors removed by the move (from `anchorMoveEffect`). `scoreMove`'s `touched` set
      (`src/core/voyage/solver.ts:134`) feeds the effect (for a sweep, all cells of the swept colour;
      for a plain chain, the chain cells — adjacency removal keys off cleared cells, so use the same set
      the runtime clears).
- [ ] The solver reads `anchors` from `VoyageState` (added in Phase 3); enumeration is called with that
      set so it never proposes an anchor-linking move.

**Generator + archetypes:**

- [ ] Add anchor archetype(s) to `src/core/voyage/archetypes.ts` (`ARCHETYPES` `:47`, `ARCHETYPE_POOL`
      `:99`) with a `clearAnchors` objective — e.g. an "anchor-break" archetype and optionally a
      "color-and-anchor" one, mirroring the existing color/twoColors/caged/colorAndCaged kinds. For v1,
      anchor archetypes place ONLY anchors (no cages) to stay collision-free (Non-goal in plan.md).
- [ ] Anchor placement helper in `src/core/voyage/cage-layout.ts` (sibling to `bottomAnchoredCages`
      `:18`) — e.g. `bottomAnchoredWeights(count, cols, rows): Obstacle[]` emitting `{type:'anchor', cell}`
      on distinct bottom cells. Reuse the bottom-anchored layout logic (DRY); do not overlap cage cells.
- [ ] `buildGenerated` (`src/core/voyage/generate-level.ts:96-151`) places anchors for anchor
      archetypes, funded by the existing `obstacleCount` dial (reinterpreted as anchor count for those
      archetypes) — no new dial. Generated levels KEEP `schemaVersion: 2` (`:124`) — anchor is un-gated
      (D-SCHEMA), so the ladder-wide v2 assertions at `generate-level.test.ts:37-39` and
      `episode-1.test.ts:16-23` stay valid.
- [ ] `hasMultiLayerCage` (`src/core/voyage/generate-level.ts:205`) uses `cagedCells` — after Phase 1's
      type filter it already ignores anchors; re-verify.

**Tuning (voyage-config.ts ONLY):**

- [ ] Any anchor tuning constant (per-band count cap, pricing) lives in `src/core/voyage/voyage-config.ts`
      alongside `DIAL_PRICES` (`:26-35`, `obstacle:1`), `MAX_OBSTACLES` (`:49`), `CAGE_LAYERS` (`:162`).
      Reuse `obstacle:1` pricing unless the sweep shows anchors need distinct pricing; if so add one
      constant here — nowhere else.
- [ ] Re-run the winnability sweep and recalibrate `difficulty-budget.ts` `spend` (`:140`) only if the
      sweep shows anchor levels fall outside the winnable budget band. Prefer reusing the obstacle dial
      before adding new budget machinery.

### Non-functional

- [ ] All solver/generator code RN-free + Vitest-tested. No `any`. Files ~<200 lines.
- [ ] `removeAdjacent` is the sole removal rule — the solver imports it, does not re-implement it.
- [ ] `enumerateMoves` default (no anchors) is byte-identical — existing Voyage tests stay green.

## Architecture

Two consistency invariants dominate this phase:

1. **Enumerator ≡ deadlock** — both skip anchors by the same rule, or the solver false-halts.
2. **Solver ≡ runtime** — `stepOnce` resolves via `resolveAnchorChain` (the same bridge the meta hooks
   use), and the heuristic counts removals via the same `removeAdjacent`. No parallel logic.

Generation flow: archetype (picks `clearAnchors` objective) → `spend` funds `obstacleCount` →
`bottomAnchoredWeights` places anchors → `buildGenerated` assembles a v2 level → `parseLevelScript`
validates → solver plays it to completion within budget → winnability sweep asserts across the ladder.

## Related Code Files

### Create

- Test additions in `src/core/voyage/solver.test.ts`, `enumerate-moves.test.ts`,
  `generate-level.test.ts`, `archetypes.test.ts` (as they exist), plus a winnability-sweep case
  covering anchor levels.

### Modify

- `src/core/voyage/enumerate-moves.ts` — anchors param + skip in all path helpers.
- `src/core/voyage/solver.ts` — `stepOnce` bridge swap (`:187`), `anchorMoveEffect`, `objectiveGain`
  clearAnchors branch (`:105`), `scoreMove` wiring (`:134`).
- `src/core/voyage/archetypes.ts` — anchor archetype(s) in `ARCHETYPES` + `ARCHETYPE_POOL`.
- `src/core/voyage/cage-layout.ts` — `bottomAnchoredWeights` (or a generalized bottom placement).
- `src/core/voyage/generate-level.ts` — `buildGenerated` places anchors; keep `schemaVersion: 2`.
- `src/core/voyage/voyage-config.ts` — anchor tuning constant(s) IF the sweep requires.
- `src/core/voyage/difficulty-budget.ts` — recalibrate `spend` ONLY if the sweep requires.

### Delete

- None.

## Implementation Steps

1. Enumerator (red→green): anchors param + skip; assert enumerator agrees with `hasLegalMove` on
   anchor boards (shared-fixture test).
2. Solver (red→green): swap `stepOnce` to `resolveAnchorChain`; add `anchorMoveEffect` +
   `objectiveGain` branch; test the solver completes a `clearAnchors` level and never proposes an
   anchor-linking move.
3. Archetypes + placement (red→green): add anchor archetype(s) + `bottomAnchoredWeights`; assert placed
   anchors are on distinct, in-bounds cells and never overlap cages.
4. Generator: `buildGenerated` emits anchor levels at v2; assert `generate-level.test.ts:37-39` (all v2)
   and `episode-1.test.ts:16-23` still pass unedited.
5. Winnability sweep: extend the sweep to include anchor archetypes; every ladder level solves within
   budget. Recalibrate `voyage-config`/`difficulty-budget` ONLY if a level falls out of band.
6. `npm test` (voyage), then lint + typecheck.

## Success Criteria

- [ ] The solver completes every generated anchor level (winnability sweep green) and never proposes a
      move that links an anchor.
- [ ] `enumerateMoves` and `hasLegalMove` agree on every anchor fixture (no false-halt).
- [ ] Every generated level parses via `parseLevelScript`; all ladder levels remain `schemaVersion: 2`
      (`generate-level.test.ts:37-39` + `episode-1.test.ts:16-23` pass unedited).
- [ ] Anchor tuning lives only in `voyage-config.ts`; budget recalibration (if any) is confined to
      `difficulty-budget.ts`.
- [ ] Voyage core RN-free + green; `removeAdjacent` is the only removal rule; no `any`; lint +
      typecheck clean.

## Risk Assessment

| Risk                                                                                   | Likelihood x Impact | Observable signal it broke                                           | Pre-decided response                                                                                                                            |
| -------------------------------------------------------------------------------------- | ------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Enumerator and deadlock skip anchors differently → solver false-halts                  | Med x High          | Winnability sweep rejects a hand-verified winnable anchor level      | Route both through one shared anchor-skip predicate; add the enumerator≡deadlock agreement test (Step 1) as a permanent guard                   |
| Solver heuristic under-counts anchor removals → picks poor moves → declares unwinnable | Med x High          | Sweep fails on levels a human can clear                              | `anchorMoveEffect` uses the same `removeAdjacent` + the same cleared set the runtime clears; assert heuristic gain == actual removals in a test |
| Anchor + cage placement collide on a cell → schema duplicate-cell reject               | Low x Med           | `parseLevelScript` throws during generation; sweep errors            | v1 anchor archetypes place only anchors (no cages); assert distinct cells in the placement test                                                 |
| Generated anchor level needs v3 (contradicts D-SCHEMA)                                 | Low x High          | `generate-level.test.ts:39` goes red (a level is not v2)             | Anchor is un-gated — emit v2; if a real need for v3 emerges, it is a scope change routed back, not a silent bump                                |
| Budget miscalibration makes anchor levels trivially easy or impossible                 | Med x Med           | Sweep passes but on-device difficulty feels wrong (Phase 5 playtest) | Recalibrate via `voyage-config`/`difficulty-budget` only; keep the sweep as the objective gate + owner playtest as the subjective gate          |
