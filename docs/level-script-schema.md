# Three Dots — Level-Script Schema (v0)

**Date:** 2026-08-06 (concept); retargeted to React Native / TypeScript / `zod` 2026-08-16.
**Status:** v0 — **LOCKED** as the contract for the level loader. This is authored BEFORE the loader and
the `level-designer` agent (see `docs/rnd-department.md` sequencing) — they both consume it, so it is
stable first. **Not yet implemented on `main`** — there is no `src/core/level/` yet; this is the shape a
future loader will parse and validate when it lands. Evolve only via a `schemaVersion` bump (add optional
fields freely; bump on any breaking change).
**Purpose:** A machine-readable definition of one Journey city (level). One file = one city. The engine loads
and validates these; the `level-designer` produces them.
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
```

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

A caged cell is freed by **any** clear of its color — a normal `≥minChain` chain, a 2×2-loop sweep, or a
`≥lineLength` straight-line sweep. `src/core/resolve/collect-cleared.ts` marks every same-color cell on
the board `reason: 'color-sweep'` for a loop or line clear, not just the chain cells, so loop and line
sweeps clear that color **board-wide** — a single sweep can free every caged cell of that color at once.
This is a **tuning consideration for level authors**, not just a chain-adjacency detail: placing several
same-color cages expecting them to be freed one at a time will instead free them all together the first
time that color sweeps.

## Field rules / validation

- `id` unique across all levels.
- `board.colors <=` the render palette length (see "`colors` bound" above); `board.minChain` in `[2, 4]`.
  The lower bound `>= 2` matches the runtime guard in `newGame` (`src/core/game.ts`); the upper bound `<= 4`
  is required because `hasLegalMove` (`src/core/deadlock.ts`) is only sound for `minChain` 3–4 — above 4 it
  can report a legal move that does not exist, soft-locking a timed Journey board when `shuffle.ts` reshuffles
  on that same `minChain`. A level with `minChain > 4` fails at parse, never at play.
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

- `schemaVersion` starts at `1`. Adding an **optional** field with a safe default = non-breaking (keep version).
  Renaming/removing/retyping a field, or adding a **required** field = bump `schemaVersion` and migrate authored
  levels. The `zod` validator rejects a version it doesn't understand rather than mis-parsing.

## Why this must precede the agent

The `level-designer` agent's entire output is files in this shape. If the schema changes after the agent and
levels exist, every prompt and every authored city is rewritten. Lock v0, produce the v1 slice's city, and only
then evolve it (with a version bump) as later obstacles/objectives are added.

## Open items

- Confirm objective/obstacle **type enums** are complete enough for the v1 slice (caged-dot city needs
  `clearColor` + `freeCaged` — present).
- Decide whether Endless needs any authored config at all (likely a single global config, not per-level files).
- Star thresholds: time-left vs efficiency-based — v0 uses time-left; revisit after playtest.
