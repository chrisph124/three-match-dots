import type { CellIndex, Chain } from '../types';
import { colOf, rowOf } from './adjacency';

/** Four distinct cells whose bounding box is exactly 2x2 are exactly a 2x2 block. */
function isSquareBlock(
  a: CellIndex,
  b: CellIndex,
  c: CellIndex,
  d: CellIndex,
  cols: number,
): boolean {
  'worklet';
  if (a === b || a === c || a === d || b === c || b === d || c === d) {
    return false;
  }
  const r0 = rowOf(a, cols);
  const r1 = rowOf(b, cols);
  const r2 = rowOf(c, cols);
  const r3 = rowOf(d, cols);
  if (Math.max(r0, r1, r2, r3) - Math.min(r0, r1, r2, r3) !== 1) {
    return false;
  }
  const c0 = colOf(a, cols);
  const c1 = colOf(b, cols);
  const c2 = colOf(c, cols);
  const c3 = colOf(d, cols);
  return Math.max(c0, c1, c2, c3) - Math.min(c0, c1, c2, c3) === 1;
}

/**
 * True when appending `cell` would close a 2x2 loop. Checked before the
 * append, so the square is the chain's last four entries.
 */
export function closesSquare(chain: Chain, cell: CellIndex, cols: number): boolean {
  'worklet';
  const start = chain.length - 4;
  if (start < 0 || chain[start] !== cell) {
    return false;
  }
  return isSquareBlock(chain[start], chain[start + 1], chain[start + 2], chain[start + 3], cols);
}

/**
 * True when a committed chain is sealed: its last entry repeats its
 * 5th-from-last, and those four cells form a 2x2. This self-describing form
 * is what tells a real loop closure apart from a chain that merely ends on
 * four square-shaped cells.
 */
export function formsSquareLoop(chain: Chain, cols: number): boolean {
  'worklet';
  const len = chain.length;
  if (len < 5 || chain[len - 1] !== chain[len - 5]) {
    return false;
  }
  return isSquareBlock(chain[len - 5], chain[len - 4], chain[len - 3], chain[len - 2], cols);
}
