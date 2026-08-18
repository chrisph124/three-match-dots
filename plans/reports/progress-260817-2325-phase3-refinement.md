# Progress — Endless Visual Upgrade, Phase 3 refinement (code landed)

Date: 2026-08-17
Plan: `plans/260817-1217-endless-visual-upgrade/`
Phase: 3 — Full-bleed city scene + opaque panel + cat's-eye marble dots
Status: **in-progress** (code complete + review-clean; on-device HARD GATE pending — user feel-test)

## What shipped (5 files, visual/render/app layers only — no game logic)

1. `src/render/marble-texture.tsx` — marble rewritten noise-vein → **analytic cat's-eye**.
   `COLOR_CONFIG` now `{blades,spin,dark,mid,light}`; blade count = identity **red 4 / green 3 /
   blue 5** (countable colour+shape cue, survives greyscale). `MARBLE_SKSL` = angular blades over a
   radial dark core; blades fade before the rim so boundary = mid tone. Per-variant spin
   `spin + v*(2π/blades/VARIANTS)` decorrelates the 5 baked variants (analytic shader has no seed).
   Bake cache / in-flight promise / `useMarbleTextures` / flat fallback UNCHANGED. Tones (hexes) kept.
2. `src/render/themes/city-themes.ts` — pure data. `CityTheme` +`skylineFar`, `skylineFarColor`,
   `landmark`; all 4 washi entries filled, contrast nudged a notch richer (still light/low-chroma).
3. `src/render/backdrop.tsx` — added far skyline row (lighter, behind near row) + flat `torii()`
   landmark (pillars + kasagi lintel + nuki), bolder sun. Flat + static; no gradient, no blur.
4. `src/app/_layout.tsx` — wrap `<Stack>` in `<SafeAreaProvider>` (already-installed dep, no new one);
   `headerShown:false` on the `game` screen ONLY (full-bleed reaches under status bar).
5. `src/app/game.tsx` — full-bleed: Canvas = `useWindowDimensions()` w×h; board centered square via
   `originX/originY`; score + Back are safe-area RN overlays (`useSafeAreaInsets`); score wrapper
   `pointerEvents:'none'`. Style-less GestureDetector wrapper + touch invariant comment KEPT.

## Verification

- **Contrast (measured once, WCAG SC 1.4.11 ≥3:1):** worst-rim = blue mid `#355eab` vs `PANEL_BASE
#f8f2e6` = **~5.64:1** (blades fade before rim → boundary is pure mid tone). Improvement over the
  old vein look (light tips ~3.30:1). No rim band added.
- **Automated gates green:** `tsc --noEmit` 0 errors; ESLint 0 errors (2 warnings, both pre-existing
  in untouched files); `npm test` 216/216 across 22 files.
- **Code review (`code-reviewer`): Status DONE, clean.** No critical/high/medium. Confirmed:
  protected files untouched (`src/core/resolve/**`, `hot/**`, `game.ts`, `config.ts`,
  `score-storage.ts`); `DOT_COLORS[0..2]` byte-identical; no new dep; one canvas; no MMKV key;
  gesture-offset invariant preserved; Journey path unaffected (no `backdrop` → flat dots,
  `headerShown:false` scoped to game only); the prior marble-bake race is now fixed.
- **3 low-severity/theoretical findings, none blocking, all outside portrait-iOS scope** — logged,
  not patched: torii/panel overlap only when `height < ~1.67*(width-32)+60` (unreachable on portrait
  iPhones; orientation locked); `boardSize` has no negative floor (unreachable, min device height
  ≫220); `atan(0,0)` GLSL UB at the single centre texel (bilinear filtering absorbs it). Optional
  hardening if Android/tablet scope ever opens.

## Plan sync-back (this session)

- Phase 1 → **Completed** (committed `cb82754`; on-device gate passed, task #21). Success criteria ticked.
- Phase 2 → **Completed** (committed `9bd04f6`; zero-visual-diff plumbing). Success criteria ticked.
- Phase 3 → **In-progress** (code landed; on-device gate pending).
- Plan overall → **in-progress**, current-phase 3. `ak plan status`: 2/7 phases, 28%.

## Outstanding

- **On-device HARD GATE (step 6, user feel-test)** — record the ~5.64:1 rim number; confirm (a) clean
  illustrated cat's-eye, blade count distinguishable in greyscale, 5 variants distinct; (b) full-bleed
  & richer but dots still dominate; (c) Back tappable + board hit-tests right cell (Phase 2 origin) —
  scope the pan to the board rect ONLY if the Back tap is eaten; (d) score/Back ≥4.5:1 over sky;
  (e) frame-rate holds during a full sweep on iPhone 12 (A14).
- **Docs impact** — deferred: the creative-bible §2.2 recede-exception + colour+shape shipped-status
  note and the three-dots-game-design Endless "Progression" row are Phase-4-owned per the plan, and
  documenting "shipped" status is gated on on-device sign-off confirming the look. Revisit post-gate.
- **Commit** — not committed (awaiting user request).
