import { describe, expect, it } from 'vitest';
import { hasLegalMove } from '../deadlock';
import { newGame } from '../game';
import {
  anchorCells,
  levelToConfig,
  parseLevelScript,
  type LevelScript,
} from '../level/level-script';
import { protectedOf } from '../obstacles/caged-dot';
import { resolveAnchorChain } from '../resolve-anchor-chain';
import { resolveChain } from '../resolve/resolve-chain';
import { parseBoard } from '../test-support/board-fixture';
import type { CellIndex, Color, GameConfig, Resolution } from '../types';
import { initObjectives, type Objective } from './objectives';
import {
  applyJourneyResolution,
  newJourney,
  registerMistake,
  settleJourney,
  tick,
  type JourneyState,
} from './journey-state';

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

/** A minimal valid journey level; the board fields are irrelevant to the
 *  timer-only functions (tick/mistake/apply/settle) that read `level.timer`. */
function parsedLevel(timer: {
  startMs: number;
  mistakePenaltyMs: number;
  clearBonusMs: number;
}): LevelScript {
  return parseLevelScript(
    {
      schemaVersion: 1,
      id: 'test-01',
      chapter: { country: 'Test', order: 1 },
      city: { name: 'T', isCapital: false },
      order: 1,
      board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
      mode: 'journey',
      timer,
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
    },
    PALETTE,
  );
}

/** Hand-builds a playing JourneyState around an arbitrary board (bypasses the
 *  seeded deal so tests can pin an exact board/cage layout). */
function journeyOf(opts: {
  board: Color[];
  config: GameConfig;
  caged: Map<number, number>;
  anchors?: Set<CellIndex>;
  objectives: Objective[];
  timeRemainingMs: number;
  level: LevelScript;
  rngState?: number;
}): JourneyState {
  const anchors = opts.anchors ?? new Set<CellIndex>();
  return {
    game: { config: opts.config, board: opts.board, score: 0, rngState: opts.rngState ?? 0 },
    level: opts.level,
    timeRemainingMs: opts.timeRemainingMs,
    objectives: initObjectives(opts.objectives, opts.caged.size, anchors.size),
    caged: opts.caged,
    anchors,
    status: 'playing',
  };
}

describe('newJourney', () => {
  const level = parseLevelScript(
    {
      schemaVersion: 1,
      id: 'japan-test',
      chapter: { country: 'Japan', order: 1 },
      city: { name: 'Kyoto', isCapital: false },
      order: 1,
      board: { cols: 6, rows: 6, colors: 5, minChain: 3 },
      seed: 20260806,
      mode: 'journey',
      timer: { startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 0 },
      objectives: [
        { type: 'clearColor', color: 0, count: 20 },
        { type: 'freeCaged', count: 3 },
      ],
      obstacles: [
        { type: 'cagedDot', cell: { col: 2, row: 3 } },
        { type: 'cagedDot', cell: { col: 3, row: 3 } },
        { type: 'cagedDot', cell: { col: 4, row: 3 } },
      ],
    },
    PALETTE,
  );

  it('deals the board from level.seed when authored (not the session seed)', () => {
    const jstate = newJourney(level, 999);
    const deterministic = newGame(levelToConfig(level), 20260806);
    expect(jstate.game.board).toEqual(deterministic.board);
  });

  it('falls back to the session seed when the level omits one', () => {
    const noSeed = parseLevelScript(
      {
        schemaVersion: 1,
        id: 'no-seed',
        chapter: { country: 'Test', order: 1 },
        city: { name: 'T', isCapital: false },
        order: 1,
        board: { cols: 6, rows: 6, colors: 3, minChain: 3 },
        mode: 'journey',
        timer: { startMs: 30000, mistakePenaltyMs: 1000, clearBonusMs: 0 },
        objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      },
      PALETTE,
    );
    const jstate = newJourney(noSeed, 4242);
    expect(jstate.game.board).toEqual(newGame(levelToConfig(noSeed), 4242).board);
  });

  it('seeds time, cages, objectives and status from the level', () => {
    const jstate = newJourney(level, 999);
    expect(jstate.timeRemainingMs).toBe(60000);
    expect([...jstate.caged.keys()].sort((a, b) => a - b)).toEqual([20, 21, 22]);
    expect(jstate.status).toBe('playing');
    expect(jstate.objectives).toHaveLength(2);
    const freeCaged = jstate.objectives.find((o) => o.objective.type === 'freeCaged');
    expect(freeCaged?.target).toBe(3); // initial cage count
  });
});

describe('newJourney — anchors', () => {
  const level = parseLevelScript(
    {
      schemaVersion: 3,
      id: 'anchor-test',
      chapter: { country: 'Japan', order: 1 },
      city: { name: 'Osaka', isCapital: false },
      order: 1,
      board: { cols: 6, rows: 6, colors: 5, minChain: 3 },
      seed: 20260806,
      mode: 'journey',
      timer: { startMs: 60000, mistakePenaltyMs: 2000, clearBonusMs: 0 },
      objectives: [{ type: 'clearAnchors' }],
      obstacles: [
        { type: 'anchor', cell: { col: 2, row: 3 } }, // → index 20
        { type: 'anchor', cell: { col: 3, row: 3 } }, // → index 21
      ],
    },
    PALETTE,
  );

  it('seeds the anchor overlay and the clearAnchors target from the level', () => {
    const jstate = newJourney(level, 999);
    expect([...jstate.anchors].sort((a, b) => a - b)).toEqual([20, 21]);
    expect([...jstate.anchors].sort((a, b) => a - b)).toEqual(
      [...anchorCells(level)].sort((a, b) => a - b),
    );
    const clearAnchors = jstate.objectives.find((o) => o.objective.type === 'clearAnchors');
    expect(clearAnchors?.target).toBe(2); // initial anchor count
    expect(clearAnchors?.done).toBe(false);
  });
});

describe('tick', () => {
  const level = parsedLevel({ startMs: 5000, mistakePenaltyMs: 2000, clearBonusMs: 0 });
  const base = () =>
    journeyOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      timeRemainingMs: 5000,
      level,
    });

  it('decrements remaining time by the elapsed delta', () => {
    expect(tick(base(), 1000).timeRemainingMs).toBe(4000);
  });

  it('clamps a negative delta to zero elapsed (never adds time)', () => {
    expect(tick(base(), -500).timeRemainingMs).toBe(5000);
  });

  it('floors time at zero and flips to lost', () => {
    const done = tick(base(), 6000);
    expect(done.timeRemainingMs).toBe(0);
    expect(done.status).toBe('lost');
  });

  it('is a no-op once the run has ended', () => {
    const lost = tick(base(), 6000);
    expect(tick(lost, 1000)).toBe(lost);
  });
});

describe('registerMistake', () => {
  const level = parsedLevel({ startMs: 5000, mistakePenaltyMs: 2000, clearBonusMs: 0 });
  const base = (timeRemainingMs: number) =>
    journeyOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      timeRemainingMs,
      level,
    });

  it('subtracts the level penalty from remaining time', () => {
    expect(registerMistake(base(5000)).timeRemainingMs).toBe(3000);
  });

  it('never drops below zero, flipping to lost at the floor', () => {
    const out = registerMistake(base(1000));
    expect(out.timeRemainingMs).toBe(0);
    expect(out.status).toBe('lost');
  });

  it('is a no-op once the run has ended', () => {
    const lost = registerMistake(base(1000));
    expect(registerMistake(lost)).toBe(lost);
  });
});

describe('applyJourneyResolution', () => {
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

  it('folds score, advances the color objective, frees a cleared cage, and wins', () => {
    const board = parseBoard(ART).board;
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: new Map([[1, 1]]), // a caged cell inside the cleared chain
      objectives: [{ type: 'clearColor', color: 0, count: 3 }, { type: 'freeCaged' }],
      timeRemainingMs: 10000,
      level: parsedLevel({ startMs: 10000, mistakePenaltyMs: 2000, clearBonusMs: 0 }),
    });

    const out = applyJourneyResolution(jstate, resolutionFor(board));

    expect(out.game.score).toBeGreaterThan(0);
    const color = out.objectives.find((o) => o.objective.type === 'clearColor');
    expect(color?.current).toBe(3);
    expect(color?.done).toBe(true);
    expect(out.caged.size).toBe(0); // the caged cell was cleared → freed
    expect(out.status).toBe('won');
  });

  it('chips a 2-layer cage first (dot survives), pops it on the second clear (freeCaged wins)', () => {
    const board = parseBoard(ART).board;
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: new Map([[1, 2]]), // a 2-layer cage inside the RRR chain
      objectives: [{ type: 'freeCaged' }],
      timeRemainingMs: 10000,
      level: parsedLevel({ startMs: 10000, mistakePenaltyMs: 2000, clearBonusMs: 0 }),
    });

    // First clear: chain [0,1,2] with index 1 protected → 0 and 2 clear, 1 is a
    // protectedHit that chips its cage 2 → 1 and keeps its dot on the board.
    const chip = resolveChain(jstate.game, [0, 1, 2], protectedOf(jstate.caged));
    if (chip === null) {
      throw new Error('chip chain must resolve');
    }
    const afterChip = applyJourneyResolution(jstate, chip);
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
    const afterPop = applyJourneyResolution(afterChip, pop);
    expect(afterPop.caged.size).toBe(0);
    expect(afterPop.status).toBe('won');
  });

  it('stays playing while any objective is unmet', () => {
    const board = parseBoard(ART).board;
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: new Map([[15, 1]]), // a cage NOT in the cleared chain
      objectives: [{ type: 'clearColor', color: 0, count: 20 }, { type: 'freeCaged' }],
      timeRemainingMs: 10000,
      level: parsedLevel({ startMs: 10000, mistakePenaltyMs: 2000, clearBonusMs: 0 }),
    });

    const out = applyJourneyResolution(jstate, resolutionFor(board));

    expect(out.caged.has(15)).toBe(true); // untouched cage survives
    expect(out.status).toBe('playing');
  });

  it('adds clearBonusMs once per commit, not per cleared dot', () => {
    const board = parseBoard(ART).board;
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: new Map<number, number>(),
      objectives: [{ type: 'clearColor', color: 0, count: 20 }],
      timeRemainingMs: 10000,
      level: parsedLevel({ startMs: 10000, mistakePenaltyMs: 2000, clearBonusMs: 500 }),
    });

    const out = applyJourneyResolution(jstate, resolutionFor(board));
    // 3 dots cleared, but the bonus is per accepted resolution: +500, not +1500.
    expect(out.timeRemainingMs).toBe(10500);
  });
});

describe('applyJourneyResolution — anchors', () => {
  const ART = 'RRRB/BGBG/GBGB/BGBG'; // top RRR (0,1,2) is a legal 3-chain of colour 0
  const NO_CAGES = new Map<CellIndex, number>();
  const anchorLevel = () =>
    parsedLevel({ startMs: 10000, mistakePenaltyMs: 2000, clearBonusMs: 0 });

  it('removes an anchor cleared by adjacency (via expandedCleared) and advances clearAnchors', () => {
    const board = parseBoard(ART).board;
    // Anchor 4 (row 1, col 0) is 8-adjacent to the RRR chain; anchor 15 is far away.
    const anchors = new Set<CellIndex>([4, 15]);
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      timeRemainingMs: 10000,
      level: anchorLevel(),
      rngState: 7,
    });

    const resolution = resolveAnchorChain(jstate.game, [0, 1, 2], NO_CAGES, anchors);
    if (resolution === null) throw new Error('fixture chain must resolve');
    expect(resolution.expandedCleared).toEqual([4]); // sanity: the seam removed anchor 4

    const out = applyJourneyResolution(jstate, resolution);
    expect([...out.anchors]).toEqual([15]); // 4 removed, 15 survives
    const clearAnchors = out.objectives.find((o) => o.objective.type === 'clearAnchors');
    expect(clearAnchors?.current).toBe(1); // one of two removed
    expect(clearAnchors?.done).toBe(false);
    expect(out.status).toBe('playing');
  });

  it('wins when the last anchor is removed', () => {
    const board = parseBoard(ART).board;
    const anchors = new Set<CellIndex>([4]);
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      timeRemainingMs: 10000,
      level: anchorLevel(),
      rngState: 7,
    });

    const resolution = resolveAnchorChain(jstate.game, [0, 1, 2], NO_CAGES, anchors);
    if (resolution === null) throw new Error('fixture chain must resolve');
    const out = applyJourneyResolution(jstate, resolution);
    expect(out.anchors.size).toBe(0);
    expect(out.status).toBe('won');
  });

  it('remaps a surviving anchor through gravity falls (consumes falls, not adjacency)', () => {
    const board = parseBoard(ART).board;
    const anchors = new Set<CellIndex>([4, 8]);
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearAnchors' }],
      timeRemainingMs: 10000,
      level: anchorLevel(),
      rngState: 7,
    });

    // Hand-built resolution: anchor 4 removed (echoed), survivor 8 falls to 12.
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
      board: jstate.game.board,
      rngState: 7,
      expandedCleared: [4],
    };

    const out = applyJourneyResolution(jstate, resolution);
    expect([...out.anchors].sort((a, b) => a - b)).toEqual([12]); // 4 removed, 8 → 12
  });

  it('does not let an anchor removal advance a clearColor objective', () => {
    const board = parseBoard(ART).board;
    const anchors = new Set<CellIndex>([4]);
    const jstate = journeyOf({
      board,
      config: CONFIG_4X4,
      caged: NO_CAGES,
      anchors,
      objectives: [{ type: 'clearColor', color: 0, count: 20 }, { type: 'clearAnchors' }],
      timeRemainingMs: 10000,
      level: anchorLevel(),
      rngState: 7,
    });

    const resolution = resolveAnchorChain(jstate.game, [0, 1, 2], NO_CAGES, anchors);
    if (resolution === null) throw new Error('fixture chain must resolve');
    const out = applyJourneyResolution(jstate, resolution);
    const color = out.objectives.find((o) => o.objective.type === 'clearColor');
    // 3 R cleared → colour count 3; the removed anchor contributes nothing.
    expect(color?.current).toBe(3);
  });
});

describe('settleJourney', () => {
  const level = parsedLevel({ startMs: 5000, mistakePenaltyMs: 2000, clearBonusMs: 0 });

  it('reshuffles a deadlocked board and keeps the cage overlay intact', () => {
    const parsed = parseBoard('BGGR/RRBR/BGBG/RGRR'); // proven deadlock at minChain 3
    expect(hasLegalMove(parsed.board, 4, 4, 3)).toBe(false);

    const jstate = journeyOf({
      board: parsed.board,
      config: CONFIG_4X4,
      caged: new Map([[5, 1]]),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      timeRemainingMs: 5000,
      level,
      rngState: 12345,
    });

    const out = settleJourney(jstate);
    expect(hasLegalMove(out.jstate.game.board, 4, 4, 3)).toBe(true);
    expect(out.jstate.caged.size).toBe(1); // exactly one cage survives, remapped
    expect(out.jstate.status).toBe('playing');
    expect(out.moves.length).toBeGreaterThan(0); // slides for the renderer
  });

  it('leaves a board that already has a legal move untouched', () => {
    const jstate = journeyOf({
      board: parseBoard('RRRB/BGBG/GBGB/BGBG').board,
      config: CONFIG_4X4,
      caged: new Map([[5, 1]]),
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      timeRemainingMs: 5000,
      level,
      rngState: 12345,
    });

    const out = settleJourney(jstate);
    expect(out.jstate).toBe(jstate);
    expect(out.moves).toEqual([]);
  });
});

describe('settleJourney — anchors', () => {
  const level = parsedLevel({ startMs: 5000, mistakePenaltyMs: 2000, clearBonusMs: 0 });

  it('keeps the anchor overlay in place across a reshuffle (not remapped)', () => {
    const parsed = parseBoard('BGGR/RRBR/BGBG/RGRR'); // proven deadlock at minChain 3
    const anchors = new Set<CellIndex>([5, 10]);
    // Anchors only remove moves, so a board deadlocked bare is deadlocked here too.
    expect(hasLegalMove(parsed.board, 4, 4, 3, anchors)).toBe(false);

    const jstate = journeyOf({
      board: parsed.board,
      config: CONFIG_4X4,
      caged: new Map<CellIndex, number>(),
      anchors,
      objectives: [{ type: 'clearColor', color: 0, count: 5 }],
      timeRemainingMs: 5000,
      level,
      rngState: 12345,
    });

    const out = settleJourney(jstate);
    // The reshuffled board is anchor-aware legal...
    expect(hasLegalMove(out.jstate.game.board, 4, 4, 3, out.jstate.anchors)).toBe(true);
    // ...and the anchor overlay is carried through untouched (same reference, in place).
    expect(out.jstate.anchors).toBe(jstate.anchors);
  });
});
