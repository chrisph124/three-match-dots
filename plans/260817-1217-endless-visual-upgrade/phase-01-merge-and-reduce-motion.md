---
phase: 1
title: 'Chain merge relay + drop bounce + useReduceMotion'
status: completed
priority: P1
effort: '1.5-2d'
dependencies: []
---

# Phase 1: Chain merge relay + drop bounce + `useReduceMotion`

> **Reworked 2026-08-17 (not a first cut).** A first version of this phase already
> shipped in commit `cb82754` (proportional chase toward the next cell, then a
> separate `playClear` popped every dot at once). On-device that read as _all dots
> slide, then all dots pop together_ — too fast, and the merge order was not legible.
> This rework replaces that model with a **sequential relay with a per-hop fade**.
> The rework lands as a **new commit** on top of `cb82754`; never amend the pushed
> commit.

## Overview

On commit, the linked dots collapse as a **traveling relay in drag order**: dot 1
slides into dot 2's cell and **fades out as it arrives**, then dot 2 slides into dot 3
and fades, and so on to the last dot — one hop at a time, like a wave running down the
chain. The **pop is folded into each hop** (a dot shrinks to nothing at the tail of its
own travel), so there is no separate "everyone pops at once" step anymore. The final
(terminal) dot fades in place as the finale beat. On a **sweep** (≥5 line / 2×2 loop
clears every same-color dot), the swept extras rush into the terminal cell **in lockstep
with the finale**, so the whole color collapses to one point and pops together.

New dropped dots (gravity refill after the clear) **settle with a gentle bounce**.

Ship a reusable `useReduceMotion()` hook in the same PR; with Reduce Motion on, both the
relay and the bounce are skipped and commit falls back to today's instant staggered pop.

## Requirements

- Functional: the drawn chain collapses **first→last, one hop at a time**. Each dot
  `chain[i]` travels to `chain[i+1]`'s static center and its radius shrinks to 0 over the
  **tail of that same hop** — arrival and pop are one motion, not two phases. Onset is
  staggered per rank so the hops read in order (`0→1`, then `1→2`, …), not simultaneously.
- Functional: the terminal cell (`chain[len-1]`) does not travel; it holds full size,
  then fades to 0 at the very end (the finale beat).
- Functional: on a sweep, the extra cleared dots (cells in `resolution.cleared` **not** in
  `chain`) travel into the terminal cell and fade **co-timed with the finale beat** — one
  unified collapse, not a scatter and not a delayed afterthought. On a plain (non-sweep)
  clear `cleared === chain`, so there are no extras and it is the pure chain relay.
- Functional: after the clear, refilled/fallen dots **overshoot their resting cell
  slightly, then settle** — a soft bounce. The overshoot is a **fixed pixel amount,
  independent of fall distance** (a dot that fell one cell and one that fell five cells
  bounce the same amount).
- Functional: Reduce Motion on → **no relay and no bounce**. `commit` runs today's
  staggered `playClear` pop and `applyAndDrop` drops with zero bounce. Byte-identical to
  today's motion.
- Non-functional: hot path stays allocation-free **per frame**; all merge/fade/bounce math
  lives in worklet `useDerivedValue`s reading shared values. The once-per-commit
  `playMerge` may allocate its rank/target arrays (mirrors `playClear`).
- Non-functional: the whole relay is bounded — for a 6-dot chain it must not exceed
  ~500ms end to end **including the terminal fade** (see Cadence). It extends the
  `isResolving` gesture-lock window, so it stays snappy.

## Architecture

### Motion model — relay, not chase-then-clear

The old model ran `playMerge` (slide) then `playClear` (pop) as two sequential tweens.
The rework **folds the pop into the merge** and **retires `playClear` from the default
motion path** (per brainstorm counsel, option iii):

- Default path: `playMerge` does position **and** fade; its `onDone` drives `applyAndDrop`
  directly — one fewer hop, and the single-tween invariant proof gets simpler.
- Reduce-Motion path: `playClear` is kept **byte-identical** as the RM fallback only. It
  is not deleted; `commit` still calls it when RM is on.

### Cadence — two absolute-ms constants, then normalized

Timing is driven by two wall-clock constants plus a clamp, converted to normalized
fractions once per commit (brainstorm counsel — absolute ms reads consistently regardless
of chain length, unlike a pure proportional scheme):

```
MERGE_STEP_MS   = 60    // per-rank onset delay — the "wave" spacing between hops
MERGE_TRAVEL_MS = 160   // one hop's travel+fade window
MERGE_MS_MAX    = 500   // hard clamp on the whole relay (len 6 ≈ 160 + 5*60 = 460ms)
```

Per commit, `playMerge` computes (worklet-safe arithmetic, no allocation beyond the two
rank/target arrays):

```
len   = chain.length
total = min(MERGE_TRAVEL_MS + max(len-1, 0) * MERGE_STEP_MS, MERGE_MS_MAX)
step  = len > 1 ? min(MERGE_STEP_MS, (MERGE_MS_MAX - MERGE_TRAVEL_MS) / (len-1)) : 0
mergeStep.value   = step / total            // normalized per-rank onset
mergeTravel.value = MERGE_TRAVEL_MS / total // normalized single-hop window
mergeT.value = withTiming(1, { duration: total }, onDone)
```

The `step` formula shrinks the wave spacing only when a very long chain would otherwise
blow the clamp, so the last beat always lands exactly at `mergeT = 1 = total`. **The
terminal fade is inside the clamp** — a 6-chain stays ≤500ms end to end; the finale does
**not** add ~150ms on top. (Confirm the exact feel on device; the constants are dials.)

### Shared values (replace the proportional stagger)

`BoardAnimation` swaps the old `mergeSpan` (proportional normalizer) for two normalized
scalars, and gains a bounce amplitude. Keep `mergeRank`, `mergeTarget`, `mergeT`:

- `mergeRank: SharedValue<number[]>` — onset rank: `0..len-1` for chain dot `chain[i]`;
  **`len-1` for a swept extra** (co-times the extra with the terminal beat); `-1` for
  cells not clearing.
- `mergeTarget: SharedValue<number[]>` — the cell whose **static** center this dot chases:
  next chain dot for a chain dot; terminal cell for a swept extra; **`-1` for the terminal
  cell itself** (stays put, fades in place) and for non-clearing cells.
- `mergeStep: SharedValue<number>` — normalized per-rank onset delay (`step/total`).
- `mergeTravel: SharedValue<number>` — normalized single-hop window (`MERGE_TRAVEL_MS/total`).
- `mergeT: SharedValue<number>` — 0→1 driver.
- `bounce: SharedValue<number>` — drop-bounce amplitude in **px**; `0` disables (the RM
  gate and every non-drop `playMove` caller write 0).

`resetMerge` resets `mergeRank`/`mergeTarget` to `-1`, `mergeStep`/`mergeTravel` to 0,
`mergeT` to 0. `mergeSpan` is removed from the type, the memo, and `resetMerge`.

### `playMerge(anim, chain, cleared, onDone)` (module-level, worklet-safe)

Same allocate-per-commit shape as today, with the rank/target assignment and the new
cadence scalars:

```
for i in 0..len-1:
  rank[chain[i]]   = i
  target[chain[i]] = i < len-1 ? chain[i+1] : -1     // terminal stays put
terminal = chain[len-1]
for c in cleared where rank[c] < 0:                  // sweep extras only
  rank[c]   = len - 1                                 // co-time with the finale
  target[c] = terminal                                // rush the collapse point
// compute total/step, set mergeStep/mergeTravel (see Cadence), then:
mergeT.value = withTiming(1, { duration: total }, () => { 'worklet'; runOnJS(onDone)(); })
```

Chain membership is still read straight off the assigned rank (chain cells get a rank in
the loop; any still-`-1` cleared cell is a sweep extra — no `Set`/`includes`). The
single-tween-in-flight invariant is preserved and **simpler**: `onDone` now triggers
`applyAndDrop` directly (not `playClear`), and the next write to `mergeT` is `resetMerge`,
reachable only from inside `applyAndDrop`, itself reachable only from this `onDone`. Update
the reachability comment on `mergeT` to say "triggers `applyAndDrop`."

### `dot-layer.tsx` — position + folded fade in the existing hooks

**`cx`/`cy` (`mergeAxis`)** — replace the `MERGE_STAGGER`/`mergeSpan` proportional formula
with the per-rank absolute model. Terminal (`target < 0`) stays at base:

```
if (rank < 0 || target < 0) return base;   // not merging, or terminal: hold position
const onset = rank * mergeStep;
const local = clamp((mergeT - onset) / mergeTravel, 0, 1);
return base + (targetCenter - base) * ease(local);   // ease = smooth in-out, dial
```

**`radius`** — extend the **existing** radius `useDerivedValue` with a **merge-fade
branch** (do NOT add a fourth hook). The three sources are mutually exclusive by path:
highlight (idle), `clearRank` (RM path only), `mergeRank` (default path). For a merging
dot, the dot rides at full radius for the first part of its own `local`, then shrinks to 0
over the tail — this is the folded pop:

```
const mrank = anim.mergeRank.value[cell];
if (mrank >= 0) {
  const onset = mrank * mergeStep;
  const local = clamp((mergeT - onset) / mergeTravel, 0, 1);
  const fade  = clamp((local - FADE_HOLD) / (1 - FADE_HOLD), 0, 1);  // FADE_HOLD ~0.65
  return base * (1 - fade);          // full size until FADE_HOLD, then shrink to 0
}
// else fall through to the existing clearRank branch (RM path), then base.
```

The terminal cell uses the **same** machinery: its `rank = len-1`, so its `local` runs one
`mergeTravel` window starting at `(len-1)*mergeStep` — it holds full then fades right at
`mergeT → 1`. That is the finale beat, no special-casing needed. Swept extras share
`rank = len-1`, so they travel into the terminal **and** fade on the same beat.

Chase targets are **static original centers** (`centerX/centerY(target, layout)`), so
there is no live moving-target dependency in the hot path.

### `dot-layer.tsx` — drop bounce in `cy`

The fall already lands via `cy = base + offsetY*(1-moveT)`. Applying an overshoot easing to
`moveT` would scale the overshoot by `offsetY` (fall distance) and let a tall-column dot
cross its neighbor — the known trap. Instead add a **fixed-pixel** bounce term driven by a
pure-arithmetic envelope of `moveT`, decoupled from `offsetY`:

```
cy = base + offsetY*(1 - moveT) + anim.bounce.value * bounceEnv(moveT);
```

`bounceEnv(t)` is a worklet: 0 until the dot is nearly home, then a single soft overshoot
that returns to 0 exactly at `t = 1` (e.g. a half-sine hump on `[B_START, 1]`,
`B_START ~0.72`). Amplitude is `anim.bounce.value` px (a small fraction of `cellSize`,
`BOUNCE_PX ~0.09*cellSize`, dial). Because the term is a fixed px independent of
`offsetY`, every dropped dot bounces the same amount and none can overshoot into a
neighbor's cell. Bounce is uniform across the falling batch (one global `moveT`); per-dot
fall stagger stays out of scope this pass.

### `use-game-state.ts` — commit branch + bounce param

```
if (!resolution) { unlock(chainState); return; }
if (reduceMotionRef.current) {
  playClear(anim, resolution.cleared, () => applyAndDrop(resolution));   // RM: today's pop
} else {
  playMerge(anim, chain, resolution.cleared, () => applyAndDrop(resolution));  // relay → drop
}
```

`playMove` gains a `bouncePx` parameter; it writes `anim.bounce.value = bouncePx` before
starting `moveT`. `applyAndDrop`'s post-clear drop passes `reduceMotionRef.current ? 0 :
BOUNCE_PX`. **Every other `playMove` caller** (initial settle, shuffle-slide) passes `0` —
the bounce is for dropping dots only, so a horizontal reshuffle does not bob. `resetMerge`
is still called at the start of `applyAndDrop` alongside `resetClear`.

Thread Reduce Motion through a **ref** updated each render (same pattern as the existing
`latest` ref) so `commit` never goes stale. `useGameState` gains a `reduceMotion: boolean`
option; `game.tsx` passes `useReduceMotion()`.

`useReduceMotion()` (`src/effects/use-reduce-motion.ts`) — `useState` seeded from
`AccessibilityInfo.isReduceMotionEnabled()`, subscribed to `reduceMotionChanged`, returns
the boolean. Reused by Phases 4 and 6.

## Related Code Files

- Create: `src/effects/use-reduce-motion.ts`
- Modify: `src/effects/use-board-animation.ts` — swap `mergeSpan`→`mergeStep`+`mergeTravel`,
  add `bounce`; add `MERGE_STEP_MS`/`MERGE_TRAVEL_MS`/`MERGE_MS_MAX`/`BOUNCE_PX`; rewrite
  `playMerge` (relay cadence + extras at `len-1`); add `bouncePx` param to `playMove`; keep
  `playClear`/`resetClear` byte-identical (RM fallback); update `resetMerge`.
- Modify: `src/render/dot-layer.tsx` — rewrite `mergeAxis` (per-rank absolute model), add
  the merge-fade branch to the existing `radius` hook, add `bounceEnv` + bounce term to
  `cy`. Drop the `MERGE_STAGGER` import; keep `STAGGER_SPAN` (RM `clearRank` path).
- Modify: `src/meta/use-game-state.ts` — `reduceMotion` option + ref; relay-vs-`playClear`
  branch in `commit`; `bouncePx` on the drop `playMove` (0 elsewhere); `resetMerge` in
  `applyAndDrop`.
- Modify: `src/app/game.tsx` — call `useReduceMotion()`, pass into `useGameState`.

## Implementation Steps

1. Add `use-reduce-motion.ts` (seed + `reduceMotionChanged` listener, cleanup on unmount).
2. Rework `BoardAnimation`/`useBoardAnimation`: remove `mergeSpan`; add `mergeStep`,
   `mergeTravel`, `bounce`; add the four timing/px constants.
3. Rewrite `playMerge` (relay cadence, extras co-timed at `len-1`, folded-fade scalars);
   keep `playClear` untouched; update `resetMerge`; add `bouncePx` to `playMove`.
4. Rewrite `dot-layer.tsx` `mergeAxis`; add the merge-fade radius branch and the `cy`
   bounce term + `bounceEnv`.
5. Add `reduceMotion` option/ref to `useGameState`; branch `commit`; pass bounce px on the
   drop; `resetMerge` in `applyAndDrop`.
6. Wire `useReduceMotion()` in `game.tsx`.
7. On-device feel test; tune `MERGE_STEP_MS`/`MERGE_TRAVEL_MS`/`FADE_HOLD`/`BOUNCE_PX`.

## Success Criteria

- [x] Committing a chain reads as a **wave**: hop `1→2`, then `2→3`, … in order, each dot
      fading as it lands — not all-slide-then-all-pop, and not out of order.
- [x] The terminal dot fades last, as a distinct finale beat.
- [x] A ≥5 straight run / 2×2 loop still sweeps all same-color dots, and the swept extras
      rush into the collapse point **on the finale beat** (one unified collapse), then pop.
- [x] A 6-dot chain resolves in ≤~500ms end to end including the terminal fade (feel, not
      a stopwatch gate).
- [x] New dropped dots overshoot and settle with a soft, distance-independent bounce; a
      one-cell drop and a five-cell drop bounce the same, and no dot bobs through a
      neighbor.
- [x] Reduce Motion on → no relay, no bounce; commit path byte-identical to today.
- [x] No new per-frame allocation in the worklet; `lint` + `typecheck` + `test` green
      (existing core tests unchanged and passing).

## Risk Assessment

- **Relay + finale feels sluggish or still too fast.** Signal: input lag, or the wave
  reads rushed/muddy on device. Response: `MERGE_STEP_MS`/`MERGE_TRAVEL_MS`/`MERGE_MS_MAX`
  are dials; raise step for a slower wave, lower the clamp for snappier long chains. Feel
  call, on device.
- **Folded fade pops too early/late within a hop.** Signal: dots vanish before arriving,
  or linger past the cell. Response: `FADE_HOLD` dial (fraction of the hop spent at full
  size before the shrink); decide on device.
- **Bounce overshoot crosses a neighbor.** Signal: on a tall emptied column a settling dot
  visibly dips into the cell below. Response: the term is a **fixed px** decoupled from
  `offsetY` by design, so this should be structurally impossible; if a large `BOUNCE_PX`
  still looks like it touches, clamp it and/or shorten the envelope tail. Verify on an
  emptied 6-tall column.
- **Merge/bounce are Reanimated/worklet → not Vitest-testable.** Signal: no unit coverage.
  Response: expected per the repo test boundary; verify on device. Keep the worklet math
  trivial and inline.
- **Stale Reduce Motion in `commit` closure.** Signal: toggling RM mid-session has no
  effect on relay/bounce. Response: read RM from a ref updated each render (mirrors the
  existing `latest` ref); the bounce reads `anim.bounce.value`, which `playMove` writes to
  `0` under RM, so both gates share the same source of truth.

## Assumptions to confirm on device

- **Min chain length ≥ 3** (Two Dots link rule). The `len === 1` path is guarded (no hops,
  terminal-only fade, `step = 0`) but is not expected to occur; confirm the engine never
  commits a 1- or 2-cell chain.
- **~500ms clamp includes the terminal tail fade** (resolved: yes, by construction — the
  terminal fades within its own `mergeTravel` window which ends at `mergeT = 1 = total ≤
MERGE_MS_MAX`). Confirm the finale still reads as a satisfying pop and not a clipped one.
