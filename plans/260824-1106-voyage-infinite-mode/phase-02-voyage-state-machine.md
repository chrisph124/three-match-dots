---
title: 'Phase 2: Voyage state machine'
status: done
phase: 2
priority: P1
effort: '1.5d'
dependencies: [1]
---

# Phase 2: Voyage state machine

## Overview

Build the pure Voyage play-loop — one level, played to win/lose under any of the three constraints —
mirroring the shipped `src/core/journey/journey-state.ts` pattern, plus a thin RN hook. This is the
"play a single generated level" capability the render layer (Phases 7–8) and the solver (Phase 5)
both drive.

## Requirements

- Functional:
  - `newVoyage(level, sessionSeed)` deals the board (`level.seed ?? sessionSeed`), builds the caged
    overlay, seeds objectives, and initializes a **constraint budget** from `constraintOf(level)`.
  - Budget union: `moves` (a committed resolution spends 1), `timed` (countdown + `clearBonusMs` +
    `mistakePenaltyMs` — identical math to Journey), `mistakes` (an invalid attempt spends 1).
  - `applyVoyageResolution` folds objectives + caged overlay exactly as Journey does (free cleared →
    remap through gravity → read settled overlay), then applies the budget effect.
  - **Win-before-loss:** if every objective is `done`, status is `won` regardless of remaining
    budget (a final move that both empties the last cage and spends the last move is a win).
  - `tickVoyage` (timed only), `registerVoyageMistake` (timed → −penalty; mistakes → −1; moves → no-op),
    `settleVoyage` (deadlock → reuse `shuffleBoard`, remap the caged overlay through the slides).
- Non-functional:
  - `src/core/voyage/**` stays RN/Skia-free (Vitest-pure). Reuse core helpers; **do not** modify or
    refactor `journey-state.ts` (keep the shipped, tested Journey path stable).

## Architecture

`voyage-state.ts` reuses the same core helpers Journey does — `newGame`, `applyResolution`,
`buildCaged`/`freeCleared`/`remapMoves` (`obstacles/caged-dot`), `initObjectives`/`foldObjectives`
(`journey/objectives`), `shuffleBoard`, `hasLegalMove`. Only the constraint tracking differs:

```ts
export type VoyageStatus = 'playing' | 'won' | 'lost';
export type VoyageBudget =
  | { readonly kind: 'moves'; readonly remaining: number }
  | { readonly kind: 'timed'; readonly remainingMs: number }
  | { readonly kind: 'mistakes'; readonly remaining: number };
export type VoyageState = {
  readonly game: GameState;
  readonly level: LevelScript;
  readonly budget: VoyageBudget;
  readonly objectives: readonly ObjectiveProgress[];
  readonly caged: ReadonlySet<CellIndex>;
  readonly status: VoyageStatus;
};
```

`applyVoyageResolution` order: `applyResolution` → `remapMoves(freeCleared(caged), falls)` →
`foldObjectives` → `won = objectives.every(done)` → if `won` return won; else spend budget (moves −1
/ timed +clearBonus) and flip to `lost` when the budget is exhausted with objectives unmet. The
`timed` clock math is a small self-contained reducer (a clamped subtract, floored at 0) — trivial
enough to keep local rather than couple to Journey's private helper.

The RN hook `src/meta/use-voyage-state.ts` mirrors `use-journey-state.ts`: owns the RAF tick for the
`timed` constraint, exposes `{ state, onResolution, onMistake, onSettle }` to the Voyage game screen,
and leaves persistence to Phase 7.

## Related Code Files

- Create: `src/core/voyage/voyage-state.ts`, `src/core/voyage/voyage-state.test.ts`
- Create: `src/meta/use-voyage-state.ts`
- Reference (do not change): `src/core/journey/journey-state.ts`, `src/core/journey/objectives.ts`,
  `src/core/obstacles/caged-dot.ts`, `src/core/game.ts`, `src/core/shuffle.ts`,
  `src/core/deadlock.ts`, `src/core/level/level-script.ts` (`constraintOf`)

## Implementation Steps

1. Define `VoyageBudget`/`VoyageState`/`VoyageStatus`; `newVoyage` builds them from `constraintOf(level)`.
2. `applyVoyageResolution` — fold (reusing the Journey helpers) then apply the budget effect with
   win-before-loss ordering.
3. `tickVoyage` + `registerVoyageMistake` per constraint kind; `settleVoyage` reusing `shuffleBoard` +
   caged remap.
4. Pure tests: moves (decrement, lose-on-0-unmet, **win-on-last-move**), timed (countdown, clearBonus,
   penalty, lose-on-0), mistakes (decrement, lose-on-cap), settle (reshuffle + cage remap), win when
   all objectives done.
5. `use-voyage-state.ts` hook (RN) — RAF tick for timed; verified on-device in Phase 7.

## Success Criteria

- [x] All three constraint kinds win and lose correctly under Vitest; win-before-loss covered.
- [x] Caged overlay never desyncs from the board through gravity or shuffle (reuses the Journey remap).
- [x] `journey-state.ts` untouched; Journey tests stay green.
- [x] `src/core/voyage/**` imports nothing from RN/Skia; hook isolates all RN concerns to `src/meta`.

## Risk Assessment

- **Destabilizing Journey via a premature shared refactor.** Signal: Journey tests break. Response:
  keep `voyage-state.ts` parallel and self-contained; extract shared clock/budget helpers only later,
  behind green tests on both modes.
- **Win/lose ordering bug** (spending the last move on the winning clear reads as a loss). Signal: the
  win-on-last-move test fails. Response: objectives-done check strictly precedes budget exhaustion.
