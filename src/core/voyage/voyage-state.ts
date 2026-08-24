import { hasLegalMove } from '../deadlock';
import { applyResolution, newGame } from '../game';
import {
  cagedCells,
  constraintOf,
  levelToConfig,
  type Constraint,
  type LevelScript,
} from '../level/level-script';
import { foldObjectives, initObjectives, type ObjectiveProgress } from '../journey/objectives';
import { buildCaged, chipLayers, remapMoves } from '../obstacles/caged-dot';
import { shuffleBoard } from '../shuffle';
import type { CellIndex, CellMove, GameState, Resolution } from '../types';

/**
 * The Voyage layer: a pure wrapper around the color-board core that adds a
 * pluggable constraint budget (moves / timed / mistakes), objective tracking,
 * and a caged-cell overlay. It mirrors `journey-state.ts` exactly — folding over
 * the `Resolution` the tested core produces — but tracks a `VoyageBudget` union
 * instead of Journey's fixed countdown, so one machine plays all three
 * constraints. It never touches the tested core (`resolve/**`, `hot/**`,
 * `game.ts`) and never modifies the Journey path.
 */

export type VoyageStatus = 'playing' | 'won' | 'lost';

/** The live spend-state of a level's constraint. `kind` mirrors `Constraint.type`. */
export type VoyageBudget =
  | { readonly kind: 'moves'; readonly remaining: number }
  | { readonly kind: 'timed'; readonly remainingMs: number }
  | { readonly kind: 'mistakes'; readonly remaining: number };

export type VoyageState = {
  readonly game: GameState;
  readonly level: LevelScript;
  readonly budget: VoyageBudget;
  readonly objectives: readonly ObjectiveProgress[];
  readonly caged: ReadonlyMap<CellIndex, number>;
  readonly status: VoyageStatus;
};

/** Seeds the live budget from the level's constraint. */
function initBudget(constraint: Constraint): VoyageBudget {
  switch (constraint.type) {
    case 'moves':
      return { kind: 'moves', remaining: constraint.budget };
    case 'timed':
      return { kind: 'timed', remainingMs: constraint.startMs };
    case 'mistakes':
      return { kind: 'mistakes', remaining: constraint.cap };
  }
}

/**
 * Opens a level. Deals the board deterministically from `level.seed` when set
 * (so winnability and caged-cell colors are provable at generation time),
 * otherwise from the caller's session seed — matching Journey/Endless. The
 * budget, cages, and objective targets all come from the level.
 */
export function newVoyage(level: LevelScript, sessionSeed: number): VoyageState {
  const seed = level.seed ?? sessionSeed;
  const game = newGame(levelToConfig(level), seed);
  const caged = buildCaged(cagedCells(level));
  return {
    game,
    level,
    budget: initBudget(constraintOf(level)),
    objectives: initObjectives(level.objectives, caged.size),
    caged,
    status: 'playing',
  };
}

/**
 * The terminal status after a committed clear. Win strictly precedes loss: a
 * move that both meets every objective AND empties the budget is a win, never a
 * loss (see `applyVoyageResolution`).
 */
function statusAfterClear(won: boolean, budget: VoyageBudget): VoyageStatus {
  if (won) {
    return 'won';
  }
  return budgetExhausted(budget) ? 'lost' : 'playing';
}

/** True when a budget can no longer sustain play (objectives still unmet ⇒ loss). */
function budgetExhausted(budget: VoyageBudget): boolean {
  switch (budget.kind) {
    case 'moves':
      return budget.remaining <= 0;
    case 'timed':
      return budget.remainingMs <= 0;
    case 'mistakes':
      return budget.remaining <= 0;
  }
}

/**
 * Applies the cost/credit a committed clear has on the budget: `moves` spends 1,
 * `timed` adds the level's `clearBonusMs`, `mistakes` is unaffected by a clear.
 */
function spendOnClear(budget: VoyageBudget, constraint: Constraint): VoyageBudget {
  switch (budget.kind) {
    case 'moves':
      return { kind: 'moves', remaining: budget.remaining - 1 };
    case 'timed': {
      const bonus = constraint.type === 'timed' ? constraint.clearBonusMs : 0;
      return { kind: 'timed', remainingMs: budget.remainingMs + bonus };
    }
    case 'mistakes':
      return budget;
  }
}

/**
 * Folds one accepted resolution into the Voyage. Order mirrors Journey: chip the
 * cages this resolution touched (pop a 1-layer cage, decrement a multi-layer one)
 * BEFORE remapping survivors through gravity, THEN read objectives off the settled
 * overlay, THEN apply the budget effect. Chip-then-remap matters: a cage's layer
 * must resolve while its key is still the pre-gravity index.
 *
 * Win-before-loss: if every objective is `done`, the status is `won` regardless
 * of the remaining budget — a final move that both empties the last cage and
 * spends the last move is a win, never a loss.
 */
export function applyVoyageResolution(vstate: VoyageState, resolution: Resolution): VoyageState {
  if (vstate.status !== 'playing') {
    return vstate;
  }
  const game = applyResolution(vstate.game, resolution);
  const caged = remapMoves(chipLayers(vstate.caged, resolution), resolution.falls);
  const objectives = foldObjectives(vstate.objectives, resolution, caged);
  const won = objectives.every((entry) => entry.done);
  const budget = spendOnClear(vstate.budget, constraintOf(vstate.level));
  const status = statusAfterClear(won, budget);
  return { game, level: vstate.level, budget, objectives, caged, status };
}

/** Sets remaining time (floored at 0) and flips to `'lost'` when it hits zero. */
function advanceClock(vstate: VoyageState, nextMs: number): VoyageState {
  const remainingMs = Math.max(0, nextMs);
  return {
    ...vstate,
    budget: { kind: 'timed', remainingMs },
    status: remainingMs === 0 ? 'lost' : 'playing',
  };
}

/** Advances a `timed` budget to reflect `dtMs` elapsed; a no-op for other kinds. */
export function tickVoyage(vstate: VoyageState, dtMs: number): VoyageState {
  if (vstate.status !== 'playing' || vstate.budget.kind !== 'timed') {
    return vstate;
  }
  // Clamp the delta: the meta hook feeds a timestamp difference, and a queued
  // burst on foreground-return must never over-subtract or run time backwards.
  const elapsed = Math.max(0, dtMs);
  return advanceClock(vstate, vstate.budget.remainingMs - elapsed);
}

/**
 * Penalizes an invalid attempt (a chain that resolves to nothing). Per kind:
 * `timed` removes the mistake penalty (and can end the run), `mistakes` spends
 * one of the cap (and can end the run), `moves` is unaffected (a wasted attempt
 * doesn't consume a move — only a committed clear does).
 */
export function registerVoyageMistake(vstate: VoyageState): VoyageState {
  if (vstate.status !== 'playing') {
    return vstate;
  }
  switch (vstate.budget.kind) {
    case 'moves':
      return vstate;
    case 'timed': {
      const constraint = constraintOf(vstate.level);
      const penalty = constraint.type === 'timed' ? constraint.mistakePenaltyMs : 0;
      return advanceClock(vstate, vstate.budget.remainingMs - penalty);
    }
    case 'mistakes': {
      const remaining = Math.max(0, vstate.budget.remaining - 1);
      return {
        ...vstate,
        budget: { kind: 'mistakes', remaining },
        status: remaining === 0 ? 'lost' : 'playing',
      };
    }
  }
}

/** The outcome of a settle: the next state plus the slides the renderer animates. */
export type VoyageSettlement = {
  readonly vstate: VoyageState;
  /** Shuffle slides to animate; empty when no reshuffle was needed. */
  readonly moves: readonly CellMove[];
};

/**
 * Resolves a deadlock the same way Journey/Endless do — reusing the shipped
 * `shuffleBoard` — and remaps the caged overlay through the shuffle's `moves`
 * so cages never desync from their dots. A board that already has a legal move
 * is returned unchanged with no moves.
 */
export function settleVoyage(vstate: VoyageState): VoyageSettlement {
  if (vstate.status !== 'playing') {
    return { vstate, moves: [] };
  }
  const { config, board, score, rngState } = vstate.game;
  if (hasLegalMove(board, config.rows, config.cols, config.minChain)) {
    return { vstate, moves: [] };
  }
  const shuffle = shuffleBoard(board, config, rngState);
  return {
    vstate: {
      ...vstate,
      game: { config, board: shuffle.board, score, rngState: shuffle.rngState },
      caged: remapMoves(vstate.caged, shuffle.moves),
    },
    moves: shuffle.moves,
  };
}
