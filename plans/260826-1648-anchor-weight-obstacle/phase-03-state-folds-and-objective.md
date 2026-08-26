---
phase: 3
title: 'State folds, objective, input suppression'
status: done
priority: P1
effort: '5h'
dependencies: [2]
---

# Phase 3: State folds, objective, and input suppression

## Overview

Thread the anchor `Set<CellIndex>` through both mode state machines (Journey + Voyage), add the
`clearAnchors` objective fold, make deadlock/shuffle anchor-aware (R4), and suppress linking of
anchored cells in the gesture worklet (R5). After this phase the mechanic is fully playable in the
pure core + input layers; only rendering (Phase 5) and Voyage generation (Phase 4) remain.

Mirrors the caged spine: `journey-state.ts` / `voyage-state.ts` fold `caged` via
`chipLayers` + `remapMoves`; `objectives.ts` folds `freeCaged`; the meta hooks call the resolve
bridge and expose the overlay.

## Requirements

### Functional

**State folds (core, Vitest-tested):**

- [ ] `JourneyState` gains `anchors: Set<CellIndex>` beside `caged` (`src/core/journey/journey-state.ts:23`).
      Seed in `newJourney` (`:33`) from `anchorCells(level)` (Phase 1) via `buildAnchors`.
- [ ] `applyJourneyResolution` (`:78`): after removal, set
      `anchors = remapAnchors(survivors, resolution.falls)` where `survivors` = current anchors minus
      `resolution.expandedCleared` (the Phase-2 echo — do NOT recompute adjacency here; consume the
      echo so the runtime and the seam agree). Mirrors the existing caged line at `:83`.
- [ ] `settleJourney` (`:113`): anchors are preserved IN PLACE across a reshuffle (acceptance:
      "preserved in place") — pass `anchors` through unchanged, NOT remapped by `shuffle.moves`. (Cages
      remap at `:126`; anchors intentionally differ.)
- [ ] Mirror ALL of the above in Voyage: `VoyageState.anchors` (`src/core/voyage/voyage-state.ts:38`),
      `newVoyage` (`:60`), `applyVoyageResolution` (`:126`, line `:131`), `settleVoyage` (`:202`, line
      `:215`).
- [ ] Both `applyJourneyResolution` and `applyVoyageResolution` call the Phase-2 bridge
      `resolveAnchorChain(game, chain, caged, anchors)` in place of `resolveCagedChain` — but note the
      RESOLVE call actually lives in the meta hooks (see below); the state folds consume the returned
      `Resolution`. Confirm where each mode invokes resolve (hook vs core fold) and keep the bridge as
      the single entry.

**Objective (core, Vitest-tested):**

- [ ] Add `clearAnchors` to the `Objective` union (`src/core/journey/objectives.ts:8-10`).
- [ ] `initObjectives` (`:24`) seeds a `clearAnchors` target from the initial anchor count.
- [ ] `foldObjectives` (`:47`) gains an `anchorsRemaining: ReadonlySet<CellIndex>` param;
      `clearAnchors` is done when `anchorsRemaining.size === 0` (mirror `freeCaged` at `:63`), and its
      progress = target − remaining. Update both mode callers to pass the post-fold anchor set.
- [ ] Anchor removal must NOT advance any `clearColor` objective — verify `foldObjectives` reads only
      `resolution.cleared` for colour counts (anchors are in `expandedCleared`, never `cleared`).

**Deadlock + shuffle (core, Vitest-tested) — R4:**

- [ ] `hasLegalMove` (`src/core/deadlock.ts:78`) gains an optional `anchors: ReadonlySet<CellIndex>`
      param (default empty ⇒ Endless byte-identical). The path DFS must treat an anchored cell as
      non-linkable (skip as start AND as neighbour). Enumerate + update every caller (see below).
- [ ] `shuffleBoard` (`src/core/shuffle.ts:51`) gains an optional `anchors` param, forwarded to
      `hasLegalMove` at `:64` and `:83`, so a permutation whose only "legal move" routes through an
      anchor is rejected (prevents a soft-lock). It shuffles underlying colours as today; anchors stay
      in place (not scattered).

**Input suppression (worklet, on-device verify) — R5:**

- [ ] `ChainState` in `src/input/use-board-gesture.ts` gains an `anchors: SharedValue<number[]>`
      worklet-readable mask (a 0/1 array indexed by cell), mirroring how `board` is a
      `SharedValue<number[]>`.
- [ ] In `buildPanGesture` (`:61`), `onStart` (`:67`) and `onUpdate` (`:77`): after `cellAtPoint`
      (`:83`) returns a cell, if `anchors.value[cell] === 1` treat it as no cell (as if `cell < 0`) —
      the chain neither starts on nor extends to an anchor. `canAppend` (`:87`) is NOT modified;
      suppression is purely at the input hit-test (Approach ①).
- [ ] The meta hooks (`src/meta/use-journey-state.ts`, `src/meta/use-voyage-state.ts`) build the mask
      with `toMask(anchors, cellCount)` (Phase 1) and write it to the `SharedValue` whenever the anchor
      set changes (initial seed + after each resolution), the same way they mirror the board.
- [ ] Meta hooks switch their resolve call from `resolveCagedChain` to `resolveAnchorChain`
      (`src/meta/use-journey-state.ts:183`, import at `:12`; `src/meta/use-voyage-state.ts:189`) and
      expose `anchors` in the returned object (beside `caged` at `use-voyage-state.ts:271`).

### Non-functional

- [ ] All core folds (`journey-state`, `voyage-state`, `objectives`, `deadlock`, `shuffle`) RN-free +
      Vitest-tested. Meta hooks + gesture are RN/worklet → on-device verify.
- [ ] `hot/**` UNTOUCHED (suppression is in the gesture worklet, not `can-append.ts`). No `any`.
- [ ] Optional params default to empty ⇒ Endless (`src/meta/use-game-state.ts`) byte-identical; it
      passes no anchors anywhere.

## Architecture

Anchor set threads exactly like `caged`, with two deliberate differences:

1. **Removal source** — cages chip via `chipLayers(caged, resolution)`; anchors are removed by
   consuming `resolution.expandedCleared` (the Phase-2 echo), then remapped through `resolution.falls`.
2. **Reshuffle** — cages remap through `shuffle.moves`; anchors are preserved IN PLACE (no remap).

Input suppression keeps the worklet hot path pristine: the board mirror already flows to the worklet;
we add a parallel anchor mask. The gesture reads `anchors.value[cell]` (plain array index, worklet-safe)
and drops anchored cells before they ever reach `canAppend`.

### Callers to update (enumerated)

`hasLegalMove` (`deadlock.ts:78`) callers — verify each and thread anchors:

- `src/core/shuffle.ts:64`, `src/core/shuffle.ts:83`
- `src/core/journey/journey-state.ts:118` (settleJourney)
- `src/core/voyage/voyage-state.ts:207` (settleVoyage)
- `src/core/deadlock.ts` internal (if any) + any Endless caller in `src/meta/use-game-state.ts`
- Plus test files that call it directly (verify at implementation; do not edit unless the signature
  break requires it — pass the default empty set to keep them green).

`resolveCagedChain` callers switching to `resolveAnchorChain`:

- `src/meta/use-journey-state.ts:183`
- `src/meta/use-voyage-state.ts:189`
- (Solver call at `src/core/voyage/solver.ts:187` is switched in Phase 4.)

> Re-grep every caller at implementation start (`grep -rn "hasLegalMove\|resolveCagedChain\|shuffleBoard" src`)
> — the counts above are from this plan's scout pass and MUST be re-verified before editing.

## Related Code Files

### Create

- Test additions across `journey-state.test.ts`, `voyage-state.test.ts`, `objectives.test.ts`,
  `deadlock.test.ts`, `shuffle.test.ts`.

### Modify

- `src/core/journey/journey-state.ts` — `JourneyState.anchors`, `newJourney`, `applyJourneyResolution`,
  `settleJourney`.
- `src/core/voyage/voyage-state.ts` — mirror.
- `src/core/journey/objectives.ts` — `Objective` union, `initObjectives`, `foldObjectives` (+ caller
  signature).
- `src/core/deadlock.ts` — `hasLegalMove` anchors param + DFS skip.
- `src/core/shuffle.ts` — `shuffleBoard` anchors param, forwarded to `hasLegalMove`.
- `src/input/use-board-gesture.ts` — `ChainState.anchors` mask + onStart/onUpdate suppression.
- `src/meta/use-journey-state.ts` — resolve bridge swap, mask mirror, expose `anchors`.
- `src/meta/use-voyage-state.ts` — mirror.

### Delete

- None.

## Implementation Steps

1. Re-grep the caller lists above; reconcile against this plan.
2. Objectives first (red→green): add `clearAnchors`, extend `initObjectives` + `foldObjectives`,
   test done-only-at-empty and no-clearColor-advance.
3. State folds (red→green): add `anchors` to both states; consume `expandedCleared`; remap via `falls`;
   preserve in place on settle; test a full commit thread + a reshuffle.
4. Deadlock + shuffle (red→green): anchors skip in the DFS; shuffle rejects anchor-only "legal" boards;
   test a board whose only chain routes through an anchor → reports deadlock → reshuffles.
5. Meta hooks + gesture: swap to `resolveAnchorChain`; build + mirror the anchor mask; add suppression
   in onStart/onUpdate; expose `anchors`. (On-device verification deferred to Phase 5.)
6. `npm test` (core), then lint + typecheck.

## Success Criteria

- [ ] `clearAnchors` completes only when the anchor set is empty; anchor removal never advances a
      `clearColor` objective.
- [ ] A full Journey AND Voyage commit threads the anchor set: removed anchors leave the set, survivors
      remap through `falls`, and the set is preserved in place across a reshuffle.
- [ ] `hasLegalMove` returns false when the only same-colour path is broken by an anchor; `shuffleBoard`
      never returns a board whose only legal move routes through an anchor.
- [ ] Endless (`use-game-state.ts`) is byte-identical (no anchors passed; defaults hold).
- [ ] Core folds RN-free + green in `npm test`; `hot/**` unchanged; no `any`; lint + typecheck clean.
- [ ] (On-device, Phase 5) an anchor cannot be linked; a chain routed around it is unaffected.

## Risk Assessment

| Risk                                                                                      | Likelihood x Impact | Observable signal it broke                                                                                    | Pre-decided response                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Fold recomputes adjacency instead of consuming `expandedCleared`, diverging from the seam | Med x High          | An anchor removed by resolve stays in the state set (or vice-versa); objective never completes                | Consume `resolution.expandedCleared` in the fold; never call `removeAdjacent` again in the fold                      |
| Anchor remapped on reshuffle (violates "in place")                                        | Med x Med           | Anchor visibly jumps position after a deadlock reshuffle                                                      | Do NOT pass anchors through `remapMoves(shuffle.moves)`; pass unchanged in `settleJourney`/`settleVoyage`            |
| `hasLegalMove` signature break reddens unrelated tests                                    | Med x Med           | `deadlock.test.ts`/`shuffle.test.ts` fail to compile                                                          | Make the anchors param optional (default empty); existing callers/tests compile unchanged                            |
| Soft-lock: shuffle accepts a board whose only move routes through an anchor               | Low x High          | On-device the board reshuffles forever or offers an impossible move                                           | `shuffleBoard` forwards anchors to `hasLegalMove` at both `:64` and `:83`; add a core test for the anchor-only board |
| Anchor mask not re-mirrored after a resolution → stale suppression                        | Med x Med           | On-device a removed anchor's freed cell still can't be linked, or a fallen anchor is linkable at its old cell | Rebuild + write the mask on every state change (seed + post-resolution), same cadence as the board mirror            |
| Worklet reads a `Set`/object (not worklet-safe)                                           | Low x High          | Reanimated worklet crash / undefined on the UI thread                                                         | Mirror as `SharedValue<number[]>` via `toMask`; never pass a `Set` into the worklet                                  |
