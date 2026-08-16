import { formsSquareLoop } from '../hot/closes-square';
import { isCollinearRun } from '../hot/is-line';
import type { Chain, ChainKind } from '../types';

/**
 * Classifies a committed chain as one of: square-loop (sealed 2×2), line
 * (collinear run), or plain (everything else).
 *
 * Precedence is square-loop > line > plain. The square-loop check comes first
 * as a defensive ordering: a chain cannot simultaneously be sealed (forms a
 * closed loop with its 5th-from-last entry) and collinear (all steps share one
 * delta), since that would require both following one direction and reversing
 * to close the loop — impossible on a grid with only adjacency moves.
 */
export function classifyChain(chain: Chain, cols: number, lineLength: number): ChainKind {
  if (formsSquareLoop(chain, cols)) {
    return 'square-loop';
  }
  if (isCollinearRun(chain, cols, lineLength)) {
    return 'line';
  }
  return 'plain';
}
