---
title: 'Phase 2: Lifetime sweep counters'
status: completed
---

# Phase 2: Lifetime sweep counters

## Overview

Persist **lifetime per-color color-sweep counts** as additive MMKV keys alongside the existing lifetime
`'score'` odometer. These are the durable substrate a later read-out surfaces ("Red swept 128× / Green
94× / Blue 71×"). No UI in this phase — persistence + wiring only, so it lands with zero collision against
the in-flight visual plans.

## Requirements

- Functional:
  - On every **color-sweep** commit (`resolution.kind !== 'plain'`), increment a per-swept-color counter
    by 1. Plain chains increment nothing.
  - Counters are **lifetime** (like `score`): they accumulate across runs and **survive `resetScore()`**
    (resetting the score does not wipe your collection history).
  - Expose typed read/increment/reset helpers so a future read-out and a future explicit "reset stats"
    action have a real API (reset-stats is NOT wired to any UI here).
- Non-functional:
  - `src/meta/score-storage.ts` stays the **only** module that touches MMKV (single-owner invariant).
  - `src/core/` stays untouched — counters are meta/persistence, driven by the `Resolution` already
    returned from core. No new core state.
  - Additive only: new keys, existing `'score'` key and its semantics unchanged.

## Architecture

**Persistence (`src/meta/score-storage.ts`):** add one key per color, namespaced to avoid collision:

```ts
const SWEEP_COUNT_PREFIX = 'sweeps.'; // 'sweeps.0', 'sweeps.1', 'sweeps.2' (Color index)

export function readSweepCounts(colors: number): number[]; // 0-filled if unset
export function incrementSweepCount(color: Color): void; // += 1 for one color
export function resetSweepCounts(colors: number): void; // explicit stats reset (not called by resetScore)
```

- `resetScore()` is left **exactly as-is** — it clears only `'score'`. That is the invariant "counters
  survive score reset." A dedicated `resetSweepCounts()` exists for a future explicit action.
- Keys are read on demand (no in-memory cache added) — matches the existing pull model.

**Wiring — MUST be inside `applyAndDrop`, NOT the score-persist point (red-team F3b).** The obvious-looking
"increment where the score is persisted" is **wrong**: score is persisted in `publish` → `onScoreChange`,
and `publish` fires **twice** on the sweep→deadlock path (`applyAndDrop` publishes at `use-game-state.ts:133`,
then `settle` re-publishes the shuffled board at `:117`). `writeScore` is an absolute idempotent write so a
double-fire is harmless for score; `incrementSweepCount` is a **relative `+=1`** so the same double-fire
would silently, permanently corrupt a lifetime key on every sweep-into-deadlock.

Correct placement: inside `applyAndDrop`, **immediately after** `applyResolution(latest.current, resolution)`
(`use-game-state.ts:125`), guarded by `resolution.kind !== 'plain'`:

```ts
const next = applyResolution(latest.current, resolution);
if (resolution.kind !== 'plain') incrementSweepCount(resolution.color); // exactly once per commit
```

`applyAndDrop` runs exactly once per commit (from `commit` → `applyAndDrop`); `settle` carries no
`resolution`, so it cannot re-increment. This mirrors where the score fold already happens (inside
`applyResolution`), keeps the increment off the animation ticks (ticks never call `applyAndDrop`), and
leaves the `publish`→`settle`→`unlock` chain untouched (MUST-check 1). One synchronous MMKV write per sweep;
sweeps are rare, no perf concern.

**Types:** `Color` is already the core color index type; counters are indexed by it. No new core type.

**Test boundary (red-team F3a).** `src/meta/score-storage.ts` imports native MMKV and `vitest.config.ts`
`include` is `src/core/**` + three named `src/render` specs — so **no `src/meta/*.test.ts` would run, and it
could not run anyway** (native module; mocking it would violate the repo's no-mocks rule and the documented
test boundary). A Vitest "counter jumps by 2" guard is therefore **fiction**. This layer is verified like
the other native layers: **code review** (increment is in `applyAndDrop`, once, `kind !== 'plain'`; `resetScore`
still touches only `'score'`) **+ on-device** verification. The single-fire is guaranteed _structurally_ by
placement, not by a test.

## Related Code Files

- Modify: `src/meta/score-storage.ts` (add sweep-count keys + read/increment/reset helpers; `resetScore` untouched)
- Modify: `src/meta/use-game-state.ts` (increment **inside `applyAndDrop`, after `applyResolution` at :125**, `kind !== 'plain'` guard — NOT in `publish`)
- Verification: **code review + on-device** (this layer is native/hook — not Vitest-reachable, F3a); no `src/meta/*.test.ts` (it would neither be included nor runnable)

## Implementation Steps

1. **Green:** implement `readSweepCounts` (0-filled default), `incrementSweepCount` (per-color `+=1`),
   `resetSweepCounts` in `score-storage.ts` using the existing `createMMKV()` instance (v4 factory — do not
   `new MMKV()`); leave `readScore`/`writeScore`/`resetScore` **unchanged** (`resetScore` clears only `'score'`).
2. **Green:** wire the increment **inside `applyAndDrop`, immediately after `applyResolution` (`:125`)**,
   guarded by `resolution.kind !== 'plain'`. Do **not** place it in `publish`/`settle` (double-fires on the
   deadlock path, F3b).
3. **Verify:** `npm run lint`, `npm run typecheck`, `npm run coverage:diff`, `npm test` (must show no existing
   test changed — this phase adds none). **Code review** confirms the single-fire placement + `resetScore`
   scope. **On-device**: sweep a color, background/relaunch, read counts; confirm a sweep-into-deadlock
   increments by exactly 1; confirm `resetScore` leaves counts intact.

## Todo

- [ ] sweep-count keys + read/increment/reset helpers in `score-storage.ts`
- [ ] `resetScore()` left byte-identical (counters survive)
- [ ] increment wired **inside `applyAndDrop` after `applyResolution`**, `kind !== 'plain'` guard (NOT `publish`)
- [ ] code-review confirms single-fire placement + `resetScore` scope
- [ ] on-device: accumulation, sweep-into-deadlock == +1, survives score reset
- [ ] lint / typecheck / coverage green; no existing test edited

## Success Criteria

- [x] Per-color sweep counters accumulate across runs and are readable via `readSweepCounts`.
- [x] `resetScore()` leaves sweep counters intact; `resetSweepCounts()` clears them.
- [x] `score-storage.ts` remains the sole MMKV owner; `src/core/` unchanged.
- [x] Increment fires **exactly once per sweep commit** — verified on the sweep→deadlock path (the F3b
      double-publish case) — never on animation ticks; `publish`→`settle`→`unlock` chain unchanged.
- [x] `npm run lint` / `typecheck` / `coverage:diff` green; `npm test` unchanged (no new/edited spec).

## Risk Assessment

- **Double-count on the deadlock path (F3b)** — increment placed in `publish`/`onScoreChange`, which fires
  twice when a sweep leaves no legal move (`applyAndDrop` publishes, then `settle` re-publishes the shuffle).
  _Signal:_ a sweep-into-deadlock adds 2 to a counter (a _lifetime_ key — permanent corruption). _Response:_
  place the increment in `applyAndDrop` after `applyResolution` (once per commit); verify the deadlock case
  on-device. Note the inverse fear ("increments on animation ticks") is impossible — ticks never call
  `applyAndDrop`.
- **No automated guard (F3a)** — this layer can't be Vitest-tested (native MMKV; `src/meta` not in the
  vitest `include`). _Response:_ accept the repo's documented boundary — code review + on-device, same as the
  Skia/gesture layers; the single-fire is structural (placement), not test-enforced.
- **`resetScore` accidentally clearing counters** (e.g. a future "clear all keys" refactor). _Signal:_ the
  on-device "survives reset" check fails. _Response:_ keep `resetScore` scoped to the `'score'` key only.
- **Key namespace collision** with a future settings/meta store. _Signal:_ unrelated value under
  `sweeps.*`. _Response:_ the `sweeps.` prefix + documented single-owner module.
