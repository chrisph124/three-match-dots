---
title: 'Endless plain board (like Journey)'
description: 'Render Endless mode like Journey — flat dots centered on the plain dark SCREEN_BACKGROUND, no framed board panel and no city-skyline backdrop — and delete the now-dead backdrop/panel/city-theme subsystem.'
status: completed
priority: P1
effort: '~0.5 dev-day, 1 PR'
tags: [endless, visual, skia, cleanup]
created: 2026-08-18
status_note: "Implemented + reviewed 2026-08-18. Gates green: typecheck clean, lint 0 errors, tests 220/220. On-device HARD GATE remains the user's step."
blockedBy: []
blocks: []
supersedes: 260817-1217-endless-visual-upgrade (Phase 3 backdrop direction + Phase 4 milestone themes)
---

# Endless plain board (like Journey)

## Overview

Reverse the just-shipped "dark city skyline + framed board panel" look for **Endless**.
Endless should render **exactly like Journey**: the flat colour dots centered on the
plain dark `SCREEN_BACKGROUND`, with the score above and Back below — no framed panel,
no city backdrop. Then delete the now-orphaned backdrop/panel/city-theme code so no dead
render paths remain. User-approved scope: **Full cleanup** (delete the files, drop the
planned milestone-city feature).

This does **not** touch game logic, the dots' look/animation, or Journey.

## Brainstorm contract

- **Outcome:** Endless = flat dots on the plain dark `SCREEN_BACKGROUND`, score above /
  Back below, structurally identical to Journey. No panel, no skyline.
- **Constraints:** No game-logic changes (`src/core/**`, `use-game-state.ts` untouched);
  `DOT_COLORS[0..2]` frozen; Journey stays pixel-identical; dots stay dead-flat; one Skia
  canvas; no new deps; no blur/gradient. Effects/render/app visual layers only.
- **Non-goals:** Changing Journey; altering dot rendering or animation; reverting the
  Phase 2 geometry origin-offset primitive (tested, general, defaults to no-op).
- **Acceptance:** Endless screen shows centered flat dots on dark ground + score + Back,
  matching Journey's framing; `npm run typecheck`, `npm run lint`, `npm test` all green;
  no reference to `backdrop`/`board-panel`/`city-themes`/`PANEL_*`/`CITY_THEMES` remains
  in `src/`; on-device feel confirmed (HARD GATE, user step).

## Changes

### Modify

- **`src/app/game.tsx`** — mirror `journey.tsx`'s render idiom:
  - `const { width } = useWindowDimensions();` (drop `height`, drop `useSafeAreaInsets`).
  - `const boardSize = Math.min(width - 32, 400);` (Journey's formula).
  - `makeLayout(rows, cols, boardSize)` — no origin args.
  - Remove the `backdrop` memo and the `backdrop` prop.
  - Container: flex-centered column, `gap: 24`, `backgroundColor: SCREEN_BACKGROUND`.
  - Layout: score `<Text>` (fontSize 40 / weight 700 / `TEXT_COLOR` / tabular-nums) as a
    centered flex child above the board; `<Link href="/">Back</Link>` (fontSize 18 /
    `TEXT_COLOR`) below. Drop the absolute overlays + `pointerEvents` plumbing (no longer
    needed — HUD are flex siblings, not overlapping the board), matching Journey.
  - Imports: drop `useSafeAreaInsets`, drop `CITY_THEMES`; add `SCREEN_BACKGROUND`.

- **`src/render/board-canvas.tsx`** — single (Journey) path only:
  - Drop imports of `Backdrop`, `BoardPanel`, and the `CityTheme` type.
  - Remove `BackdropSpec`, `PANEL_PAD`, `PANEL_RADIUS`, and the `backdrop?` prop.
  - Canvas style is always `{ width: boardWidth, height: boardHeight }` (keep the memo).
  - Remove the backdrop `<>…</>` branch; keep `LinkPath` + `DotLayer`.
  - Simplify the coordinate-invariant + dead-flat-dots doc comments to the single path.

- **`src/render/contrast.test.ts`** (moved from `src/render/themes/contrast.test.ts`) —
  trim to the still-true invariant: the frozen dots and the HUD `TEXT_COLOR` clear WCAG
  contrast on `SCREEN_BACKGROUND` (the one ground both modes now render on). Import from
  `./palette` only; drop all `city-themes`/`PANEL_*`/scene-swatch assertions. Rewrite the
  header comment to the palette-only scope.

- **`vitest.config.ts`** — change the include entry `src/render/themes/contrast.test.ts`
  → `src/render/contrast.test.ts`; update the accompanying comment (no more `themes/`).

- **`src/render/geometry.ts`** — comment-only: de-reference the deleted "backdrop" in the
  `originX/originY` doc (e.g. "a caller that enlarges the canvas beyond the board"). No
  logic change; `geometry.test.ts` untouched and still green.

### Delete

- `src/render/backdrop.tsx`
- `src/render/board-panel.tsx`
- `src/render/themes/city-themes.ts` (then remove the emptied `src/render/themes/` dir)

## Verification

1. `npm run typecheck` — clean (proves no dangling imports of the deleted files/symbols).
2. `npm run lint` — 0 errors.
3. `npm test` — all green, including the trimmed `contrast.test.ts` and untouched
   `geometry.test.ts`.
4. Grep gate: `grep -rE "backdrop|board-panel|city-themes|CITY_THEMES|PANEL_" src/`
   returns nothing outside an intentional generic word (verify zero real references).
5. Mandatory `code-reviewer` subagent (acceptance met, no logic/contract regression,
   Journey unaffected, no new lint/type errors).
6. On-device (HARD GATE, user): Endless renders dots on plain dark ground like Journey.

## Risk

- **Coordinate regression** if `game.tsx` reintroduces an offset. Mitigation: with no
  origin passed, `makeLayout` origin defaults to (0,0) — same space as the canvas, exactly
  Journey's proven path; `geometry.test.ts` still guards the math.
- **Journey drift** — none: `journey.tsx` and `BoardCanvas`'s no-backdrop path are
  unchanged; only the (now-removed) backdrop branch went away.

## Finalize reconciliation

At finalize, mark in `plans/260817-1217-endless-visual-upgrade/`: Phase 3's backdrop/panel
direction **superseded** (dots-on-plain-dark shipped instead) and Phase 4 (score→milestone
city themes) **dropped** (no backdrop to theme). Do not delete that plan's history.
