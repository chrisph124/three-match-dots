---
title: Endless reverts to the plain Journey look
date: 2026-08-18
summary: 'Removed the framed board panel + dark city skyline from Endless; it now renders flat dots on plain SCREEN_BACKGROUND exactly like Journey, and the dead backdrop/panel/city-theme subsystem is deleted.'
---

# Endless reverts to the plain Journey look

## What happened

User called it plainly: _"remove the board, leave the dots, like the journey."_ This
reverses the interim Phase-3 direction (see the 2026-08-17 cats-eye-marble / full-bleed
city journal) where Endless had grown a framed inset board panel and a dark city-skyline
backdrop. Endless now mirrors `journey.tsx` one-for-one: board `Math.min(width-32, 400)`,
`makeLayout` with no origin offset, `<BoardCanvas>` with no `backdrop` prop, flex-centered
score above / Back below on the plain dark `SCREEN_BACKGROUND`. The dots were already
dead-flat matte discs — only their framing changed.

Scope was the full cleanup the user approved, not just a visual swap:

- Rewrote `game.tsx` to Journey's idiom; collapsed `board-canvas.tsx` to the single
  no-backdrop path (dropped `BackdropSpec`/`PANEL_*`/the backdrop branch).
- Deleted `backdrop.tsx`, `board-panel.tsx`, `themes/city-themes.ts` (all untracked — never
  committed, so nothing to stage for their removal).
- Moved `themes/contrast.test.ts` → `render/contrast.test.ts`, trimmed 43 scene/panel
  assertions down to the 4 that stay true (frozen dots + HUD text clear WCAG on the dark
  ground). Test count 259 → 220, all intentional.

## Decision

Kept the Phase-2 geometry origin-offset primitive (`makeLayout(..., originX=0, originY=0)`)
even though nothing passes an offset now — it is tested by `geometry.test.ts`, defaults to a
no-op, and reverting it would risk the coordinate invariant for zero benefit. Out of scope.

No evergreen docs touched: the "city backdrop" in `three-dots-game-design.md` /
`creative-bible.md §2.5` is the _Journey_ isometric lego-metropolis (a distinct, still-LOCKED
future feature), not the Endless skyline that was removed. The skyline lived only in the plan.

## Outcome

Gates green: typecheck clean, lint 0 errors (2 pre-existing warnings in untouched files),
tests 220/220. `code-reviewer` ran; both findings (a stray `_layout.tsx` Phase-3 leftover,
a stale path in `palette.ts`) fixed and re-verified.

## Next steps

- On-device HARD GATE (user): confirm Endless shows dots on plain dark ground like Journey —
  render/gesture layers aren't Vitest-testable.
- Commit is the plain-board slice only; unrelated pre-existing session work stays out of it.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
