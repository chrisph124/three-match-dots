---
title: Layered cages and first-cage teaching shipped code-complete
date: 2026-08-25
summary: 'Cages became visible, layered (N clears to break, stays linkable, chips per clear), provably winnable, and taught once via a per-install popup; gates green, review APPROVE_WITH_CONCERNS, on-device verification handed to owner'
---

# Layered cages and first-cage teaching shipped code-complete

## What happened

Executed the accepted 7-phase plan end-to-end (autonomous, test-first). The caged-dot
obstacle changed from a binary "linked once to free" into a **layered** obstacle that is
visible, taught, and provably winnable in both Journey and Voyage.

Built/finished this pass:

- **Core seam (Phase 1):** `resolveChain(state, chain, protectedCells?)` gained an optional,
  default-off protected set (`EMPTY_PROTECTED`). Protected cells (cages with ≥2 layers) still
  link/count/classify on the full chain/sweep, but partition into `Resolution.protectedHits`
  instead of `cleared` — they chip, not pop. The one Endless caller is byte-identical.
- **Layer data + fold (Phases 2-3):** `caged` is now `Map<CellIndex, number>` (index→layers
  remaining) threaded end-to-end. `chipLayers`/`chipLayersInner` peel one layer (floored) per
  qualifying same-colour clear and pop only on the final layer; a loop/line colour-sweep peels
  one layer from every same-colour cage at once. Voyage depth by band via
  `CAGE_LAYERS = { teach:1, mid:2, boss:3 }` (boss-first precedence); curated levels may override.
- **Solver parity + winnability (Phase 4):** `solver.ts` imports the SAME `protectedOf` +
  `chipLayersInner` and routes `protectedOf(caged)` into `resolveChain` — one freeing rule, no
  divergence (the level-83 lesson). `objectiveGain` credits `(layersBefore − layersAfter)` per
  chip; `clearColor` counts only true pops (F13). Budgets stay solver-derived at runtime.
- **Render + teach (Phases 5-6):** `cage-overlay-layer.tsx` draws square pips per remaining
  layer (numeric badge above 3) and rattles a pip on chip. `cage-intro-popup.tsx` +
  `tutorial-flags.ts` (MMKV `createMMKV()`, `'tutorial.cageIntroSeen'`) teach the mechanic once
  per install, gated on `!hasSeenCageIntro() && protectedOf(caged).size > 0` in BOTH modes.
- **Docs (Phase 7):** synced `three-dots-game-design.md`, `level-script-schema.md` (`layers?`
  field), `tech-stack-and-infra.md`. `creative-bible.md` left untouched (cage art is TBD §2.4).

## Decision

- **Popup predicate is `protectedOf(caged).size > 0`, never `caged.size > 0`** (red-team F6) — a
  1-layer-only level yields an empty protected set, so it never triggers the teach popup.
- **Curated levels recalibrate only when they carry a `layers ≥ 2` cage** (F9/S1):
  `hasMultiLayerCage(level)` widens the curated-bypass so the seeded pre-boss teaching cage and
  japan-01 are proven winnable; purely 1-layer curated levels return byte-identical.
- **Boss converged at full depth — Validation S1 fallback NOT exercised.** "The Caged Core" ships
  all 8 cages × 3 layers (24 chips) and solves `won: true` with no cage-count or layer reduction.
- **Code review = APPROVE_WITH_CONCERNS** (no blockers/majors; F2/F6/F12/F13 all confirmed,
  backwards-compat verified). Fixed the one closable minor: the winnability sweep proved palette 5
  while the app ships `DOT_COLORS.length = 6`. Verified empirically that all 1..200 levels
  (including the palette-divergent cage-free color-rush bosses) still solve at 6, then set both
  sweeps to `PALETTE = 6` (literal, to keep core tests RN-free). Test-only; no runtime change.

## Next steps

- **OWNER on-device verification is the only remaining gate:** popup fires on the first
  multi-layer cage (seeded L5 Voyage / japan-01 Journey), NOT on 1-layer levels; checkbox+dismiss
  persists across restart and never reappears in either mode; doesn't block gestures post-dismiss;
  a chip visibly rattles + drops a pip; boss HP bar ticks per chip; a chip-only commit doesn't
  lock input. **japan-01's new 2-layer centre cage got no timer bump and is not solver-swept
  (authored Journey levels never are, per F12) — confirm 60s still clears both objectives.**
- **L5 pre-boss teaching level** is now solver-calibrated tighter than its generous hand-authored
  budget — an on-device feel-flag (tight-but-fair, not a walkover/wall), not a pinned number.
- Commit not made (awaiting user request).

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
