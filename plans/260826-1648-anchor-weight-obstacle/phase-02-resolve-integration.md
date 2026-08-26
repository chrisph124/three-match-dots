---
phase: 2
title: 'Resolve integration (R1 seam)'
status: done
priority: P1
effort: '5h'
dependencies: [1]
---

# Phase 2: Resolve integration (the R1 seam)

## Overview

The highest-risk integration (brainstorm R1): a committed chain must, in the SAME resolution pass,
empty every cell holding an 8-way-adjacent anchor — cells that were NOT part of the chain — then let
those cells fall and refill with the rest. This phase adds a generic, mechanic-agnostic seam to
`resolveChain` (decision D-SEAM) and a combined bridge `resolveAnchorChain`. The colour core never
learns the word "anchor"; it learns "the caller may skip some cells from a sweep, and may expand the
cleared set by a caller-computed extra set".

## Requirements

### Functional

- [ ] Extend `resolveChain` with an optional final seam parameter, e.g.
      `resolveChain(state, chain, protectedCells?, seam?: { skipCollect?: ReadonlySet<CellIndex>; expandCleared?: (cleared: readonly ClearedCell[]) => readonly CellIndex[] })`.
      Current signature: `resolveChain(state, chain, protectedCells: ReadonlySet<CellIndex> = EMPTY_PROTECTED)` at `src/core/resolve/resolve-chain.ts:54`.
- [ ] `skipCollect`: passed into `collectCleared` (`src/core/resolve/collect-cleared.ts:8`) so the sweep
      loop (`:25-32`, which collects ALL cells of the swept colour) skips any cell in the set. The
      chain loop (`:13-20`) needs no skip — a committed chain never contains an anchor (INPUT
      suppression, Phase 3).
- [ ] `expandCleared`: after `collectCleared` returns and the cleared/protectedHits split is computed
      (`resolve-chain.ts:71-75`), call `expandCleared(cleared)` to get extra cell indices to empty.
      Feed those extra indices into `applyGravity` alongside `cleared` — `applyGravity`
      (`src/core/resolve/gravity.ts:9`) reads only `.index` (`:17`), so extra empties can be appended
      as minimal `ClearedCell`-shaped entries carrying `index`.
- [ ] Scoring uses `cleared` ONLY (`resolve-chain.ts:95`) — expanded (anchor) cells must NOT be in the
      scored set. Verify `scoreFor` receives the original `cleared`, not the expanded union.
- [ ] `refill` (`src/core/resolve/refill.ts:58`) runs after gravity over the merged empties — the freed
      anchor cell refills like any other emptied cell (no special path).
- [ ] Echo the expanded indices on the Resolution: add `expandedCleared?: readonly CellIndex[]` to
      `Resolution` (`src/core/types.ts:75-100`, alongside `protectedHits?` at `:99`). Absent when empty
      ⇒ byte-identical for every current caller (decision D-NAME).
- [ ] New bridge `src/core/resolve-anchor-chain.ts`:
      `resolveAnchorChain(game, chain, caged, anchors): Resolution | null` = `resolveChain(game, chain,
  protectedOf(caged), { skipCollect: anchors, expandCleared: (cleared) =>
  removeAdjacent(anchors, cleared.map(c => c.index), game.config.cols).removed })`. This is the
      single bridge both meta hooks and the solver call; it composes cages AND anchors (caged +
      anchor coexistence).
- [ ] Keep `resolveCagedChain` (`src/core/resolve-caged-chain.ts:21`) working. Either delegate it to
      `resolveAnchorChain(g, c, caged, EMPTY_ANCHORS)` (DRY, keeps its test meaningful) or leave it
      untouched for the caged-only path. RECOMMENDED: delegate, so there is one composition rule.

### Non-functional

- [ ] `resolve/**` stays mechanic-agnostic: no import of `anchor.ts` into `resolve-chain.ts` or
      `collect-cleared.ts`. Only `resolve-anchor-chain.ts` (a bridge, sibling to `resolve-caged-chain.ts`)
      imports `anchor.ts`.
- [ ] `hot/**` UNTOUCHED. `src/core/**` RN-free. No `any`. Files ~<200 lines.
- [ ] The optional seam preserves byte-identical output when omitted — existing `resolve-chain.test.ts`
      and `resolve-caged-chain.test.ts` stay green with no edits.

## Architecture

Pipeline today (`resolve-chain.ts`): `isCommittable` (`:15-32`) → `classifyChain` (`:66`) →
`collectCleared` (`:71`) → split cleared/protectedHits (`:73-75`) → `applyGravity` (`:76`) →
`scoreFor` (`:95`) → `refill` (`:100`) → `Resolution` (`:110-121`).

Seam insertion points:

- `collectCleared(board, chain, kind, skipCollect)` — sweep loop skips `skipCollect`.
- After the cleared/protectedHits split: `const expanded = seam?.expandCleared?.(cleared) ?? []`.
- `applyGravity(board, [...cleared, ...expandedAsClearedCells], rows, cols)`.
- `scoreFor(cleared, ...)` — unchanged input (score excludes `expanded`).
- `Resolution` gains `...(expanded.length ? { expandedCleared: expanded } : {})`.

```
chain committed
   │
   ├─ collectCleared(skip = anchors)  → cleared (chain/sweep, minus anchors)
   ├─ expandCleared(cleared)          → removeAdjacent(anchors, cleared).removed
   ├─ applyGravity(cleared ++ expanded)   ← both sets empty & fall in ONE pass
   ├─ scoreFor(cleared)                    ← anchors score 0 (not in cleared)
   ├─ refill                               ← freed anchor cell refills normally
   └─ Resolution{ ..., expandedCleared }   ← echo for the state fold (Phase 3)
```

**Caged + anchor coexistence (confirm-at-implementation checkpoint):** the bridge passes BOTH
`protectedOf(caged)` (as `protectedCells`) AND `anchors` (as `skipCollect` + `expandCleared`). A cell
cannot be both caged and anchored (schema dedups by `cell`, Phase 1), so the two sets are disjoint.
Confirm at the top of implementation that `protectedCells` and `skipCollect` never overlap and that a
protected (caged) cell adjacent to a cleared cell still chips its layer via `chipLayers` (Phase 3),
independent of the anchor `expandCleared` path. If any interaction surfaces, STOP and re-scope before
writing the fold.

## Related Code Files

### Create

- `src/core/resolve-anchor-chain.ts` — the combined bridge.
- `src/core/resolve-anchor-chain.test.ts` — Vitest; mirrors `src/core/resolve-caged-chain.test.ts`.
- Additions to `src/core/resolve/resolve-chain.test.ts` for the seam behaviour.

### Modify

- `src/core/resolve/resolve-chain.ts` — add optional `seam` param; thread `skipCollect` into
  `collectCleared`; apply `expandCleared`; merge expanded into gravity; echo `expandedCleared`.
- `src/core/resolve/collect-cleared.ts` — add optional `skip: ReadonlySet<CellIndex>` param; skip in
  the sweep loop (`:25-32`).
- `src/core/types.ts` — add `Resolution.expandedCleared?: readonly CellIndex[]`.
- `src/core/resolve-caged-chain.ts` — optionally delegate to `resolveAnchorChain` (recommended).

### Delete

- None.

## Implementation Steps

1. Confirm the coexistence checkpoint (protected vs skip disjoint; chipLayers path independent) by
   re-reading `resolve-chain.ts:71-95`, `caged-dot.ts:50-99`, `collect-cleared.ts:8-33`. If clean,
   proceed; else re-scope.
2. Write `resolve-chain.test.ts` seam cases (red): (a) omitting the seam is byte-identical to today;
   (b) `skipCollect` excludes a swept cell from `cleared`; (c) `expandCleared` empties an extra cell
   that then falls/refills, and `expandedCleared` echoes exactly those indices; (d) score reflects
   only `cleared`, not the expanded set.
3. Add the optional `skip` param to `collectCleared`; add the `seam` param to `resolveChain`; wire the
   four insertion points; add the `expandedCleared` echo.
4. Write `resolve-anchor-chain.test.ts` (red): an anchor 8-adjacent to a cleared chain is emptied,
   falls, refills, scores 0, and is reported in `expandedCleared`; an anchor NOT adjacent survives; a
   sweep of the anchor's own colour does not collect the anchor cell but the adjacency still removes it.
5. Implement `resolve-anchor-chain.ts`; delegate `resolveCagedChain` to it (recommended).
6. Run focused tests, then `npm test` (broadened: resolve + caged + anchor), then lint + typecheck.

## Success Criteria

- [ ] With no seam argument, `resolveChain` output is byte-identical — existing `resolve-chain.test.ts`
      and `resolve-caged-chain.test.ts` pass unedited.
- [ ] An 8-way-adjacent same-colour clear empties the anchor cell in ONE pass; the freed cell falls and
      refills; `Resolution.expandedCleared` lists exactly the removed anchor indices.
- [ ] The anchor cell scores 0 (score reflects only `cleared`) and is not in `cleared`.
- [ ] A sweep does not collect an anchor cell (`skipCollect` honoured), yet adjacency still removes it.
- [ ] `resolve/resolve-chain.ts` and `collect-cleared.ts` do NOT import `anchor.ts`; only the bridge
      does. `hot/**` unchanged. No `any`. Lint + typecheck clean.

## Risk Assessment

| Risk                                                                           | Likelihood x Impact | Observable signal it broke                                                                  | Pre-decided response                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expanded cells leak into the scored set                                        | Med x High          | A resolve test shows a higher score when an anchor is nearby; `scoreFor` receives the union | Pass ONLY `cleared` to `scoreFor`; assert score-excludes-expanded in a test before shipping                                                                                              |
| Expanded empties double-count in gravity (an anchor cell already in `cleared`) | Med x High          | Gravity test shows a cell processed twice / NaN column height                               | De-dup: build the gravity input as a Set-union of `cleared.index` and `expanded`; anchor cells are excluded from `cleared` by `skipCollect`, so overlap should be impossible — assert it |
| Optional seam changes default output (protectedHits/echo present when empty)   | Low x High          | An existing resolve test diffs on a newly-present field                                     | Spread the field only when non-empty (`...(expanded.length ? {expandedCleared} : {})`), mirroring the `protectedHits` pattern at `resolve-chain.ts`                                      |
| Caged + anchor interaction (protected cell also expanded)                      | Low x High          | A level with a cage adjacent to an anchor mis-chips or mis-empties                          | Sets are disjoint by schema dedup; assert disjointness at the bridge; if violated, the checkpoint in Step 1 halts before folds are written                                               |
| `resolveCagedChain` delegation subtly changes caged-only behaviour             | Low x High          | `resolve-caged-chain.test.ts` goes red                                                      | Delegate with an EMPTY anchor set so the `expandCleared`/`skipCollect` paths are no-ops (byte-identical); if any diff appears, keep `resolveCagedChain` standalone instead               |
