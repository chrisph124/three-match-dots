---
phase: 3
title: 'Dark receded city skyline + inset board panel + flat color dots'
status: in-progress
priority: P1
effort: '1.5-2d'
dependencies: [2]
---

# Phase 3: Dark receded city skyline + inset board panel + flat color dots

> **Reworked four times (not a first cut).** History kept so a later reader does not re-derive
> abandoned directions.
>
> **First cut (uncommitted):** washi **gradient** sky + folded skyline + SkSL grain **blurred
> once** behind a **translucent frosted-vellum** panel, dot contrast on a thin achromatic **ink
> ring**. On-device: _ugly / distracting_; the ring looked stuck-on. Replaced by a crisp flat scene
> and an opaque panel.
>
> **Second pass (2026-08-17):** **full-bleed** light-washi scene + **cat's-eye** marble (light
> blades from a dark core, darkened tones) + a "**a bit richer**" scene taking a documented
> exception to "backgrounds recede." Landed (uncommitted), **rejected before the on-device gate**.
>
> **Third pass (2026-08-18):** **matte candy marble** — bright frozen hues, a distinct **pattern
> archetype per colour** (swirl / spots / stripes) baked via SkSL, on a **dark, receded** city with
> an **inset** board. Never reached the on-device gate.
>
> **Fourth pass (2026-08-18, this file):** the user removes the pattern entirely — _"remove the
> marble pattern, just a plain matte color set, and the scene is city skyline."_ Two forks resolved
> in-session (`plans/reports/brainstorm-260818-0138-endless-flat-color-city-skyline.md`):
> **(1) dot identity is colour-only** — the user chose to **accept the LOCKED §2.2 gap** (colour +
> shape) rather than add a shape/pattern channel; **(2) dots are dead-flat matte discs** — a flat
> solid frozen-hue fill, **no roundness shading, no soft top-left light, no gloss**. This is a
> **net deletion**: the entire baked-marble subsystem (`marble-texture.tsx`, the SkSL shader, the
> pattern selector, the variant cache) is **removed**. What survives is the dark, receded **city
> skyline**, the **inset** opaque dark board panel, and the dark-ground contrast analysis — none of
> which depended on the pattern. Visual layer only; game logic untouched.

## Overview

First visual payoff, simplified to plain flat colour dots on a dark city skyline. One Skia canvas
fills the screen with a **flat-vector, dark, receding city skyline** (flat colour bands + folded-
paper building silhouettes, **no gradient, no blur**). An **opaque, dark, framed board panel** floats
**inset with a clear margin** from every screen edge (Journey-like framing) via the Phase 2 origin
offset — the board never reaches the phone edge. Dots are drawn as **dead-flat solid-colour discs**
on the **bright frozen `DOT_COLORS`** — the existing flat `colorFor` circle path, byte-for-byte the
Journey dot (`patterned = false`). Dots only ever sit on the fixed dark `PANEL_BASE`, so scene
changes never touch dot contrast. Parametrized by a **shared theme catalog** from day one so Phase 4
and future Journey reuse it (DRY).

**v1 scope (validation #3, 2026-08-17, unchanged):** one **city-skyline identity** as a small ramp
of milestone **states** (dark time-of-night / skyline-density variants — cheap flat recolour data,
one visual family), so Phase 4's cross-fade has states to move between. `CITY_THEMES` is ordered by
milestone state, all one dark-city family. No tropical / urban-daylight / galaxy / fantasy cities
(deferred).

## Requirements

### Flat colour dots (the whole marble subsystem is removed)

- Functional: each dot is a **dead-flat solid-colour disc** filled with its **bright frozen hue**
  (`DOT_COLORS[id]` — **no darkening**). This is the renderer's **existing** flat path:
  `dot-layer.tsx` already draws `<Circle cx cy r color={colorFor(colorId)} />` for the non-patterned
  case (the Journey dot). Endless now uses that same path (`patterned = false`).
- Functional (dead-flat finish — the user's fork): **no roundness shading, no soft top-left light,
  no specular, no gloss, no ring, no rim.** The disc is one uniform colour edge-to-edge — exactly
  today's shipped Endless/Journey dot, now over the new dark scene. (The LOCKED §2.1 "light painted
  in" material cue is **not** applied to dots this pass — the user chose dead-flat; the scene still
  carries the paper look.)
- Functional (**delete the pattern machinery**): remove `src/render/marble-texture.tsx` entirely
  (SkSL `MARBLE_SKSL`, `uPattern` selector, `COLOR_CONFIG`, the baked `SkImage` variant `Map`, the
  in-flight promise, `useMarbleTextures`, variant decorrelation). Drop the `ImageShader`/`variant`
  branch and the `textures` prop from the Endless `DotLayer` call. Journey already renders
  `patterned = false`, so both modes converge on the one flat path (KISS/DRY).
- **Accessibility — the LOCKED §2.2 colour+shape rule stays UNMET (user chose to accept the gap).**
  Dot identity is carried by **colour alone**; there is **no shape/pattern channel**. This is **not a
  regression** — the shipped app already draws colour-only plain circles, and the bible has flagged
  this rule `not yet met` since v0. The user explicitly declined the "colour + distinct silhouette
  per colour" middle path. Consequence: **do not claim §2.2 is satisfied** anywhere (plan, bible
  shipped-status note, store/compliance copy). It remains a documented open gap. (Practical note,
  informing not closing the gap: only 3 hues, green L≈0.54 is well separated from red/blue L≈0.27,
  and red vs blue differ by hue under common protan/deutan types — colour-only is _workable_ for most
  users, but the rule is formally unmet.)
- Non-functional (contrast — **named acceptance criterion**): because the disc is one flat colour,
  the **whole dot** = the base hue; contrast is a single measurement of `DOT_COLORS[id]` vs the fixed
  dark `PANEL_BASE`, holding **WCAG SC 1.4.11 ≥ 3:1** (the graphical-object bar). No pattern-fade
  caveat, no "worst rim pixel" — every pixel of the dot is the measured colour. Measure **once** per
  colour against the one dark `PANEL_BASE` hex and record the three ratios in the PR.
  - **The tight cases on a dark ground are red and blue, NOT green (the relationship inverts).**
    On a **dark** panel the _dimmest_ hues sit closest to the panel: red `#ff4d5e` and blue
    `#4f8cff` (relative luminance L≈0.27) are the tight pair; green `#3ddc84` (L≈0.54, the brightest)
    now has the most headroom and is safest. Solve SC 1.4.11 for **red/blue**, not green.
  - **`PANEL_BASE` luminance ceiling (design-time guardrail): relative luminance L ≤ ~0.058.**
    Solving `(L_dot + 0.05) / (L_panel + 0.05) ≥ 3.0` for the red/blue L≈0.27 hues gives
    `L_panel ≤ ~0.058`. Hand this ceiling to whoever authors the dark `PANEL_BASE` hex as an
    authoring-time catch. The per-colour re-measure above is still the real gate; the ceiling fails a
    too-light panel before it reaches the device. (Journey proves the band is comfortable even for
    the dim hues: red 5.8:1, blue 5.9:1, green 10.6:1 on its near-black ground.)

### Dark receded flat-vector city skyline + inset opaque panel

- Functional: one Skia canvas renders, back-to-front: **city-skyline scene → board panel → link
  path → dots**. No second canvas (bible §2.5).
- Functional (dark, receding): the scene is a **dark city skyline** — low-chroma dark sky bands +
  folded-paper **building silhouettes** (a near row and a far row) that **recede** (quiet, low local
  contrast; the dots are the loud element by construction). This **complies with §2.2** "backgrounds
  recede" — no exception needed. The scene may fill the whole screen (full-bleed backdrop is fine;
  §2.2 is about the background _receding_, not its extent).
- Functional (inset board — the user's core ask): the **board panel does not reach the phone edge**.
  It is centred with a **clear margin on all four sides** (Journey-like framing), sized distinctly
  smaller than the screen so the receded skyline shows as a calm border around it.
- Functional: the scene is **flat vector** — solid colour sky bands + folded-paper building-silhouette
  shapes + an optional accent disc (a moon over the night skyline). **No gradient sky, no blur, no
  depth-of-field.** Static art this phase. (The existing washi/torii `landmark` becomes a generic
  signature tall building or is dropped — an authoring detail; the scene reads as a **city skyline**,
  not a shrine.)
- Functional: the board panel is **opaque** (a solid, **dark** framed card), not translucent/frosted.
  The scene shows only in the margin around the panel, never behind the dots. The opaque dark base
  **decouples dot contrast from the scene** — dots only ever sit on `PANEL_BASE`.
- Non-functional (figure-ground — **named target**): because the panel is dark **and** the scene is
  dark, the panel must still read as a distinct card. Give it an explicit **frame** (`PANEL_FRAME`, a
  solid border ~2px) + a subtle **edge highlight** (`PANEL_EDGE`) authored **fresh for a dark
  surface** — do not reuse the light-vellum `PANEL_BASE/FRAME/EDGE` darkened blindly; a light-tuned
  palette does not behave predictably when darkened. Author `PANEL_FRAME` to clear **SC 1.4.11 ≥ 3:1
  against the darkest adjacent `CITY_THEMES` scene swatch** — a static-data check over the theme hexes
  at authoring time, then verified on device. The panel-base ceiling (L ≤ ~0.058) and the
  frame-vs-scene floor (≥ 3:1) are independent and both must hold.
- Non-functional (legibility): the **score** and **Back** text stay **≥ 4.5:1** over whatever band of
  the dark scene sits behind them. On a **dark** scene the text ink flips to a **light paper token**
  (append-only new UI token, e.g. `TEXT_ON_SCENE` ≈ `TEXT_COLOR`), authored to clear 4.5:1 over
  **every** dark `CITY_THEMES` sky/foreground swatch — a static-data check at authoring time. Phase 3
  renders only `CITY_THEMES[0]`; the cross-theme on-device re-check is **Phase 4**'s.

## Architecture

- **Shared theme catalog** — `src/render/themes/city-themes.ts` (pure data + types, **no Skia
  import** so Phase 4's index fn is Vitest-testable): a flat-colour `CityTheme` (`sceneFields`,
  `skylineColor`, `skyline`, `skylineFar`/`skylineFarColor`, `sceneAccent` — **no gradient stops, no
  blur radius**) + an ordered `CITY_THEMES: readonly CityTheme[]` — the **dark**-city milestone-state
  ramp (≥2 dark-family states). `PANEL_BASE`/`PANEL_FRAME`/`PANEL_EDGE` are **single fixed
  module-level exports, NOT `CityTheme` fields** (matches the live code): every milestone state shares
  the one dark panel, which is exactly why dot contrast can be measured **once** and holds across all
  states. A per-theme panel colour would silently un-cover 3 of the 4 states — do not add these to
  `CityTheme`. **Reauthor every hex to a dark city-skyline family from scratch** (not a darken of the
  light values); keep low chroma so the scene recedes. RN/Skia-free.
- **City-skyline scene** — `src/render/backdrop.tsx` (`Backdrop` component): a `CityTheme` +
  full-screen `width`/`height` in, draws **flat** dark sky bands (fraction-based) + folded-paper
  building silhouettes (near + far rows via `Path`/`RoundedRect`, **flat fills**) + optional accent
  disc, tuned to **recede** (quiet, low contrast — the dots dominate). **No `LinearGradient`, no
  `Blur`/`BackdropBlur`, no per-frame shader.** An optional faint **static** baked paper-grain
  (existing `RuntimeEffect.Make` + `drawAsImage` pattern) is allowed only if subtle; default off.
- **Board panel** — `src/render/board-panel.tsx`: an **opaque** `RoundedRect` at the **dark**
  `PANEL_BASE` (alpha ~1.0) with a soft drop shadow, a 1px inner **edge highlight** (`PANEL_EDGE`),
  and an explicit ~2px **frame** (`PANEL_FRAME`) — all authored fresh for a dark surface. No blur, no
  live luminance clamp (YAGNI). Dots only ever sit on `PANEL_BASE`.
- **Dots** — `src/render/dot-layer.tsx`: **simplified to the flat path only for Endless.** Endless
  renders dots exactly as Journey does today: a `Circle(cx, cy, r)` filled with `colorFor(colorId)`,
  `patterned = false`. **Remove** the `ImageShader`/`variant` marble branch and the `textures` prop
  from the Endless call (the whole `patterned && textures` gate). The merge-fade and drop-bounce
  worklet math is shape-agnostic and composes with the flat disc unchanged. Journey stays
  pixel-identical.
- **Delete** — `src/render/marble-texture.tsx` is removed in full; nothing imports it after
  `dot-layer.tsx`/`game.tsx` drop the `textures` wiring.
- **Canvas + inset board (opt-in — `board-canvas.tsx` is SHARED with Journey).** Already wired:
  `backdrop?: { theme; width; height }` prop; the Canvas sizes from `backdrop.width/height` when
  present, else the board size. Endless (`game.tsx`) opts in; Journey passes nothing and stays
  pixel-identical. Render order when present: `<Backdrop/> → <BoardPanel/> → <LinkPath/> →
<DotLayer/>` (no `patterned`/`textures`).
- **Layout (inset board, dark scene)** — `src/app/game.tsx`: the Canvas stays sized to the **whole
  screen** (`useWindowDimensions`) so the dark scene fills it, but the **board is inset**:
  `boardSize = min(width, height) * k` clamped so a **clear margin** remains on all sides (the user's
  "not reach the edge" ask); `originX = (width - boardSize)/2`, `originY` centres the board vertically
  with room for the score above and Back below. Score/Back are safe-area RN overlays
  (`useSafeAreaInsets`, provider already added). The container `backgroundColor` becomes the dark
  `SCREEN_BACKGROUND` (occluded by the full-bleed dark Canvas anyway). Also drop any `textures`/
  `useMarbleTextures` wiring here.
- **Safe-area provider** — `src/app/_layout.tsx`: `<SafeAreaProvider>` around the router `<Stack>`
  **already landed in the second pass** (uncommitted). Keep it; no change.

## Related Code Files

- **Delete: `src/render/marble-texture.tsx`** — the whole baked-marble module is removed.
- Modify: `src/render/dot-layer.tsx` — drop the `ImageShader`/`variant` branch, the `textures` prop,
  and the `patterned` gate for Endless; render the flat `colorFor` `Circle` (already the Journey
  path). Journey output byte-identical.
- Modify: `src/render/themes/city-themes.ts` — **reauthor to a dark city-skyline family** (dark
  low-chroma per-theme `sceneFields`/`skylineColor`/`skylineFar*`/`sceneAccent`, plus fresh dark
  **fixed module-level exports** `PANEL_BASE`/`PANEL_FRAME`/`PANEL_EDGE` — not `CityTheme` fields);
  no gradient/blur fields. Replace the torii `landmark` with a generic signature building or drop it.
- Modify: `src/render/backdrop.tsx` — draw the flat **city skyline** (near + far building rows) tuned
  to **recede** (quiet, dark, low contrast); still flat + static + full-screen.
- Modify: `src/app/game.tsx` — **inset** board sizing (clear margin), origin recompute; dark
  container background; **remove** the `textures`/`useMarbleTextures` wiring. Keep the style-less
  `<View>` wrapping `<GestureDetector>` (touch invariant).
- Modify: `src/render/palette.ts` — **append-only** UI tokens if needed for dark scene text
  (`TEXT_ON_SCENE`) / dark panel; **never** reorder or re-hex `DOT_COLORS[0..2]`. **Revert** the stale
  header comment (lines ~12-16) that claims Endless "meets the LOCKED colour+shape rule via the baked
  marble swirl" — now false; restore colour-only / documented-gap wording.
- Verify (likely no change): `src/render/board-canvas.tsx` — already sizes from
  `backdrop.width/height`; confirm no edit for the inset board (board size shrinks, canvas stays
  full-screen — the origin offset handles placement).
- Verify (no change): `src/app/_layout.tsx` — `<SafeAreaProvider>` already present.
- Cleanup: `src/render/frosted-panel.tsx` — dead artifact from the first (frosted-vellum) cut; remove.

## Implementation Steps

1. **HTML mock FIRST (de-risk the look before code).** Repurpose
   `scratchpad/endless-matte-candy-preview.html` to show the **dark city skyline + inset framed
   board + flat colour discs** only — drop the pattern-hero rows, the greyscale toggle, and the
   true-scale swirl strip (all dead now). Get **user look-approval** before touching any Skia file.
2. **Dark theme data** — reauthor `city-themes.ts` to the dark city-skyline family (fresh dark hexes,
   low chroma, receding; near + far building rows; accent disc; generic/none landmark). Author the
   dark `PANEL_BASE`/`FRAME`/`EDGE` fresh (not darkened light values). Static-check: each
   `DOT_COLORS` hue ≥ 3:1 vs `PANEL_BASE` (red/blue tight); `PANEL_BASE` L ≤ ~0.058; `PANEL_FRAME`
   ≥ 3:1 vs the darkest scene swatch; `TEXT_ON_SCENE` ≥ 4.5:1 vs every dark sky band.
3. **Flat dots** — delete `marble-texture.tsx`; simplify `dot-layer.tsx` to the flat `colorFor`
   circle for Endless (drop `ImageShader`/`variant`/`textures`); remove the `useMarbleTextures`
   wiring from `game.tsx`. Confirm Journey output is byte-identical. **Measure each colour's flat-disc
   contrast** vs the dark `PANEL_BASE` (must be ≥ 3:1, SC 1.4.11) and record the three ratios.
4. **Draw the skyline** — build/tune `backdrop.tsx` to draw the dark city skyline (near + far rows)
   quiet and low-contrast (the dots dominate by construction).
5. **Inset layout** — in `game.tsx`, shrink `boardSize` so a clear margin remains on all sides (the
   "not reach the edge" ask), recompute `originX/originY`, set the dark container background, keep the
   score/Back safe-area overlays and the style-less `<GestureDetector>` wrapper + invariant comment.
6. **Panel/frame** — confirm the dark opaque panel reads as a distinct framed card against the dark
   skyline; strengthen the frame/edge only if figure-ground is weak.
7. **On-device (HARD GATE)** — confirm: (a) dots read as clean flat solid discs, each colour legible
   on the dark panel; (b) the scene is a **dark city skyline** that **recedes** — the dots clearly
   dominate; (c) the **board is inset** with a clear margin (does not reach the edge) and reads as
   framed; (d) **touch routing** — Back is tappable over the canvas and the board hit-tests the right
   cell (Phase 2 origin at the inset size); (e) score/Back stay ≥ 4.5:1 over the dark scene; (f) the
   full-screen dark scene holds frame-rate during a full sweep/merge — profile on **iPhone 12 (A14)**.

## Success Criteria

- [ ] Dots render as **dead-flat solid-colour discs** on the **bright frozen hues** (no darkening, no
      shading, no light, no gloss, no ring) — the existing flat `colorFor` path, `patterned = false`.
      `marble-texture.tsx` is deleted and nothing imports it.
- [ ] **§2.2 colour+shape stays UNMET** — dot identity is **colour-only**; the plan and docs record
      it as a **documented accessibility gap**, never as satisfied. No bible amendment (the rule is
      unchanged, still not met).
- [ ] Flat-disc contrast vs the dark `PANEL_BASE` is **measured once per colour and ≥ 3:1**
      (SC 1.4.11); the whole dot is the base hue; the three ratios are recorded in the PR (**red and
      blue are the tight cases on a dark ground, not green**).
- [ ] The city **skyline** scene is **dark and recedes** (§2.2-compliant — no "backgrounds recede"
      exception); flat, static, one canvas; correct scene→panel→link→dots order. No gradient, no blur.
- [ ] The **board panel is inset with a clear margin on all sides** — it does not reach the phone edge
      (the user's core ask) — and reads as a distinct **dark opaque framed card** against the dark
      skyline. `PANEL_FRAME` clears **≥ 3:1 (SC 1.4.11) vs the darkest `CITY_THEMES` scene swatch**
      (figure-ground), and `PANEL_BASE` stays under the **L ≤ ~0.058** luminance ceiling — both
      checked over the theme data at authoring time.
- [ ] Dots only ever sit on the fixed dark `PANEL_BASE` (scene changes cannot touch dot contrast).
- [ ] **Touch still routes correctly**: Back is tappable over the canvas, the board hits the right
      cell at the inset size (Phase 2 origin).
- [ ] Score + Back text stay **≥ 4.5:1** over the dark scene (light text token, authored vs every dark
      theme's sky).
- [ ] Theme comes from `CITY_THEMES`; **no dot hex changed**; Journey (`journey.tsx`) is unchanged and
      pixel-identical (flat dots, no scene).
- [ ] `lint` + `typecheck` + `test` green.

## Risk Assessment

- **Flat discs read sticker-like / pasted-on against the dark ground.** Signal: at the mock or the
  on-device gate the dead-flat discs look flat-pasted rather than sitting on the board. Response: the
  user chose dead-flat deliberately, so the in-bible remedy is a subtle **paper drop-shadow** under
  each dot (a shadow is not shading/gloss/light-on-the-dot — it respects the "dead-flat" choice);
  decide on device, do not pre-add. Not a blocker.
- **Bright dot vs dark panel dips below 3:1 — watch red & blue, not green.** On a dark ground the
  relationship inverts: green (`#3ddc84`, L≈0.54) has the most headroom and is safest; **red
  (`#ff4d5e`) and blue (`#4f8cff`) (L≈0.27) are the tight pair.** Signal: a measured red- or
  blue-disc ratio < 3:1. Response: keep `PANEL_BASE` relative luminance **≤ ~0.058** (the design-time
  ceiling that lands red/blue at ≥3:1); if a dark theme's `PANEL_BASE` drifts lighter, darken it
  (fresh dark authoring, not a global darken) and re-measure. Panel opaque + fixed → one-time tune.
- **Dark panel doesn't separate from the dark skyline (figure-ground).** Signal: on device the board
  card blends into the scene, or the authoring-time check shows `PANEL_FRAME` < 3:1 vs the darkest
  `CITY_THEMES` swatch. Response: the explicit `PANEL_FRAME` (~2px) + `PANEL_EDGE` highlight do the
  separation; author them fresh for a dark surface (**not** a blind darken of the light tones) and
  hold `PANEL_FRAME` to **≥ 3:1 (SC 1.4.11) vs the darkest adjacent scene swatch** — a static check
  over the theme data. Nudge frame contrast up if it blends. Verify on device.
- **Full-screen dark canvas breaks touch routing.** Signal: Back not tappable, or the board mis-hits
  after the inset origin. Response: keep the `game.tsx` `<View>` wrapping `<GestureDetector>`
  **style-less** so `event.x/y` stays canvas-pixel space (Phase 2 origin sufficient); score/Back are
  RN overlays **above** the Canvas with their own touch targets; scope the pan to the board rect
  **only if** the device gate shows the Back tap is eaten. Phase 2 Vitest origin cases + on-device hit
  check + invariant comment are the guard.
- **Score/Back illegible over the dark scene.** Signal: measured text contrast < 4.5:1. Response: the
  ink flips to a **light** paper token over the dark scene (≥ 4.5:1 by construction on a dark sky); if
  a lighter dark-theme band drops it, add a subtle scrim behind just the text. Re-measure.
- **Full-screen enlarges per-frame draw cost.** Signal: frame-rate dips during a full sweep on A14 vs
  a bounded box. Response: the dark skyline is flat fills + a few paths and stays 100% static; the
  lever is scene complexity (thin the skyline / drop optional grain), not the dots (a flat `Circle` is
  cheaper than the deleted baked marble). Measured at step 7(f).
- **Shared `BoardCanvas` leaks the scene into Journey.** Signal: `journey.tsx` shows the Endless
  scene. Response: the `backdrop` prop is optional; Journey passes none → board-sized, origin-(0,0),
  flat dots. Grep-verify only `game.tsx` opts in; sanity-check Journey (japan-01) on device.
- **Accessibility gap is later cited as met.** Signal: store/compliance/bible copy claims colourblind-
  safe dot identity. Response: §2.2 is **unmet by design this pass** (user accepted the gap); the
  plan, the bible shipped-status note (Phase 4), and `palette.ts` all record colour-only. Never cite
  §2.2 as satisfied. The remedy path (a per-colour silhouette channel) is a documented future option,
  not shipped.

## Decisions (confirmed at the approval gate)

- **Panel opacity — RESOLVED: fully opaque (alpha ~1.0), dark family.** Dots only ever sit on the
  fixed dark `PANEL_BASE`, so dot contrast is measured once against that one colour.
- **Dot finish — RESOLVED (2026-08-18, user fork): dead-flat matte discs.** Flat solid frozen hue,
  **no** roundness shading, soft light, specular, gloss, ring, or rim. The "matte fill + soft
  top-left light" option was declined. Reuses the existing flat `colorFor` path; the entire baked-
  marble subsystem is deleted.
- **Dot identity — RESOLVED (2026-08-18, user fork): colour-only, accept the §2.2 gap.** The LOCKED
  colour+shape rule stays **unmet** (same as the shipped app). The "colour + distinct silhouette per
  colour" middle path was declined. No bible amendment; recorded as an open accessibility gap.
- **Ground + colour — RESOLVED (2026-08-18): dark receded city skyline + bright dots.** The bright
  frozen `DOT_COLORS` only clear WCAG on a dark ground (green caps ~1.8:1 on any light washi panel —
  kongming contrast math), so "use Journey's colours" _requires_ the dark ground. The board is
  **inset with a margin** (not full-bleed). Phase 4's cross-fade **survives**, retargeted to the dark
  city family. **Note the inversion:** on a _light_ panel green is the tight case; on the _dark_
  ground the tight cases flip to the dimmest hues — **red/blue** — while green becomes the safest
  (drives the `PANEL_BASE` L ≤ ~0.058 ceiling).
- **Scene subject — RESOLVED (2026-08-18, user): city skyline.** Resolves the earlier A(quiet) /
  B(city) busy-ness fork to **B · city skyline**, recoloured to a dark, receding family.
- **"Backgrounds recede" — RESOLVED: no exception needed.** The dark receding skyline **complies**
  with §2.2. The second pass's documented full-bleed "richer" exception is **dropped** (Phase 4 docs
  updated accordingly).
- **Touch-priority — RESOLVED (validate, 2026-08-17, carried): z-order first, scope pan only if
  needed.** Score/Back as RN overlays above the Canvas with their own touch targets; bound the pan to
  the board rect only if the device gate shows the full-screen pan eats the Back tap.

## Assumptions confirmed at validate

- **Oldest supported iPhone — PINNED (2026-08-17): iPhone 12 (A14).** The perf gate (step 7f) profiles
  against **A14**; A13 (iPhone 11 / SE 2nd-gen) is not guaranteed.

## Assumptions still to confirm

- **Board inset amount / vertical placement** — the exact `boardSize` clamp (`k`) and `originY`
  reserve for the score band + Back on the tallest and shortest supported screens is a tuning dial set
  in the HTML mock + on device (start with a clear symmetric margin; not a blocker).
- **Flat dots reading sticker-like** — if the dead-flat discs look pasted-on at the gate, a subtle
  paper drop-shadow (no gloss, no light on the dot) is the in-bible remedy; decide on device.
