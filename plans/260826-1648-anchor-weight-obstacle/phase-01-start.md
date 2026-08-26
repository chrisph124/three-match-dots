---
phase: 1
title: 'Schema + core anchor module'
status: done
priority: P1
effort: '4h'
dependencies: []
---

# Phase 1: Schema + core anchor module

## Overview

Lay the pure-TS foundation: a new `src/core/obstacles/anchor.ts` module (the ONE shared removal rule
plus set helpers) and the level-script schema extensions (`anchor` obstacle + `clearAnchors`
objective). Nothing wires into resolve/state/render yet — this phase produces a fully unit-tested,
RN-free vocabulary that every later phase consumes. TDD: tests written with/before the code.

Mirrors the caged-dot foundation: `src/core/obstacles/caged-dot.ts` (the overlay-helper template) and
the `obstacleSchema` / `objectiveSchema` in `src/core/level/level-script.ts:54-58` / `:35-44`.

## Requirements

### Functional

- [ ] `buildAnchors(cells: readonly CellIndex[]): Set<CellIndex>` — mirrors `buildCaged`
      (`src/core/obstacles/caged-dot.ts:17`) but a plain `Set` (single-hit, no layer count).
- [ ] `removeAdjacent(anchors, clearedIndices, cols): { removed: CellIndex[]; survivors: Set<CellIndex> }`
      — the SINGLE shared removal rule. An anchor is removed iff at least one cleared index is 8-way
      adjacent to it. Reuses `areAdjacent(a, b, cols)` from `src/core/hot/adjacency.ts` (the adjacency
      authority already used at `src/core/resolve/resolve-chain.ts:27`) so diagonals are handled once.
- [ ] `remapAnchors(anchors, moves): Set<CellIndex>` — mirrors `remapMoves`
      (`src/core/obstacles/caged-dot.ts:101`, identity default `map.get(idx) ?? idx`) but over a `Set`.
- [ ] `toMask(anchors: ReadonlySet<CellIndex>, cellCount: number): number[]` — pure 0/1 mask indexed by
      cell, for the worklet input layer (Phase 3). Plain data, no RN.
- [ ] Schema: add an `anchor` obstacle variant `{ type: 'anchor', cell: number }`. Convert the current
      single-shape `obstacleSchema` (`src/core/level/level-script.ts:54-58`) into a
      `z.discriminatedUnion('type', [cagedDotSchema, anchorSchema])`.
- [ ] Schema: add a `clearAnchors` objective `{ type: 'clearAnchors', count: number }` to the
      `objectiveSchema` discriminated union (`src/core/level/level-script.ts:35-44`), mirroring
      `freeCaged`.
- [ ] Version union accepts `3`: `schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3)])`
      (`src/core/level/level-script.ts:154`). `anchor`/`clearAnchors` are additive and un-gated
      (decision D-SCHEMA), matching the `layers` "so no schemaVersion bump" precedent (comment at `:50`,
      optional field at `:54-58`).
- [ ] Validation gates (in `checkObjectives`, `src/core/level/level-script.ts:269`): a `clearAnchors`
      objective requires ≥1 `anchor` obstacle (twin of the freeCaged-requires-cage gate at `:283-290`).
- [ ] `checkObstacles` (`src/core/level/level-script.ts:244`) already bounds-checks + dedups by
      `obstacle.cell`; confirm it covers both variants (both carry `cell`) — extend only if a variant-
      specific check surfaces.
- [ ] New helper `anchorCells(level): CellIndex[]` mirroring `cagedCellIndices`
      (`src/core/level/level-script.ts:446`), filtering `type === 'anchor'`. Update `cagedCells`
      (`:434`) to filter `type === 'cagedDot'` — the code comment at `:430-432` explicitly anticipates
      this ("When the enum grows (a schemaVersion bump), filter by type === 'cagedDot' here").

### Non-functional

- [ ] `src/core/obstacles/anchor.ts` is RN-free and Vitest-testable; file ~<200 lines.
- [ ] No `any`; `CellIndex` / `CellMove` types reused from `src/core/types.ts`.
- [ ] `removeAdjacent` is deterministic and pure (no module state) — it is the rule Phase 2 (runtime)
      and Phase 4 (solver) BOTH call; drift here is the level-83 failure mode.

## Architecture

Anchor is a `Set<CellIndex>` overlay parallel to the caged `Map<CellIndex, number>` overlay. Unlike a
cage (weight-N, chips a layer per hit via `chipLayers`, `caged-dot.ts:76`), an anchor is single-hit:
one qualifying adjacent clear removes it outright. So the anchor module needs no layer arithmetic —
`removeAdjacent` returns a partition (`removed` / `survivors`), and there is no `chipLayers` analogue.

`removeAdjacent` is defined once here and imported by BOTH the runtime seam (Phase 2, via the
resolve bridge) and the solver heuristic (Phase 4). This is the "one rule, two callers" contract.

## Related Code Files

### Create

- `src/core/obstacles/anchor.ts` — `buildAnchors`, `removeAdjacent`, `remapAnchors`, `toMask`.
- `src/core/obstacles/anchor.test.ts` — Vitest; mirrors `src/core/obstacles/caged-dot.test.ts`.
- `src/core/level/level-script.test.ts` additions (same file, new cases) for the schema variants.

### Modify

- `src/core/level/level-script.ts` — `obstacleSchema` (`:54-58` → discriminated union),
  `objectiveSchema` (`:35-44` add `clearAnchors`), `schemaVersion` union (`:154` add `3`),
  `checkObjectives` (`:269` add clearAnchors-requires-anchor gate), `cagedCells` (`:434` filter by
  type), add `anchorCells` (near `:446`). Verify `checkObstacles` (`:244`) covers both variants.
- `src/core/types.ts` — only if a shared `Obstacle`/objective type alias needs the new variant; the
  schema `z.infer` types may suffice. Confirm before editing.

### Delete

- None.

## Implementation Steps

1. Write `anchor.test.ts` first (red): adjacency incl. all 4 diagonals + 4 orthogonals; a non-adjacent
   clear leaves the anchor; single-hit (one adjacent clear removes; a second clear is a no-op on an
   already-empty set); `remapAnchors` follows a downward fall and a shuffle permutation; `toMask`
   produces the right 0/1 vector and is pure.
2. Implement `anchor.ts` to green. Reuse `areAdjacent` from `hot/adjacency.ts` inside `removeAdjacent`
   (DRY — do not re-derive diagonal math).
3. Add schema cases to `level-script.test.ts` (red): accept an `anchor` obstacle; accept a
   `clearAnchors` objective; reject an off-board anchor cell; reject duplicate cells across
   cagedDot+anchor; reject `clearAnchors` with no anchor obstacle; accept `schemaVersion: 3`; update
   the existing "rejects an unknown schemaVersion" case (`level-script.test.ts:181`) to mutate to `4`.
4. Convert `obstacleSchema` to a discriminated union; add `anchorSchema`; add `clearAnchors` to
   `objectiveSchema`; widen the `schemaVersion` union; add the `checkObjectives` gate; add
   `anchorCells`; make `cagedCells` filter by `type === 'cagedDot'`.
5. Run `npm test` (focused: anchor + level-script), then `npm run lint` + `npm run typecheck`.

## Success Criteria

- [ ] `anchor.test.ts` green: adjacency (8-way incl. diagonals), single-hit removal partition,
      `remapAnchors` over a fall + a shuffle, `toMask` purity.
- [ ] `level-script.test.ts` green: anchor + clearAnchors accept; off-board / duplicate /
      clearAnchors-without-anchor reject; `schemaVersion: 3` accepted; the unknown-version case now
      mutates to `4`.
- [ ] `cagedCells` still returns only caged-dot cells (filtered by type); `anchorCells` returns only
      anchor cells; existing cage tests unchanged and green.
- [ ] `src/core/obstacles/anchor.ts` RN-free (grep `from '`/`require(` shows no RN/Skia); no `any`.
- [ ] `npm run lint` + `npm run typecheck` clean.

## Risk Assessment

| Risk                                                                                                           | Likelihood x Impact | Observable signal it broke                                                                                              | Pre-decided response                                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Discriminated-union conversion silently changes the inferred `Obstacle` type, breaking existing cage consumers | Med x High          | `tsc` errors at `cagedCells`/`checkObstacles`/generator call sites, or existing `caged-dot`/`level-script` tests go red | Add the `type === 'cagedDot'` filter at every cage consumer (already flagged at `:430-432`); do NOT loosen the union to fix a type error — narrow the consumer                 |
| `removeAdjacent` diagonal logic drifts from the game's real adjacency                                          | Low x High          | `anchor.test.ts` diagonal cases fail, OR later solver false-halts                                                       | Reuse `areAdjacent` from `hot/adjacency.ts` (single source); never hand-roll adjacency here                                                                                    |
| Un-gated anchor at v1/v2 lets a malformed old level parse                                                      | Low x Med           | A v1 fixture unexpectedly accepts an anchor                                                                             | Acceptable per D-SCHEMA (additive, matches `layers` precedent); if the owner wants gating, that is a scope change routed back — do not gate unilaterally (breaks ladder tests) |
| `checkObjectives` gate ordering shifts an existing error message                                               | Low x Med           | An existing level-script reject test asserts a different message/order                                                  | Append the new gate after existing ones; keep existing messages byte-identical                                                                                                 |
