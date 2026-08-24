---
phase: 5
title: 'Cage overlay render layer'
status: done
priority: P1
effort: '1.5-2d'
dependencies: [3]
---

# Phase 5: Cage overlay render layer

## Overview

Draw the cage. A new sibling overlay layer (the `VoyageEffectsLayer` pattern — absolute-positioned,
`pointerEvents="none"`, one animated sub-component per caged cell) renders a folded-paper cage plus a
remaining-layer indicator over each caged dot, in BOTH modes, and animates a rattle + pip-decrement
off `protectedHits` so a chip-only commit gives visible feedback. On-device verified (worklet/native —
not Vitest-testable).

## Requirements

- Functional:
  - New `src/render/cage-overlay-layer.tsx` (name per repo convention) copying the
    `VoyageEffectsLayer` structure: absolute over the board, `pointerEvents="none"`, maps `caged`
    entries to per-cell sub-components positioned via `centerX`/`centerY`/`cellSize` from
    `geometry.ts` (reuse — do NOT recompute geometry in the component).
  - Each cell draws: the paper cage frame + a remaining-layer indicator. Indicator = pips (one per
    remaining layer) for small N, per the creative bible; a numeric fallback is acceptable if pips
    crowd the cell. Shape carries distinctness (bible §2.4 — not colour alone).
  - Mount on BOTH screens: `voyage-game.tsx` (after `VoyageEffectsLayer`, ~L165, reading
    `voyage.caged`) and `journey.tsx` (its FIRST sibling overlay — journey has no effects layer yet).
    The journey mount depends on Phase 3 having added `caged` + `JourneyClearEvent` to `useJourneyState`
    (red-team F1); without that plumbing there is nothing to read here. Follow the same
    absolute/`pointerEvents="none"` pattern.
  - **Update the incumbent cage juice for Set→Map** (red-team F3): `voyage-juice.ts:68`
    `fireCageJuice(fx, prev, next)` iterates `for (const idx of prev)` and `voyage-game.tsx:111-119`
    diffs `prevCaged`. With a Map, a **free** is a key that disappeared and a **chip** is a key whose
    value dropped — the diff must distinguish them (free → pop juice as today; chip → the new
    rattle+pip). Iterate `.keys()`; compare `prev.get(idx)` vs `next.get(idx)`.
  - Animate off the Phase-3 `chipped`/`protectedHits` clear-event channel: a **rattle** on the chipped
    cage(s) + a **pip decrement** the moment a layer is stripped (Reanimated `useAnimatedStyle` per
    cell, mutations in a module-level worklet-safe function per the React-Compiler rule — no `.value`
    writes in component bodies). A **pop** on the final layer reuses the existing clear animation
    (the cell is in `resolution.cleared` then).
  - `src/render/voyage/voyage-boss-hpbar.tsx` (correct path — red-team F4) counts **layers remaining
    per colour**, not cages remaining. It already groups by colour: `tallyByColor(caged, board)` reads
    `board[idx]` for each caged cell (`:19-26,40-46`). With the Set→Map change it must sum **Map values**
    (layers), not count keys: the mount snapshot seeds per-colour totals from `cagedCells(level)` summing
    `layers` (not `cagedCellIndices`, which has no layers), and the live tally sums `caged.get(idx)` over
    `caged.keys()`. So a boss whose red cages total 12 layers shows 12 for red and ticks down per chip,
    not per free. The bar is **per-colour**, not one flat 24 — do not frame it as a single total.
  - `src/render/voyage/voyage-hud.tsx` (`:16,79`) forwards the `caged` prop to the HP bar — its prop
    type changes `ReadonlySet → ReadonlyMap` too (red-team F4).
- Non-functional: `board-canvas.tsx` stays at origin, untouched — cages are a sibling layer only.
  `geometry.ts` stays pure arithmetic (no new impurity). Art within LOCKED `creative-bible.md` §2.4
  (folded paper, solid + shadow, no texture yet, muted). Files <200 lines. No `any`.

## Architecture

Same layering discipline as effects: the board canvas owns dots at (0,0); everything additive (link
path, pops, now cages) is a stacked absolute sibling reading the same geometry. The overlay is a pure
function of `caged: Map` (what to draw + where + how many pips) plus the transient `chipped` event
(what to animate this frame). No new state store — it reads the hook's `vstate.caged` and the clear
event the hook already emits (Phase 3).

Risk A is the reason this phase is P1, not polish: a chip-only commit yields nothing in
`resolution.cleared`, so WITHOUT this rattle+pip animation the cage still "feels unsolvable" — the
exact original complaint, reborn. The animation IS the fix, so it's an on-device acceptance gate, not
a nice-to-have.

## Related Code Files

- Create: `src/render/cage-overlay-layer.tsx` (shared by both modes — kept at `render/` root, not
  under `render/voyage/`, since journey mounts it too)
- Modify: `src/app/voyage-game.tsx` (mount overlay after effects layer ~L165; update the `prevCaged`
  diff at `:111-119` and the `caged={voyage.caged}` prop at `:116` for the Map — red-team F3)
- Modify: `src/app/journey.tsx` (mount overlay — first sibling overlay here; reads Phase-3 `caged` + event)
- Modify: `src/render/voyage/voyage-boss-hpbar.tsx` (correct path — tally layers per colour, not cages)
- Modify: `src/render/voyage/voyage-hud.tsx` (`:16,79` — forwards `caged`, prop type Set→Map)
- Modify: `src/render/voyage/voyage-juice.ts` (`:68` `fireCageJuice` — Map diff, chip vs free)
- Reference: `src/render/voyage/voyage-effects-layer.tsx` (pattern to copy), `src/render/geometry.ts` (reuse)
- No new Vitest (RN/worklet) — verify on device

## Implementation Steps

1. Build `cage-overlay-layer.tsx` from the `VoyageEffectsLayer` skeleton: absolute, `pointerEvents`
   none, map `caged` → positioned sub-components; draw static paper frame + pips first (no animation).
2. Mount on `voyage-game.tsx`, verify on device: a first cage level shows a visible cage + correct pip
   count over the caged dots.
3. Mount on `journey.tsx` (japan-01), verify same.
4. Wire the chip animation: rattle + pip-decrement off `chipped`; pop on final layer via existing
   clear anim. Move all `.value`/ref mutations into module-level worklet-safe functions (React-Compiler
   `immutability`/`refs` rules — do not disable).
5. Update `voyage/voyage-boss-hpbar.tsx` + `voyage/voyage-hud.tsx` to sum layers **per colour** (Map
   values); verify each colour's segment reads its layer total (e.g. a colour with 4 three-layer cages
   shows 12) and ticks down per chip, not per free.
6. On-device pass: mixed chain, chip-only chain, and a sweep hitting mixed cages each give distinct,
   readable feedback; chip-only commit returns input cleanly (ties to Phase 3 unlock).

## Success Criteria

- [ ] Cages visible with correct remaining-layer pips in BOTH modes (on-device)
- [ ] Chip → rattle + pip decrement; final layer → pop; each distinct and readable (on-device)
- [ ] Chip-only commit shows feedback AND does not lock input (Risk A gate, on-device)
- [ ] `voyage-boss-hpbar` tallies layers **per colour** (Map values), decrements per chip (on-device)
- [ ] `board-canvas.tsx` unchanged; `geometry.ts` still pure; overlay `pointerEvents="none"`
- [ ] Art matches creative bible §2.4; `typecheck` + `lint` green; no `any`

## Risk Assessment

- **Risk A — chip feedback gap = original complaint reborn.** If the rattle/pip animation is skipped
  or fires only on free, a chip-only commit looks like nothing happened. Signal: playtester says "I
  cleared the colour and the cage didn't do anything." Response: the animation is a hard on-device gate
  here; do not mark the phase done until a chip visibly rattles + drops a pip.
- **pointerEvents leak** — an overlay that captures touches breaks the gesture that reads through it.
  Signal: dragging over a caged cell stops registering. Response: assert `pointerEvents="none"` on the
  layer and every sub-view.
- **React-Compiler lint error** on `.value`/ref writes in the component body. Response: module-level
  worklet-safe mutation functions (the `playClear`/`playMove` pattern) — never disable the rule.
- **Pip crowding at N=3** in a small cell. Response: numeric fallback within the bible's restraint;
  decide on device.
