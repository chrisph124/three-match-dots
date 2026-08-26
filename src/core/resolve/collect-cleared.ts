import type { Board, CellIndex, Chain, ChainKind, ClearedCell } from '../types';

/**
 * A shared, never-mutated empty set so the default 3-arg path allocates nothing
 * and `skip.has(...)` is always safe to call.
 */
const NONE_SKIPPED: ReadonlySet<CellIndex> = new Set();

/**
 * Chain cells first, in drag order; then, for a sweep, every remaining cell
 * of that colour row-major. The ordering is contractual — the render layer
 * staggers its pop animations along it.
 *
 * `skip` is a generic, mechanic-agnostic seam: any cell in it is left OUT of the
 * SWEEP (the caller keeps it despite the colour match — an anchored cell is
 * un-sweepable). The chain loop is deliberately not filtered: a committed chain
 * never contains a skipped cell (the input layer suppresses it), and skipping a
 * chain cell would silently drop a linked dot. Omitted/empty ⇒ byte-identical.
 */
export function collectCleared(
  board: Board,
  chain: Chain,
  kind: ChainKind,
  skip: ReadonlySet<CellIndex> = NONE_SKIPPED,
): ClearedCell[] {
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
    if (board[index] !== color || seen.has(index) || skip.has(index)) {
      continue;
    }
    seen.add(index);
    cleared.push({ index, color, reason: 'color-sweep' });
  }
  return cleared;
}
