import type { AppendVerdict, Board, CellIndex, Chain } from '../types';
import { areAdjacent } from './adjacency';
import { closesSquare, formsSquareLoop } from './closes-square';

/**
 * Decides what a drag onto `cell` means. Check order matters: the retrace
 * case must be settled before the revisit case, or backing up would read as
 * an illegal revisit.
 */
export function canAppend(
  chain: Chain,
  cell: CellIndex,
  board: Board,
  cols: number,
): AppendVerdict {
  'worklet';
  const len = chain.length;
  if (len === 0) {
    return 'append';
  }
  // A sealed chain accepts nothing further until release.
  if (formsSquareLoop(chain, cols)) {
    return 'reject';
  }
  if (cell === chain[len - 1]) {
    return 'reject';
  }
  if (len >= 2 && cell === chain[len - 2]) {
    return 'undo';
  }
  if (!areAdjacent(cell, chain[len - 1], cols)) {
    return 'reject';
  }
  if (board[cell] !== board[chain[0]]) {
    return 'reject';
  }
  for (let i = 0; i < len; i++) {
    if (chain[i] === cell) {
      return closesSquare(chain, cell, cols) ? 'close-square' : 'reject';
    }
  }
  return 'append';
}
