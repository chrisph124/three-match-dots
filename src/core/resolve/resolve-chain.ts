import { areAdjacent } from '../hot/adjacency';
import type { Board, CellIndex, Chain, ClearedCell, GameState, Resolution } from '../types';
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
 * A shared, never-mutated empty set so the default 2-arg path allocates nothing
 * and `protectedCells.size` is always safe to read (red-team F7: a bare optional
 * would null-deref for every current 2-arg caller).
 */
const EMPTY_PROTECTED: ReadonlySet<CellIndex> = new Set();

/**
 * A generic, mechanic-agnostic seam let into the resolution pipeline:
 * - `skipCollect`: cells a colour-sweep must NOT collect (kept despite the match).
 * - `expandCleared`: given the scored `cleared` set, returns extra cell indices to
 *   empty in the SAME pass — they fall and refill with `cleared` but never score.
 * Both optional; omitting the seam is byte-identical to the classic resolve. The
 * anchor bridge supplies both; the core never learns the word "anchor".
 */
type ResolveSeam = {
  readonly skipCollect?: ReadonlySet<CellIndex>;
  readonly expandCleared?: (cleared: readonly ClearedCell[]) => readonly CellIndex[];
};

/**
 * classify -> collect -> gravity -> refill -> score.
 * Returns null when the chain cannot be committed; the input layer treats
 * null as a cancel. Nothing here throws.
 *
 * `protectedCells` is a generic, mechanic-agnostic seam: any collected cell in
 * the set is linked and counted toward the chain (validation, classification,
 * and colour all run on the FULL chain) yet survives removal — it does not
 * score, is not punched out, and is echoed back on `Resolution.protectedHits`.
 * The layered-cage overlay and the solver pass their own "keep this cell" set;
 * the core never learns why. Omitted/empty ⇒ byte-identical to the classic
 * two-arg resolve (no partition, no `protectedHits` key).
 */
export function resolveChain(
  state: GameState,
  chain: Chain,
  protectedCells: ReadonlySet<CellIndex> = EMPTY_PROTECTED,
  seam?: ResolveSeam,
): Resolution | null {
  const { board, config } = state;
  const { rows, cols } = config;

  if (!isCommittable(board, chain, cols, config.minChain)) {
    return null;
  }

  const kind = classifyChain(chain, cols, config.lineLength);
  const color = board[chain[0]];
  // Classification ran on the full chain above; only the *removed* set is split.
  // Protecting a cell that was never collected is a no-op, so the overlay can
  // pass its protected set unconditionally without predicting collect/classify.
  const collected = collectCleared(board, chain, kind, seam?.skipCollect);
  const cleared =
    protectedCells.size === 0 ? collected : collected.filter((c) => !protectedCells.has(c.index));
  const protectedHits =
    protectedCells.size === 0 ? undefined : collected.filter((c) => protectedCells.has(c.index));
  // The seam may empty extra cells (never scored, never in `cleared`); they join
  // gravity by index only. `skipCollect` keeps them out of `cleared`, so the two
  // sets are disjoint and no cell is punched twice.
  const expanded = seam?.expandCleared ? seam.expandCleared(cleared) : [];
  const emptied = expanded.length ? [...cleared, ...expanded.map((index) => ({ index }))] : cleared;
  const settled = applyGravity(board, emptied, rows, cols);

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
    ...(protectedHits && protectedHits.length ? { protectedHits } : {}),
    ...(expanded.length ? { expandedCleared: expanded } : {}),
  };
}
