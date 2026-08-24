---
title: 'Phase 5: Solver bot and calibration'
status: done
phase: 5
priority: P1
effort: '1.5d'
dependencies: [2, 4]
---

# Phase 5: Solver bot and calibration

## Overview

A headless solver bot that plays a generated level to completion, used to (a) **gate winnability**
(no level ships that can't be beaten) and (b) **calibrate** each level's move/time budget from real
play data instead of a guess. This is what makes the difficulty honest.

## Requirements

- Functional:
  - `enumerateMoves(game) → Move[]`: every legal chain on the current board (reuses the shipped hot
    adjacency/chain primitives; a "move" is a committable chain ≥ `minChain`, plus sweep-eligible
    loops/lines).
  - `solve(level, seed) → SolveResult`: a **greedy chain-picker + sweep-opportunist** — prefers a
    sweep (2×2 loop or ≥5 line) when it advances the objective, else the longest objective-relevant
    chain — driving the Phase 2 state machine (`applyVoyageResolution`/`settleVoyage`) until win, loss, or
    a step cap. Returns `{ won, movesUsed, msUsed, mistakes }`.
  - `calibrateBudget(level, seed, samples) → budget`: runs the solver over N seeds, takes **p75** of
    `movesUsed` (or `msUsed`) and adds **slack**, then writes that back as the level's `constraint`
    budget. p75-percentile and slack are the two tuning constants (plan Open Question 3).
  - **Winnability gate:** a level whose solver can't win within the step cap is **rejected** — the
    generator re-seeds (bounded) or the CI sweep fails loudly.
- Non-functional:
  - Pure TS in `src/core/voyage/`, Vitest-able. Uses only `src/core/hot/` primitives for board math
    (worklet-safe, no allocation churn in the inner loop where practical) and the Phase 2 machine for
    state transitions — no RN/Skia.
  - A CI **sweep test** runs the solver over indices `1..N` (a bounded N for CI time) and asserts every
    level is winnable at its calibrated budget; it `log`s any dropped/failed index (no silent cap).

## Architecture

- `enumerate-moves.ts` — legal-move enumeration over the current board using `src/core/hot/`
  adjacency + chain validation + loop/line detection. Returns lightweight move descriptors.
- `solver.ts` — the greedy policy + the play loop driving the Phase 2 machine; `solve` and
  `calibrateBudget`. The policy is intentionally _sub-optimal but honest_: it approximates a
  competent-but-not-perfect player so p75 maps to a fair budget, not a theoretical minimum.
- Generation wiring: `generate-level.ts` (Phase 4) calls `calibrateBudget` after assembling a
  candidate and **before** the final `parseLevelScript`, so the shipped script carries a solver-set
  budget. Bosses calibrate the same way but with a wider slack (the ~80% first-attempt-pass target).
- `voyage-config.ts` (Phase 3) gains the calibration constants (`SOLVER_PERCENTILE`, `SOLVER_SLACK`,
  `SOLVER_STEP_CAP`, `SOLVER_SAMPLES`) so tuning is one edit point.

## Related Code Files

- Create: `src/core/voyage/enumerate-moves.ts`, `src/core/voyage/solver.ts`
- Create: `src/core/voyage/solver.test.ts`, `src/core/voyage/calibration.test.ts`,
  `src/core/voyage/generation-sweep.test.ts` (the CI winnability sweep)
- Modify: `src/core/voyage/generate-level.ts` (call `calibrateBudget` in the pipeline),
  `src/core/voyage/voyage-config.ts` (add calibration constants)
- Reference (do not change): `src/core/hot/*` (adjacency/chain/loop/line primitives), `src/core/voyage/
voyage-state.ts` (Phase 2 machine)

## Implementation Steps

1. `enumerate-moves.ts` over the hot primitives; unit-test it against known boards (chain count,
   sweep eligibility).
2. `solver.ts` greedy policy driving the Phase 2 machine to a terminal state; test win on a trivially
   solvable level and loss on an impossible one within the cap.
3. `calibrateBudget` (p75 + slack over N seeds); test that it produces a budget the solver then wins
   at, and that a too-tight manual budget is correctly flagged unwinnable.
4. Wire `calibrateBudget` into `generate-level.ts`; move calibration constants into `voyage-config.ts`.
5. `generation-sweep.test.ts`: solve `1..N`, assert all winnable at calibrated budget, `log` any drop.

## Success Criteria

- [x] `enumerateMoves` returns exactly the legal chains/sweeps for known test boards.
- [x] The solver wins solvable levels and correctly reports loss on unwinnable ones within the step cap.
- [x] `calibrateBudget` sets budgets the solver reliably beats; the winnability sweep over `1..N` is
      green with zero silent drops.
- [x] Caged Core (level 10) is solver-winnable within its (wider-slack) calibrated budget.
- [x] Pure TS, hot-primitive-based; `npm test` + `npm run typecheck` green.

> **Sync note (winnability closure):** the `1..N` sweep initially false-halted on one deal (level 83).
> Root cause was a soundness bug in the _shipped core_ `hasLegalMove` (`src/core/deadlock.ts`), not the
> solver: it reported a live board by same-colour _component size_ ≥ `minChain`, but a 4-cell "star"
> (K₁,₃) has no 4-chain — a false positive only at `minChain 4` (Voyage). Fixed (user-approved core
> scope widening) by rewriting `hasLegalMove` as a bounded same-colour simple-path search (byte-identical
> at `minChain 3`, so Endless/Journey unaffected), with a regression test on the star board. `enumerate-
moves.ts` carries a matching `findChain` completeness net so its move set agrees with the corrected
> predicate. Post-fix: sweep `1..200` + Caged Core green, zero drops.

## Risk Assessment

- **Greedy solver ≠ human, so p75 mis-estimates real difficulty.** Signal: on-device playtest feels
  far harder/easier than the solver's budget implied. Response: the policy is a floor, not an oracle;
  slack absorbs the gap, and constants live in `voyage-config.ts` for playtest-driven tuning. Escalate
  to a lookahead policy only if playtest shows systematic bias.
- **Sweep-heavy boards explode the enumeration.** Signal: the sweep test times out. Response: cap the
  step count and prune obviously dominated moves; the entity count is tiny (≤64 cells) so this is a
  guard, not an expected path.
- **CI sweep cost.** Signal: the sweep test dominates CI time. Response: bound N for CI (full sweep as
  an on-demand script), and `log` the covered range so the bound is never mistaken for full coverage.
