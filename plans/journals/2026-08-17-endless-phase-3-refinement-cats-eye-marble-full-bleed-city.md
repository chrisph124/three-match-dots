---
title: "Endless Phase 3 refinement — cat's-eye marble + full-bleed city"
date: 2026-08-17
summary: "Landed cat's-eye blade-count marble + full-bleed safe-area layout; gates green, review clean; on-device gate pending"
---

# Endless Phase 3 refinement — cat's-eye marble + full-bleed city

## What happened

Executed the Phase 3 refinement of the Endless visual upgrade (`/ak:cook` code mode on
`plans/260817-1217-endless-visual-upgrade/phase-03-backdrop-and-panel.md`). Five visual-layer
edits, no game logic touched:

- Marble rewritten from a noise-vein fbm swirl to an **analytic cat's-eye** (light blades from a
  dark radial core). Blade count now carries identity — red 4 / green 3 / blue 5 — a countable
  colour+shape cue that survives greyscale, replacing hue-only distinction. Baked-SkSL architecture
  (module cache, in-flight promise, `useMarbleTextures`, flat fallback) left intact; only
  `MARBLE_SKSL` + `COLOR_CONFIG` changed. Per-variant spin offset decorrelates the 5 baked variants
  (the analytic shader has no seed to vary, unlike the old fbm field).
- Full-bleed layout: one Skia canvas sized to `useWindowDimensions()`, board centered via the Phase 2
  origin offset, score/Back as safe-area RN overlays. Added `<SafeAreaProvider>` (already-installed
  dep) and `headerShown:false` on the game screen only.
- Scene pitched a notch richer (far skyline row + flat torii landmark), still flat/static, guard-railed
  so dots stay the loudest element.

## Decision

Kept the marble boundary at the mid tone (blades fade before the rim) so worst-rim contrast is a
single design-time measurement against the opaque `PANEL_BASE` — blue mid `#355eab` vs `#f8f2e6` =
~5.64:1, clearing WCAG SC 1.4.11 ≥3:1 with margin and beating the old vein look's ~3.30:1 light tips.
No rim band (that would re-introduce the ring the user rejected).

Three low-severity code-review findings (torii/panel overlap on unreachable short-aspect screens,
unfloored boardSize, `atan(0,0)` UB at one texel) logged but not patched — all outside the current
portrait-locked iOS scope; hardening deferred to any future Android/tablet work.

Docs (creative-bible §2.2 recede-exception, colour+shape shipped-status) deferred: Phase-4-owned per
the plan, and "shipped" status is gated on on-device sign-off confirming the look holds.

## Next steps

- User runs the on-device HARD GATE (feel-test): cat's-eye legibility + greyscale blade count, dots
  dominate the richer full-bleed scene, Back tappable + correct cell hit-test, score/Back ≥4.5:1 over
  sky, frame-rate on iPhone 12 (A14) during a full sweep.
- Commit on user request (not yet committed).
- After sign-off: Phase 4 (score-milestone theme index + cross-fade) + the deferred docs reconciliation.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
