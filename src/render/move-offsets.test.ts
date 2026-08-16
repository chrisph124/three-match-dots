import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../core/config';
import { resolveChain } from '../core/resolve/resolve-chain';
import { shuffleBoard } from '../core/shuffle';
import { parseBoard } from '../core/test-support/board-fixture';
import type { GameState } from '../core/types';
import { makeLayout, moveOffsetX, moveOffsetY, spawnOffsetY } from './geometry';
import { buildMoveOffsets } from './move-offsets';

// Same board as core/resolve/resolve-chain.test.ts, so this exercises a real
// `Resolution` rather than hand-written falls/spawns:
//  R R G R
//  R R G R
//  G G R R
//  R G R G
const ART = 'RRGR/RRGR/GGRR/RGRG';
const DEADLOCKED_6X6 = 'BBRBRR/GRGGBG/GBBRRG/RRGGBB/GBBRRG/GRGGBG';

const stateFrom = (art: string, seed = 2026): GameState => {
  const { board, rows, cols } = parseBoard(art);
  return { config: { ...DEFAULT_CONFIG, rows, cols }, board, score: 0, rngState: seed };
};

describe('buildMoveOffsets', () => {
  it('leaves untouched cells at offset 0', () => {
    const state = stateFrom(ART);
    const resolution = resolveChain(state, [0, 1, 5, 4, 0]); // square-loop sweep
    expect(resolution).not.toBeNull();
    const layout = makeLayout(4, 4, 40);
    const cellCount = 16;

    const { offsetX, offsetY } = buildMoveOffsets(
      { moves: resolution?.falls, spawns: resolution?.spawns },
      layout,
      cellCount,
    );

    const touched = new Set<number>([
      ...(resolution?.falls.map((f) => f.to) ?? []),
      ...(resolution?.spawns.map((s) => s.to) ?? []),
    ]);
    for (let cell = 0; cell < cellCount; cell++) {
      if (!touched.has(cell)) {
        expect(offsetX[cell]).toBe(0);
        expect(offsetY[cell]).toBe(0);
      }
    }
  });

  it('gives every fall the pixel offset back to where it fell from', () => {
    const state = stateFrom(ART);
    const resolution = resolveChain(state, [0, 1, 5, 4, 0]);
    expect(resolution).not.toBeNull();
    expect(resolution?.falls.length).toBeGreaterThan(0); // sanity: this chain does cause falls
    const layout = makeLayout(4, 4, 40);

    const { offsetX, offsetY } = buildMoveOffsets(
      { moves: resolution?.falls, spawns: resolution?.spawns },
      layout,
      16,
    );

    for (const fall of resolution?.falls ?? []) {
      expect(offsetX[fall.to]).toBe(moveOffsetX(fall.from, fall.to, layout));
      expect(offsetY[fall.to]).toBe(moveOffsetY(fall.from, fall.to, layout));
    }
  });

  it('gives every spawn landing in the same column an identical offset', () => {
    const state = stateFrom(ART);
    const resolution = resolveChain(state, [0, 1, 5, 4, 0]);
    expect(resolution).not.toBeNull();
    expect(resolution?.spawns.length).toBeGreaterThan(0); // sanity: this chain does cause spawns
    const layout = makeLayout(4, 4, 40);
    const cols = 4;

    const { offsetY } = buildMoveOffsets(
      { moves: resolution?.falls, spawns: resolution?.spawns },
      layout,
      16,
    );

    const byColumn = new Map<number, number[]>();
    for (const spawn of resolution?.spawns ?? []) {
      const col = spawn.to % cols;
      const bucket = byColumn.get(col) ?? [];
      bucket.push(offsetY[spawn.to]);
      byColumn.set(col, bucket);
    }
    for (const offsets of byColumn.values()) {
      expect(new Set(offsets).size).toBe(1); // one shared offset per column
    }

    // The contract that makes that true: matches `spawnOffsetY` directly.
    for (const spawn of resolution?.spawns ?? []) {
      expect(offsetY[spawn.to]).toBe(spawnOffsetY(spawn.to, spawn.heightAbove, layout));
    }
  });

  it('covers plain moves (e.g. a shuffle slide), not just falls and spawns', () => {
    const { board, rows, cols } = parseBoard(DEADLOCKED_6X6);
    const result = shuffleBoard(board, { ...DEFAULT_CONFIG, rows, cols }, 2026);
    expect(result.moves.length).toBeGreaterThan(0); // sanity: this fixture is deadlocked
    const layout = makeLayout(rows, cols, 60);
    const cellCount = rows * cols;

    const { offsetX, offsetY } = buildMoveOffsets({ moves: result.moves }, layout, cellCount);

    for (const move of result.moves) {
      expect(offsetX[move.to]).toBe(moveOffsetX(move.from, move.to, layout));
      expect(offsetY[move.to]).toBe(moveOffsetY(move.from, move.to, layout));
    }
    const movedTo = new Set(result.moves.map((m) => m.to));
    for (let cell = 0; cell < cellCount; cell++) {
      if (!movedTo.has(cell)) {
        expect(offsetX[cell]).toBe(0);
        expect(offsetY[cell]).toBe(0);
      }
    }
  });

  it('defaults to all-zero offsets when given neither moves nor spawns', () => {
    const layout = makeLayout(2, 2, 20);
    const { offsetX, offsetY } = buildMoveOffsets({}, layout, 4);
    expect(offsetX).toEqual([0, 0, 0, 0]);
    expect(offsetY).toEqual([0, 0, 0, 0]);
  });
});
