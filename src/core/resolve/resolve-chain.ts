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
  const filled = refill(settled.board, rows, cols, config.colors, state.rngState);

  return {
    kind,
    color,
    cleared,
    falls: settled.falls,
    spawns: filled.spawns,
    scoreDelta: scoreFor(kind, cleared.length, config),
    board: filled.board,
    rngState: filled.rngState,
  };
}
