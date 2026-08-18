# Brainstorm — Endless: plain flat matte dots + dark city skyline (Phase 3 fourth pass)

**Date:** 2026-08-18 · **Plan:** `plans/260817-1217-endless-visual-upgrade` · **Phase:** 3 (in-progress)
**Supersedes look-direction of:** `brainstorm-260818-0054-endless-matte-candy-dark-receded.md` (matte-candy pattern marble).

## Trigger

User (`/ak-brainstorm`): _"remove the marble pattern, just a plain matte color set, and the scene is
city skyline."_ Two decisive forks answered in-session:

1. **Colourblind rule (LOCKED §2.2):** _Color only — accept the gap._
2. **Dot finish:** _Dead-flat matte discs._

## Outcome

Endless dots become **plain, dead-flat, solid-colour discs** on the **bright frozen hues**
(`DOT_COLORS[0..2]` = `#ff4d5e`/`#3ddc84`/`#4f8cff`, unchanged) — **no pattern, no baked texture, no
soft light, no gloss**. They sit on an **inset, opaque, dark, framed board panel** over a **dark,
receded, folded-paper city skyline** (flat vector, no gradient, no blur) that cross-fades at score
milestones. This is the simplest of the four passes: it **deletes the entire marble/pattern
subsystem**.

## What this REMOVES from Phase 3 (net simplification)

- `src/render/marble-texture.tsx` — **deleted** (SkSL `MARBLE_SKSL`, `uPattern` selector,
  `COLOR_CONFIG`, baked `SkImage` variant cache, in-flight promise, `useMarbleTextures`, variant
  decorrelation). None of it is needed for a flat fill.
- `dot-layer.tsx` marble path — Endless draws the existing **flat `colorFor` `Circle`** path
  (`patterned=false`), byte-for-byte the Journey dot. The `ImageShader`/`variant` branch and
  `textures` prop can be dropped from the Endless call (kept only if Journey ever needs it — it
  does not, so remove for KISS).
- All marble-specific requirements/risks: glossy-plastic breach, greyscale-distinguishability,
  live-shader temptation, bake-fails-on-device, pattern-fade-before-rim.
- The §2.2 "met by matte candy pattern archetypes" claim (see below).

## What SURVIVES unchanged (the kongming-verified core)

The dark-ground contrast analysis is independent of the pattern and carries over intact — it was
always about dot-vs-panel and panel-vs-scene, not the dot's interior:

- **Dark ground is load-bearing.** Bright frozen dots clear WCAG only on a dark panel (green caps
  ~1.8:1 on any light washi panel). Current `city-themes.ts` is still LIGHT (`PANEL_BASE=#f8f2e6`,
  L≈0.90) → **must be reauthored to a dark family** (fresh dark tones, not a blind darken).
- **Contrast inversion:** on a dark ground the tight cases are **red & blue** (L≈0.27), NOT green
  (L≈0.54, now the safest). `PANEL_BASE` relative-luminance ceiling **L ≤ ~0.058** (from
  `(L_dot+0.05)/(L_panel+0.05) ≥ 3.0` for red/blue). SC 1.4.11 ≥ 3:1, measured once (opaque fixed
  panel). **Simpler now:** the whole flat dot is the base hue, so there is no pattern-fade caveat —
  every pixel of the dot is the measured colour.
- **Figure-ground:** `PANEL_FRAME` ≥ 3:1 (SC 1.4.11) vs the darkest `CITY_THEMES` scene swatch;
  authored fresh for a dark surface. Both this floor and the base ceiling hold independently.
- **Inset board** (the user's "not reach the edge, like the journey" ask): board centred with a
  clear margin, scene fills the screen behind it. Score/Back ≥ 4.5:1 (light text token over the
  dark scene). Touch routing z-order guard unchanged.
- **Scene = city skyline:** resolves the earlier A(quiet)/B(city) fork to **B · city skyline** —
  the folded-paper near+far skyline rows stay, recoloured dark/low-chroma so the scene still
  recedes (§2.2-compliant, no exception).

## LOCKED-rule status (§2.2 colour+shape) — the one accepted trade-off

Removing the pattern re-opens the LOCKED §2.2 rule ("dot identity = colour AND shape/pattern,
colourblind-safe"). **User chose colour-only, accepting the gap.** This is **not a regression** —
the shipped app already draws colour-only plain circles; the rule has been documented `not yet met`
in the bible since v0. Consequences:

- **No bible amendment** (we are not changing the rule, just still not meeting it).
- **Revert the false claims:** `palette.ts` header comment (lines ~12-16) currently says Endless
  "meets the LOCKED colour+shape rule via the baked marble swirl" — now false; revert to
  colour-only / documented gap. Phase 4's doc-update reverts from "met by matte candy pattern
  archetypes" back to "stays unmet (colour-only) — open accessibility gap." Never cite §2.2 as
  satisfied in store/compliance copy.
- **Practical risk is modest** (informs, does not remove, the gap): only 3 hues, and green
  (L≈0.54) is well separated in luminance from red/blue (L≈0.27); red-vs-blue differ by hue and
  are distinguishable under the common protan/deutan types. Documented, not claimed-solved.

## Constraints (carried)

One Skia canvas; `DOT_COLORS[0..2]` frozen; **zero** new dependencies (this pass spends none and
removes the marble machinery); game logic untouched (`src/core/**`, scoring, gesture,
score-persistence); no new MMKV key; Journey pixel-identical; no AI attribution.

## Non-goals

Journey; timer/fail-state; audio; per-dot shape channel (the accepted gap); any pattern/texture on
dots.

## Acceptance

- Dots are flat solid frozen-hue discs; whole-dot contrast vs the dark `PANEL_BASE` ≥ 3:1
  (SC 1.4.11), red/blue re-measured & recorded; `PANEL_BASE` L ≤ ~0.058.
- Scene is a dark, receded city **skyline**; board inset with a clear margin (does not reach the
  edge) and reads as a distinct dark framed card (`PANEL_FRAME` ≥ 3:1 vs darkest scene swatch).
- Score/Back ≥ 4.5:1 over the scene; touch routes correctly at the inset origin.
- Journey unchanged & pixel-identical; `lint`+`typecheck`+`test` green; on-device HARD GATE.
- Docs reconciled: §2.2 note reverts to colour-only gap; `palette.ts` comment reverted;
  §2.5/§7 procedural-backdrop amendment (Phase 4) unaffected.

## Look sign-off before code

Simplified HTML mock (`scratchpad/endless-matte-candy-preview.html` → repurposed) shows the **dark
city skyline + inset framed board + flat colour discs** only — no pattern/greyscale machinery. User
look-approval precedes deleting `marble-texture.tsx` / rewiring `dot-layer.tsx`. On-device gate
re-runs against the new build.

## Unresolved questions

- **Board inset amount / vertical placement** — exact `boardSize` clamp `k` and `originY` reserve
  are on-device tuning dials (start symmetric; not blocking).
- **Flat dots reading sticker-like on a dark ground** — if the dead-flat discs look pasted-on at the
  gate, the cheap in-bible remedy is a subtle paper **drop-shadow** under each dot (no gloss, no
  soft light — respects the "dead-flat" choice); decide on device, not now.
- **`frosted-panel.tsx`** (dead artifact from the first cut) — remove during implementation cleanup.
