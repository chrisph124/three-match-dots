---
phase: 5
title: 'HUD / title / settings reskin (static)'
status: pending
priority: P1
effort: '1.5-2d'
dependencies: []
---

# Phase 5: HUD / title / settings reskin (static)

## Overview

Turn the three bare centered-text screens into an intentional **paper-craft UI**: a
framed HUD on the game screen, a composed title screen, and a paper-styled settings
screen — matching the approved mockup. Static (no Rive yet — that is Phase 6). Preserve
every functional wire: gesture, `useGameState`, score read/write, `expo-router` links,
the reset `Alert`.

## Requirements

- Functional: `game.tsx` keeps `GestureDetector` → `BoardCanvas`, `useGameState`, and
  score display wiring; only chrome/layout changes.
- Functional: `index.tsx` keeps `readScore` + `useFocusEffect` refresh and the
  Play/Journey/Settings links (Journey link stays; `journey.tsx` itself is untouched).
- Functional: `settings.tsx` keeps `resetScore` behind the confirm `Alert` and the
  Back link.
- Non-functional: shared UI tokens (color/radii/type/spacing) live in one module so the
  three screens stay DRY; each screen file stays ~<200 lines.
- Non-functional: no web-font dependency — use the system font stack (custom typeface
  is out of scope; the one-dependency budget is spent on Rive in Phase 6). No
  em-dashes in visible UI copy.

## Architecture

- **UI token module** — `src/render/ui-theme.ts`: paper-craft RN tokens (paper/ink,
  vermilion `shu` and indigo `ai` accents, radii, type scale, spacing). These are
  **new, additive** exports; the frozen `DOT_COLORS[0..2]` and existing palette
  exports in `src/render/palette.ts` are not touched (append new chrome tokens to
  `palette.ts` **or** keep them in `ui-theme.ts` — pick one home; do not re-hex or
  reorder existing entries).
- **Game HUD** (`game.tsx`) — score in a framed vellum chip above the board; refined
  Back affordance; board framed to sit with the Phase 3 panel. The score/Back are the
  **safe-area RN overlays over the full-bleed scene** that Phase 3 introduces (do not move
  them back inside a bounded box); the vellum chip is the deliberate paper plate behind the
  score text (the "scrim only if needed" Phase 3 leaves to authoring). Gesture + canvas
  subtree unchanged.
- **Title** (`index.tsx`) — paper-craft title lockup, score card, Play / Journey /
  Settings as paper buttons (pressed states). Same links/handlers.
- **Settings** (`settings.tsx`) — paper card, destructive "Reset score" styled as a
  clear-but-calm action, Back link. Same `Alert` flow.

## Related Code Files

- Create: `src/render/ui-theme.ts` (shared RN paper-craft tokens).
- Modify: `src/app/game.tsx` — HUD/frame chrome (keep gesture/canvas/state wiring).
- Modify: `src/app/index.tsx` — title/score/buttons (keep links + focus refresh).
- Modify: `src/app/settings.tsx` — paper card + styled reset (keep Alert + reset).
- Possibly modify: `src/render/palette.ts` — append UI chrome tokens (no change to
  frozen dot hexes).

## Implementation Steps

1. Define `ui-theme.ts` tokens from the approved mockup (paper/ink/shu/ai, radii, type
   scale, spacing).
2. Reskin `index.tsx` (title lockup, score card, paper buttons + pressed states).
3. Reskin `settings.tsx` (paper card, styled reset behind the existing Alert).
4. Reskin `game.tsx` HUD/frame; leave the `GestureDetector`/`BoardCanvas`/`useGameState`
   subtree intact.
5. Verify on device: all links navigate, score persists/refreshes, reset confirms and
   zeroes, and — critically — **re-verify gesture hit-testing after the board-frame
   chrome lands** (not just "gesture unaffected"): tap-start must land on the visible
   dot with no systematic offset. Phase 2's origin math proves the arithmetic, but only
   an on-device check proves the RN layout tree still delivers `event.x/y` in Canvas
   pixel space once this phase wraps the board in new chrome.

## Success Criteria

- [ ] Title / HUD / settings read as intentional paper-craft, matching the mockup
      direction.
- [ ] Every existing behavior intact: play, score persist + focus-refresh, reset-with-
      confirm, navigation.
- [ ] Gesture hit-testing re-verified on device **after** the board-frame chrome lands
      — tap-start hits the visible dot with no offset.
- [ ] Frozen dot palette untouched; new tokens are additive; each screen ~<200 lines.
- [ ] No new dependency; no em-dashes in UI copy; `lint` + `typecheck` + `test` green.

## Risk Assessment

- **Accidental logic churn in `game.tsx`.** Signal: gesture, score, or commit behavior
  changes. Response: restrict edits to layout/chrome; keep the
  `GestureDetector`→`BoardCanvas` + `useGameState` wiring byte-for-byte where possible;
  on-device regression check of a full play loop.
- **Custom-font expectation from the mockup.** Signal: reviewer expects Mincho display
  type. Response: mockup fonts were illustrative (artifact CSP blocked web fonts); ship
  the system stack now, note custom-typeface as a possible later slice (needs
  `expo-font` + asset — outside this plan's one-dependency budget).
- **Parallel-edit collision with Phases 3/4** (both touch `game.tsx`). Signal: merge
  conflict. Response: land Phase 3 (canvas/backdrop) first, then this reskin; they own
  different regions of `game.tsx` but sequence to avoid churn.
