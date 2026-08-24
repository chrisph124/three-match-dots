---
title: 'Phase 4: Generation engine and variety'
status: done
phase: 4
priority: P1
effort: '2d'
dependencies: [1, 3]
---

# Phase 4: Generation engine and variety

## Overview

Turn a level index into a validated `LevelScript`. This phase assembles the archetype library, the
variety metric that keeps nearby levels distinct, the boss pool, the biome rotation, and the curated
Episode 1 ladder — all pure TS, every output re-validated through `parseLevelScript`.

## Requirements

- Functional:
  - `generateVoyageLevel(index, paletteSize) → LevelScript`: deterministic from `index`. Reads
    `curve(index)`/`budget(d)` (Phase 3), picks an **archetype** by `index` (seeded), spends the
    budget into dials, chooses a **constraint** (moves default; timed/mistakes mixed in per archetype),
    sets objectives, seeds the board, attaches the `voyage` + `theme` blocks, and returns a script that
    **passes `parseLevelScript`**.
  - **Variety rule:** each level has a `signature` (feature vector — archetype, constraint kind,
    colors, minChain, obstacle count/shape, objective type). Within a sliding **window of 8**, a new
    level must differ from each neighbor in **≥40% of signature fields** (similarity ≤60%). On a
    collision, re-roll the archetype/profile/seed (bounded retries) then accept the best.
  - **Bosses** (`index % 10 === 0`): drawn from a boss pool, exempt from the variety rule, tagged
    `voyage.isBoss` and `theme.boss`. Level 10 is the curated **"The Caged Core"** (bottom-anchored
    8-cage cluster spanning ≥2 colors — see Episode 1 below).
  - **Biome rotation:** `biomeFor(index)` assigns one of the 2 shipped biomes (+ its time-of-day
    variant) so the ribbon shows visible episodic change without new art.
  - **Episode 1 ladder** (`episode-1.ts`): levels 1–10 are a **curated** teaching ramp (introduce
    link → sweep → caged dot → constraint tightening → boss), overriding the pure generator where a
    hand-tuned beat is needed, still emitted as validated `LevelScript`s.
- Non-functional:
  - Pure TS in `src/core/voyage/`, zero RN/Skia imports, Vitest-tested. Deterministic: same
    `(index, paletteSize)` ⇒ identical script.
  - Winnability is **not** asserted here — Phase 5's solver sets the move/time budget and gates
    winnability. Phase 4 emits a _candidate_ budget (a heuristic) the solver later overwrites.

## Architecture

Modules under `src/core/voyage/`:

- `archetypes.ts` — the archetype table: each entry names its dial `profile` (Phase 3), its allowed
  constraint kinds, its objective template, and a weight. Data, not logic.
- `level-signature.ts` — `signatureOf(level) → Signature` and `similarity(a, b) → 0..1`; the variety
  comparator used by the generator and asserted in tests.
- `generate-level.ts` — `generateVoyageLevel`; orchestrates curve → budget → archetype → spend →
  constraint → objectives → seed → assemble → **`parseLevelScript`**. Holds the variety re-roll loop
  (uses a small ring buffer of the previous 8 signatures).
- `boss.ts` — the boss pool + modifier tags; `bossFor(index)`.
- `biome-rotation.ts` — `biomeFor(index) → { biome, variant }` over the 2 shipped biomes.
- `episode-1.ts` — the curated 1–10 ladder (incl. Caged Core), as validated scripts.

**Roadmap note (not built here):** deeper obstacle archetypes land **guardian before blight** — the
multi-layer guardian cage is a smaller schema delta than the spreading blight. Both are Non-goals for
this plan; the archetype table leaves labelled gaps for them.

### Episode 1 — "The Caged Core" (level 10)

Built from **shipped mechanics only** (no schema bump beyond v2): a bottom-anchored cluster of **8
`cagedDot` obstacles** spanning **≥2 colors** (validated), objective `freeCaged` (target = cage count).
Because cages ride gravity, they must be seeded at the board floor. Spanning ≥2 colors makes it a
multi-phase fight: a **sweep** frees a whole color's cages at once (mastery path), slow chaining frees
them one region at a time (floor path). Tuned toward ~80% first-attempt pass. Boss-ness comes from
naming + the color-grouped HP HUD (Phase 8) + the boss theme modifier (Phase 6), not bespoke art.

## Related Code Files

- Create: `src/core/voyage/archetypes.ts`, `src/core/voyage/level-signature.ts`,
  `src/core/voyage/generate-level.ts`, `src/core/voyage/boss.ts`, `src/core/voyage/biome-rotation.ts`,
  `src/core/voyage/episode-1.ts`
- Create: matching `*.test.ts` for signature/similarity, generator validity, variety window, boss,
  episode-1 ladder
- Reference (do not change): `src/core/level/level-script.ts` (`parseLevelScript`, `cagedCellIndices`),
  `src/core/voyage/difficulty-*.ts` (Phase 3), `src/core/rng.ts`

## Implementation Steps

1. `archetypes.ts` table + `level-signature.ts` (`signatureOf` + `similarity`).
2. `generate-level.ts` core path (no variety yet); assert every `index` in `1..N` passes
   `parseLevelScript`.
3. Add the variety window re-roll loop; assert the ≥40%-different rule across a long run (bosses
   exempt).
4. `boss.ts` + `biome-rotation.ts`; wire boss indices and biome tags into the generator.
5. `episode-1.ts` curated ladder incl. Caged Core (8 bottom cages, ≥2 colors validated).
6. Tests: determinism, schema validity sweep, variety rule, Caged Core shape, episode-1 teaching order.

## Success Criteria

- [x] `generateVoyageLevel(index)` is deterministic and every level `1..N` passes `parseLevelScript`.
- [x] Variety: within any window of 8, non-boss neighbors differ in ≥40% of signature fields.
      _Met via the sanctioned least-similar fallback (`VARIETY_MAX_SHORTFALL_RATE`): ~96% of window
      pairs clear ≥40%-different; the residual ~4% differ by exactly one field, counted (never silently
      capped) via the variety shortfall report. Measured shortfall ≈0.038, under the 0.06 ceiling._
- [x] Bosses land on every 10th index; level 10 = Caged Core (8 bottom-anchored cages, ≥2 colors).
- [x] Episode 1 follows the designed teaching order (link → sweep → caged → tighten → boss).
- [x] Zero RN/Skia imports; `npm test` + `npm run typecheck` green.

## Risk Assessment

- **Variety re-roll can't satisfy the window** (a small palette narrows signature diversity). Signal:
  the re-roll loop hits its retry cap on some indices. Response: the **extended palette (up to 5 hues,
  Phase 6)** widens the color axis of the signature and eases this materially versus 3 hues; where it
  still bites, accept the least-similar candidate and `log`/count the shortfall (no silent cap).
- **Generated budget is a guess.** Signal: Phase 5 solver flags many levels unwinnable at the emitted
  budget. Response: expected — Phase 4's budget is a placeholder; the solver (Phase 5) is the authority
  and overwrites it. Do not tune budgets here.
- **Episode 1 curation drifts from the generator's signature space.** Signal: a curated level trips the
  variety comparator against its generated neighbors. Response: bosses/curated beats are variety-exempt;
  assert the ladder parses and teaches, not that it's maximally distinct.
