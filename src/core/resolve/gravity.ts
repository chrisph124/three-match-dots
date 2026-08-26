import type { Board, CellIndex, Color, FallMove } from '../types';
import { EMPTY } from '../types';

/**
 * Punches out each listed cell (by index), then settles each column downward.
 * Falls are emitted per column bottom-up, columns left to right, so the
 * render layer can stagger them straight from the array order.
 *
 * The input is the minimal `{ index }` shape — gravity only ever reads the
 * index. Callers pass the scored `cleared` cells and may append extra emptied
 * cells (a caller-computed expand set) without minting a colour/reason for them.
 */
export function applyGravity(
  board: Board,
  emptied: readonly { readonly index: CellIndex }[],
  rows: number,
  cols: number,
): { board: Color[]; falls: FallMove[] } {
  const next: Color[] = [...board];
  for (const cell of emptied) {
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
