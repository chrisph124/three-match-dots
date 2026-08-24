---
title: 'Phase 7: Navigation ribbon and persistence'
status: done
phase: 7
priority: P1
effort: '2d'
dependencies: [2, 4, 6]
---

# Phase 7: Navigation ribbon and persistence

## Overview

The map screen and save system: a **virtualized pop-up-book ribbon** of level nodes the player scrolls
and taps to enter a level, plus **packed per-level progress** persistence. Wires the Voyage routes into
`expo-router` and connects the generator (Phase 4), the state machine (Phase 2), and the diorama
(Phase 6) into a playable loop.

## Requirements

- Functional:
  - A **navigation ribbon** (`src/render/voyage/ribbon/`): a horizontally/vertically scrolling strip of
    level nodes over the diorama, each node showing index, lock state, and stars earned; bosses marked.
    Tapping an unlocked node routes into that level.
  - **Virtualized:** only the on-screen window of nodes (plus a small buffer) is built/drawn — the
    ribbon must scroll smoothly across an unbounded ladder without materializing thousands of nodes.
  - **Persistence** (`src/meta/voyage-progress-storage.ts`): per-level result (unlocked?, stars 0–3)
    stored **packed** in MMKV — ~2 bits/level, keyed per **episode** (e.g. `voyage.progress.ep1`), so a
    long ladder stays a few small keys, not thousands. Read/write is pure over a bitfield; the MMKV
    boundary is thin.
  - `expo-router` routes: `src/app/voyage.tsx` (the ribbon/map) and the Voyage game route (renders the
    board + diorama + HUD, driven by `use-voyage-state`). Completing a level writes progress and unlocks
    the next node.
  - Progress model: linear unlock (beat N ⇒ N+1 unlocks); stars from the constraint metric
    (`movesLeft`/`secondsLeft`/`mistakesLeft` thresholds in the level's `rewards`).
- Non-functional:
  - The bit-packing codec is **pure TS** and Vitest-tested (round-trip, boundary indices, forward-
    compatible unknown-episode reads). Only the thin MMKV read/write wrapper is RN and verified
    on-device.
  - MMKV usage follows the v4 factory pattern (`createMMKV()`, not `new MMKV()`) per project rules.
  - No secrets; no network. Progress is local-only (matches the "no backend in v1" decision).

## Architecture

- `src/meta/voyage-progress-codec.ts` — **pure**: `packEpisode(results) ↔ unpackEpisode(bytes)` over a
  2-bit-per-level field (`00` locked, `01` unlocked, `10`/`11` = stars). Vitest-tested.
- `src/meta/voyage-progress-storage.ts` — thin RN wrapper: `createMMKV()` instance, `loadEpisode`/
  `saveLevelResult` calling the pure codec; per-episode keys.
- `src/render/voyage/ribbon/` — `ribbon.tsx` (the virtualized scroll container + windowing),
  `ribbon-node.tsx` (a single level node: index, lock, stars, boss marker). Nodes are drawn over the
  Phase 6 backdrop; the window computes which indices are visible from scroll offset.
- `src/app/voyage.tsx` (map route) + the Voyage game route — compose backdrop (Phase 6) + board + HUD
  (Phase 8) + `use-voyage-state` (Phase 2). Level nodes call `generateVoyageLevel(index)` lazily on entry.

## Related Code Files

- Create: `src/meta/voyage-progress-codec.ts`, `src/meta/voyage-progress-storage.ts`
- Create: `src/render/voyage/ribbon/ribbon.tsx`, `src/render/voyage/ribbon/ribbon-node.tsx`
- Create: `src/app/voyage.tsx` (+ the Voyage game route file per the router's convention)
- Create: `src/meta/voyage-progress-codec.test.ts` (pure round-trip/boundary tests)
- Reference (do not change): `src/meta/use-voyage-state.ts` (Phase 2 hook), `src/core/voyage/
generate-level.ts` (Phase 4), `src/render/voyage/*` (Phase 6), existing `expo-router` routes +
  `src/meta/*` MMKV usage (the `createMMKV()` pattern)

## Implementation Steps

1. `voyage-progress-codec.ts` + tests: 2-bit pack/unpack, round-trip, boundary indices, unknown-episode
   read returns "all locked" (forward-compatible).
2. `voyage-progress-storage.ts`: `createMMKV()` wrapper, per-episode keys, load/save.
3. `ribbon.tsx` virtualization (visible-window from scroll offset) + `ribbon-node.tsx`.
4. `src/app/voyage.tsx` map route + Voyage game route; lazy `generateVoyageLevel` on node entry; wire
   backdrop + board + `use-voyage-state`.
5. On-device: scroll the ribbon across a long ladder (smooth, virtualized), enter/win a level, confirm
   progress persists across app restart and the next node unlocks.

## Success Criteria

- [x] Codec round-trips 2-bit progress; boundary + unknown-episode cases covered (`npm test` green).
- [x] Ribbon scrolls smoothly across an unbounded ladder without materializing all nodes (virtualized).
      (Windowed virtualizer — review-confirmed it never materializes all nodes; smoothness is on-device.)
- [ ] Winning a level persists stars + unlocks the next node, surviving an app restart (on-device).
      _(Write path + ratchet-up + derived unlock proven in code/tests; surviving a real restart is the
      owner's on-device check.)_
- [x] Voyage routes wire backdrop (Phase 6) + board + `use-voyage-state` (Phase 2) into a playable loop.
- [x] MMKV via `createMMKV()`; progress local-only; no secrets/network.

## Risk Assessment

- **Ribbon materializes the whole ladder ⇒ jank/memory blowup.** Signal: scroll stutter or memory
  growth on device. Response: strict windowing (only visible + buffer nodes exist); test with a large
  synthetic max index before sign-off.
- **Packing scheme can't grow.** Signal: a future star tier or per-level flag needs >2 bits. Response:
  version the episode key/header now (a 1-byte version prefix) so `unpackEpisode` can migrate; unknown
  version reads as "all locked" rather than corrupting.
- **Progress corruption on interrupted write.** Signal: a half-written key. Response: write the whole
  episode field atomically (single MMKV set of the packed buffer), never per-level partial writes.
