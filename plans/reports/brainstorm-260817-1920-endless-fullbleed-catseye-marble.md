# Brainstorm — Endless full-bleed city + cat's-eye marble (Phase 3 refinement)

Date: 2026-08-17 · Feeds: `plans/260817-1217-endless-visual-upgrade/phase-03-backdrop-and-panel.md`
Status: accepted direction, ready to amend Phase 3 and cook. Not yet implemented.

## Trigger

User feedback on the in-flight (uncommitted, pre-on-device-gate) Phase 3 marble+scene:

1. Background should **cover the whole layout**, not just the box around the board.
2. Marble should be **revised simpler** — an _illustration_ swirl (glass cat's-eye
   marble reference), **matte, "not too transparent or crystal"**, "we do in our way".

This is a **refinement folded INTO Phase 3** (its code is uncommitted and has not
passed the on-device gate), not a new phase.

## Contract

- **Outcome:** Endless's single Skia canvas fills the whole screen with the washi
  city; the framed board panel floats centered on it; dots are a cleaner _illustrated
  cat's-eye marble_ (matte, not glassy) — still one baked texture set, distinct per color.
- **Constraints (LOCKED, carried):** one Skia canvas (no 2nd); `src/core/**` +
  scoring + gesture rules + score-persist (`key 'score'`) untouched; `DOT_COLORS[0-2]`
  frozen; marble **baked once** (never live per-dot shader) with flat-fill fallback;
  worst-rim contrast re-measured **once** ≥3:1 (WCAG SC 1.4.11) vs `PANEL_BASE #f8f2e6`;
  identity = colour **+** shape; **no** glass/refraction/specular/gradient/blur/DoF;
  scene 100% static; gesture hit-test invariant (style-less wrapper + Phase-2 origin)
  preserved; no new dependency.
- **Non-goals:** HUD/title/settings reskin (Phase 5); Journey (untouched, pixel-identical);
  audio; any timer/fail state.
- **Acceptance:** background reaches all four screen edges (behind board + score + back);
  score text stays ≥4.5:1 over its band; marble reads as an illustrated swirl (not noise,
  not glass), each color distinguishable without hue; rim ratio recorded ≥3:1; lint +
  typecheck + Vitest green; on-device sign-off (the HARD GATE).

## Decision 1 — Marble motif: CAT'S-EYE SWIRL (chosen)

Light "blades" fan from a darker core — the iconic toy marble. **Per-color blade count
carries identity**: red = 4, green = 3, blue = 5 (a countable colour+shape cue, stronger
for colorblind users than the old vein texture). 2-3 tonal layers of the dot's own frozen
hue. Matte, no highlight/refraction.

**Technical approach — minimal churn (KISS/DRY):** keep the whole baked-SkSL architecture
in `marble-texture.tsx` — bake cache, shared in-flight promise, `drawAsImage`, the
`ImageShader`-on-unit-circle draw in `dot-layer.tsx`, `useMarbleTextures(enabled)`, and the
flat-fill fallback all UNCHANGED. **Only** rewrite the `MARBLE_SKSL` body from noise-vein to
an **analytic cat's-eye**: angular blades via `smoothstep` over `cos(atan(y,x)*N + spin)`
around a radial dark-core term; drop the 5-octave fbm (analytic, so "simpler" in code too,
or ≤1 subtle octave for organic edge). Swap `COLOR_CONFIG`'s `dir/freq/bands/strength` for
`blades` (4/3/5) + `spin` + the three tones. Re-measure the one worst-rim number.

**Rim-contrast rule:** blades live in an inner radius and fade before the rim; a thin
same-hue **darker** rim band guarantees the worst-rim pixel samples a dark/mid tone (not a
light blade tip). Measured once vs `PANEL_BASE`; record ratio in the PR.

Rejected: spiral ribbon (softer, less iconic); flat blobs (reads as a shaded ball, least
marble). Rejected switching to hand-authored Skia vector paths — more per-color code, loses
the clean measure-once contrast story, no benefit over analytic SkSL.

## Decision 2 — Full-bleed city: "A BIT RICHER" (chosen)

The city is now the whole backdrop, so allow modestly more contrast + skyline detail (raise
the scene contrast ceiling a notch; denser/second-row skyline; keep it **static**). Marble
dots must remain the single loudest element — that is the guardrail the on-device gate checks.

**Deliberate bible deviation:** this softens creative-bible "backgrounds recede". Record as
an explicit, documented exception for the Endless full-bleed backdrop (not a silent break);
the guardrail (dots dominate) stays.

**Full-bleed layout (mechanical):** `game.tsx` sizes the Canvas to the full screen
(`useWindowDimensions` w×h, honoring safe-area insets), recomputes `originX/originY` to
center the board with room for the score (top) and back (bottom), and passes full-screen
w/h into the `backdrop` spec. `board-canvas.tsx` already sizes the Canvas from
`backdrop.width/height`, so it follows once game.tsx passes full-screen dims. `backdrop.tsx`
bands are fraction-based → they stretch. Score/back stay RN overlays above the canvas.

## Files (expected touchpoints — confirm at plan/cook)

- `src/render/marble-texture.tsx` — rewrite `MARBLE_SKSL` (cat's-eye) + `COLOR_CONFIG`
  (`blades`/`spin`/tones); re-measure rim ratio. Architecture (cache/hook/fallback) unchanged.
- `src/render/backdrop.tsx` — richer scene (higher contrast ceiling, more skyline), still flat + static.
- `src/render/themes/city-themes.ts` — tone/skyline data for the richer look (all 4 states).
- `src/app/game.tsx` — full-screen canvas sizing + safe-area + origin recompute; keep the
  style-less GestureDetector wrapper (touch invariant).
- `src/render/board-canvas.tsx` — likely no change (already sizes from backdrop dims); verify.
- Docs: creative-bible "backgrounds recede" exception note (Phase 4/finalize doc-impact).

## Risks / unresolved

- **Bible recede rule softened** — user-chosen; guardrail = dots dominate; on-device gate confirms.
- **Touch routing** — full-screen gesture Canvas overlaps the Back link's touch target and
  the board origin is now large. Verify: Back link still tappable, board still hit-tests
  (Vitest covers origin math; on-device covers touch). Scope the pan or z-order the chrome above.
- **Score/back legibility over a richer scene** — re-verify ≥4.5:1; add a subtle scrim only if needed.
- **Cat's-eye rim** — must fade blades before rim + darker rim band; re-measure the one ratio.
- **Oldest supported iPhone** still unpinned — perf gate for the baked marble; confirm at sign-off.

## Handoff

→ amend `phase-03-backdrop-and-panel.md` (motif = cat's-eye, city = richer, full-bleed
layout) → `/ak:cook` the amendment → code-review + on-device HARD GATE. No `--advice` on this
round (user did not pass it). Optional de-risk: a quick HTML render of the 3-color cat's-eye
marbles + full-bleed mock before touching Skia, since the last marble was rejected on look.
