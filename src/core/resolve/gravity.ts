import type { Board, ClearedCell, Color, FallMove } from '../types';
import { EMPTY } from '../types';

/**
 * Punches out the cleared cells, then settles each column downward.
 * Falls are emitted per column bottom-up, columns left to right, so the
 * render layer can stagger them straight from the array order.
 */
export function applyGravity(
  board: Board,
  cleared: readonly ClearedCell[],
  rows: number,
  cols: number,
): { board: Color[]; falls: FallMove[] } {
  const next: Color[] = [...board];
  for (const cell of cleared) {
    next[cell.index] = EMPTY;
  }

  const falls: FallMove[] = [];
  for (let col = 0; col < cols; col++) {
    let writeRow = rows - 1;
    for (let row = rows - 1; row >= 0; row--) {
      const from = row * cols + col;
      if (next[from] === EMPTY) {
        continue;
      }
      const to = writeRow * cols + col;
      if (from !== to) {
        falls.push({ from, to });
        next[to] = next[from];
        next[from] = EMPTY;
      }
      writeRow--;
    }
  }
  return { board: next, falls };
}
