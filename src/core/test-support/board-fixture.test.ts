import { describe, expect, it } from 'vitest';
import { formatBoard, parseBoard } from './board-fixture';

describe('parseBoard', () => {
  it('parses dimensions and colours', () => {
    const { board, rows, cols } = parseBoard('RGB/BRG');
    expect(rows).toBe(2);
    expect(cols).toBe(3);
    expect(board).toEqual([0, 1, 2, 2, 0, 1]);
  });

  it('parses "." as empty', () => {
    expect(parseBoard('R./.G').board).toEqual([0, -1, -1, 1]);
  });

  it('throws on a ragged board', () => {
    expect(() => parseBoard('RGB/RG')).toThrow(/ragged/);
  });

  it('throws on an unknown colour character', () => {
    expect(() => parseBoard('RGX')).toThrow(/unknown colour/);
  });
});

describe('formatBoard', () => {
  it('round-trips with parseBoard', () => {
    const art = 'RGBR/BRGB/GBRG';
    const { board, cols } = parseBoard(art);
    expect(formatBoard(board, cols)).toBe(art);
  });

  it('renders empty cells as "."', () => {
    expect(formatBoard([0, -1, -1, 1], 2)).toBe('R./.G');
  });
});
