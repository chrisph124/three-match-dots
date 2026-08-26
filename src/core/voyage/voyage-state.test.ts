import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../deadlock';
import { newGame } from '../game';
import {
  anchorCells,
  levelToConfig,
  parseLevelScript,
  type LevelScript,
} from '../level/level-script';
import { buildAnchors } from '../obstacles/anchor';
import { protectedOf } from '../obstacles/caged-dot';
import { resolveAnchorChain } from '../resolve-anchor-chain';
import { resolveChain } from '../resolve/resolve-chain';
import { parseBoard } from '../test-support/board-fixture';
import { initObjectives, type Objective } from '../journey/objectives';
import type { CellIndex, Color, GameConfig, Resolution } from '../types';
import {
  applyVoyageResolution,
  newVoyage,
  registerVoyageMistake,
  settleVoyage,
  tickVoyage,
  type VoyageBudget,
  type VoyageState,
} from './voyage-state';

const PALETTE = 6;

const CONFIG_4X4: GameConfig = {
  rows: 4,
  cols: 4,
  colors: 3,
  minChain: 3,
  lineLength: 5,
  baseScore: 10,
  sweepMultiplier: 3,
};

/**
 * A minimal valid voyage level carrying the given constraint. The board fields
 * are irrelevant to the budget functions (tick/mistake/apply/settle) that read
 * `constraintOf(level)`; overrides let a test add a seed, cages, or objectives.
 */
function parsedVoyage(
  constraint: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): LevelScript {
  return parseLevelScript(
    {
      schemaVersion: 2,
      id: 'voyage-001-test',
      order: 1,
      board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
      mode: 'voyage',
      constraint,
      voyage: { index: 1, episode: 1, isBoss: false },
      theme: {
        biome: 'harbor',
        variant: 'dawn',
        particle: 'spray',
        trim: 'brass',
        parallaxSeed: 1,
        boss: false,
      },
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      ...overrides,
    },
    PALETTE,
  );
}

const MOVES = { type: 'moves', budget: 25 };
const TIMED = { type: 'timed', startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 500 };
const MISTAKES = { type: 'mistakes', cap: 3 };

/**
 * Hand-builds a playing VoyageState around an arbitrary board and budget
 * (bypasses the seeded deal so tests pin an exact board/cage/budget layout).
 */
function voyageOf(opts: {
  board: Color[];
  config: GameConfig;
  caged: Map<number, number>;
  anchors?: Set<CellIndex>;
  objectives: Objective[];
  budget: VoyageBudget;
  level: LevelScript;
  rngState?: number;
}): VoyageState {
  const anchors = opts.anchors ?? new Set<CellIndex>();
  return {
    game: { config: opts.config, board: opts.board, score: 0, rngState: opts.rngState ?? 0 },
    level: opts.level,
    budget: opts.budget,
    objectives: initObjectives(opts.objectives, opts.caged.size, anchors.size),
    caged: opts.caged,
    anchors,
    status: 'playing',
  };
}

describe('newVoyage', () => {
  it('seeds a moves budget from the constraint', () => {
    const vstate = newVoyage(parsedVoyage(MOVES), 1);
    expect(vstate.budget).toEqual({ kind: 'moves', remaining: 25 });
  });

  it('seeds a timed budget from the constraint', () => {
    const vstate = newVoyage(parsedVoyage(TIMED), 1);
    expect(vstate.budget).toEqual({ kind: 'timed', remainingMs: 60000 });
  });

  it('seeds a mistakes budget from the constraint', () => {
    const vstate = newVoyage(parsedVoyage(MISTAKES), 1);
    expect(vstate.budget).toEqual({ kind: 'mistakes', remaining: 3 });
  });

  it('deals the board from level.seed when authored (not the session seed)', () => {
    const level = parsedVoyage(MOVES, { seed: 20260824 });
    const vstate = newVoyage(level, 999);
    expect(vstate.game.board).toEqual(newGame(levelToConfig(level), 20260824).board);
  });

  it('falls back to the session seed when the level omits one', () => {
    const level = parsedVoyage(MOVES);
    const vstate = newVoyage(level, 4242);
    expect(vstate.game.board).toEqual(newGame(levelToConfig(level), 4242).board);
  });

  it('seeds cages, objectives and status from the level', () => {
    const level = parsedVoyage(MOVES, {
      objectives: [{ type: 'clearColor', color: 0, count: 20 }, { type: 'freeCaged' }],
      obstacles: [
        { type: 'cagedDot', cell: { col: 2, row: 3 } },
        { type: 'cagedDot', cell: { col: 3, row: 3 } },
        { type: 'cagedDot', cell: { col: 4, row: 3 } },
      ],
    });
    const vstate = newVoyage(level, 999);
    expect([...vstate.caged.keys()].sort((a, b) => a - b)).toEqual([20, 21, 22]);
    expect(vstate.status).toBe('playing');
    expect(vstate.objectives).toHaveLength(2);
    const freeCaged = vstate.objectives.find((o) => o.objective.type === 'freeCaged');
    expect(freeCaged?.target).toBe(3); // initial cage count
  });
});

describe('newVoyage — anchors', () => {
  it('seeds the anchor overlay and the clearAnchors target from the level', () => {
    const level = parsedVoyage(MOVES, {
      objectives: [{ type: 'clearAnchors' }],
      obstacles: [
        { type: 'anchor', cell: { col: 2, row: 3 } }, // → index 20
        { type: 'anchor', cell: { col: 3, row: 3 } }, // → index 21
      ],
    });
    const vstate = newVoyage(level, 999);
    expect([...vstate.anchors].sort((a, b) => a - b)).toEqual([20, 21]);
    expect([...vstate.anchors].sort((a, b) => a - b)).toEqual(
      [...anchorCells(level)].sort((a, b) => a - b),
    );
    const clearAnchors = vstate.objectives.find((o) => o.objective.type === 'clearAnchors');
    expect(clearAnchors?.target).toBe(2); // initial anchor count
    expect(clearAnchors?.done).toBe(false);
  });
});

describe('applyVoyageResolution', () => {
  // Top row RRR (indices 0,1,2) is a legal 3-chain of colour 0.
  const ART = 'RRRB/BGBG/GBGB/BGBG';

  function resolutionFor(board: Color[]) {
    const state = { config: CONFIG_4X4, board, score: 0, rngState: 7 };
    const resolution = resolveChain(state, [0, 1, 2]);
    if (resolution === null) {
      throw new Error('fixture chain must resolve');
    }
    return resolution;
  }

  it('spends one move per committed clear and stays playing while budget remains', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      budget: { kind: 'moves', remaining: 5 },
      level: parsedVoyage(MOVES),
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));

    expect(out.budget).toEqual({ kind: 'moves', remaining: 4 });
    expect(out.game.score).toBeGreaterThan(0);
    expect(out.status).toBe('playing');
  });

  it('wins before it loses: a final move that meets objectives AND empties the budget is a win', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map([[1, 1]]), // a caged cell inside the cleared chain
      objectives: [{ type: 'clearColor', color: 0, count: 3 }, { type: 'freeCaged' }],
      budget: { kind: 'moves', remaining: 1 }, // spends to 0 on this commit
      level: parsedVoyage(MOVES),
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));

    expect(out.budget).toEqual({ kind: 'moves', remaining: 0 });
    expect(out.caged.size).toBe(0);
    expect(out.status).toBe('won');
  });

  it('chips a 2-layer cage first (dot survives), pops it on the second clear (freeCaged wins)', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map([[1, 2]]), // a 2-layer cage inside the RRR chain
      objectives: [{ type: 'freeCaged' }],
      budget: { kind: 'moves', remaining: 5 },
      level: parsedVoyage(MOVES),
    });

    // First clear: chain [0,1,2] with index 1 protected → 0 and 2 clear, 1 is a
    // protectedHit that chips its cage 2 → 1 and keeps its dot on the board.
    const chip = resolveChain(vstate.game, [0, 1, 2], protectedOf(vstate.caged));
    if (chip === null) {
      throw new Error('chip chain must resolve');
    }
    const afterChip = applyVoyageResolution(vstate, chip);
    expect(afterChip.caged.get(1)).toBe(1); // 2 → 1, still caged
    expect(afterChip.game.board[1]).toBe(0); // the caged dot survives in place
    expect(afterChip.objectives.find((o) => o.objective.type === 'freeCaged')?.done).toBe(false);
    expect(afterChip.status).toBe('playing');

    // Second clear pops the now-1-layer cage (a 1-layer cage is never protected):
    // a synthetic resolution that clears index 1. Its last layer gone, freeCaged
    // completes → win.
    const pop: Resolution = {
      kind: 'plain',
      color: 0,
      cleared: [{ index: 1, color: 0, reason: 'chain' }],
      falls: [],
      spawns: [],
      scoreDelta: 10,
      board: afterChip.game.board,
      rngState: afterChip.game.rngState,
    };
    const afterPop = applyVoyageResolution(afterChip, pop);
    expect(afterPop.caged.size).toBe(0);
    expect(afterPop.status).toBe('won');
  });

  it('loses when the last move is spent with objectives still unmet', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }], // unmet after clearing 3
      budget: { kind: 'moves', remaining: 1 },
      level: parsedVoyage(MOVES),
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));

    expect(out.budget).toEqual({ kind: 'moves', remaining: 0 });
    expect(out.status).toBe('lost');
  });

  it('adds clearBonusMs once per commit for a timed budget, not per cleared dot', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      budget: { kind: 'timed', remainingMs: 10000 },
      level: parsedVoyage(TIMED), // clearBonusMs 500
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));
    // 3 dots cleared, but the bonus is per accepted resolution: +500, not +1500.
    expect(out.budget).toEqual({ kind: 'timed', remainingMs: 10500 });
    expect(out.status).toBe('playing');
  });

  it('leaves a mistakes budget untouched on a clear', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      budget: { kind: 'mistakes', remaining: 3 },
      level: parsedVoyage(MISTAKES),
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));

    expect(out.budget).toEqual({ kind: 'mistakes', remaining: 3 });
    expect(out.status).toBe('playing');
  });

  it('is a no-op once the run has ended', () => {
    const board = parseBoard(ART).board;
    const lost = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      budget: { kind: 'moves', remaining: 1 },
      level: parsedVoyage(MOVES),
    });
    const ended = applyVoyageResolution(lost, resolutionFor(board)); // → lost
    expect(ended.status).toBe('lost');
    expect(applyVoyageResolution(ended, resolutionFor(board))).toBe(ended);
  });
});

describe('applyVoyageResolution — anchors', () => {
  const ART = 'RRRB/BGBG/GBGB/BGBG'; // top RRR (0,1,2) is a legal 3-chain of colour 0
  const NO_CAGES = new Map<CellIndex, number>();

  it('removes an anchor cleared by adjacency and advances clearAnchors', () => {
    const board = parseBoard(ART).board;
    const anchors = new Set<CellIndex>([4, 15]); // 4 is adjacent to the chain, 15 is not
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      budget: { kind: 'moves', remaining: 5 },
      level: parsedVoyage(MOVES),
    });

    const resolution = resolveAnchorChain(vstate.game, [0, 1, 2], NO_CAGES, anchors);
    if (resolution === null) throw new Error('fixture chain must resolve');
    expect(resolution.expandedCleared).toEqual([4]);

    const out = applyVoyageResolution(vstate, resolution);
    expect([...out.anchors]).toEqual([15]); // 4 removed, 15 survives
    const clearAnchors = out.objectives.find((o) => o.objective.type === 'clearAnchors');
    expect(clearAnchors?.current).toBe(1);
    expect(clearAnchors?.done).toBe(false);
    expect(out.status).toBe('playing');
  });

  it('wins when the last anchor is removed', () => {
    const board = parseBoard(ART).board;
    const anchors = buildAnchors([4]);
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      budget: { kind: 'moves', remaining: 5 },
      level: parsedVoyage(MOVES),
    });

    const resolution = resolveAnchorChain(vstate.game, [0, 1, 2], NO_CAGES, anchors);
    if (resolution === null) throw new Error('fixture chain must resolve');
    const out = applyVoyageResolution(vstate, resolution);
    expect(out.anchors.size).toBe(0);
    expect(out.status).toBe('won');
  });

  it('remaps a surviving anchor through gravity falls (consumes falls, not adjacency)', () => {
    const board = parseBoard(ART).board;
    const anchors = new Set<CellIndex>([4, 8]);
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      budget: { kind: 'moves', remaining: 5 },
      level: parsedVoyage(MOVES),
    });

    const resolution: Resolution = {
      kind: 'plain',
      color: 0,
      cleared: [
        { index: 0, color: 0, reason: 'chain' },
        { index: 1, color: 0, reason: 'chain' },
        { index: 2, color: 0, reason: 'chain' },
      ],
      falls: [{ from: 8, to: 12 }],
      spawns: [],
      scoreDelta: 10,
      board: vstate.game.board,
      rngState: 7,
      expandedCleared: [4],
    };

    const out = applyVoyageResolution(vstate, resolution);
    expect([...out.anchors].sort((a, b) => a - b)).toEqual([12]); // 4 removed, 8 → 12
  });
});

describe('tickVoyage', () => {
  const base = () =>
    voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'timed', remainingMs: 5000 },
      level: parsedVoyage(TIMED),
    });

  it('decrements a timed budget by the elapsed delta', () => {
    expect(tickVoyage(base(), 1000).budget).toEqual({ kind: 'timed', remainingMs: 4000 });
  });

  it('clamps a negative delta to zero elapsed (never adds time)', () => {
    expect(tickVoyage(base(), -500).budget).toEqual({ kind: 'timed', remainingMs: 5000 });
  });

  it('floors time at zero and flips to lost', () => {
    const done = tickVoyage(base(), 6000);
    expect(done.budget).toEqual({ kind: 'timed', remainingMs: 0 });
    expect(done.status).toBe('lost');
  });

  it('is a no-op for a moves budget', () => {
    const moves = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'moves', remaining: 10 },
      level: parsedVoyage(MOVES),
    });
    expect(tickVoyage(moves, 1000)).toBe(moves);
  });

  it('is a no-op once the run has ended', () => {
    const lost = tickVoyage(base(), 6000);
    expect(tickVoyage(lost, 1000)).toBe(lost);
  });
});

describe('registerVoyageMistake', () => {
  it('does not spend a move on a wasted attempt (moves budget)', () => {
    const moves = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'moves', remaining: 10 },
      level: parsedVoyage(MOVES),
    });
    expect(registerVoyageMistake(moves)).toBe(moves);
  });

  it('subtracts the mistake penalty from a timed budget', () => {
    const timed = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'timed', remainingMs: 5000 },
      level: parsedVoyage(TIMED), // mistakePenaltyMs 2000
    });
    expect(registerVoyageMistake(timed).budget).toEqual({ kind: 'timed', remainingMs: 3000 });
  });

  it('floors a timed budget at zero and flips to lost', () => {
    const timed = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'timed', remainingMs: 1000 },
      level: parsedVoyage(TIMED),
    });
    const out = registerVoyageMistake(timed);
    expect(out.budget).toEqual({ kind: 'timed', remainingMs: 0 });
    expect(out.status).toBe('lost');
  });

  it('spends one of the mistakes cap, losing at zero', () => {
    const mistakes = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'mistakes', remaining: 1 },
      level: parsedVoyage(MISTAKES),
    });
    const out = registerVoyageMistake(mistakes);
    expect(out.budget).toEqual({ kind: 'mistakes', remaining: 0 });
    expect(out.status).toBe('lost');
  });

  it('is a no-op once the run has ended', () => {
    const mistakes = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'mistakes', remaining: 1 },
      level: parsedVoyage(MISTAKES),
    });
    const lost = registerVoyageMistake(mistakes);
    expect(registerVoyageMistake(lost)).toBe(lost);
  });
});

describe('settleVoyage', () => {
  it('reshuffles a deadlocked board and keeps the cage overlay intact', () => {
    const parsed = parseBoard('BGGR/RRBR/BGBG/RGRR'); // proven deadlock at minChain 3
    expect(hasLegalMove(parsed.board, 4, 4, 3)).toBe(false);

    const vstate = voyageOf({
      board: parsed.board,
      config: CONFIG_4X4,
      caged: new Map([[5, 1]]),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'moves', remaining: 10 },
      level: parsedVoyage(MOVES),
      rngState: 12345,
    });

    const out = settleVoyage(vstate);
    expect(hasLegalMove(out.vstate.game.board, 4, 4, 3)).toBe(true);
    expect(out.vstate.caged.size).toBe(1); // exactly one cage survives, remapped
    expect(out.vstate.status).toBe('playing');
    expect(out.moves.length).toBeGreaterThan(0); // slides for the renderer
  });

  it('leaves a board that already has a legal move untouched', () => {
    const vstate = voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map([[5, 1]]),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'moves', remaining: 10 },
      level: parsedVoyage(MOVES),
      rngState: 12345,
    });

    const out = settleVoyage(vstate);
    expect(out.vstate).toBe(vstate);
    expect(out.moves).toEqual([]);
  });
});

describe('settleVoyage — anchors', () => {
  it('keeps the anchor overlay in place across a reshuffle (not remapped)', () => {
    const parsed = parseBoard('BGGR/RRBR/BGBG/RGRR'); // proven deadlock at minChain 3
    const anchors = new Set<CellIndex>([5, 10]);
    expect(hasLegalMove(parsed.board, 4, 4, 3, anchors)).toBe(false);

    const vstate = voyageOf({
      board: parsed.board,
      config: CONFIG_4X4,
      caged: new Map<CellIndex, number>(),
      anchors,
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      budget: { kind: 'moves', remaining: 10 },
      level: parsedVoyage(MOVES),
      rngState: 12345,
    });

    const out = settleVoyage(vstate);
    expect(hasLegalMove(out.vstate.game.board, 4, 4, 3, out.vstate.anchors)).toBe(true);
    expect(out.vstate.anchors).toBe(vstate.anchors); // same reference — preserved in place
  });
});
