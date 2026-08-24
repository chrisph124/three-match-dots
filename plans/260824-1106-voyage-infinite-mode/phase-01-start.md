---
title: 'Phase 1: Schema v2 — the LevelScript contract'
status: done
phase: 1
priority: P1
effort: '1d'
dependencies: []
---

# Phase 1: Schema v2 — the LevelScript contract

## Overview

Evolve `src/core/level/level-script.ts` to `schemaVersion: 2` — adding the `voyage` mode, a pluggable
**constraint union** (moves / timed / mistakes), and optional `voyage` + `theme` blocks — while still
accepting every existing v1 Journey/Endless level unchanged. This contract is the foundation the
generator (Phase 4), the state machine (Phase 2), and the render `theme` (Phase 6) all consume, so it
lands first and stays stable.

## Requirements

- Functional:
  - `schemaVersion` accepts `1` **or** `2`; `mode: 'voyage'` requires `schemaVersion: 2`.
  - `mode` enum gains `'voyage'` (now `['journey','endless','voyage']`).
  - New `constraint` discriminated union on `type`:
    - `moves`: `{ type:'moves', budget: int>0 }`
    - `timed`: `{ type:'timed', startMs, mistakePenaltyMs, clearBonusMs }` — reuses the shipped
      `timerSchema` field shapes (so the timed path is byte-compatible with Journey's timer).
    - `mistakes`: `{ type:'mistakes', cap: int>0 }`
  - Optional `voyage` envelope: `{ index: int>=1, episode: int>=1, isBoss: boolean }`.
  - Optional `theme` block: `{ biome, variant, particle, trim, parallaxSeed: int, boss: boolean }`
    (all strings except `parallaxSeed`/`boss`) — additive, consumed by Phase 6; unknown biome ids are
    a **render-time** fallback concern, not a parse error (keeps content data-driven).
  - `chapter` and `city` become **optional** (Journey-only); a `voyage` level omits them.
  - `rewards.stars` thresholds follow the constraint metric: `movesLeft` (moves), `secondsLeft`
    (timed — keep existing name), or `mistakesLeft` (mistakes). Wrong metric for the constraint → error.
- Non-functional:
  - Zero RN/Skia imports (stays Vitest-pure). Keep the injected-`paletteSize` pattern (core must not
    import `src/render/palette.ts`).
  - Every existing v1 rule (board-legality `colors × minChain ≤ rows × cols`, `colors ≤ paletteSize`,
    obstacle bounds/dedupe, `freeCaged` needs ≥1 cage, `minChain ∈ [2,4]`) carries forward verbatim.

## Architecture

One `levelSchema`, `schemaVersion: z.union([z.literal(1), z.literal(2)])`, with mode-driven
conditional validation in `superRefine`. Sketch:

```ts
const constraintSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('moves'), budget: z.number().int().positive() }),
  z.object({
    type: z.literal('timed'),
    startMs: z.number().int().positive(),
    mistakePenaltyMs: z.number().int().nonnegative(),
    clearBonusMs: z.number().int().nonnegative().default(0),
  }),
  z.object({ type: z.literal('mistakes'), cap: z.number().int().positive() }),
]);

// superRefine additions:
//  - mode 'voyage'  ⇒ schemaVersion === 2, constraint present, voyage envelope present, objectives non-empty
//  - mode 'voyage'  ⇒ timer absent (constraint replaces it); mode 'journey' keeps its timer requirement
//  - rewards.stars metric must match constraint.type (movesLeft|secondsLeft|mistakesLeft)
```

Add accessors: `constraintOf(level)` (returns the discriminated constraint or the journey timer
mapped to a `timed` constraint), so Phase 2 has one uniform entry point. `levelToConfig` is unchanged
(board-only). Export `Constraint`, `VoyageMeta`, `Theme` types.

## Related Code Files

- Modify: `src/core/level/level-script.ts`
- Modify: `src/core/level/level-script.test.ts` (v1-still-parses + v2 cases)
- Reference (do not change): `src/core/journey/journey-state.ts` (timer semantics the `timed`
  constraint mirrors), `src/core/config.ts` (`DEFAULT_CONFIG` defaults)
- Docs sync: `docs/level-script-schema.md` (bump to v2; document the new fields + the version policy)

## Implementation Steps

1. Widen `schemaVersion` to `union(1,2)`; add `'voyage'` to the `mode` enum.
2. Add `constraintSchema`; add optional `constraint`, `voyage`, `theme`; make `chapter`/`city` optional.
3. Rework `rewards.stars` to a metric that the superRefine checks against the constraint type.
4. Extend `superRefine` with the voyage rules (above); keep all existing v1 checks intact.
5. Add `constraintOf(level)` + export the new types.
6. Tests: `japan-01` v1 still parses; a valid voyage L10 parses; voyage missing `constraint` fails; voyage
   with a `timer` fails; mismatched reward metric fails; board-legality still rejected; v1 endless
   still parses.
7. Update `docs/level-script-schema.md` in the same change (version policy + new field table).

## Success Criteria

- [x] `japan-01.test.ts` and `level-script.test.ts` v1 cases stay green (no v1 regression).
- [x] A valid `voyage` level-10 script parses; each new invariant has a red→green test.
- [x] `npm run typecheck` clean; new exported types (`Constraint`, `VoyageMeta`, `Theme`) used downstream.
- [x] `docs/level-script-schema.md` documents v2 and the accept-v1-and-v2 policy.

## Risk Assessment

- **Breaking authored v1 levels.** Signal: `japan-01.test.ts` fails. Response: the v1 path must stay
  untouched — only _add_ a v2 branch; if a shared rule must change, migrate `japan-01` in the same PR.
- **Constraint/timer duplication drift.** The `timed` constraint and Journey's `timer` describe the
  same thing. Mitigation: `constraintOf()` maps a journey timer into a `timed` constraint so Phase 2
  reads one shape; do not fork the countdown logic.
