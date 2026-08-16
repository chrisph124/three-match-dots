import type { Board, Chain, ChainKind, ClearedCell } from '../types';

/**
 * Chain cells first, in drag order; then, for a sweep, every remaining cell
 * of that colour row-major. The ordering is contractual — the render layer
 * staggers its pop animations along it.
 */
export function collectCleared(board: Board, chain: Chain, kind: ChainKind): ClearedCell[] {
  const color = board[chain[0]];
  const seen = new Set<number>();
  const cleared: ClearedCell[] = [];

  for (const index of chain) {
    if (seen.has(index)) {
      continue;
    }
    seen.add(index);
    cleared.push({ index, color, reason: 'chain' });
  }

  if (kind === 'plain') {
    return cleared;
  }

  for (let index = 0; index < board.length; index++) {
    if (board[index] !== color || seen.has(index)) {
      continue;
    }
    seen.add(index);
    cleared.push({ index, color, reason: 'color-sweep' });
  }
  return cleared;
}
