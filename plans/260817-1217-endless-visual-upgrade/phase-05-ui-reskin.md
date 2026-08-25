---
phase: 5
title: 'HUD / title / settings reskin (static)'
status: done
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

- [x] Title / HUD / settings read as intentional paper-craft, matching the mockup
      direction.
- [x] Every existing behavior intact: play, score persist + focus-refresh, reset-with-
      confirm, navigation.
- [ ] Gesture hit-testing re-verified on device **after** the board-frame chrome lands
      — tap-start hits the visible dot with no offset. **OUTSTANDING — on-device gate not
      yet run** (code-level subtree preservation confirmed by review; real-device tap-hit
      check is the remaining owner action).
- [x] Frozen dot palette untouched; new tokens are additive; each screen ~<200 lines.
- [x] No new dependency; no em-dashes in UI copy; `lint` + `typecheck` + `test` green.

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

## Completion (2026-08-25)

**Shipped:** "Night paper" direction — warm washi cards over the shipped **plain dark**
`SCREEN_BACKGROUND` ground (shu 朱 primary/destructive accent, ai 藍 secondary accent).
New `src/render/ui-theme.ts` (additive RN tokens, reuses palette's `SCREEN_BACKGROUND`/
`TEXT_COLOR` as `night`/`nightInk`). Reskinned `src/app/index.tsx`, `src/app/settings.tsx`,
`src/app/game.tsx` (HUD chrome only).

**Direction reconciliation (important — resolves a plan self-contradiction).** This
phase file's original text (Overview/Architecture above) assumes a _framed HUD over the
Phase-3 city-skyline scene with an inset board panel_. Phase 3 was **superseded** by the
plain-board pivot (`../260818-1656-endless-plain-board/plan.md`) before Phase 5 started —
the shipped board is flat dots on the plain dark `SCREEN_BACKGROUND`, no panel, no
skyline. Phase 5 was built against the ACTUAL shipped plain board, not the stale
Overview text: the game HUD is a paper **chip** (SCORE label + tabular-nums value)
floated over the plain dark ground — not a framed panel over a skyline. Treat "framed
HUD" / "board framed to sit with the Phase 3 panel" in Overview/Architecture above as
superseded by this note.

**Scope correction:** `index.tsx` ships **4** nav links (Play / Journey / Voyage /
Settings), not the 3 (Play/Journey/Settings) the Requirements/Architecture sections
above list — Voyage shipped between this phase's authoring and its implementation.

**Wiring preserved (verified):** `game.tsx` keeps `GestureDetector` → style-less `View`
→ `BoardCanvas` byte-for-byte + `useGameState` score read/write; `index.tsx` keeps
`readScore` + `useFocusEffect`; `settings.tsx` keeps `resetScore` behind the `Alert`
confirm + Back link.

**Verification evidence:** `npm run typecheck` clean; `npm run lint` 0 errors (2
pre-existing warnings, untouched files); `npm test` 402/402 pass. No coverage impact —
`ui-theme.ts` is RN/Skia presentation, outside the Vitest include. `code-reviewer`
subagent verdict: DONE, all acceptance criteria PASS, hit-test subtree + wiring
verifiably unchanged, frozen `DOT_COLORS`/`palette.ts` untouched.

**Outstanding gate:** on-device sign-off (Implementation Step 5 above) is NOT yet done.
Per repo DoD, RN/Skia "feel" is not Vitest-testable and must be verified on a real
device — the user approved the LOOK via an HTML A/B preview only. Phase is
code-complete + all automated gates green + review DONE; on-device tap-hit-test and
visual sign-off remain the owner's open action before this phase can be called fully
closed.
