# Three Dots — Creative Bible (v0)

**Date:** 2026-08-06 (concept); retargeted to React Native 2026-08-16.
**Status:** v0 — locked rules + placeholders pending the art reference for the v1 country. See §2.2 for
a shipped-status note where a LOCKED rule is not yet met by the running app.
**Purpose:** The single source of truth for look, feel, motion, sound, and tone. **This is the primary
anti-drift mechanism** — every asset, level, and screen is checked against this bible so nothing drifts
"too far from origin," stays consistent, yet still leaves room for bounded creativity.

**Consumers:** the `art-director-reviewer` agent (reviews against this), `level-designer`, `storyboard-writer`,
`ui-ux-designer`, and any human producing art/audio. **Related:** `docs/three-dots-game-design.md` (what the
game is), `docs/creative-tool-catalog.md` (what tools produce the assets), `docs/rnd-department.md` (who + workflow).

> **How to use this file:** anything under **LOCKED** is a hard boundary — deviating requires a bible update,
> not a one-off. Anything marked **TBD** is an open slot to fill (most need the chosen v1 country's reference).
> "Creative within boundary" = free choices _inside_ the LOCKED rules.

---

## 1. Origin & tone (the "boundary")

- **LOCKED — lineage:** the Two-Dots family — elegant, minimal, tactile, _quietly_ satisfying. Three Dots is
  **not** loud, not Candy-Crush-maximalist, not cartoon-slapstick.
- **LOCKED — the twist:** warm, handmade **paper-craft** world + a "conquer the world" Journey. Cozy craft
  meets a gentle sense of a journey/expedition.
- **LOCKED — tone words:** _warm, tactile, calm-but-purposeful, handmade, uncluttered._ Anti-words: _harsh,
  neon, busy, glossy-plastic, aggressive._
- **LOCKED — mode split:** Endless reads calm/meditative; Journey reads focused/adventurous (timer, map,
  progress) — but both share the same paper-craft materials and palette. See `three-dots-game-design.md`.

## 2. Visual language

### 2.1 Material — paper-craft (LOCKED concept, TBD exact textures)

- Everything reads as **cut / folded / layered textured paper**: dots, board, cages, city, UI cards.
- Depth comes from **soft paper drop-shadows + layering**, not realistic 3D lighting (Skia is a 2D canvas —
  light is _painted into_ the art, kept consistent, not simulated). **LOCKED:** one implied light direction
  (top-left) across all assets so shadows agree.
- **TBD:** the exact paper texture set (grain, edge fray, fold lines) — produced in Procreate, sampled once
  the v1 country reference is chosen; then locked here.

### 2.2 Color system (LOCKED rules, TBD exact hex)

- **LOCKED — accessibility:** dot identity is carried by **color AND a shape/pattern** (colorblind-safe;
  required by HIG + our 13+ posture). No state is communicated by color alone.

  > **Shipped-status: not yet met — shape/pattern deferred.** The shipped renderer
  > (`src/render/dot-layer.tsx`) draws plain circles: color only, no shape/pattern channel. Extending the
  > color palette to more hues does not add one either. This LOCKED rule stays the design target; treat it
  > as an open accessibility gap, not a shipped guarantee, until the renderer carries a shape/pattern
  > channel — do not cite this rule as satisfied in store copy or a compliance submission.

- **LOCKED — count:** v1 uses a small dot palette (default **5 colors**, tunable per city in the level script).
- **LOCKED — harmony:** muted, slightly desaturated "paper-pigment" tones, not primary neon. Backgrounds recede;
  dots pop via saturation/shape contrast, not brightness alone.
- **LOCKED — index stability:** the palette is **append-only**; a color's **position is its stable identity**
  (never inserted or reordered), because level scripts reference colors by positional index
  (`docs/level-script-schema.md`). Adding a color = append at the end; reordering is a breaking change. The
  shipped renderer already follows this rule (`src/render/palette.ts#DOT_COLORS`).
- **TBD:** the exact palette (dot hexes + each dot's shape motif, board/paper base tones, per-country accent) —
  drawn from the **v1 country reference (Japan — washi / origami paper tones)**, then locked.

### 2.3 Dots (LOCKED role, TBD final art)

- The star of the screen. Each color = a distinct **hue + shape motif** (e.g. circle / square / triangle /
  petal / ring) so they're distinguishable without color. Skins are cosmetic re-textures within these motifs.
- **TBD:** the 5 motif shapes + default skin, plus any per-country skin variants.

### 2.4 Board & obstacles (LOCKED, TBD art)

- Paper-sheet playfield; grid implied by soft creases/cells, not hard lines. Cages (caged-dot obstacle) read as
  folded-paper cages. **LOCKED:** obstacles must read instantly as "different from a normal dot."
- **TBD:** board frame, cage art, other obstacle art (introduced per catalog in the GDD).

### 2.5 City backdrop — isometric "lego-metropolis" (LOCKED approach, TBD kit)

- **LOCKED:** 2D **isometric** parallax sprite layers beneath the playfield, rendered on the same Skia canvas
  as the board — no 3D engine. Buildings unlock/light up as cities are cleared, making progress visible in
  the world.
- **LOCKED:** same paper-craft material as the board (folded-paper buildings), same implied light direction.
- **TBD:** the modular building kit per country (a reusable set of paper-block sprites the `level-designer`
  composes per city).

### 2.6 Mascot (LOCKED scope, TBD design)

- **LOCKED scope:** exactly **one** light mascot — used for branding / app icon and gentle Journey framing
  (map intro, win/lose reaction). **Not** a narrative character; **no** per-country characters.
- **TBD:** the mascot design (a paper-craft creature/emblem consistent with the tone words).

## 3. Typography & UI language

- **LOCKED:** one warm, rounded, highly legible type family; large touch targets (**≥44×44pt**); generous
  spacing; UI as paper cards over the world. Minimal chrome — the board and city are the stars.
- **LOCKED:** HUD shows only what the mode needs (Endless: score/best; Journey: objective, timer, stars).
- **TBD:** the exact typeface + type scale (set at the `ui-ux-designer` pass; must clear the license check in
  the tool catalog).

## 4. Motion language

- **LOCKED — engine:** in-scene motion is **`react-native-reanimated` worklets driving Skia primitives**
  (dots, link path, particles all live on the same canvas the board renders on); meta-UI micro-motion is
  **`rive-react-native`** (see tool catalog). One tool per layer — no mixing.
- **LOCKED — feel:** springy but soft. Juice vocabulary: dot **pop** (scale-out + paper-burst), **fall-bounce**
  on gravity, **loop-clear** flash + gentle shake, **combo** flair, time-low pulse (Journey). Tactile, never frantic.
- **LOCKED — restraint & a11y:** effects support readability, never obscure the board; **respect Reduce Motion**
  (provide reduced variants). Haptics reinforce key beats (clear, loop-clear, win/lose) — subtle, not constant.
- **TBD:** exact timing curves / durations — authored on-device to hit the "juicy but calm" bar, then noted here.

## 5. Audio language

- **LOCKED — tone:** warm, acoustic/organic, low-key. Endless = ambient, meditative loop; Journey = light,
  adventurous themes with a gentle time-pressure cue near 0. SFX are soft, papery, tactile (link blips rise in
  pitch with chain length; pop; loop-clear sparkle).
- **LOCKED — licensing:** every track/SFX must clear the license rules in the tool catalog (monetized-app-safe;
  keep proof-of-license). No unlicensed or ambiguous-rights audio ships.
- **TBD:** the actual music/SFX set (sourced via the audio tools in the catalog; `researcher` agent assists sourcing).

## 6. Consistency rules (the mechanism)

1. **One tool per asset class** (see catalog) — the single biggest anti-drift rule. No parallel toolchains for
   the same asset type.
2. **Every asset & level batch is reviewed against this bible** by the `art-director-reviewer` agent before it
   integrates. Drift = "does not match a LOCKED rule" → send back or update the bible deliberately.
3. **Export specs (LOCKED):** assets ship at the resolutions/format the Skia/RN asset pipeline needs
   (`@1x`/`@2x`/`@3x` via Metro asset resolution as applicable), consistent naming, packed into sprite
   sheets/atlases where that helps draw-call count. (Exact spec set once the art pipeline is wired.)
4. **The bible is versioned.** Changing a LOCKED rule is a real decision recorded here — not a silent per-asset exception.

## 7. Locked vs TBD summary

- **LOCKED now:** tone/boundary, paper-craft concept + single light direction, a11y color+shape rule
  (not yet met by the shipped renderer — see §2.2), 2D isometric growing city, one mascot only,
  Reanimated+Skia / `rive-react-native` motion split, audio tone + licensing rule, the one-tool-per-class +
  reviewer-gate mechanism.
- **TBD (needs the v1 country reference):** exact palette + hexes, the 5 dot motif shapes + skins, paper
  textures, building kit, mascot design, typeface, timing curves, the actual audio set.

## 8. Open items

- ✅ **v1 country = Japan** (origami / washi synergy with paper-craft). Palette hexes, motif shapes, building kit,
  mascot, typeface, and timing/audio are still drawn from the Japan reference, then locked.
- Provide the city-backdrop reference image (the "[Image #1]" concept) if available — non-blocking input for §2.5.
