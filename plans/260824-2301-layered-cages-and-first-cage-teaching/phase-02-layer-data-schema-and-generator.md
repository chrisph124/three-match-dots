---
title: 'Phase 2: Layer data schema and generator'
phase: 2
status: done
priority: P1
effort: '0.5-1d'
dependencies: []
---

# Phase 2: Layer data schema and generator

## Overview

Make every level carry a per-cage layer count. Add an optional `layers?` field to the `cagedDot`
obstacle (backward-compatible, **no `schemaVersion` bump**), a `CAGE_LAYERS` tuning constant, a layer
accessor the overlay/solver read, and difficulty-band assignment across the generator, boss pool, and
the curated Episode-1 ladder. Layers are **derived** by band, with an authored `layers` override now
used for a seeded pre-boss Voyage teaching cage and japan-01 (Validation S1).

<!-- Updated: Validation Session 1 - seed a 2-layer teaching cage (Voyage) + a 2-layer japan-01 cage; both authored via explicit `layers: 2` -->

## Requirements

- Functional:
  - `Obstacle` (`cagedDot`) gains optional `layers?: number` (`z.number().int().min(1).max(5)` —
    bounded so a fat-fingered authored value can't create an unwinnable, un-solver-checked cage; 5 is
    a generous ceiling above the boss's 3, red-team F12). Absent ⇒ treated as `1` (teach / today's
    behaviour).
  - `CAGE_LAYERS = { teach: 1, mid: 2, boss: 3 } as const` in `voyage-config.ts`, plus a helper
    `cageLayersForIndex(index): number` that is the **single band authority** — every band decision
    (generator, boss pool, curated ladder) routes through it, none re-derives bands inline (red-team F5).
    Precedence, in this exact order: **boss FIRST** (`isBossIndex(index)` → `CAGE_LAYERS.boss`), THEN
    Episode-1 cage level (→ `CAGE_LAYERS.teach`), ELSE `CAGE_LAYERS.mid`. Boss must win the tie because
    L10 is BOTH a boss index and inside the Episode-1 range (`isEpisodeOne` = 1..10) — episode-first
    would mislabel the Caged Core boss as a 1-layer teach cage.
  - **Move `isBossIndex` from `generate-level.ts` (currently a private `function isBossIndex` at
    ~L187-190) to `voyage-config.ts` and export it** (red-team F5). `cageLayersForIndex` lives in
    `voyage-config.ts` and needs `isBossIndex`; `generate-level.ts` already imports from
    `voyage-config.ts`, so hosting `isBossIndex` there (and re-importing it into `generate-level.ts`)
    avoids an import cycle. `boss.ts` and `episode-1.ts` also call `cageLayersForIndex`/`isBossIndex`
    from `voyage-config.ts`, never a local copy.
  - A layer accessor so the overlay/solver seed layers without re-reading raw obstacles — make
    `cagedCells(level): { index: CellIndex; layers: number }[]` (index = `row * cols + col`, layers =
    `obstacle.layers ?? 1`) the **source of truth**, and reimplement the existing `cagedCellIndices`
    (`level-script.ts:411`) on top of it as `cagedCells(level).map((c) => c.index)` (red-team F14 — one
    enumeration of the obstacle list, no duplicated row-major math that could drift).
  - `bottomAnchoredCages(count, layerCounts, cols, rows)` — new `layerCounts: readonly number[]`
    param; each emitted obstacle gets `layers: layerCounts[k] ?? 1`.
  - `generate-level.ts` builds a per-index `layerCounts` array (all entries = `cageLayersForIndex`)
    and passes it to `bottomAnchoredCages`.
  - `boss.ts` `cagedCore` → all 8 cages `layers: CAGE_LAYERS.boss`.
  - `episode-1.ts` curated levels (cages on L4/L5/L9): L4 stays `layers: CAGE_LAYERS.teach` (= 1),
    byte-identical to today — the "cages exist" instant-pop intro. **Seed one authored 2-layer teaching
    cage on a pre-boss level (default L5) via an explicit `layers: 2`** (Validation S1) so the layered
    mechanic — and the teaching popup (Phase 6) — is met BEFORE the L10 boss, not at it. The 2-layer
    value is authored directly on that cage, NOT derived through `cageLayersForIndex` (band authority
    stays a single clean rule; the accessor reads `obstacle.layers ?? 1`). Exact seed level is tunable
    on-device for pacing; keep at least one earlier 1-layer cage (L4) as the instant-pop intro. Any other
    curated 1-layer cage stays teach = 1.
  - **japan-01** (`assets/levels/japan-01.json`, the authored Journey level): bump ≥1 of its three
    `cagedDot`s to `layers: 2` (Validation S1) so Journey showcases layering. Authored Journey levels are
    NOT solver-swept (red-team F12) → this cage's winnability is hand-verified on-device and noted in the PR.
- Non-functional: no `schemaVersion` bump; `difficulty-budget.ts` UNCHANGED (obstacle stays 1 pt;
  layers are a separate axis; the solver re-calibrates budgets in Phase 4). No `any`. Files <200 lines.

## Architecture

Data-only phase: levels now describe how many hits each cage needs. Nothing consumes `layers` yet
(the overlay in Phase 3, the solver in Phase 4). **Even the seeded 2-layer cage and japan-01's 2-layer
cage are inert here** — until Phase 3's `protectedOf` runs, a `layers: 2` cage still frees on its first
clear, so this phase changes no behaviour and the generation sweep must stay green as a pure refactor
guard. The seeded cage's winnability under real protection (and calibration of its curated level) is
Phase 4's job; japan-01's is hand-verified on-device.

Band mapping is decided in ONE place — `cageLayersForIndex` — with boss-first precedence (red-team F5),
confirmed against `episode-1.ts` / `boss.ts` / `voyage-config.ts` index schemes:

1. `isBossIndex(index)` → boss (level 10 Caged Core, and later bosses). **Checked first** — L10 is
   also inside `isEpisodeOne` (1..10), so an episode-first order would misclassify the boss as teach.
2. else Episode-1 cage level → teach (first cage = level 4).
3. else → mid (all other generated indices).

## Related Code Files

- Modify: `src/core/level/level-script.ts` (optional `layers?: …min(1).max(5)` on obstacle schema
  at ~L47-50; `cagedCells` as source; `cagedCellIndices` at ~L411 reimplemented on top of it)
- Modify: `src/core/voyage/voyage-config.ts` (`CAGE_LAYERS`, `cageLayersForIndex`, and now the
  relocated + exported `isBossIndex`)
- Modify: `src/core/voyage/cage-layout.ts` (`bottomAnchoredCages` gains `layerCounts`)
- Modify: `src/core/voyage/generate-level.ts` (build + pass `layerCounts`; import `isBossIndex` from
  `voyage-config.ts` instead of its removed private copy)
- Modify: `src/core/voyage/boss.ts` (Caged Core cages → `CAGE_LAYERS.boss` via the shared constant)
- Modify: `src/core/voyage/episode-1.ts` (L4 cage stays `CAGE_LAYERS.teach` = 1, byte-identical; seed
  ONE authored 2-layer teaching cage on a pre-boss level, default L5, via explicit `layers: 2`; any
  other curated cage stays 1 — Validation S1, red-team F9)
- Modify: `assets/levels/japan-01.json` (bump ≥1 `cagedDot` to `layers: 2` — Validation S1; hand-verified
  winnable on-device since authored Journey isn't solver-swept)
- Tests: `level-script.test.ts` (accessor + optional field), `cage-layout.test.ts` (if present) or a
  new one, `episode-1.test.ts` / `boss.test.ts` layer assertions (incl. the seeded L5 cage = 2 layers)

## Implementation Steps (test-first)

1. **Red:** test `cagedCells(level)` returns `{index, layers}` with `layers` defaulting to 1 when the
   obstacle omits it, and the authored value when present; test the schema accepts an obstacle with
   and without `layers` (parse succeeds, no version bump).
2. **Red:** test `cageLayersForIndex` returns teach for Episode-1 cage levels, boss for boss indices,
   mid otherwise.
3. **Green:** implement schema field, `CAGE_LAYERS`, `cageLayersForIndex`, `cagedCells`.
4. **Green:** thread `layerCounts` through `bottomAnchoredCages`, `generate-level`, `boss`,
   `episode-1`; update their call-sites and tests (L4=1, Caged Core=3).
5. Run `npm test` — **`generation-sweep.test.ts` must stay green as-is** (this phase is behaviourally
   inert: no freeing-rule change yet, so winnability is unaffected).

## Success Criteria

- [ ] Obstacle parses with and without `layers`; rejects `layers` > 5 or < 1; `schemaVersion` unchanged
- [ ] `cagedCells` returns correct `{index, layers}`; `cagedCellIndices` is `cagedCells(level).map(c => c.index)`
- [ ] `cageLayersForIndex` is the only band decider; boss index beats Episode-1 (L10 → boss = 3)
- [ ] `isBossIndex` exported from `voyage-config.ts`; `generate-level.ts` imports it (no private copy, no cycle)
- [ ] Generated/boss/curated levels carry the right band layers (L4=1, Caged Core=3)
- [ ] Seeded pre-boss Voyage teaching cage authored at `layers: 2` (default L5); L4 stays 1-layer (Validation S1)
- [ ] japan-01 carries ≥1 authored `layers: 2` cage; the rest stay 1 (Validation S1)
- [ ] `generation-sweep.test.ts` + `calibration.test.ts` green unchanged (inert refactor — `layers` not yet
      consumed, so the seeded 2-layer cage still frees on first clear at this phase)
- [ ] `npm run typecheck` + `npm run lint` green; no `any`

## Risk Assessment

- If `layers` is later made REQUIRED it breaks every v1 level → keep it optional + defaulted; document
  the derived-default decision in `level-script-schema.md` (Phase 7). Signal it broke: a curated level
  needs a hand-tuned N the band can't express → response: add the authored override path then (already
  supported by the optional field), still no bump.
- Do NOT change `difficulty-budget.ts` here — obstacle pricing stays flat; conflating layers with the
  point budget would double-count difficulty. Budget re-tuning is Phase 4's solver-driven job.
- **Authored Journey levels are NOT solver-swept** (red-team F12): the generation sweep + calibration
  in Phase 4 cover only the Voyage ladder (generated/boss/curated Voyage). A hand-authored Journey
  script (`assets/levels/japan-01.json`) with a raised `layers` is not machine-proven winnable. The
  `.max(5)` bound caps the blast radius; anyone bumping an authored Journey cage above 1 layer must
  hand-verify winnability on-device and note it in the PR. This slice bumps ≥1 of japan-01's three
  `cagedDot`s to `layers: 2` (Validation S1) — so japan-01 is now the concrete instance requiring that
  on-device winnability check; the remaining japan-01 cages stay 1 layer.
