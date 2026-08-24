import { constraintOf, type Constraint, type LevelScript } from '../level/level-script';
import type { ObjectiveProgress } from '../journey/objectives';
import { resolveChain } from '../resolve/resolve-chain';
import type { Board, CellIndex } from '../types';
import { enumerateMoves, type Move } from './enumerate-moves';
import {
  SOLVER_BOSS_SLACK,
  SOLVER_MS_PER_MOVE,
  SOLVER_PERCENTILE,
  SOLVER_SAMPLES,
  SOLVER_SLACK,
  SOLVER_STEP_CAP,
  SOLVER_TIMED_FLOOR_MS,
  mixSeed,
} from './voyage-config';
import {
  applyVoyageResolution,
  newVoyage,
  settleVoyage,
  tickVoyage,
  type VoyageState,
} from './voyage-state';

/**
 * The headless solver bot (Phase 5). It plays a generated level with a greedy,
 * intentionally *sub-optimal-but-honest* policy — prefer whichever move advances
 * the objective most, breaking ties toward sweeps and larger clears — driving the
 * Phase 2 Voyage machine to a terminal state. Two jobs:
 *
 *  - `solve` gates **winnability**: a level whose bot can't win within the step
 *    cap must not ship (the generation sweep fails loudly).
 *  - `calibrateBudget` sets a **fair budget** from real play: the p75 of the move
 *    count over N sampled deals, plus slack — not a hand-guessed number.
 *
 * The policy approximates a competent-not-perfect player, so p75 maps to a fair
 * budget rather than a theoretical minimum. Pure TS: `src/core/hot/` grid math
 * (via `enumerate-moves`) and the shipped resolve/Voyage layers — no RN/Skia.
 */

/** The outcome of one solver play-through. */
export type SolveResult = {
  readonly won: boolean;
  readonly movesUsed: number;
  readonly msUsed: number;
  /** Invalid attempts made; always 0 — the greedy bot only commits legal moves. */
  readonly mistakes: number;
};

/** All board cells currently holding `color`, row-major. */
function cellsOfColor(board: Board, color: number): CellIndex[] {
  const cells: CellIndex[] = [];
  for (let i = 0; i < board.length; i += 1) {
    if (board[i] === color) {
      cells.push(i);
    }
  }
  return cells;
}

/** How many cells this move would clear that advance one unmet objective. */
function objectiveGain(
  entry: ObjectiveProgress,
  moveColor: number,
  cleared: readonly CellIndex[],
  caged: ReadonlySet<CellIndex>,
): number {
  if (entry.objective.type === 'clearColor') {
    if (entry.objective.color !== moveColor) {
      return 0;
    }
    return Math.min(entry.target - entry.current, cleared.length);
  }
  let freed = 0;
  for (const cell of cleared) {
    if (caged.has(cell)) {
      freed += 1;
    }
  }
  return freed;
}

/** A move ranked against the live objectives — the policy's decision record. */
type Scored = {
  readonly move: Move;
  readonly adv: number;
  readonly isSweep: boolean;
  readonly clearedCount: number;
  readonly firstCell: CellIndex;
};

/** Scores a move: objective advancement first, then its churn (cells cleared). */
function scoreMove(move: Move, vstate: VoyageState): Scored {
  const { board } = vstate.game;
  const color = board[move.chain[0]];
  const isSweep = move.kind !== 'plain';
  const cleared = isSweep ? cellsOfColor(board, color) : Array.from(new Set(move.chain));
  let adv = 0;
  for (const entry of vstate.objectives) {
    if (!entry.done) {
      adv += objectiveGain(entry, color, cleared, vstate.caged);
    }
  }
  return { move, adv, isSweep, clearedCount: cleared.length, firstCell: move.chain[0] };
}

/** Strict ordering: advancement, then sweeps, then bigger clears, then low index. */
function betterScore(a: Scored, b: Scored): boolean {
  if (a.adv !== b.adv) {
    return a.adv > b.adv;
  }
  if (a.isSweep !== b.isSweep) {
    return a.isSweep;
  }
  if (a.clearedCount !== b.clearedCount) {
    return a.clearedCount > b.clearedCount;
  }
  return a.firstCell < b.firstCell;
}

/** The greedy policy's chosen move for the current state. */
function pickBest(moves: readonly Move[], vstate: VoyageState): Move {
  let best = scoreMove(moves[0], vstate);
  for (let i = 1; i < moves.length; i += 1) {
    const cand = scoreMove(moves[i], vstate);
    if (betterScore(cand, best)) {
      best = cand;
    }
  }
  return best.move;
}

/** One committed move (or a halt): settle a deadlock, pick, optionally tick, apply. */
type StepOutcome = {
  readonly vstate: VoyageState;
  readonly committed: boolean;
  readonly halted: boolean;
};

function stepOnce(vstate: VoyageState, tickClock: boolean): StepOutcome {
  const settled = settleVoyage(vstate).vstate;
  if (settled.status !== 'playing') {
    return { vstate: settled, committed: false, halted: true };
  }
  const moves = enumerateMoves(settled.game.board, settled.game.config);
  if (moves.length === 0) {
    return { vstate: settled, committed: false, halted: true };
  }
  const resolution = resolveChain(settled.game, pickBest(moves, settled).chain);
  if (resolution === null) {
    return { vstate: settled, committed: false, halted: true };
  }
  // Timed play models think-time as the clock ticking before the move commits;
  // running out mid-move is a loss (slack in the budget keeps it off real boards).
  if (tickClock && settled.budget.kind === 'timed') {
    const ticked = tickVoyage(settled, SOLVER_MS_PER_MOVE);
    if (ticked.status !== 'playing') {
      return { vstate: ticked, committed: false, halted: true };
    }
    const next = applyVoyageResolution(ticked, resolution);
    return { vstate: next, committed: true, halted: next.status !== 'playing' };
  }
  const next = applyVoyageResolution(settled, resolution);
  return { vstate: next, committed: true, halted: next.status !== 'playing' };
}

/** Plays the greedy policy from a fresh deal to a terminal state or the step cap. */
function runGreedy(
  level: LevelScript,
  seed: number,
  tickClock: boolean,
): { readonly vstate: VoyageState; readonly movesUsed: number } {
  let vstate = newVoyage({ ...level, seed }, seed);
  let movesUsed = 0;
  for (let step = 0; step < SOLVER_STEP_CAP; step += 1) {
    const out = stepOnce(vstate, tickClock);
    vstate = out.vstate;
    if (out.committed) {
      movesUsed += 1;
    }
    if (out.halted) {
      break;
    }
  }
  return { vstate, movesUsed };
}

/**
 * Plays a level under its real constraint (ticking the clock for timed levels)
 * and reports the outcome — the winnability gate the generation sweep leans on.
 */
export function solve(level: LevelScript, seed: number): SolveResult {
  const { vstate, movesUsed } = runGreedy(level, seed, true);
  return {
    won: vstate.status === 'won',
    movesUsed,
    msUsed: movesUsed * SOLVER_MS_PER_MOVE,
    mistakes: 0,
  };
}

/** A constraint relaxed so a measurement play never loses before the step cap. */
function relaxConstraint(constraint: Constraint): Constraint {
  switch (constraint.type) {
    case 'moves':
      return { type: 'moves', budget: SOLVER_STEP_CAP + 1 };
    case 'timed':
      return { ...constraint, startMs: SOLVER_STEP_CAP * SOLVER_MS_PER_MOVE + 1 };
    case 'mistakes':
      return { type: 'mistakes', cap: SOLVER_STEP_CAP + 1 };
  }
}

/** Move count the bot needs to satisfy the objective on one deal (no fail-state). */
function playToObjective(
  level: LevelScript,
  seed: number,
): { reached: boolean; movesUsed: number } {
  const relaxed: LevelScript = { ...level, constraint: relaxConstraint(constraintOf(level)) };
  const { vstate, movesUsed } = runGreedy(relaxed, seed, false);
  return { reached: vstate.status === 'won', movesUsed };
}

/** Nearest-rank percentile of a small sample (empty ⇒ the step cap, the worst case). */
function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return SOLVER_STEP_CAP;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * The calibrated primary budget for a level's constraint, from real solver play:
 * p75 of the move count over `samples` deals, plus `slack`, floored so the actual
 * board (sample 0) is always beatable. The number's meaning follows the kind —
 * a `moves` budget, a `timed` `startMs`, or (unchanged) a `mistakes` cap, since a
 * perfect bot makes no mistakes and can't derive a human forgiveness count.
 *
 * The `actual + 1` floor only guarantees winnability when sample 0 (the real
 * board, `level.seed`) is *reached* within `SOLVER_STEP_CAP`; if the bot can't
 * finish it, `actual` stays 0 and the floor is inert. That case is caught
 * independently by the generation winnability sweep (`solve` on the real board),
 * so a level the bot can't actually beat never ships regardless of this floor.
 */
export function calibrateBudget(
  level: LevelScript,
  seed: number,
  samples: number,
  slack: number = SOLVER_SLACK,
): number {
  const constraint = constraintOf(level);
  if (constraint.type === 'mistakes') {
    return constraint.cap;
  }
  const counts: number[] = [];
  let actual = 0;
  for (let i = 0; i < samples; i += 1) {
    const sampleSeed = i === 0 ? (level.seed ?? seed) : mixSeed(seed, i);
    const { reached, movesUsed } = playToObjective(level, sampleSeed);
    if (reached) {
      counts.push(movesUsed);
      if (i === 0) {
        actual = movesUsed;
      }
    }
  }
  const p = percentile(counts, SOLVER_PERCENTILE);
  const calibratedMoves = Math.max(Math.ceil(p * (1 + slack)), actual + 1);
  if (constraint.type === 'moves') {
    return calibratedMoves;
  }
  const netPerMove = Math.max(0, SOLVER_MS_PER_MOVE - constraint.clearBonusMs);
  return Math.max(SOLVER_TIMED_FLOOR_MS, Math.ceil(calibratedMoves * netPerMove));
}

/** Splices a calibrated primary budget back into a constraint of the same kind. */
export function applyCalibratedBudget(constraint: Constraint, budget: number): Constraint {
  switch (constraint.type) {
    case 'moves':
      return { type: 'moves', budget };
    case 'timed':
      return { ...constraint, startMs: budget };
    case 'mistakes':
      return { type: 'mistakes', cap: budget };
  }
}

/**
 * A level's constraint recalibrated from solver play — the one call the generator
 * makes. `slack` widens for bosses (`SOLVER_BOSS_SLACK`) to hit the softer
 * ~80%-first-attempt boss feel.
 */
export function calibrateConstraint(
  level: LevelScript,
  samples: number = SOLVER_SAMPLES,
  slack: number = SOLVER_SLACK,
): Constraint {
  const constraint = constraintOf(level);
  const budget = calibrateBudget(level, level.seed ?? 0, samples, slack);
  return applyCalibratedBudget(constraint, budget);
}

/** The slack a boss calibrates under — re-exported so callers need one import. */
export const BOSS_SLACK = SOLVER_BOSS_SLACK;
