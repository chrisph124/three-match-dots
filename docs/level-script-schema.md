# Three Dots — Level-Script Schema (v1 + v2)

**Date:** 2026-08-06 (concept); retargeted to React Native / TypeScript / `zod` 2026-08-16;
extended to **schemaVersion 2 (Voyage)** 2026-08-24.
**Status:** **Implemented** in `src/core/level/level-script.ts` (`parseLevelScript`). The validator now
accepts **schemaVersion `1` OR `2`**: v1 is the shipped Journey/Endless contract, v2 adds the `voyage`
mode, the pluggable `constraint` union, and the optional `voyage`/`theme` blocks (see "Schema v2 —
Voyage additions" below). Every v1 level parses unchanged under v2. Evolve only via a `schemaVersion`
bump (add optional fields freely; bump on any breaking change).
**Purpose:** A machine-readable definition of one level. One file = one level. The engine loads and
validates these; Journey cities are hand-authored, Voyage levels are emitted by the generator
(`src/core/voyage/`).
**Related:** `docs/three-dots-game-design.md` (mechanic/obstacles), `docs/rnd-department.md` (who authors),
`docs/creative-bible.md` (look).

---

## Format decision — JSON

- **JSON**, one file per level, bundled as an app resource (later loadable for OTA-free content via a data pack).
- **Why JSON over a bespoke format:** portable across platforms, diff-friendly in git, and trivially
  validated at runtime with a **`zod`** schema in TypeScript. A `parseLevelScript(json)` function decodes and
  validates it into a `LevelScript` type in the pure-TS core (no RN/Skia imports — keeps the core
  Vitest-testable and portable, matching the rest of `src/core/`).

## Schema (v0 fields)

```jsonc
{
  "schemaVersion": 1, // bump on any breaking field change
  "id": "japan-01-kyoto", // stable unique id (country-order-city)
  "chapter": { "country": "Japan", "order": 1 },
  "city": { "name": "Kyoto", "isCapital": false },
  "order": 1, // level order within the country (1..N)

  "board": {
    "cols": 6, // board width  (per-city, tunable)
    "rows": 6, // board height
    "colors": 5, // active dot colors this level (<= render palette length)
    "minChain": 3, // clear threshold (namesake default 3; per-level tunable)
    "spawnWeights": [1, 1, 1, 1, 1], // RESERVED — see "spawnWeights" below; not wired to anything
  },

  "seed": 20260806, // OPTIONAL — see "seed" below

  "mode": "journey", // "journey" (timed) | "endless" (relaxed; usually not authored per-city)

  "timer": {
    // REQUIRED when mode == "journey"; omit/null for endless
    "startMs": 60000,
    "mistakePenaltyMs": 2000, // time removed on an invalid attempt (GDD "mistake reduces time")
    "clearBonusMs": 0, // optional: time added per clear (0 = off)
  },

  "objectives": [
    // 1+; ALL must be met to win (AND). Authored per city.
    { "type": "clearColor", "color": 0, "count": 20 },
    { "type": "freeCaged", "count": 3 },
  ],

  "obstacles": [
    // 0+; placed by cell. v1 slice ships "cagedDot" only.
    { "type": "cagedDot", "cell": { "col": 2, "row": 3 } },
  ],

  "rewards": {
    "stars": { "twoStarSecondsLeft": 15, "threeStarSecondsLeft": 30 }, // time-left thresholds → 1..3 stars
  },

  "unlock": {
    // gating in the world map
    "requiresLevelId": "japan-00-intro", // null for the country's first city
    "requiresStars": 0,
  },

  "designIntent": "Intro the caged-dot obstacle; gentle timer; teach freeing cages by adjacent clears.",
}
```

## Schema v2 — Voyage additions

`schemaVersion: 2` is a **superset** of v1: every v1 field keeps its meaning, and these fields are added.
A voyage level uses them; a Journey/Endless level may stay on v1 or set version 2 without change.

```jsonc
{
  "schemaVersion": 2,
  "id": "voyage-010-caged-core", // voyage-{index}-{slug}
  "order": 10,
  // chapter/city are now OPTIONAL — Journey-only framing; a voyage level omits both.
  "board": { "cols": 6, "rows": 6, "colors": 3, "minChain": 3 },
  "mode": "voyage", // "journey" | "endless" | "voyage"

  // The play constraint — REQUIRED for voyage; replaces `timer` (a voyage level
  // must NOT carry a timer). Discriminated on `type`:
  "constraint": { "type": "moves", "budget": 25 },
  //           | { "type": "timed", "startMs": 45000, "mistakePenaltyMs": 1500, "clearBonusMs": 0 }
  //           | { "type": "mistakes", "cap": 5 }

  // Where the level sits in the ladder — REQUIRED for voyage.
  "voyage": { "index": 10, "episode": 1, "isBoss": true },

  // Additive render metadata for the diorama layer — OPTIONAL, consumed by render.
  // Unknown biome/variant ids fall back at render time; they are NOT a parse error.
  "theme": {
    "biome": "harbor",
    "variant": "dusk",
    "particle": "embers",
    "trim": "brass",
    "parallaxSeed": 7,
    "boss": true,
  },

  "objectives": [{ "type": "freeCaged" }],
  "obstacles": [{ "type": "cagedDot", "cell": { "col": 2, "row": 5 } }],

  // Star thresholds carry the CONSTRAINT's metric (see below), not always seconds.
  "rewards": { "stars": { "twoStarMovesLeft": 5, "threeStarMovesLeft": 10 } },
}
```

**`constraint` (v2, required for voyage).** A discriminated union on `type`:

| `type`     | Fields                                        | Metric         |
| ---------- | --------------------------------------------- | -------------- |
| `moves`    | `budget` (int > 0)                            | `movesLeft`    |
| `timed`    | `startMs`, `mistakePenaltyMs`, `clearBonusMs` | `secondsLeft`  |
| `mistakes` | `cap` (int > 0)                               | `mistakesLeft` |

The `timed` variant's field shapes are byte-identical to the Journey `timer`, so the countdown math is
shared, not forked. `constraintOf(level)` returns the level's constraint, mapping a Journey `timer` into
an equivalent `timed` constraint — one uniform entry point for the Voyage state machine.

**`voyage` (v2, required for voyage):** `{ index: int ≥ 1, episode: int ≥ 1, isBoss: boolean }`.

**`theme` (v2, optional):** `{ biome, variant, particle, trim, parallaxSeed: int, boss: boolean }` — all
strings except `parallaxSeed`/`boss`. Additive; the render layer owns the biome table and falls back on
an unknown id rather than failing the parse.

**`rewards.stars` metric rule (v2):** the star thresholds are expressed in the level's constraint metric
— `twoStarMovesLeft`/`threeStarMovesLeft` (moves), `twoStarSecondsLeft`/`threeStarSecondsLeft`
(timed/Journey), or `twoStarMistakesLeft`/`threeStarMistakesLeft` (mistakes). A shape whose metric does
not match the constraint is a **parse error**. The seconds shape is unchanged from v1.

**v2 fail-fast rules (added to the v1 rules below):** `mode: 'voyage'` ⇒ `schemaVersion === 2`,
`constraint` present, `voyage` envelope present, `objectives` non-empty, and `timer` absent.

## Board → engine config mapping

The engine already exposes `GameConfig` (`src/core/types.ts`) and `DEFAULT_CONFIG`
(`src/core/config.ts`). A level's `board` object maps directly onto it — nothing else in the schema does:

| Level script field      | `GameConfig` field | Required | Default if omitted                   |
| ----------------------- | ------------------ | -------- | ------------------------------------ |
| `board.cols`            | `cols`             | yes      | —                                    |
| `board.rows`            | `rows`             | yes      | —                                    |
| `board.colors`          | `colors`           | yes      | —                                    |
| `board.minChain`        | `minChain`         | no       | `DEFAULT_CONFIG.minChain` (3)        |
| `board.lineLength`      | `lineLength`       | no       | `DEFAULT_CONFIG.lineLength` (5)      |
| `board.baseScore`       | `baseScore`        | no       | `DEFAULT_CONFIG.baseScore` (10)      |
| `board.sweepMultiplier` | `sweepMultiplier`  | no       | `DEFAULT_CONFIG.sweepMultiplier` (3) |

`objectives` and `obstacles` never map onto `GameConfig` — they describe the Journey layer wrapped
around the color-board core (win condition, obstacle overlay), not the board itself.

## `colors` bound

`board.colors` is bounded by the length of the render palette (`src/render/palette.ts#DOT_COLORS`) — a
level can't request a hue the renderer can't draw. The validator rejects `board.colors` beyond that
length at parse time. The example above (`colors: 5`) is only valid once the shipped palette has been
extended to at least 5 hues; the palette ships 3 today (Endless's red/green/blue). A level authored
against a longer palette than currently ships must fail validation, not render a wrong or missing color.

## `seed` (new, optional)

An optional integer. When present, the board is dealt deterministically — the loader threads it into
`newGame(config, seed)` (already the core's signature; `src/core/game.ts`), so a level author can pin a
board layout, prove a level is winnable, and assert a caged cell's dealt color in a fixture test. Omitted
→ a session seed is used, matching Endless's existing seeding. This is a pure schema addition: it does
**not** touch `GameConfig` or `src/core/config.ts`.

## `spawnWeights` (reserved, not wired)

`spawnWeights` stays in the schema shape but maps to nothing today: the shipped refill logic
(`src/core/resolve/refill.ts`) draws each new dot uniformly via `nextInt(state, colors)` — there is no
per-color weighting anywhere in `GameConfig` or the resolve layer. The field is **optional, with no
length constraint** — a level may omit it, supply any length, or leave it empty, and none of that is
validated. **There is deliberately no `spawnWeights.length == colors` rule** (the earlier concept spec had
one): the field isn't consumed by anything, so there is nothing for that rule to protect, and enforcing it
would force a future validator (and `config.ts`/`refill.ts`) change just to keep already-authored levels
valid. Treat `spawnWeights` as reserved for a possible future weighted-refill feature, not a live contract.

## `cagedDot` obstacle — positional only

```jsonc
{ "type": "cagedDot", "cell": { "col": 2, "row": 3 } }
{ "type": "cagedDot", "cell": { "col": 3, "row": 3 }, "layers": 2 } // multi-layer
```

**`layers?` (optional, integer 1–5, default 1).** How many same-color clears (each including the caged
dot) it takes to break the cage. `1` = the original instant-pop intro (omit the field for it — **no
`schemaVersion` bump**; every existing level parses unchanged). A cage with `layers ≥ 2` stays linkable
and **chips** one layer per qualifying clear, popping only on the last. The accessor reads
`obstacle.layers ?? 1` (`cagedCells`, `src/core/level/level-script.ts`).

**Voyage derives depth by band, not per level.** The generated + boss ladder assigns depth from
`CAGE_LAYERS = { teach: 1, mid: 2, boss: 3 }` (`src/core/voyage/voyage-config.ts`), boss-first, so the whole
first (teaching) episode is 1-layer unless a curated level authors an override. An authored `layers` value
always wins over the band default.

**Authored Journey levels are NOT solver-swept**, so a hand-authored `layers ≥ 2` cage must be
**hand-verified winnable** on-device — the winnability sweep only covers generated + boss levels and any
_curated_ level that carries a multi-layer cage (which is why such curated levels now route through
`calibrateLevel`; see `docs/tech-stack-and-infra.md`). Two `layers: 2` instances ship this slice:
**japan-01's** center cage (Journey, hand-verified) and the **seeded pre-boss Voyage teaching cage** (the
one curated multi-layer level routed through the solver sweep).

No authored `color`. The shipped board dealer (`newGame`, `src/core/game.ts`) fills every cell by RNG
with no per-cell override, so an authored `color` on a cage would be decorative at best and misleading at
worst — the engine has no hook to force that specific cell to a chosen color. Under a `seed`, a cell's
dealt color is deterministic and knowable ahead of time; a level's fixture test asserts the caged cell's
actual dealt color under that seed instead of trusting an authored value that the engine can't enforce.

**Obstacle-type enum (v0):** `cagedDot` only. The wider obstacle catalog in
`docs/three-dots-game-design.md` (anchor, locked tile, color lock) is design intent for later cities, not
yet in the validated schema — adding one is a `schemaVersion` bump once its Journey-layer support ships.

**Objective-type enum (v0):** `clearColor` and `freeCaged` only, matching what the Journey layer folds
today. Broader objective ideas from the concept doc (total-clears, loop-clear counts, score targets) are
catalog entries for a later `schemaVersion`, not validated yet.

## Freeing semantics

A caged cell is affected by **any** clear of its color — a normal `≥minChain` chain, a 2×2-loop sweep, or a
`≥lineLength` straight-line sweep. `src/core/resolve/collect-cleared.ts` marks every same-color cell on
the board `reason: 'color-sweep'` for a loop or line clear, not just the chain cells, so loop and line
sweeps reach that color **board-wide** — a single sweep touches every caged cell of that color at once.
This is a **tuning consideration for level authors**, not just a chain-adjacency detail: placing several
same-color cages expecting them to be freed one at a time will instead have them all affected together the
first time that color sweeps.

**With layers:** a 1-layer cage frees on the first such clear (unchanged). A `layers ≥ 2` cage is
**protected** — `resolveCagedChain` (`src/core/resolve-caged-chain.ts`) passes the `protectedOf(caged)`
set (every cage with ≥2 layers) into `resolveChain`, which lets the caged dot link, count, and classify
on the full chain/sweep but partitions it into `Resolution.protectedHits` instead of `cleared`: it **chips**
one layer rather than popping. It frees (pops) only on the clear that removes its last layer. So a
board-wide color sweep peels **one** layer from every same-color cage at once, freeing only those then on
their final layer — a deep cage survives a sweep it shares with shallower ones.

## Field rules / validation

- `id` unique across all levels.
- `board.colors <=` the render palette length (see "`colors` bound" above); `board.minChain` in `[2, 4]`.
  The lower bound `>= 2` matches the runtime guard in `newGame` (`src/core/game.ts`); the upper bound `<= 4`
  is a design/scope ceiling — `minChain 4` is the hardest legal difficulty dial (`MAX_MIN_CHAIN`,
  `voyage-config.ts`), and `[2, 4]` is the validated, tested envelope every shipped mode plays within.
  (`hasLegalMove` in `src/core/deadlock.ts` is a same-colour simple-path search, **sound at every**
  `minChain` — so the cap is a scope bound, not a deadlock-soundness one. It must stay a path search,
  never a same-colour _component-size_ test: a 4-cell "star" has a size-4 component but no 4-chain, which
  a size test would wrongly call legal and soft-lock a board at `minChain 4`.) A level with `minChain > 4`
  fails at parse, never at play.
- `timer` **required iff** `mode == "journey"`; forbidden (or ignored) for `endless`.
- `objectives` non-empty for journey levels; every `objective.color < board.colors`.
- **Color is a positional palette index.** `objective.color` (and, for a future weighted-obstacle type,
  any per-cell color) indexes the render palette by position; the palette is **append-only** — an index is
  stable color identity, never inserted or reordered (see `creative-bible.md` §2.2). A reorder would
  silently remap every authored level.
- Every `obstacle.cell` within board bounds; no two obstacles on the same cell.
- Unknown `objective.type` / `obstacle.type` → **validation error** (fail fast; don't silently skip).
- `isCapital: true` should be the country's **last** `order` (the finale) — a soft author convention, warned if violated.

## Fail-fast validation rules

The validator enforces these at parse time — a level that violates one never reaches play, because a
timed Journey level that turns out unwinnable mid-play is strictly worse than Endless's fail-state-free
design:

- `obstacle.cell.col ∈ [0, cols-1]`; `obstacle.cell.row ∈ [0, rows-1]`.
- `objective.color ∈ [0, colors-1]`.
- `objectives` is non-empty.
- `cols`, `rows`, `colors` are positive integers under a sane ceiling; `timer.startMs > 0` when a timer is present.
- **Board-legality invariant: `colors × minChain ≤ rows × cols`.** `src/core/shuffle.ts`'s deadlock
  reshuffle guarantee assumes this holds (by pigeonhole, some color can always occupy enough cells to form
  a legal `minChain`-length group). A level that violates it must fail at **parse**, never surface as a
  stuck, unsolvable board mid-play.
- Unknown `objective.type` or `obstacle.type` → validation error.

## Versioning

- `schemaVersion` is `1` or `2`; the validator **accepts both** and rejects any other value rather than
  mis-parsing. Adding an **optional** field with a safe default is non-breaking (keep version). A new
  **mode** with its own required fields (Voyage's `constraint`/`voyage`) is gated behind a version bump so
  the older shape stays valid — hence `mode: 'voyage'` requires `schemaVersion: 2` while every v1 level
  parses unchanged under either version. Renaming/removing/retyping a field, or adding a field required of
  **all** levels, = bump `schemaVersion` and migrate authored levels.

## Why this must precede the agent

The `level-designer` agent's entire output is files in this shape. If the schema changes after the agent and
levels exist, every prompt and every authored city is rewritten. Lock v0, produce the v1 slice's city, and only
then evolve it (with a version bump) as later obstacles/objectives are added.

## Open items

- Confirm objective/obstacle **type enums** are complete enough for the v1 slice (caged-dot city needs
  `clearColor` + `freeCaged` — present).
- Decide whether Endless needs any authored config at all (likely a single global config, not per-level files).
- Star thresholds: time-left vs efficiency-based — v0 uses time-left; revisit after playtest.
