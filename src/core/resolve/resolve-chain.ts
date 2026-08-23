import { areAdjacent } from '../hot/adjacency';
import type { Board, Chain, GameState, Resolution } from '../types';
import { EMPTY } from '../types';
import { classifyChain } from './classify-chain';
import { collectCleared } from './collect-cleared';
import { applyGravity } from './gravity';
import { refill } from './refill';
import { scoreFor } from './scoring';

/**
 * Defensive validation. The gesture layer should never hand over a chain
 * that fails this, but the chain arrives from a worklet-owned array and a
 * corrupted one must not be able to corrupt the board.
 */
function isCommittable(board: Board, chain: Chain, cols: number, minChain: number): boolean {
  if (chain.length < minChain) {
    return false;
  }
  const color = board[chain[0]];
  if (color === EMPTY || color === undefined) {
    return false;
  }
  for (let i = 0; i < chain.length; i++) {
    if (board[chain[i]] !== color) {
      return false;
    }
    if (i > 0 && !areAdjacent(chain[i - 1], chain[i], cols)) {
      return false;
    }
  }
  return true;
}

/**
 * classify -> collect -> gravity -> refill -> score.
 * Returns null when the chain cannot be committed; the input layer treats
 * null as a cancel. Nothing here throws.
 */
export function resolveChain(state: GameState, chain: Chain): Resolution | null {
  const { board, config } = state;
  const { rows, cols } = config;

  if (!isCommittable(board, chain, cols, config.minChain)) {
    return null;
  }

  const kind = classifyChain(chain, cols, config.lineLength);
  const color = board[chain[0]];
  const cleared = collectCleared(board, chain, kind);
  const settled = applyGravity(board, cleared, rows, cols);

  // Combo heat. Off unless the config sets heatCap > 0 (only ENDLESS_CONFIG does),
  // so DEFAULT_CONFIG and every Journey config stay byte-identical: nextHeat is
  // pinned to 0, the factor is 1, and the optional fields are omitted entirely.
  const heatCap = config.heatCap ?? 0;
  const heatStep = config.heatStep ?? 0;
  const heatEnabled = heatCap > 0;
  const isSweep = kind !== 'plain';
  const heat = state.heat ?? 0;
  // A sweep heats one tier (capped); any plain chain cools one tier (floored).
  const nextHeat = isSweep ? Math.min(heatCap, heat + 1) : Math.max(0, heat - 1);
  const lastKind = state.lastKind ?? null;
  const doubleSweep = isSweep && lastKind !== null && lastKind !== 'plain';

  // F5 override: the multiplier rides EVERY commit, plain or sweep, off the
  // POST-move heat. A plain chain is therefore boosted by its cooled heat — the
  // plain-snake cash-in the sim's farm-then-cash bot is charged with bounding.
  const factor = 1 + nextHeat * heatStep;
  const scoreDelta = Math.round(scoreFor(kind, cleared.length, config) * factor);

  // A colour-sweep's own refill wave can avoid re-offering the swept colour.
  const exclusionWeight = config.sweepExclusionWeight ?? 0;
  const excludeColor = isSweep && exclusionWeight > 0 ? color : undefined;
  const filled = refill(
    settled.board,
    rows,
    cols,
    config.colors,
    state.rngState,
    excludeColor,
    config.sweepExclusionWeight,
  );

  return {
    kind,
    color,
    cleared,
    falls: settled.falls,
    spawns: filled.spawns,
    scoreDelta,
    board: filled.board,
    rngState: filled.rngState,
    ...(heatEnabled ? { heat: nextHeat, doubleSweep } : {}),
  };
}
