import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../deadlock';
import { newGame } from '../game';
import { levelToConfig, parseLevelScript, type LevelScript } from '../level/level-script';
import { resolveChain } from '../resolve/resolve-chain';
import { parseBoard } from '../test-support/board-fixture';
import { initObjectives, type Objective } from '../journey/objectives';
import type { Color, GameConfig } from '../types';
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
  caged: Set<number>;
  objectives: Objective[];
  budget: VoyageBudget;
  level: LevelScript;
  rngState?: number;
}): VoyageState {
  return {
    game: { config: opts.config, board: opts.board, score: 0, rngState: opts.rngState ?? 0 },
    level: opts.level,
    budget: opts.budget,
    objectives: initObjectives(opts.objectives, opts.caged.size),
    caged: opts.caged,
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
    expect([...vstate.caged].sort((a, b) => a - b)).toEqual([20, 21, 22]);
    expect(vstate.status).toBe('playing');
    expect(vstate.objectives).toHaveLength(2);
    const freeCaged = vstate.objectives.find((o) => o.objective.type === 'freeCaged');
    expect(freeCaged?.target).toBe(3); // initial cage count
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
      caged: new Set<number>(),
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
      caged: new Set([1]), // a caged cell inside the cleared chain
      objectives: [{ type: 'clearColor', color: 0, count: 3 }, { type: 'freeCaged' }],
      budget: { kind: 'moves', remaining: 1 }, // spends to 0 on this commit
      level: parsedVoyage(MOVES),
    });

    const out = applyVoyageResolution(vstate, resolutionFor(board));

    expect(out.budget).toEqual({ kind: 'moves', remaining: 0 });
    expect(out.caged.size).toBe(0);
    expect(out.status).toBe('won');
  });

  it('loses when the last move is spent with objectives still unmet', () => {
    const board = parseBoard(ART).board;
    const vstate = voyageOf({
      board,
      config: CONFIG_4X4,
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      budget: { kind: 'moves', remaining: 1 },
      level: parsedVoyage(MOVES),
    });
    const ended = applyVoyageResolution(lost, resolutionFor(board)); // → lost
    expect(ended.status).toBe('lost');
    expect(applyVoyageResolution(ended, resolutionFor(board))).toBe(ended);
  });
});

describe('tickVoyage', () => {
  const base = () =>
    voyageOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set<number>(),
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
      caged: new Set([5]),
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
      caged: new Set([5]),
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
