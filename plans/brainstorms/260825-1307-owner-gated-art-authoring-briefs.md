# Owner-gated art-authoring briefs: `title.riv` + mascot

**Date:** 2026-08-25
**Type:** Brainstorm / design contract (stateful, pre-delivery). NOT evergreen authority.
Evergreen look/feel authority stays `docs/creative-bible.md` (LOCKED). Per `plans/brainstorms/README.md`
this record feeds a plan; it does not supersede `docs/` once work lands.
**Scope:** SPEC/BRIEF DOCUMENTATION ONLY. No art asset is produced, generated, or faked here. A `.riv`
is a compiled Rive-editor binary authored by a human; mascot art is human-authored in Procreate. Per
`docs/rnd-department.md`, agents spec and review; humans produce art.

---

## Brainstorm contract: unblock the two owner-gated art follow-ups

### Outcome

Two follow-ups are blocked on human-authored art. This document removes every blocker except the art
itself, so that:

1. **`title.riv`** (animated Rive title) — a human Rive artist has a drop-in-trivial spec: exact
   lockup, colors, canvas, animation intent, size budget, and the two-step dev activation. When the
   `.riv` lands, shipping it is a JS/Metro-asset change (no native rebuild).
2. **Mascot moment** (Phase 7, `plans/260817-1217-endless-visual-upgrade/phase-07-mascot-deferred.md`)
   — the owner has 2 to 3 concept options and a decision block. The mascot's _existence_ is LOCKED by
   bible §2.6; its _design_ is the owner's creative call. This brief specifies; it does not adopt.

### Constraints (hard)

- **`docs/creative-bible.md` is LOCKED.** Both briefs honor it and cite it; neither proposes changing it.
- **No AI attribution** anywhere (authors, co-authors, comments, copy).
- **No em-dashes** in any string that could become on-screen UI text (wordmark, subtitle, mascot copy).
- Tone words (bible §1, LOCKED): warm, tactile, calm-but-purposeful, handmade, uncluttered.
  Anti-words: harsh, neon, busy, glossy-plastic, aggressive.
- Material (bible §2.1, LOCKED): everything reads as cut/folded/layered textured paper; depth from soft
  paper drop-shadows + layering; ONE implied light direction (top-left) across all assets.
- Motion (bible §4, LOCKED): meta-UI micro-motion is `rive-react-native` (one tool per layer, no mixing
  with the Reanimated + Skia in-scene layer). Feel: springy but soft, juicy but calm, never frantic.
  Respect Reduce Motion.
- v1 country (bible §8): Japan (origami / washi synergy with paper-craft).

### Non-goals

- Producing, generating, or stubbing any `.riv`, image, or placeholder mascot (Phase 7 explicitly
  forbids shipping a placeholder mascot — a missing mascot beats a wrong one).
- Adopting a mascot design (owner decision), adding per-country characters, or making the mascot an
  in-board element (bible §2.6: branding + gentle Journey framing only, not narrative).
- Editing any code, token, or doc. This file is the only artifact created.
- Changing the shipped static title lockup, the palette (`src/render/palette.ts`), or the tokens
  (`src/render/ui-theme.ts`).

### Acceptance criteria

- [ ] Brief 1 lets a Rive artist author `assets/rive/title.riv` with zero further questions: canvas,
      default-artboard/autoplay contract, exact color tokens, animation intent, size budget, and the
      artist definition-of-done are all stated.
- [ ] Brief 1 states the exact two-step dev drop-in and that no native rebuild is needed.
- [ ] Brief 2 gives 2 to 3 distinct concept options (each with name, read, silhouette, palette from
      washi tokens, icon-scale legibility, one Journey motion beat, tone-word hits/anti-word risks,
      biggest design risk), a placement map, a human production path, and an explicit owner-decision
      block that adopts nothing.
- [ ] Every constraint above holds; every claim traces to a cited source file.

---

# Brief 1: `title.riv` authoring spec

**Deliverable (human):** one file at `assets/rive/title.riv` that animates into the exact shipped title
lockup. **Consumer:** `src/render/rive-title.tsx` (pinned contract below).

## Pinned code contract (do not contradict)

From `src/render/rive-title.tsx`:

- The component renders `<Rive source={source} autoplay onError={...} style={{ width: '100%', height: 150 }} />`.
  It passes **neither `artboardName` nor `stateMachineName`.** Therefore the authored file's **default
  artboard must BE the title lockup**, and it must **autoplay** (default state machine, or a timeline the
  runtime auto-plays). The artist may name the artboard/state-machine for their own clarity, but the
  runtime uses the DEFAULTS, so the defaults must be correct.
- **Reduce Motion and any native Rive error are already handled in code** (`useReduceMotion()` + `onError`
  swap to the static paper-craft lockup). So the `.riv` does NOT need to author a reduced-motion variant.
  It must still stay calm and non-frantic per bible §4 regardless.
- **No native rebuild needed.** `rive-react-native` `^9.8.5` is already a dependency (`package.json`) and
  already imported in shipped code; `metro.config.js` already registers `.riv` in `assetExts`
  (`config.resolver.assetExts.push('riv')`). Dropping the asset + flipping one line is a JS/Metro-asset
  change: reload Metro and verify on device. (`expo run:ios` is only for adding a native module, which
  this is not.)

## The lockup the `.riv` must reproduce and animate

Source of truth is the static fallback in `src/app/index.tsx` (styles `lockup` / `title` / `subtitle` /
`kanji` / `seal`). The animation must **resolve to visually match this static lockup**, so toggling
Reduce Motion (Rive <-> static) causes no layout or appearance jump.

| Element  | Content                                                                       | Token (bake this hex)                                                                                           | Placement / weight                                      |
| -------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Card     | Warm washi card, hairline border, soft top-left drop-shadow, over dark ground | bg `paper` `#f2e9d8`; border `paperEdge` `#d9c9a8`; shadow `rgba(28,22,18,0.22)`; ground `night` (shipped dark) | radius ~14; shadow offset y+6, blur ~14, top-left light |
| Wordmark | `Three Dots`                                                                  | `ink` `#2b2622`                                                                                                 | heavy ~800 weight, letterSpacing ~0.3                   |
| Subtitle | `ENDLESS` (uppercase)                                                         | `inkSoft` `#6d6151`                                                                                             | small (~12pt), letterSpacing ~2.2                       |
| Kanji    | `三`                                                                          | `shu` `#cf5138`                                                                                                 | pinned top-right, small (~16pt)                         |
| Seal     | small square mark                                                             | `shu` `#cf5138`                                                                                                 | near the bottom edge, ~22x22, rounded                   |

## Canvas / artboard

- Renders at `width: 100%` inside a container with **32pt horizontal padding each side**
  (`paddingHorizontal: space.xxl` in `index.tsx`), so usable width is approximately `deviceWidth - 64`.
  Author a **responsive layout / fit** (fit to width, layout-driven) so the card fills the container
  cleanly on phones from ~320pt up.
- **Height reconciliation (important).** The code placeholder is `height: 150`, but the static lockup
  renders shorter, approximately **105 to 120pt** tall: paddingVertical 24 top + 24 bottom = 48, plus
  wordmark ~30pt + subtitle ~16pt (plus the seal's slight bottom overhang). Author the `.riv` to that
  aspect (roughly `usableWidth x ~112pt`). The dev then sets `styles.rive.height` in `rive-title.tsx` to
  the **measured static-lockup height on device**, so the Rive <-> static toggle does not shift layout.
- **Default artboard = the lockup. Autoplay on mount.**

## Animation intent (bible §4 LOCKED: springy but soft, juicy but calm, one implied top-left light)

A short **one-shot assemble** that ends matching the static lockup, then stops (or holds a barely
perceptible idle breath). No looping flash, no frantic motion.

Suggested beat order (artist may refine timing to hit "juicy but calm"):

1. Paper pieces fold / settle into the washi card (soft paper drop-shadow implies the top-left light).
2. `Three Dots` ink text settles in.
3. `ENDLESS` tracks / fades in.
4. `三` stamps in vermilion, top-right.
5. Tiny `shu` seal presses near the bottom edge.
6. Settle to a stop, or a very subtle idle breath (no attention-grabbing loop).

## Budget, export, handoff

- **File-size budget:** <= 200KB (realistically < 100KB for vector art + one state machine).
- **Colors baked in:** `paper #f2e9d8`, `paperEdge #d9c9a8`, `ink #2b2622`, `inkSoft #6d6151`,
  `shu #cf5138`. (Ground is the shipped `night`; the card sits over it, do not paint an opaque dark bg.)
- **Export:** a single `.riv`, default artboard = the lockup, autoplay verified in the Rive editor
  preview before handoff.

## Definition of done (artist checklist)

- [ ] Default artboard IS the title lockup (no reliance on a named artboard/state-machine).
- [ ] Autoplays on load in the Rive editor preview (no manual trigger needed).
- [ ] Resolves to visually match the static lockup (same layout, colors, positions) so a Reduce-Motion
      toggle causes no jump.
- [ ] Responsive to width; authored to ~`usableWidth x ~112pt` aspect.
- [ ] Motion is calm and non-frantic (bible §4); one-shot assemble, no looping flash.
- [ ] Colors match the baked hexes exactly.
- [ ] `.riv` <= 200KB.

## Dev drop-in (two steps, then verify)

1. **Place the file** at `assets/rive/title.riv`.
2. **Flip one line** in `src/render/rive-title.tsx`: change `riveTitleSource()` body from
   `return null;` to `return require('../../assets/rive/title.riv');`.
3. **Verify:** reload Metro, verify on device; also toggle Reduce Motion to confirm the static fallback
   still matches (no layout shift). If the aspect differs, set `styles.rive.height` to the measured
   static-lockup height. No native rebuild.

---

# Brief 2: Mascot design brief

**Frame:** the mascot's _existence_ is LOCKED by bible §2.6 (exactly ONE light mascot, used for
branding / app icon and gentle Journey framing: map intro, win/lose reaction; NOT a narrative character;
NO per-country characters). Its _design_ is TBD and is the owner's creative decision. This brief cites
the higher-authority bible over `docs/game-scripts/characters.md` (currently an empty template whose
"does v1 need a character at all?" open question is answered: yes, one, per §2.6). Phase 7 forbids
shipping a placeholder mascot, so this brief specifies; it does not create.

## Locked scope + tone constraints (every concept must honor)

- Exactly one mascot; branding / app icon + gentle Journey framing only; NOT in-board, NOT narrative
  (bible §2.6).
- Paper-craft material, one implied top-left light (bible §2.1).
- Tone words: warm, tactile, calm-but-purposeful, handmade, uncluttered. Anti-words: harsh, neon, busy,
  glossy-plastic, aggressive (bible §1).
- Japan / origami / washi reference (bible §8). Palette drawn from the shipped washi tokens:
  `paper #f2e9d8`, `paperEdge #d9c9a8`, `ink #2b2622`, `inkSoft #6d6151`, accents `shu #cf5138`
  (vermilion) and/or `ai #33526e` (indigo). No neon.
- Journey micro-motion authored in Rive (bible §4 meta-UI layer), Reduce Motion gets a static pose.

## Concept options (2 to 3 distinct directions)

### Concept A: "Tsuru" (folded-paper crane)

- **Character read:** a serene folded-paper crane that quietly presides over the Journey; a calm guide,
  not a talker.
- **Silhouette / shape language:** sharp, angular crane profile with strong negative space; a clean
  side-on read (folded wings, long neck). Instantly recognizable as a single crisp shape.
- **Palette:** `paper #f2e9d8` body, `ink #2b2622` fold-line accents, one `shu #cf5138` fold or beak
  accent; optional `ai #33526e` on the Journey map for cool contrast.
- **Icon legibility:** the profile silhouette holds at 40 to 60px; at 1024px the fold creases + paper
  grain + top-left highlight carry the craft detail.
- **One Journey motion beat (Rive):** map intro = crane unfolds and settles onto the map with a soft
  wing-settle; win = a small wing-lift + head-tilt delight; lose = wings soften and droop, then a gentle
  re-fold (encouraging, not sad).
- **Tone hits / anti-word guard:** hits handmade, calm-but-purposeful, tactile; must avoid aggressive
  (keep the beak soft) and busy (few, clean folds).
- **Biggest design risk:** the origami crane is a well-worn shorthand for "Japan" and can read generic;
  it must feel bespoke through paper texture, fold detail, and the one-light shading, not a stock fold.

### Concept B: "Mame" (paper dot-spirit)

- **Character read:** a small folded-paper pebble creature, a "dot" come to life; warm and quietly
  satisfying, tying the mascot to the star of the board (the dot).
- **Silhouette / shape language:** rounded, slightly faceted paper blob with two tiny fold-eyes;
  essentially a circle, so it is trivially legible at any size.
- **Palette:** `shu #cf5138` body (the hero accent) with `ink` facial marks and a `paper #f2e9d8`
  highlight fold; or invert to a `paper` body with a `shu` cheek. Matte, never glossy.
- **Icon legibility:** a single warm paper dot with a face reads at 40px effortlessly; at 1024px show
  fold facets + a soft top-left highlight to keep it clearly paper, not plastic.
- **One Journey motion beat (Rive):** map intro = hops / rolls into frame and settles with a soft
  squash-stretch; win = a gentle bounce + a small paper-fleck burst (echoes the board's dot-pop juice
  vocabulary, but authored in the Rive meta-UI layer, not Skia); lose = a soft deflate / tilt, then a
  hopeful re-inflate.
- **Tone hits / anti-word guard:** hits warm, tactile, handmade, quietly satisfying; must avoid
  cartoon-slapstick (keep the bounce soft) and glossy-plastic (keep the surface matte paper).
- **Biggest design risk:** can drift toward a generic cute-blob mascot or candy-crush sweetness; it must
  stay matte, restrained, and paper-faceted to hold the bible's calm, handmade tone.

### Concept C: "Han" (paper seal / guardian emblem)

- **Character read:** an emblem-first mascot, a folded-paper guardian crest that unifies with the
  vermilion seal already in the title lockup, so branding and mascot are one system.
- **Silhouette / shape language:** a compact, symmetrical crest / guardian face (komainu-leaning or a
  stylized mon) that works as a pure emblem; the strongest possible app-icon legibility.
- **Palette:** `shu #cf5138` seal field with `paper #f2e9d8` cut-out shapes + `ink #2b2622` linework;
  `ai #33526e` as a secondary accent on the map.
- **Icon legibility:** essentially already an icon (a seal / mon), so it reads perfectly small; at 1024px
  show layered paper cut edges + top-left shadow.
- **One Journey motion beat (Rive):** map intro = the seal presses onto the map (a stamp beat that
  echoes the lockup's seal press); win = the crest brightens + a tiny confetti of paper flecks; lose =
  the stamp lifts and softly re-inks (a retry framing).
- **Tone hits / anti-word guard:** hits handmade, uncluttered, calm-but-purposeful; must avoid harsh /
  aggressive (a guardian can read stern, keep it gentle) and glossy.
- **Biggest design risk:** an emblem can feel cold or corporate and delivers a weaker win/lose
  "reaction" than a creature with a face; it may not carry the warm Journey framing as readably.

### Quick comparison

| Concept | Archetype        | Icon legibility    | Warmth of reaction | Ties to existing lockup | Biggest risk          |
| ------- | ---------------- | ------------------ | ------------------ | ----------------------- | --------------------- |
| A Tsuru | creature (crane) | strong profile     | medium-high        | complementary           | reads generic / stock |
| B Mame  | dot-spirit       | strongest (circle) | highest            | echoes dot motif        | cute-blob drift       |
| C Han   | emblem / seal    | strongest (icon)   | lower              | unifies with the seal   | cold, weak reaction   |

## Placement / usage map

- **App icon:** the primary branding surface; must read from ~40 to 60px up to the 1024px store icon.
- **Title-screen branding:** sits as a small companion **complementary to** the existing `三` washi
  lockup; it must **not compete** with the wordmark or duplicate the vermilion role. It should be a
  small accent near a corner or above the card, not overlapping `Three Dots`. Note: Concept C would
  **unify with** the existing `shu` seal rather than add a second competing vermilion mark, so if C is
  chosen, the seal and mascot become one element (do not ship two rival seals).
- **Journey framing:** map intro + a win reaction + a lose reaction (bible §2.6), authored in Rive.
- **Explicitly NOT an in-board element** (bible §2.6). The board stays Reanimated + Skia dots only.

## Production path (human)

- **Art:** authored by a human in **Procreate** (paper-craft look), consistent with the one top-left
  light and washi tokens above.
- **Journey micro-motion:** authored by a human in **Rive** (`rive-react-native`, the bible §4 meta-UI
  motion layer), one gentle beat set (map intro + win + lose) with a static Reduce-Motion pose.
- **Workflow (`docs/rnd-department.md`):** agents spec and review; humans produce. Final review is the
  `art-director-reviewer` gate against the LOCKED bible before anything integrates.
- **Landing target (from Phase 7):** exported as `assets/rive/mascot.riv` (preferred, reuses the Rive
  layer) or a static asset; mounted near the title lockup in `src/app/index.tsx` with a Reduce-Motion
  static fallback. No new dependency beyond what is already shipped.

## Owner decision requested

**This brief adopts NO concept.** The mascot's design is the owner's creative call. Please choose one:

- [ ] **Pick one** concept (A Tsuru / B Mame / C Han) to take into production.
- [ ] **Request a blend** (for example: B's dot-spirit warmth wearing C's seal role).
- [ ] **Reject all** and redirect (new direction, still inside the LOCKED tone words + Japan/washi).
- [ ] **Defer** (Phase 7 stays `deferred`; it blocks nothing).

Once a direction is chosen, a human authors the art (Procreate) + Journey motion (Rive), then it clears
the `art-director-reviewer` bible gate before integration.

---

# Owner-gated: what remains

1. **`title.riv`** — needs a human-authored `assets/rive/title.riv` matching Brief 1. Drop-in is then
   trivial: place the file + flip one line in `src/render/rive-title.tsx`, reload Metro, verify on
   device (and toggle Reduce Motion). No native rebuild.
2. **Mascot** — needs the owner to pick a direction (or blend / reject / defer). Then a human authors
   the art in Procreate + the Journey motion in Rive, and it clears the bible review gate. No placeholder
   ships in the meantime (Phase 7 rule).
