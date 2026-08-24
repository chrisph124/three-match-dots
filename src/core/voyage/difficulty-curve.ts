import { BOSS_BUMP, INTRA_BLOCK_STEP, PLATEAU_HEIGHT, RAMP_TAU, RELIEF_DIP } from './voyage-config';

/**
 * The Voyage difficulty curve: a level index in, a difficulty target `d` out.
 * Pure and deterministic — no RNG. The generator (Phase 4) turns `d` into a
 * point budget via `budget(d)`, then spends it into concrete dials.
 *
 * Shape:
 *  - a saturating base ramp `PLATEAU_HEIGHT · (1 − e^(−index/RAMP_TAU))` that
 *    rises quickly over the first ~150 levels then flattens toward the plateau,
 *  - plus a per-block modifier keyed on `index % 10`: a gentle rise across
 *    positions 2..9, a boss spike at 10 (`index % 10 === 0`), and a relief dip
 *    at the post-boss level (`index % 10 === 1`).
 *
 * So within a block the boss is the local maximum and the level right after it
 * is the local minimum — the classic tension/release beat.
 */

/** The saturating base ramp, ignoring block structure. Monotone in `index`. */
function baseRamp(index: number): number {
  return PLATEAU_HEIGHT * (1 - Math.exp(-index / RAMP_TAU));
}

/** The `index % 10` block modifier: intra-block rise, boss spike, relief dip. */
function blockModifier(index: number): number {
  const position = index % 10;
  if (position === 0) {
    return BOSS_BUMP; // boss level (10, 20, 30, …)
  }
  if (position === 1) {
    return -RELIEF_DIP; // post-boss relief (11, 21, 31, …)
  }
  return (position - 1) * INTRA_BLOCK_STEP; // gentle rise across 2..9
}

/**
 * The difficulty target for a level index (`index ≥ 1`). Floored at 0 so the
 * relief dip on an early, low-base level can never go negative.
 */
export function curve(index: number): number {
  return Math.max(0, baseRamp(index) + blockModifier(index));
}
