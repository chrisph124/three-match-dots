# Design — Saga/Infinite Mode: Environment & Progression Strategy

**Date:** 2026-08-24 07:46 · **Phase:** BRAINSTORM (design-only, no code) · **Author:** ui-ux-designer
**Scope:** A third mode — "Infinite / Saga" — a near-infinite level ladder (thousands of levels) with a
boss every 10th level, its own visual identity, that scales without thousands of bespoke assets and
kills the near-black canvas.
**Authorities honored:** `docs/creative-bible.md` (LOCKED), `docs/three-dots-game-design.md`,
`docs/level-script-schema.md`, `src/render/palette.ts`, `src/render/board-canvas.tsx`.
**Status of siblings:** Endless & Journey both currently float a board-sized Skia canvas on flat
`#0f1117` — the Aug-18 "dark city skyline" brainstorm (`brainstorm-260818-0138-…`) was explored but
**never shipped**. Saga is greenfield for environment.

---

## 0. The one decision everything hangs on (read first)

The user's pain is "the background is completely black." The obvious fix — paint a warm scene directly
behind the dots — **breaks a load-bearing accessibility constraint already proven in this repo**: the
frozen dot hues clear WCAG contrast only on a _dark_ ground. From the shipped analysis
(`src/render/contrast.test.ts` + the Aug-18 brainstorm's kongming-verified core): red `#ff4d5e` and blue
`#4f8cff` sit at relative luminance L≈0.27; to hold SC 1.4.11 ≥3:1 the ground directly behind them needs
**L ≤ ~0.058** (near-black). A warm bright fill behind the dots would fail red & blue outright.

**Resolution — the "shadow-box diorama":** the warm, alive environment fills the _screen_, but the board
sits on an **opaque dark inset panel** floated over it — a framed paper stage. The black stops being a
void and becomes a deliberate _shadow-box_: a dark paper card lit from top-left, sitting inside a sunny
paper landscape. This is the single move that reconciles "kill the black" with the contrast floor, and it
also gives Saga an identity distinct from both siblings.

```
  ┌───────────────────────────────────────┐  ← warm biome sky (gradient) fills screen
  │   ~ ~   paper clouds      petals ·  ·  │
  │  ▁▂▃  far paper hills (low chroma) ▃▂▁ │  ← parallax mid layers = ALIVE, warm
  │      ┌───────────────────────────┐     │
  │      │▓ dark paper board panel ▓ │     │  ← inset card, L ≤ 0.058 → dots clear contrast
  │      │  ● ● ● ●  (flat discs)   │     │
  │      │  ● ● ● ● ●               │     │
  │      └───────────────────────────┘     │  ← washi-tape trim = biome accent (the only
  │  ▂▃▅  near paper terrace  ▅▃▂         │      part that recolors per episode)
  └───────────────────────────────────────┘
```

**Identity split across the three modes (all one paper-craft family, no drift):**

| Mode                       | Environment                                                                    | Feel                            | Backdrop archetype            |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------------- | ----------------------------- |
| **Endless** (shipped)      | near-black, no scene                                                           | zen, timeless                   | none / minimal                |
| **Journey** (partly coded) | **isometric** growing Japan city                                               | boutique, hand-authored "place" | iso building kit (bible §2.5) |
| **Saga** (this doc)        | **side-on parallax paper diorama** (pop-up-book ribbon), warm, rotating biomes | endless ladder, momentum        | flat vector silhouette layers |

Journey is _isometric_ and _authored_; Saga is _side-on_ and _parameterized_. They can never be confused,
yet share paper material, one top-left light, and the palette.

> **⚠️ Bible flag (needs a deliberate note, not a silent break):** Creative Bible §2.5 LOCKS "2D
> **isometric** parallax sprite layers" as _the_ backdrop — but that clause was written for Journey's
> conquer-a-country city. Saga introduces a **second, distinct backdrop archetype** (side-on,
> non-isometric paper diorama). Recommend amending §2.5 to a **per-mode backdrop clause**: "Journey =
> isometric growing city; Saga = side-on parallax diorama; both paper-craft, one light direction." This
> is the only LOCKED rule Saga touches. Everything else fits inside the boundary.

> **⚠️ Tone tension (resolved by design, no exception needed):** Bible §1 LOCKS anti-word
> "Candy-Crush-maximalist." Saga borrows Candy Crush's _skeleton_ (level ladder, boss-every-10, episode
> theming) but keeps a **Two-Dots soul**: juice stays papery and soft, never explosive confetti-spam.
> "Candy-Crush structure, Two-Dots restraint." No bible change required as long as effects obey §4's
> restraint rule.

---

## 1. Progression / navigation frame

**Recommendation: a vertical, virtualized "pop-up-book ribbon" — an endless upward paper trail.**

A winding path of level nodes climbs upward through a side-on paper diorama. You scroll up toward the
horizon; the biome behind recolors as you climb. Boss nodes every 10th level are large wax-**seal**
medallions that _gate_ the page — clearing one triggers a torn-paper page-turn into the next biome.

```
        ╱▔▔▔ next biome peeking (torn-page edge) ▔▔▔╲
       │        ( 21 )  ( 22 ) ...                    │
       │           ╲      ╱                            │
   ┌───┴──┐     ╭─────────────╮   ← BOSS GATE (level 20): big sealed medallion,
   │ ⑳ SEAL│◀───┤  ✦ 20  ✦    │      banner, paper arch. 9 dots + 1 gate = the "10" rhythm.
   └───┬──┘     ╰─────────────╯
       │   (19)╮   ╭(18)
       │       (17)                 ← small nodes: cleared = wax-seal stamp w/ 1–3 stars
       │   (16)╮                       available = raised, gentle bob, mascot marker sits here
       │      (15)  ★★☆               locked = folded grey paper, flat
       │   (14)╮
      ─┴─ scroll ↑ ─
```

**Why a ribbon, not a bounded world-map:** a Journey-style bordered map implies _authored geography_ —
that is precisely Journey's job and it does not scale to thousands. An endless upward ribbon scales with
zero cartography: nodes are procedurally placed along a repeating serpentine curve; the _only_ thing that
changes down the ribbon is which biome tokens paint the diorama behind it. **Trade-off:** less "sense of
place" than a real map — accepted, and intentional: Saga is a _ladder with momentum_, Journey is a
_world_. That contrast is a feature.

**Node states (colorblind-safe — shape + color, never color alone):**

- **Locked:** folded/creased grey paper, flat, no bob.
- **Available:** raised paper chit, biome-accent color, slow idle bob (Reanimated), mascot marker perches.
- **Cleared:** a wax-**seal stamp** pressed on it + 1–3 **star** count (shape channel = stamp; stars = count).
- **Boss (x10):** ~1.6× larger, framed medallion, small banner ribbon, distinct silhouette.

**Boss cadence legibility:** the repeat unit is literally "9 small chits → 1 gate." The gate is bigger,
sealed, and sits under a paper **arch**; the next biome's torn-page edge peeks above it, so the player
_sees_ that clearing the boss opens a new page. The number 10 is felt as rhythm, not read as a label.

**Hard technical requirement — virtualization.** Thousands of nodes cannot all mount. Render only a
window (~2 screens) of nodes as cheap RN `View`s (or one windowed Skia layer); the parallax diorama
behind is a single Skia canvas whose tokens are chosen by scroll position (current episode). Node state
(cleared/stars) persists via MMKV, keyed per level id — no backend (matches v1 scope). This mirrors what
mature saga games do: Candy Crush ships only ~10 map scenes and _rotates_ them across thousands of
episodes rather than authoring each — see Sources.

---

## 2. In-play environment system (replaces the black)

### 2a. Skia layer breakdown (two canvases — do not break the board's origin invariant)

`board-canvas.tsx` is sized _exactly_ to the board with origin (0,0), and its gesture wrapper must stay
style-less so touch maps to canvas pixels. **Therefore the environment is a SEPARATE full-screen Canvas
positioned absolutely behind**, and the board Canvas floats on top with margin. Clean separation, no
hit-test regression.

```
FULL-SCREEN BACKDROP CANVAS (absolute, behind)      cost / technique
─────────────────────────────────────────────────────────────────────
L0  Sky            vertical Gradient (biome ramp)    1 shader fill — cheapest; this alone kills the black
L1  Far silhouette distant hills/dunes/rooftops      1–2 Path fills, low chroma, slowest parallax, baked soft shadow
L2  Mid silhouette nearer terrace/trees              1–2 Path fills, medium parallax
L3  Ambient FX     petals / motes / snow / embers    POOLED tiny shapes (8–16), one Reanimated clock — the "alive" cue
L4  Foreground     torn-paper edge vignette (opt.)   1 Path at screen edges, fastest parallax → frames the board
─────────────────────────────────────────────────────────────────────
BOARD CANVAS (separate, floated, origin 0,0)
P0  Board panel    opaque dark card, L ≤ 0.058       1 RoundedRect + washi-tape trim (biome accent) + top-left drop-shadow (baked)
P1  Link path      existing LinkPath                 unchanged
P2  Dots           existing DotLayer (flat discs)    unchanged
P3  Board FX       sweep ripple, paper-burst pool    pooled, on-demand only
─────────────────────────────────────────────────────────────────────
HUD (RN Views, paper cards, above all)               score/timer/objectives/boss-seal — native text, ≥44pt targets
```

**Parallax drive:** a slow idle drift + a small reaction to cascades (board group nudges the layers a few
px). Optional subtle device-tilt. All of it is a handful of `translateX/Y` shared values — trivial cost.
**Blur discipline:** Skia blur is the one moderately costly op — allow it ONLY on _static_ baked layers
(the paper drop-shadows, the far-layer softness), never per-frame. This matches the repo's deliberate
removal of the live marble SkSL shader for perf/KISS.

### 2b. Theme-pack / biome system — high variety from ~30 shapes

A biome is **data, not art**: a token bundle the one backdrop renderer consumes. Ship **5 seed biomes**,
each with ~6 reusable silhouette shapes. Total bespoke art floor ≈ **30 vector shapes (or one atlas) for
the entire infinite mode.**

| #   | Seed biome          | Sky ramp (warm)                                                         | Silhouette motif                  | Ambient particle        |
| --- | ------------------- | ----------------------------------------------------------------------- | --------------------------------- | ----------------------- |
| 1   | **Meadow Terraces** | peach→butter                                                            | rolling paper hills, folded trees | petals                  |
| 2   | **Dune Coast**      | apricot→sand                                                            | layered dunes, paper palms        | drifting sand motes     |
| 3   | **Pine Highlands**  | teal→sage                                                               | folded conifers, ridgelines       | slow snow               |
| 4   | **Harbor Rooftops** | rose→clay                                                               | cut-paper roofs, chimneys, sails  | gull-dot specks / steam |
| 5   | **Lantern Night**   | plum→indigo (still ≥ nothing behind dots — board panel guards contrast) | paper lanterns, hill silhouettes  | fireflies / embers      |

**Parameterization axes** (multiply the 5 biomes into perceived hundreds, all recolor/transform — zero
new geometry):

1. **Time-of-day palette variant** — each biome ships **4** recolor ramps (dawn / midday / dusk / night)
   over the _same_ silhouettes → 5×4 = **20 palette sets**.
2. **Layer density / parallax seed** — which silhouette rows show and their spacing (a per-level integer).
3. **Ambient particle type + rate** — swap petals↔motes↔snow↔fireflies, tune density.
4. **Washi-tape trim accent** — the board-panel frame color (the one on-board element that recolors).
5. **Sky-gradient angle** — subtle, per-level.

Because the silhouettes are flat vector Paths, a "recolor" is literally changing fill props — no atlas
reload, no bake. This is the mechanism behind §6's "<40% identical" budget.

**Rotation schedule:** biome changes on a fixed cadence (~every 30–50 levels; time-of-day cycles faster
_within_ a biome so consecutive levels shift). After the 5 seeds are exhausted, they **reuse in fresh
palette+particle combos** — perceptually new via recolor. This is exactly Candy Crush's post-episode-420
background reuse, done deliberately and cheaply (Sources).

---

## 3. Boss-level visual language (x10) — special & harder at a glance, zero bespoke boss art

A boss reuses the _current_ biome tokens with a **"boss modifier"** applied. Nothing is hand-drawn per
boss. Five stacked signals read instantly:

```
BOSS FRAMING (level 30, e.g. Pine Highlands → "storm" modifier)
  ┌─────────────────────────────────────┐
  │▚▚ torn-paper proscenium (vignette) ▚▚│ ← 1 Path border w/ heavy top-left shadow = "arena"
  │  ⚑══ BOSS ══⚑   ⏳ 1:20   [◆◆◇]      │ ← HUD: banner + heavier objective frame + SEAL icon + boss accent
  │   ┌───────────────────────────┐      │
  │   │ darker/stormier sky ramp  │      │ ← palette INTENSIFY: pull the biome ramp deeper/desaturated
  │   │  ● ● ● ●  faster parallax │      │ ← layers drift a touch faster; a slow paper banner waves
  │   └───────────────────────────┘      │
  └─────────────────────────────────────┘
```

1. **Palette intensification** — shift the biome's sky ramp to its darkest/stormiest variant (deeper,
   lower-chroma). Same shapes, heavier mood. (Board panel stays L ≤ 0.058 — contrast unaffected.)
2. **Torn-paper proscenium** — a vignette _frame_ of torn paper closes in around the board (one Path +
   drop-shadow). Signals "arena / this one is walled-in." The strongest single cue.
3. **Motion** — parallax layers drift slightly faster; a slow paper **banner** waves at the top
   (translateY/skew loop). Elevated energy without noise.
4. **HUD treatment** — the objective bar gains a heavier paper frame + a wax-**seal** icon + the boss
   accent color; timer (Saga is timed like Journey) gets a subtle low-time pulse reserved for bosses.
5. **One-beat boss intro** — on level start the proscenium **unfolds** (Path scale/rotate reveal ~500ms)
   and the banner **drops** (spring translateY). One-time, then settles. Reduce-motion → static frame +
   fade, no unfold.

**Difficulty that matches the look (mechanic, not art):** bosses lean on levers the schema already
supports — more `colors` (up to the 6-hue palette), tighter `timer.startMs`, more/denser obstacles,
higher objective counts. The scary _look_ is honest because the board _is_ harder.

---

## 4. Obstacle layout & on-board treatment

Paper-craft, colorblind-safe (shape/pattern channel — obstacles carry a distinct silhouette regardless of
color, which actually satisfies §2.2 for obstacles even while plain dots stay color-only), full-cell so
≥44pt targets hold. Each must read _instantly_ "not a normal dot" (bible §2.4 LOCKED).

```
  ┌─────┬─────┬─────┬─────┐
  │  ●  │ ▦●▦ │  ●  │ ⬒   │   ● normal flat disc
  │     │ CAGE│     │ANCHOR│   ▦●▦ CAGED (shipped): folded-paper cage — thin cross-hatch fold-line
  ├─────┼─────┼─────┼─────┤          Paths OVER the dot + slight desaturation. Silhouette = cage.
  │  ●  │ ⌗   │ ░░  │  ●  │   ⬒  ANCHOR/weight: heavy folded block, darker matte, deep top-left
  │     │LOCK │TINT │     │          crease-shadow, never highlights → reads "unlinkable."
  └─────┴─────┴─────┴─────┘   ⌗  LOCKED TILE: taped-over / cross-hatched flap — "can't hold a dot yet."
                              ░░ COLOR-LOCK region: translucent washi-vellum tint over cells + a small
                                 corner tag listing allowed colors. Low opacity keeps dots readable.
```

- **Caged dot (shipped, primary):** folded-paper cage = thin fold-line hatch Paths drawn over a slightly
  desaturated dot. Freed by any clear of its color (repo semantics: a loop/line sweep frees every
  same-color cage at once — a _layout_ consideration for authors, per `level-script-schema.md`).
- **Anchor / weight (designed):** a heavier square paper block, darker matte, exaggerated top-left crease
  shadow; it _never_ takes the sweep-highlight scale — the absence of juice is itself the "inert" signal.
- **Locked tile (designed):** an empty cell shown as a taped/hatched flap; reads clearly "no dot here yet."
- **Color-lock region (designed):** a low-opacity tinted vellum overlay + corner tag; readability first —
  the tint must never drop dot contrast below the panel floor.

**Layout guidance for authors:** keep obstacle cells ≤ ~25% of the board so the color field stays
readable and the `colors × minChain ≤ rows × cols` legality invariant (schema) holds with headroom.
Introduce one new obstacle type per biome, Two-Dots-style, so complexity ramps gently.

---

## 5. Effects / juice palette (paper-craft, perf-safe) — technique named per effect

Restraint rule (bible §4 LOCKED): effects **support** readability, never obscure the board; every effect
ships a Reduce-Motion variant (`useReduceMotion` already exists). Juice is papery/soft — this is the
line that keeps Saga's structure from tipping into "Candy-Crush-maximalist."

| Beat                              | Visual                                                  | Skia / Reanimated technique                                                                                                                 | Reduce-motion                                 |
| --------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Clear pop**                     | dot fades + tiny paper shards fly out                   | existing merge-relay `radius→0` (shipped) + 4–6 shard quads from a **fixed pool**, one shared clock, scale+opacity out                      | shards off; keep fade                         |
| **Cascade fall**                  | survivors drop with a soft settle                       | existing `bounceEnv` fall-bounce (shipped) — unchanged                                                                                      | unchanged (already gentle)                    |
| **Combo escalation**              | warm edge flush on big combos                           | one full-screen low-opacity warm `Rect` fade; link-blip pitch rises (audio, planned)                                                        | dim/flush only, no shake                      |
| **Loop / line sweep** (signature) | color ripples out; all same-color dots pop              | one stroked `Circle` growing r + fading opacity from sweep origin (biome accent) + brief vignette pulse; dots reuse shipped highlight scale | ripple as single fade ring, no vignette pulse |
| **Boss intro**                    | proscenium unfolds, banner drops                        | Path scale/rotate reveal + spring translateY, one-time ~500ms                                                                               | static frame + fade                           |
| **Win**                           | wax **seal** thuds on board, paper confetti, tiny shake | seal = scale-overshoot + drop-shadow; confetti from the same pool; board group `translate` shake decays                                     | seal + fade, no shake, no confetti            |
| **Lose** (timed)                  | board "folds closed" softly                             | paper fold-over from top (scale/skew), soft                                                                                                 | fade to a folded card                         |

**Performance contract:** one shared Reanimated clock per active effect; **fixed-size particle pools, no
per-frame allocation** (matches the `src/core/hot/` no-allocation worklet rule and the existing
`use-board-animation.ts` pattern); blur only on static layers; target ≤ a handful of extra draw calls
during a cascade so the 60fps drag+cascade bar (GDD acceptance) holds on a mid-tier iPhone. Entity count
stays tiny (36–64 dots + ≤16 pooled particles).

---

## 6. Variety-without-asset-explosion budget

**Asset floor for the entire infinite mode:**

- 5 seed biomes × ~6 reusable silhouette shapes = **~30 vector shapes** (or one sprite atlas).
- 5 biomes × 4 time-of-day ramps = **20 palette sets** (recolor only, no new geometry).
- 4 ambient particle types, ~5 obstacle glyphs, 1 board-panel frame, 1 wax-seal + star set. **Zero
  per-level art.**

**Per-block composition (a "block" = the 10 levels between bosses):** pick one biome + one time-of-day
variant + one ambient particle + one trim accent. Within the block, per-level micro-variation is all
**parameters**: parallax-offset seed, particle density, trim-hue rotation, sky-gradient angle,
obstacle/color-count ramp.

**The "look-alike but <40% identical" rule, made concrete:**

- **Adjacent levels:** at least **one** of {sky palette, silhouette layer set, ambient particle} changes.
- **Episode boundary (every 10, at the boss):** at least **two** of those three change.
- **Biome boundary (~every 30–50):** **all three** change + torn-page transition.
- **Invariant spine (always identical):** the board panel, the flat dots, the HUD layout, the wax-seal /
  star grammar. This constant frame is what makes the game _learnable_ while the world stays _fresh_ — the
  same principle behind Candy Crush reusing ~10 scenes across thousands of episodes (Sources).

**Governance (data-driven, schema-safe):** extend `level-script-schema.md` with an **optional** `theme`
block — additive, no `schemaVersion` breakage:

```jsonc
"theme": {
  "biome": "meadow-terraces",   // references a biome token bundle (a saga-biomes registry)
  "variant": "dusk",            // one of the 4 time-of-day ramps
  "particle": "petals",         // ambient FX id
  "trim": "clay",               // board-panel accent
  "parallaxSeed": 20260824,     // deterministic layer offset
  "boss": false                 // true → apply the boss modifier stack (§3)
}
```

A biome registry (`saga-biomes.ts`, the analog of the Aug-18 brainstorm's proposed `city-themes.ts`)
holds the token bundles; a Saga level is a tiny JSON with a `theme` ref. **Thousands of levels =
thousands of tiny JSON files, not thousands of art assets.** Board `colors` (3→6) and obstacle mix are
the difficulty dials, already schema-supported.

---

## Trade-offs summary

- **Shadow-box board panel** buys accessibility + a distinct identity, but the dark card is a fixed frame
  — the biome recolor is what carries freshness, not the play surface. (Accepted; the play surface must
  stay constant anyway for the contrast floor and learnability.)
- **Vertical ribbon** scales infinitely but sacrifices Journey's "sense of place." Intentional contrast.
- **Recolor-not-redraw** yields huge variety cheaply but means silhouette _geometry_ repeats; mitigated by
  the parallax-seed + particle + time-of-day layering so repeats are non-obvious.
- **Papery restraint on juice** keeps the bible tone but is less dopamine-loud than Candy Crush; that is
  the deliberate Two-Dots positioning, not a miss.

## Unresolved questions

1. **Bible §2.5 amendment** — approve the per-mode backdrop clause (Journey isometric / Saga diorama)? A
   LOCKED-rule note, owner call.
2. **Saga timing** — is Saga timed (like Journey) or untimed score-per-level (more Endless-zen)? §3/§5
   assume a per-level timer; if untimed, drop the boss timer-pulse and the "lose = fold" beat.
3. **Board panel exact tokens** — `PANEL_BASE` (L ≤ 0.058), `PANEL_FRAME` ≥ 3:1 vs darkest scene swatch,
   and the inset margin are on-device tuning dials; needs a contrast pass like `contrast.test.ts`.
4. **Node persistence scale** — thousands of per-level MMKV star records: confirm a compact encoding
   (bitfield/packed) before it becomes a storage concern.
5. **Biome count for v1 slice** — ship all 5 seeds, or prove the system with 2 and rotate? (Recommend 2
   for the slice, architecture sized for 5+.)

## Sources (examined for principles, not copied)

- [Candy Crush Saga — Episode (asset/background reuse; post-E420 reuse trend)](https://candycrush.fandom.com/wiki/Episode)
- [PocketGamer.biz — how Saga Adventures make Candy Crush a "living, breathing universe"](https://www.pocketgamer.biz/how-saga-adventures-make-candy-crush-a-living-breathing-universe/)
- [Kenneth Lim — Candy Crush Saga map art overhaul (~10 rotated map scenes)](https://kleeam.artstation.com/projects/L3lDBv)
- [Game UI Database — Level Select: World Map (navigation patterns reference)](https://www.gameuidatabase.com/index.php?scrn=6)
- [BamBamTastic — Mobile game level design best practices (clarity, feedback, ramping)](https://bambamtastic.com/mobile-game-level-design/)
- [itch.io — Making a game feel "juicy" with simple effects (screen shake, particles, restraint)](https://itch.io/blog/1059831/making-a-game-feel-juicy-with-simple-effects)
- [Room 8 Studio — Match-3 level design (symmetry, field shape, color scheme)](https://room8studio.com/news/smart-casual-the-state-of-tile-puzzle-games-level-design-part-1/)
