---
title: Endless meta reskin (visual-upgrade Phase 5) code-complete
date: 2026-08-25
summary: 'Paper-craft night-paper reskin of title/HUD/settings + ui-theme token module; gates green, review DONE, plan+docs synced; on-device sign-off handed to owner'
---

# Endless meta reskin (visual-upgrade Phase 5) code-complete

# Endless meta reskin (visual-upgrade Phase 5) code-complete

## What happened

Shipped Phase 5 of `plans/260817-1217-endless-visual-upgrade` — the static paper-craft
reskin of the three Endless meta screens, in the user-approved "night paper" direction
(picked from an A/B HTML preview before any code). One commit: `e107092` on branch
`feat/endless-ui-reskin` (not pushed).

Built/changed:

- `src/render/ui-theme.ts` (new, 47 LOC) — additive RN-facing design tokens:
  paper/ink neutrals, `shu` 朱 (vermilion, primary + destructive) and `ai` 藍 (indigo,
  secondary/on-paper links), radius/space/fontSize scales. Reuses palette's
  `SCREEN_BACKGROUND`/`TEXT_COLOR` as `night`/`nightInk` so board + chrome share one
  dark-ground source. Outside the Vitest include → no coverage impact.
- `src/app/index.tsx` — title reskin: washi lockup card (kanji 三 + seal), score card,
  4 nav buttons (Play/Journey/Voyage/Settings) via `Link asChild` + `Pressable` for
  pressed states. (Phase file said 3 links; corrected to the actual 4.)
- `src/app/settings.tsx` — paper card, shu-outlined reset; `Alert.alert` confirm →
  `resetScore` and Back link preserved.
- `src/app/game.tsx` — HUD chrome only: score `Text` → vellum "chip" `View` (SCORE
  label + tabular-nums value), Back link restyled; import swap palette → ui-theme.

## Decision

- Direction reconciliation: the phase-05 file assumed a framed HUD over the Phase-3
  city-skyline scene, but Phase 3 was superseded by the plain-board pivot
  (`260818-1656-endless-plain-board`) — the shipped board is flat dots on the plain
  dark ground. So the HUD is a paper chip floated over the plain dark ground, NOT a
  framed panel over a skyline. Recorded in the plan so it is not self-contradictory.
- Hit-test safety: kept the `GestureDetector` → style-less `<View>` → `BoardCanvas`
  subtree byte-for-byte (layout origin stays (0,0)); a padded/centered wrapper there
  would silently reintroduce a touch offset Vitest cannot catch. Reviewer confirmed it
  unchanged in the diff.
- On-paper Back links use `nightInk`, not `ai` — indigo on the dark ground fails
  contrast; `ai` is used only for on-paper secondary buttons.

## Verification

- typecheck clean; lint 0 errors (2 pre-existing warnings in untouched files);
  `npm test` 402/402 pass; no coverage-gate impact.
- `code-reviewer` verdict DONE — all 5 acceptance criteria pass with file:line evidence;
  game wiring + frozen `DOT_COLORS`/`palette.ts` untouched; no public-contract break;
  3 cosmetic non-blocking notes (fixed the stale comment; left the two acceptable ones).
- Plan synced: phase-05 → `done`, plan.md row → `Done²` with on-device footnote,
  paper-craft success criterion ticked. Docs: reconciled Journey/Voyage status drift in
  CLAUDE.md + three-dots-game-design.md; added `ui-theme.ts` to the render arch-map in
  tech-stack-and-infra.md. `ak` reads status from frontmatter (files-first) — no index to sync.

## Open

- On-device sign-off is the remaining owner gate — RN/Skia screen "feel" is not
  Vitest-testable. Direction is approved (HTML preview); running it on a device is the user's step.
- Phase 6 (`rive-react-native` animated title, P2) is now unblocked by Phase 5.
- Not pushed/merged; `main` stays unprotected (owner action, tracked elsewhere).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
