---
phase: 2
title: 'Canvas-coordinate plumbing (zero visual diff)'
status: completed
priority: P1
effort: '0.5-1d'
dependencies: []
---

# Phase 2: Canvas-coordinate plumbing (zero visual diff)

## Overview

Add a **board-origin offset** to `BoardLayout` and the geometry worklets so the board
can later be drawn inside a larger canvas (the backdrop) while gesture hit-testing
still recovers the correct cell. Ships as a pure refactor with **zero visual change**
and new Vitest coverage — reviewable entirely on its own, before any backdrop art.

## Requirements

- Functional: `centerX`/`centerY` place a cell relative to a board origin;
  `cellAtPoint` inverts that origin before hit-testing and returns `-1` outside the
  board rectangle.
- Functional: with `originX = originY = 0` (this phase's wiring), every rendered pixel
  and every hit-test is **identical** to today — no visual or behavioral diff.
- Non-functional: `geometry.ts` stays pure arithmetic over plain numbers, worklet-safe,
  no allocation — it is the one file outside `src/core/` that Vitest runs.

## Architecture

The LOCKED invariant "canvas coordinates == board coordinates, so the gesture handler
needs no offset" (`board-canvas.tsx:17-20`) holds today only because the canvas is
sized exactly to the board. Phase 3 breaks that by enlarging the canvas. This phase
introduces the offset the enlarged canvas will need, defaulted to 0 so nothing moves
yet.

- `BoardLayout` gains `originX: number` and `originY: number`.
- `makeLayout(rows, cols, boardSize, touchFraction?, originX = 0, originY = 0)` stores
  them.
- `centerX(cell, layout) = layout.originX + ((cell % cols) + 0.5) * cellSize`
- `centerY(cell, layout) = layout.originY + (Math.floor(cell / cols) + 0.5) * cellSize`
- `cellAtPoint(x, y, layout)`: subtract `originX`/`originY` first, then the existing
  column/row math; return `-1` when the adjusted point falls outside `[0, cols*cellSize)
× [0, rows*cellSize)`.
- `moveOffsetX/Y` and `spawnOffsetY` are pure deltas — **unchanged** (origin cancels).

Consumers (`dot-layer.tsx`, `link-path.tsx`, `use-board-gesture.ts`,
`board-canvas.tsx`) already call these functions and pass `layout` through, so they
compile unchanged. Both `makeLayout` callers — `game.tsx` (Endless) **and**
`journey.tsx` (Journey; the vertical slice shipped in PR #4) — keep calling
`makeLayout(...)` with no origin args → origin stays `(0,0)` in both → zero visual
diff. Phase 3 flips the origin non-zero **for Endless only** (`journey.tsx` is a
plan non-goal, stays origin `(0,0)`).

## Related Code Files

- Modify: `src/render/geometry.ts` — add `originX`/`originY` to `BoardLayout`,
  `makeLayout`, and the three coordinate worklets.
- Modify/Create: `src/render/geometry.test.ts` (or the existing geometry spec) — new
  cases with non-zero origin.

## Implementation Steps

1. Add `originX`/`originY` to the `BoardLayout` type and `makeLayout` signature
   (defaulted to 0, appended after `touchFraction` to preserve existing call sites).
2. Fold origin into `centerX`, `centerY`, `cellAtPoint`.
3. Add Vitest cases: `centerX`/`centerY` with `originX=20, originY=40`; `cellAtPoint`
   returns the right cell for an origin-shifted point and `-1` just outside the shifted
   board rect; a `(0,0)`-origin regression case proving today's numbers are unchanged.
4. `npm test` (geometry) + `npm run typecheck` green; confirm `game.tsx` renders
   pixel-identical (origin 0).

## Success Criteria

- [x] `BoardLayout` carries an origin; all three coordinate worklets honor it.
- [x] New Vitest cases cover non-zero origin for center + hit-test, including the
      outside-board `-1` boundary.
- [x] With origin `(0,0)`, the game looks and plays exactly as before (verified in the
      running dev client).
- [x] `geometry.ts` remains pure/worklet-safe; `lint` + `typecheck` + `test` green.

## Risk Assessment

- **Silent hit-test regression** (dots draw fine but touches map to the wrong cell).
  Signal: a Vitest case with non-zero origin fails, or on-device the chain starts on
  the wrong dot. Response: the outside-board `-1` and origin-shift cases are the guard;
  keep origin `(0,0)` in `game.tsx` this phase so any regression is impossible until
  Phase 3 deliberately shifts it.
- **Default-arg ordering breaks existing `makeLayout` callers.** Signal: `typecheck`
  error at a `makeLayout` call site. Response: append origin params after
  `touchFraction`; both current callers (`game.tsx`, `journey.tsx`) pass neither, so
  defaults apply in each.
