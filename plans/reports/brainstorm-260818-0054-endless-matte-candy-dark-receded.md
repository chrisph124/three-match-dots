# Brainstorm outcome — Endless dots+board pivot: matte candy marble on a dark receded city

Date: 2026-08-18
Plan: `plans/260817-1217-endless-visual-upgrade/` (Phase 3 rework + Phase 4 retarget)
Supervision: `--advice` (kongming). Reference: `/Users/yordle/Downloads/variety-balls-with-unique-patterns/2426.jpg`

## Trigger

Pre-on-device-gate look pivot on the landed (uncommitted) Phase 3 cut. User rejects the
**cat's-eye** marble + the **full-bleed light washi panel** + the **darkened marble tones**.
Wants: dots like the reference candy marbles; board pulled back from the phone edge
("like the journey"); Journey's **bright** colours over the darkened marble tones.

## Contract (resolved)

- **Outcome:** Endless dots restyled to a candy-marble look on the bright frozen palette;
  board inset with a margin (not full-bleed) over a **dark, receded** city; cat's-eye removed.
- **Constraints:** frozen `DOT_COLORS[0..2]` · baked-once texture arch (no per-frame shader) ·
  one Skia canvas · effects/render/app layers only (no protected game logic) · no new runtime
  dep · **per-colour pattern identity preserved** (greyscale-distinguishable) · Journey untouched.
- **Non-goals:** Journey visuals · HUD/title reskin (Phase 5) · Android/monetization · glossy-plastic
  material (rejected — would need a bible amendment; not taken).
- **Acceptance (on-device):** reads as the reference candy style · 3 colours distinct by pattern
  in greyscale · clear board margin from edges · bright dots ≥3:1 vs the dark scene (recorded) ·
  score/Back ≥4.5:1 · frame-rate holds on A14 during a full sweep.

## The two forks and how they resolved

kongming's load-bearing correction: **the board-ground decision and the colour decision are one.**
The frozen `DOT_COLORS` only clear WCAG SC 1.4.11 (≥3:1) on a **dark** ground — green caps at
~1.8:1 against any panel light enough to read as washi, unfixable by tuning. So "use Journey's
bright colours" _requires_ a dark ground. A light-panel variant was removed from consideration.

1. **Board + colour → "Dark receded city" (user pick).** Keep an atmospheric backdrop but
   reauthor it to a **dark family**; board **inset with a margin**, not full-bleed; **bright frozen
   `DOT_COLORS`** on the dark scene. Phase 4's score-milestone **cross-fade survives** (retargeted
   to dark themes). Not kongming's default (it recommended A1 = remove the city, Journey-clone) —
   user chose to keep the atmosphere/progression. This is kongming's named A2-dark fallback.
2. **Marble → "Matte candy (in-bible)" (user pick).** Bright frozen hues; a **distinct pattern
   archetype per colour** for colourblind safety — **red = wavy swirl bands, green = soft circular
   spots, blue = diagonal stripes** (the reference shows all three families); **soft matte shading
   with one painted top-left highlight, no hard plastic specular**. Stays inside every LOCKED bible
   rule → **no bible amendment**. The literal glossy-plastic option (B1) was declined; it would have
   overridden §1 "neon"/"glossy-plastic" + §2.1 "no simulated 3D lighting" + §2.2 harmony.

## Consequences

- **Better bible alignment, not worse.** The current cut carries a §2.2 "backgrounds recede"
  _exception_ (added for the full-bleed "a bit richer" scene). A **dark, receded** scene now
  _complies_ with §2.2 → that exception is **dropped**, not amended. The §2.5 procedural-city
  exception (validation 2026-08-17) still stands. No new LOCKED override introduced.
- **Accessibility note changes.** §2.2/§2.5 shipped-status cue moves from "cat's-eye blade-count
  (red 4/green 3/blue 5)" to "matte candy **pattern archetypes** (swirl/spots/stripes)". Still
  colour+shape, still greyscale-safe.
- **Reused, not wasted.** The baked-once marble arch (`RuntimeEffect.Make` → `drawAsImage` →
  ImageShader) is unchanged — only `MARBLE_SKSL` + `COLOR_CONFIG` are rewritten (3rd time on the
  same scaffold). Phase 4 stays; `city-themes.ts` data is reauthored to dark, not deleted.

## kongming cautions carried into the plan (A2-dark path)

- **Do NOT blindly darken the light-tuned panel palette.** `PANEL_BASE/PANEL_FRAME/PANEL_EDGE`
  (+ scene tones) are tuned for a light vellum surface; a dark reauthor needs its own tones —
  uniform-darkening a light palette does not behave predictably. **Re-measure contrast fresh.**
- **Re-verify dot contrast on the new dark scene** (expected easily ≥3:1 — Journey clears
  5.8–10.6:1 on its dark ground — but measure, don't assume).
- **Validate the look with an HTML mock before SkSL** (same as
  `scratchpad/endless-fullbleed-catseye-preview.html`) — the team's proven de-risk step for a
  look pivot. Marble pattern engineering cost is the same for matte vs glossy; the decision was
  tone, and it's settled (matte).
- Re-run the on-device HARD GATE against the **new** build (the prior cat's-eye gate is void).

## Handoff

To planning: rewrite `phase-03`, amend `plan.md` (Goals #2/#3 + refinement subsection + docs-impact),
retarget `phase-04` to dark themes; kongming red-team; then user approval before implementation
(`/ak:cook`). Marble HTML mock precedes any `marble-texture.tsx` edit.

## Open questions

- **Panel treatment on the dark scene** — does the board keep an explicit framed panel (dark/subtle),
  or sit directly on the dark scene with only a thin frame? Decide in the HTML mock; not blocking.
- **Board inset amount** — exact margin/`boardSize` for the inset look is a mock/on-device tuning dial.
