import type { Chain } from '../types';
import { colOf, rowOf } from './adjacency';

/**
 * True when the chain is at least `minLength` long and every step shares one
 * (dRow, dCol). Because each step is already an adjacency step, that is
 * exactly "straight along one of the 8 directions".
 */
export function isCollinearRun(chain: Chain, cols: number, minLength: number): boolean {
  'worklet';
  if (chain.length < minLength || chain.length < 2) {
    return false;
  }
  const dRow = rowOf(chain[1], cols) - rowOf(chain[0], cols);
  const dCol = colOf(chain[1], cols) - colOf(chain[0], cols);
  for (let i = 2; i < chain.length; i++) {
    if (rowOf(chain[i], cols) - rowOf(chain[i - 1], cols) !== dRow) {
      return false;
    }
    if (colOf(chain[i], cols) - colOf(chain[i - 1], cols) !== dCol) {
      return false;
    }
  }
  return true;
}
