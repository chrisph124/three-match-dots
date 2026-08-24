---
title: 'Phase 8: Boss visuals, HUD and juice'
status: done
phase: 8
priority: P1
effort: '1.5d'
dependencies: [2, 6]
---

# Phase 8: Boss visuals, HUD and juice

## Overview

Make a boss _read_ as a boss and make the moment-to-moment feel good — with **zero bespoke art**.
Adds the constraint-aware HUD (incl. the color-grouped boss HP bar), the boss modifier signals, and
the pooled juice effects (shards, sweep ripple, seal thud), all with reduce-motion variants.

## Requirements

- Functional:
  - **HUD** (`src/render/voyage/voyage-hud.tsx`): shows the active constraint budget — moves remaining /
    seconds remaining / mistakes remaining — plus objective progress. Constraint-aware: it reads the
    Phase 2 `VoyageBudget` union and renders the right metric.
  - **Boss HP bar:** for the Caged Core, a **color-grouped HP bar** — one segment per color present in
    the cage cluster, draining as that color's cages are freed. This is what turns "free 8 cages" into
    a legible multi-phase boss fight.
  - **Boss modifier signals** (`boss-modifier.ts`): the non-art cues that mark a boss — boss title
    card on entry, the Phase 6 scene shift (desaturate/vignette), the HP-bar HUD, both-sided contrast
    emphasis. Driven by `theme.boss` / `voyage.isBoss`; no new sprites.
  - **Juice** (pooled effects): dot-pop **shards**, a **sweep ripple** when a loop/line sweeps a color,
    and a **seal thud** when a cage frees — all reusing the Reanimated + Skia effect layer, from a
    fixed **pool** (no per-event allocation).
  - **Reduce-motion:** every effect has a calm variant (reduced/again no large motion) honoring the OS
    reduce-motion setting.
- Non-functional:
  - Effects run on the **UI thread** (worklets) reusing the shipped `src/effects/` pattern; no JS↔native
    per-frame bridge traffic, no allocation in the hot path (fixed pools).
  - HUD math that feeds worklets stays pure (`geometry.ts` rule). No change to the board Canvas or the
    core — this layer is presentational, reading Phase 2 state.
  - Not Vitest-testable (Skia/Reanimated/worklet) → verified **on-device** per the project test boundary.

## Architecture

Under `src/render/voyage/`:

- `voyage-hud.tsx` — reads `VoyageState` (Phase 2): renders the constraint metric + objective progress;
  delegates the boss case to the HP bar.
- `voyage-boss-hpbar.tsx` — the color-grouped HP bar; segments = colors in the cage cluster (from
  `cagedCellIndices` + board colors), each draining as `foldObjectives` reports that color freed.
- `boss-modifier.ts` — pure-ish descriptor: given `theme.boss`/`voyage.isBoss`, returns the set of
  active boss signals (title card, scene-shift flag already handled in Phase 6, HP-bar on, contrast
  emphasis). Keeps "what makes a boss" in one place.
- `voyage-effects.ts` — the pooled juice: shard pool, sweep-ripple pool, seal-thud trigger; each with a
  reduce-motion branch. Reuses `src/effects/use-board-animation.ts` patterns (module-level mutators,
  no `.value` writes in component bodies — per project React-Compiler rule).

## Related Code Files

- Create: `src/render/voyage/voyage-hud.tsx`, `src/render/voyage/voyage-boss-hpbar.tsx`,
  `src/render/voyage/boss-modifier.ts`, `src/render/voyage/voyage-effects.ts`
- Reference (do not change): `src/effects/use-board-animation.ts` (the pooled-effect + module-mutator
  pattern), `src/core/voyage/voyage-state.ts` (Phase 2 state the HUD reads), `src/core/level/
level-script.ts` (`cagedCellIndices`), `src/render/voyage/board-panel.tsx` (Phase 6, the surface HUD
  overlays), `docs/creative-bible.md` (LOCKED tone — restrained juice, no confetti-spam)

## Implementation Steps

1. `voyage-hud.tsx`: constraint-aware budget + objective readout from Phase 2 state.
2. `voyage-boss-hpbar.tsx`: color-grouped segments from the cage cluster; drain on color-freed.
3. `boss-modifier.ts`: assemble the boss signal set from `voyage.isBoss`/`theme.boss`.
4. `voyage-effects.ts`: pooled shards / sweep ripple / seal thud, each with a reduce-motion variant,
   reusing the effect-layer pattern.
5. On-device: play the Caged Core — confirm the HP bar phases with color-frees, the boss reads as a
   boss (title + scene shift + HP bar), juice fires without jank, and reduce-motion calms it.

## Success Criteria

- [x] HUD shows the correct metric for each constraint (moves/seconds/mistakes) + objective progress.
- [x] The boss HP bar has one segment per cage color and drains as each color is freed (Caged Core
      reads as a multi-phase fight).
- [x] A boss is unmistakable via non-art signals (title + scene shift + HP bar + contrast) — zero new
      sprites.
- [x] Juice (shards / sweep ripple / seal thud) fires from fixed pools with no per-event allocation
      (review-confirmed pool discipline: ≤2 `fireShards`/event, ≤16 of 18 spark slots); no-jank is
      the owner's on-device check.
- [x] Reduce-motion produces calm variants of every effect (`useReduceMotion` gates every fire).
- [x] Tone stays within the LOCKED creative bible (restrained, papery — no confetti-spam).

## Risk Assessment

- **Juice overwhelms the Two-Dots restraint.** Signal: the boss feels like Candy Crush confetti,
  violating the LOCKED bible. Response: keep effects small and pooled; the bible is the acceptance
  authority — restrained shards/ripple, not particle storms.
- **HP bar desyncs from actual cage state.** Signal: a segment drains at the wrong time. Response: the
  bar reads the same `foldObjectives`/`cagedCellIndices` source of truth as the state machine — no
  parallel counter; verify against a scripted Caged Core solve on device.
- **Allocation in the effect hot path drops frames.** Signal: GC pauses during heavy sweeps. Response:
  fixed pools sized to the max simultaneous effects; no `new` in the per-event path (reuse the shipped
  effect-layer discipline).
