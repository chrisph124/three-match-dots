---
phase: 3
title: 'Layered cage overlay and folds'
status: done
priority: P1
effort: '1.5-2d'
dependencies: [1, 2]
---

# Phase 3: Layered cage overlay and folds

## Overview

Turn the caged overlay from a `Set<CellIndex>` (freed-on-first-clear) into a `Map<CellIndex, number>`
(layers remaining), and route every clear through a thin pure wrapper that computes which cages to
protect and calls the Phase-1 `resolveChain(game, chain, protected)`. This is the behavioural core of
the feature and stays entirely in `src/core/**` (Vitest-testable) plus the two hooks that surface the
chip event.

## Requirements

- Functional:
  - `caged: Set<CellIndex>` → `caged: Map<CellIndex, number>` everywhere it is threaded
    (`voyage-state.ts`, `journey-state.ts`, the hooks, objectives, boss HP bar). Map value = layers
    remaining (≥ 1).
  - `buildCaged(cells)` seeds each entry from Phase-2 `cagedCells` `{index, layers}` → `Map(index →
layers)`. (Signature moves from `CellIndex[]` to the `{index, layers}[]` shape.)
  - `protectedOf(caged): ReadonlySet<CellIndex>` = keys whose layers ≥ 2. Passed **unconditionally**
    to `resolveChain` (protecting a cell that would not clear is a no-op, so the overlay never has to
    predict classify/collect).
  - `chipLayers(caged, resolution): Map<CellIndex, number>` replaces `freeCleared`, but is a **thin
    adapter over a pure index-only inner helper** so the solver can share the exact freeing rule
    without allocating a `Resolution` (red-team F2, the level-83 divergence lesson):
    `chipLayersInner(caged, clearedIndices: Iterable<CellIndex>, protectedIndices: Iterable<CellIndex>)
: Map<CellIndex, number>`. Then `chipLayers(caged, resolution) = chipLayersInner(caged,
resolution.cleared.map(c => c.index), (resolution.protectedHits ?? []).map(c => c.index))`. Rule,
    for each caged index:
    - in `clearedIndices` (a 1-layer cage that popped) → **remove** the entry (freed).
    - in `protectedIndices` (a multi-layer cage that was hit) → **decrement** by 1; if it reaches 1 it
      stays in the Map at 1 (next hit pops it — 1-layer is never protected).
    - untouched → unchanged.
      Pure, returns a new Map; never mutates the input. The solver's alloc-free heuristic (Phase 4)
      calls `chipLayersInner` directly with its locally-built cleared/protected index sets — one
      freeing rule, two callers, no drift.
  - `remapMoves(caged, falls): Map` — rebuild keys through the falls remap, preserving each key's
    layer value (`map.get(idx) ?? idx` identity default, same as today but carrying the value).
  - **One shared wrapper** `src/core/resolve-caged-chain.ts` (red-team F15 — a single module, NOT two
    mode-named files that would drift): `resolveCagedChain(game, chain, caged) = resolveChain(game,
chain, protectedOf(caged))`, returning the same `Resolution | null` (null still = illegal chain =
    mistake). Both hooks call it; if a mode ever needs bespoke pre-processing, inline `protectedOf` at
    that one call-site rather than forking the module.
  - `applyVoyageResolution` / `applyJourneyResolution` fold order becomes:
    `game = applyResolution(game, resolution); caged = remapMoves(chipLayers(caged, resolution),
resolution.falls); objectives = foldObjectives(...)`. (chip first, then gravity-remap — a popped
    or chipped cage must resolve its layer BEFORE its key is remapped.)
  - **`foldObjectives` signature widens `cagedRemaining: ReadonlySet<CellIndex>` →
    `ReadonlyMap<CellIndex, number>`** (red-team F8 — it is NOT unchanged; the folds now pass a Map).
    `freeCaged` progress reads `caged.size`/`caged.keys()`, which is identical for a Map. **`clearColor`
    must keep reading ONLY `resolution.cleared`** — a chipped caged cell lands in `protectedHits`, never
    `cleared`, so chipping a target-colour cage does NOT advance a `clearColor` objective; only an actual
    pop counts (red-team F13, user decision). Add a test asserting a chip-only commit on a `clearColor`
    target leaves the objective's `current` unchanged.
  - **Voyage hook** (`use-voyage-state.ts:182,197-204`): call `resolveCagedChain(game, chain,
vstate.caged)` instead of raw `resolveChain`, and add `chipped?: readonly ClearedCell[]` to
    `VoyageClearEvent` (`:44,103-104`), fed from `resolution.protectedHits`.
  - **Journey hook** (`use-journey-state.ts`) is NOT symmetric today and must be brought up (red-team
    F1 — do not describe this as pre-existing): it currently returns `{board, timeRemainingMs,
objectives, status, commit}` with **no `caged` and no clear event at all**. This phase adds:
    (a) `caged: Map<CellIndex, number>` to its state + return value, seeded from `cagedCells(level)`;
    (b) a new `JourneyClearEvent { seq; cleared; sweep; chipped }` emitted on each commit, mirroring
    `VoyageClearEvent`; (c) the `resolveCagedChain` call in its commit path. Without these, Phases 5/6
    have nothing to read in Journey mode. `playClear` still animates `resolution.cleared`; chip cells
    are a separate channel (they do not pop).
- Non-functional: `objectives.ts` `foldObjectives` third param is retyped `ReadonlySet → ReadonlyMap`
  (red-team F8); its `freeCaged` branch stays `.size`/`.keys()`-based (identical for a Map), its
  `clearColor` branch stays `resolution.cleared`-only (F13). `objectives.test.ts` `new Set(...)`
  literals at `:77,81,90,107` become `new Map(...)` of `[index, layers]`. No `resolve/**` edit in this
  phase (Phase 1 already opened the seam). No `any`; files <200 lines.

## Architecture

The wrapper is the whole trick: `resolveChain` stays cage-blind; the overlay decides protection by a
pure predicate over its own Map and hands it in. Because Phase 1 makes an omitted/empty protected set
byte-identical and protecting a non-clearing cell a no-op, `protectedOf` can be passed every commit
with zero special-casing — a board with no multi-layer cages produces an empty set ⇒ today's exact
behaviour (teach band L4 unchanged).

Chip-then-remap ordering mirrors the existing `freeCleared`→`remapMoves` order in `voyage-state.ts`;
only the middle function changes (free → chip/decrement). Keep the two mode files structurally
identical so the fold contract can't drift.

## Related Code Files

- Modify: `src/core/obstacles/caged-dot.ts` (Set→Map; `buildCaged`, `chipLayers` + pure
  `chipLayersInner`, `remapMoves`, add `protectedOf`)
- Create: `src/core/resolve-caged-chain.ts` (ONE shared wrapper — red-team F15, not two mode files)
- Modify: `src/core/voyage/voyage-state.ts` (fold uses chipLayers; **also the second `remapMoves`
  caller at `:213` — the `shuffle.moves` remap — must carry Map values**, red-team F10)
- Modify: `src/core/journey/journey-state.ts` (fold uses chipLayers; **also the `remapMoves` caller at
  `:126`**, red-team F10)
- Modify: `src/core/journey/objectives.ts` (`foldObjectives` param Set→Map; `freeCaged` Map-based;
  `clearColor` stays cleared-only)
- Modify: `src/meta/use-voyage-state.ts` (`:44,103-104,182,197-204`: call `resolveCagedChain`; add
  `chipped` to `VoyageClearEvent`; re-verify lock/unlock on a chip-only commit)
- Modify: `src/meta/use-journey-state.ts` (`:156-173,213-222`: **add** `caged` Map to state+return,
  **add** a `JourneyClearEvent` with `chipped`, call `resolveCagedChain` — none of these exist today,
  red-team F1)
- Tests: `caged-dot.test.ts` (Map + chipLayers/chipLayersInner + protectedOf), `voyage-state.test.ts`,
  `journey-state.test.ts`, `objectives.test.ts` (Set→Map literals at `:77,81,90,107`; clearColor-chip test)
- **Type-change ripple (edited in Phase 5, listed here so nothing is missed — red-team F3):** the
  `caged: Set→Map` change breaks the render-side consumers `src/render/voyage/voyage-juice.ts:68`
  (`fireCageJuice` iterates `for (const idx of prev)` — becomes `.keys()`) and
  `src/app/voyage-game.tsx:111-119` (the `prevCaged` Set-diff — a free is a removed key, a chip is a
  value-only change). Their edits belong to Phase 5; flagged here because the type originates in Phase 3.

## Implementation Steps (test-first)

1. **Red:** `caged-dot.test.ts` — `buildCaged` seeds layers; `protectedOf` = keys ≥ 2; `chipLayers`
   pops a 1-layer cage in `cleared` (removed), decrements a 2-layer cage in `protectedHits` (→1, still
   present), leaves untouched cages, never mutates input; `remapMoves` carries the layer value through
   a fall.
2. **Red:** `voyage-state.test.ts` / `journey-state.test.ts` — a chain including a 2-layer cage:
   `caged` still has that key at layer 1 after apply, board keeps the dot, objectives not yet
   complete; a second clear pops it (key gone), and only then does `freeCaged` complete when it was
   the last cage.
3. **Green:** convert `caged-dot.ts` to Map + the three/four functions; add the wrapper(s); rewire the
   two state folds and objectives.
4. **Green (hooks, on-device-verified but wire now):** hooks call `resolveCagedChain` and put
   `protectedHits` on the clear event as `chipped`. `playClear`'s `onDone` already fires
   **unconditionally** after `CLEAR_MS` (`clearSpan = max(cleared.length, 1)` in
   `use-board-animation.ts:114-133`), so an empty `cleared` already unlocks — a chip-only commit does
   NOT lock today (red-team F11). The rule for this phase is therefore **do not introduce an
   empty-`cleared` special-case** (e.g. an early-return that skips `playClear`/`applyAndDrop` when
   nothing popped) — that is what WOULD strand the unlock. Route chip-only through the identical settle
   path; the only real gap is visual (no chip feedback), which Phase 5 fills.
5. Run `npm test`; then `npm run typecheck` + `npm run lint`.

## Success Criteria

- [ ] `caged` is `Map<CellIndex, number>` end-to-end in core + BOTH hooks
- [ ] `chipLayers` pops 1-layer / decrements multi-layer / is pure — proven by tests; `chipLayersInner`
      is a pure index-only helper the solver can reuse
- [ ] `protectedOf` passed every commit via one shared `resolveCagedChain`; a cage-free board is byte-identical
- [ ] A 2-layer cage survives its first same-colour clear and pops on the second (state test)
- [ ] `freeCaged` completes only when the last cage's last layer breaks
- [ ] `clearColor` advances only on an actual pop; a chip-only commit does NOT move it (test)
- [ ] `useJourneyState` now exposes `caged` and emits a `JourneyClearEvent` with `chipped` (was absent)
- [ ] Hooks surface `chipped` on the clear event; chip-only commit does not lock input (on-device)
- [ ] `npm test` / `typecheck` / `lint` green; `src/core/**` RN-free

## Risk Assessment

- **A new empty-`cleared` special-case would strand the unlock** (red-team F11, corrected framing):
  the incumbent `playClear` `onDone` is unconditional (`clearSpan = max(cleared.length,1)`), so a
  chip-only commit already settles and unlocks. The hazard is regressing that — adding an
  `if (!cleared.length) return` fast-path that skips the settle. Signal: after chipping, the board
  won't accept the next drag. Response: forbid the special-case; chip-only takes the identical path as
  a normal clear; do NOT gate unlock on `cleared.length > 0`. (The _feedback_ gap — chip produces no
  visible pop — is Risk A, fixed in Phase 5, not a lock.)
- **Fold order regression:** remapping before chipping would decrement the wrong (post-gravity) key.
  Mitigation: the state test asserts the exact post-apply Map; keep chip-then-remap.
- **objectives.ts hidden Set assumption:** if it iterates `caged` as a Set of indices, a Map iteration
  yields `[k,v]` pairs. Signal: freeCaged `current` goes wrong. Response: read `caged.keys()`/`.size`
  explicitly; test guards it.
