---
title: Voyage render layer (Phases 6-8) shipped code-complete
date: 2026-08-24
summary: 'Built the full Skia render layer for Voyage mode; gates green, code review findings fixed, on-device verification handed to owner'
---

# Voyage render layer (Phases 6-8) shipped code-complete

## What happened

Completed the Voyage Infinite Mode render layer (Phases 6-8) — the Skia/Reanimated
layers that make the pure-TS engine (Phases 1-5) visible and playable. Voyage is now
wired into the title menu: `/voyage` (diorama ladder) → `/voyage-game` (playable run).

Built/finished this pass:

- `src/app/voyage-game.tsx` — the playable game route: backdrop + constraint HUD +
  boss HP bar + pooled juice + persistence, composed so the board Canvas stays
  origin-(0,0) inside a board-sized view (panel wraps the gesture detector →
  hit-test coords unshifted). `starsForWin` maps surviving budget → 1-3 stars.
- Route wiring: `_layout.tsx` (voyage/voyage-game screens, headerShown:false),
  `index.tsx` (Voyage menu link).
- Earlier this session: rewrote `voyage-effects.ts` to a fixed-hook-count pool
  (rules-of-hooks), added `voyage-effects-layer.tsx`, `voyage-juice.ts`,
  `voyage-ladder.ts` (O(1) nav cache), `voyage.tsx` (map route), and a `VoyageClearEvent`
  output on `use-voyage-state.ts` for faithful clear/sweep/cage juice.

## Decision

- Two lint blockers were prior-session render files, both fixed cleanly:
  `voyage-boss-hpbar.tsx` used a ref read during render (React-Compiler `react-hooks/refs`)
  → switched to a lazy `useState` initializer. That then tripped a genuine BUG in
  `sonarjs/no-hook-setter-in-body` (its `:has(ArrayPattern[len=2])` selector matched the
  inner `[color,count]` tuple destructure and crashed reading `elements[1].name` of the
  length-1 `[segments]` id) → dodged by dropping the inner tuple destructure. Nested
  ternary in `ribbon-node.tsx` → extracted `statusLabel` helper.
- Code review (DONE_WITH_CONCERNS): fixed H1 (Next used push → stacked mounted game
  screens + live clocks in a near-infinite mode; now `replace` for Next, `back()` for
  Ladder/Back), M1 (`useVoyageEffects` returned a fresh object each render → `useMemo`),
  L1 (unlock derivation could lock an already-cleared level → `unlocked: prevCleared ||
cleared`). Skipped L2 (assertNever in starsForWin — no existing idiom, code
  verified-correct, YAGNI) and L3 (square-board hardcode — safe for fixed 6x6).

## Next steps

- OWNER on-device verification is the only remaining gate: diorama replaces black,
  ribbon scrolls smoothly, boss reads as a boss, timed/moves/mistakes fail-states,
  persistence survives a real app restart, first-entry ladder-generation timing
  (SLICE_LADDER_LENGTH=60), and raw frame rate.
- Docs-impact flagged, NOT applied: `docs/tech-stack-and-infra.md` src/ map (add
  src/render/voyage, src/meta/voyage-_, src/app/voyage_), gameplay script, and
  `docs/creative-bible.md` §2.5 per-mode backdrop — the LOCKED bible amendment is an
  OWNER call, left untouched.
- Commit not made (awaiting user request).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
