---
title: 'Phase 6: Environment diorama render'
status: todo
phase: 6
priority: P1
effort: '2d'
dependencies: [1]
---

# Phase 6: Environment diorama render

## Overview

Replace the near-black canvas with the **shadow-box diorama**: a warm biome fills the screen behind
an opaque dark inset card the board sits on. Ships **2 biomes** driven by the `theme` block. The board
Canvas stays untouched so gesture hit-testing is unaffected.

## Requirements

- Functional:
  - A **separate full-screen backdrop Skia `Canvas`** renders behind the board Canvas: sky gradient +
    parallax biome silhouettes, recolored per the `theme` block (biome, time-of-day variant,
    parallax seed, particle, trim).
  - The board sits on an **opaque dark inset panel** (the "shadow box"): a rounded card at luminance
    **L ≤ ~0.058** so **every** dot hue keeps its WCAG **3:1** contrast floor (existing red `#ff4d5e` /
    blue `#4f8cff` at L≈0.27 read cleanly against it).
  - **Extended palette (in scope):** grow the dot palette from 3 to **up to 5 hues** (`palette.ts`).
    Each new hue must (a) clear WCAG **3:1** against `PANEL_BASE` and (b) be **colorblind-
    distinguishable** (deutan/protan/tritan) from the other hues. The exact hue values are chosen here;
    `contrast-tokens.test.ts` asserts the floor for **all** hues, not just the original two.
  - `themeToScene(theme, paletteSize) → SceneParams` maps the data-driven `theme` block to concrete
    draw params; **unknown biome id ⇒ safe fallback** (a neutral biome), never a crash.
  - Ships **2 biomes** × their time-of-day variants (the vertical-slice set); the biome table is
    data-driven so biomes 3–5 are an art-track addition, not a code change.
  - A **boss theme modifier**: when `theme.boss`, the scene shifts (desaturated sky, heavier vignette,
    contrast bump) so a boss reads environmentally — no bespoke art.
- Non-functional:
  - The board Canvas **stays origin-(0,0), style-less** so the gesture worklet's touch→cell math is
    unchanged (the diorama is purely behind it). All new geometry math lives in `src/render/` and stays
    pure arithmetic (the `geometry.ts` rule) where it feeds worklets.
  - The two-Canvas split must not regress frame rate on device (backdrop is static/slow-parallax; no
    per-frame allocation).
  - Contrast tokens are defined once and asserted: `PANEL_BASE` L ≤ 0.058; a unit check on the token
    math guards the floor.

## Architecture

Under `src/render/voyage/`:

- `backdrop-canvas.tsx` — the full-screen backdrop `Canvas`: sky + layered biome silhouettes with
  slow parallax; consumes `SceneParams`.
- `biomes.ts` — the data-driven biome table (2 shipped): each biome = a set of vector silhouettes +
  recolor ramps (4 time-of-day variants) + particle/trim params. `themeToScene` + the unknown-id
  fallback live here.
- `board-panel.tsx` — the opaque dark inset card (the shadow box) the board draws on; owns the
  `PANEL_BASE`/contrast tokens.
- `contrast-tokens.ts` — `PANEL_BASE` (L ≤ 0.058) + the dot-vs-panel contrast assertions (pure math,
  Vitest-checkable via `geometry.ts`-style purity).

The Voyage game screen (Phase 7 route) stacks: `backdrop-canvas` (back) → `board-panel` → the existing
board Canvas (front, unchanged). Confirmed against the environment strategy report
(`plans/reports/design-260824-0746-saga-environment-strategy.md`); its "Voyage is timed" assumption is
**not** adopted — the diorama is constraint-agnostic and Voyage defaults to moves.

## Related Code Files

- Create: `src/render/voyage/backdrop-canvas.tsx`, `src/render/voyage/biomes.ts`,
  `src/render/voyage/board-panel.tsx`, `src/render/voyage/contrast-tokens.ts`
- Create: `src/render/voyage/contrast-tokens.test.ts` (the L ≤ 0.058 / 3:1 floor check for **all**
  hues — pure math)
- Modify: `src/render/palette.ts` (add the new dot hue(s), 3 → up to 5) — the one shared palette both
  Endless/Journey and Voyage read. **Append** at indices 3+; keep indices 0–2 byte-for-byte unchanged
  so Endless/Journey (which use `colors: 3`) are visually untouched.
- Reference (do not change): the existing board Canvas + `src/render/geometry.ts` (purity rule),
  `docs/creative-bible.md` (LOCKED look/feel — honor, don't edit)
- Docs sync: none required unless a token becomes a documented contract; the creative bible stays LOCKED.

## Implementation Steps

1. Extend `palette.ts`: append up to 2 new dot hues (indices 3+); pick values that clear 3:1 on
   `PANEL_BASE` and are colorblind-distinguishable; keep indices 0–2 unchanged.
2. `contrast-tokens.ts` + test: define `PANEL_BASE` and assert **every** palette hue clears 3:1 against it.
3. `biomes.ts`: 2 biomes, their silhouettes + time-of-day ramps, `themeToScene`, unknown-id fallback.
4. `backdrop-canvas.tsx`: full-screen Canvas, sky + parallax silhouettes from `SceneParams`.
5. `board-panel.tsx`: the opaque inset card at `PANEL_BASE`.
6. Boss modifier path in `themeToScene` (desaturate/vignette/contrast when `theme.boss`).
7. On-device check: diorama replaces black, all dot hues stay legible on the panel, no frame drop;
   verify both biomes and the boss modifier.

## Success Criteria

- [ ] The near-black background is gone; a warm biome fills the screen behind the board.
- [ ] The palette is extended to up to 5 hues (indices 0–2 unchanged); **every** hue clears ≥3:1
      contrast on the panel (`contrast-tokens.test.ts` green) and is colorblind-distinguishable.
- [ ] Board Canvas is unchanged (origin-0,0, style-less) — gestures behave exactly as before.
- [ ] 2 biomes + time-of-day variants render; unknown biome id falls back, never crashes.
- [ ] `theme.boss` visibly shifts the scene; no bespoke boss art added.
- [ ] No per-frame allocation in the backdrop; on-device frame rate holds.

## Risk Assessment

- **Diorama erodes dot contrast.** Signal: `contrast-tokens.test.ts` fails or dots look muddy on
  device. Response: the panel is the guard — dots always sit on `PANEL_BASE` (L ≤ 0.058), never on the
  biome; the token test blocks a regression before it ships.
- **Two Canvases regress frame rate.** Signal: jank on device. Response: backdrop is static / slow
  parallax with no per-frame allocation; if needed, snapshot the backdrop to a single image layer.
- **Touching the board Canvas breaks gestures.** Signal: hit-testing drifts. Response: do not modify
  the board Canvas or its transform — the diorama is strictly behind it; verify a chain draws on the
  correct cells on device before sign-off.
- **A new hue is indistinguishable (colorblind) or muddy on the panel.** Signal: a hue fails the 3:1
  token check, or playtesters confuse two colors. Response: the `contrast-tokens.test.ts` all-hues
  assertion blocks the contrast case pre-merge; run the palette through a deutan/protan/tritan check
  and reject a colliding hue before it ships. Falling back to 4 hues (not 5) is acceptable.
- **New hues regress Endless/Journey.** Signal: the existing modes look different. Response: append
  only at indices 3+; a snapshot/manual check confirms indices 0–2 are byte-for-byte unchanged.
