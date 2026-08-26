import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './config';
import { buildAnchors } from './obstacles/anchor';
import { buildCaged, protectedOf } from './obstacles/caged-dot';
import { resolveCagedChain } from './resolve-caged-chain';
import { resolveChain } from './resolve/resolve-chain';
import { resolveAnchorChain } from './resolve-anchor-chain';
import { parseBoard } from './test-support/board-fixture';
import type { CellIndex, GameState } from './types';

const stateFrom = (art: string, seed = 2026): GameState => {
  const { board, rows, cols } = parseBoard(art);
  return { config: { ...DEFAULT_CONFIG, rows, cols }, board, score: 0, rngState: seed };
};

const idxOf = (cells: readonly { index: number }[]) => cells.map((c) => c.index);
const NO_CAGES: ReadonlyMap<CellIndex, number> = new Map();
const NO_ANCHORS: ReadonlySet<CellIndex> = new Set();

describe('resolveAnchorChain', () => {
  it('empties an 8-adjacent anchor in the same pass: it falls/refills, scores 0, and is echoed', () => {
    // BBB/RRR/GGG — chain [3,4,5] pops the R row; the anchor at 7 (a G) sits below
    // cell 4, so an adjacent clear removes it. The B above (cell 1) then falls into 7.
    const anchors = buildAnchors([7]);
    const result = resolveAnchorChain(stateFrom('BBB/RRR/GGG'), [3, 4, 5], NO_CAGES, anchors);

    expect(idxOf(result?.cleared ?? [])).toEqual([3, 4, 5]); // the anchor is NOT in cleared
    expect(result?.expandedCleared).toEqual([7]); // removed by adjacency, echoed
    expect(result?.falls).toContainEqual({ from: 1, to: 7 }); // a dot fell into the freed cell

    // Score reflects ONLY the three cleared R — the removed anchor contributes nothing.
    const noAnchor = resolveChain(stateFrom('BBB/RRR/GGG'), [3, 4, 5]);
    expect(result?.scoreDelta).toBe(noAnchor?.scoreDelta);
  });

  it('leaves an anchor that is not 8-adjacent to any cleared cell untouched', () => {
    // GGG/BBB/RRR — chain [6,7,8] is two rows below the anchor at 1; not adjacent.
    const result = resolveAnchorChain(
      stateFrom('GGG/BBB/RRR'),
      [6, 7, 8],
      NO_CAGES,
      buildAnchors([1]),
    );
    expect(idxOf(result?.cleared ?? [])).toEqual([6, 7, 8]);
    expect(result && 'expandedCleared' in result).toBe(false); // nothing removed
  });

  it('does not collect an anchor in a same-colour sweep, yet adjacency still removes it', () => {
    // All-R board; a 2x2 loop sweeps every R. The anchor at 5 shares the swept colour,
    // so skipCollect must keep it out of `cleared`, while its neighbour (3) removes it.
    const result = resolveAnchorChain(
      stateFrom('RR/RR/RR'),
      [0, 1, 3, 2, 0],
      NO_CAGES,
      buildAnchors([5]),
    );
    expect(result?.kind).toBe('square-loop');
    expect(idxOf(result?.cleared ?? [])).toEqual([0, 1, 3, 2, 4]); // drag order 0,1,3,2 then sweep 4; 5 not swept
    expect(result?.expandedCleared).toEqual([5]); // 5 removed by adjacency, not by sweep
  });

  it('composes a cage and an anchor on one board — disjoint, each on its own channel', () => {
    // All-R board, 2x2 loop sweeps all R. Cell 0 is a 2-layer cage (chips, stays),
    // cell 5 is an anchor (removed by adjacency). The two overlays never overlap.
    const result = resolveAnchorChain(
      stateFrom('RR/RR/RR'),
      [0, 1, 3, 2, 0],
      buildCaged([{ index: 0, layers: 2 }]),
      buildAnchors([5]),
    );
    expect(idxOf(result?.cleared ?? [])).toEqual([1, 3, 2, 4]); // drag order minus protected 0; 5 skipped
    expect(idxOf(result?.protectedHits ?? [])).toEqual([0]); // cage chipped
    expect(result?.expandedCleared).toEqual([5]); // anchor removed
  });

  it('keeps the caged-only path byte-identical to a bare protected resolve', () => {
    // The bridge with an empty anchor set must not perturb the classic cage path.
    const caged = buildCaged([{ index: 0, layers: 2 }]);
    const viaBridge = resolveAnchorChain(stateFrom('RR/RR'), [0, 1, 3, 2, 0], caged, NO_ANCHORS);
    const direct = resolveChain(stateFrom('RR/RR'), [0, 1, 3, 2, 0], protectedOf(caged));
    expect(viaBridge).toEqual(direct);
  });

  it('resolveCagedChain still delegates to the same composition (no anchor drift)', () => {
    const caged = buildCaged([{ index: 0, layers: 2 }]);
    const viaCaged = resolveCagedChain(stateFrom('RR/RR'), [0, 1, 3, 2, 0], caged);
    const direct = resolveChain(stateFrom('RR/RR'), [0, 1, 3, 2, 0], protectedOf(caged));
    expect(viaCaged).toEqual(direct);
  });
});
