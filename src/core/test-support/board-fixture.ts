import type { Board, Color } from '../types';
import { EMPTY } from '../types';

/** Colour index 0..2 maps to these characters in board art. Matches the palette. */
export const COLOR_CHARS = 'RGB';

/** Parse board art like "RGB/BRG/GBR" into a flat board. "." is an empty cell. */
export function parseBoard(art: string): { board: Color[]; rows: number; cols: number } {
  const lines = art.trim().split('/');
  const cols = lines[0].length;
  const board: Color[] = [];
  for (const line of lines) {
    if (line.length !== cols) {
      throw new Error(`ragged board row: "${line}" (expected ${cols} cells)`);
    }
    for (const char of line) {
      if (char === '.') {
        board.push(EMPTY);
        continue;
      }
      const color = COLOR_CHARS.indexOf(char);
      if (color < 0) {
        throw new Error(`unknown colour character: "${char}"`);
      }
      board.push(color);
    }
  }
  return { board, rows: lines.length, cols };
}

/** Inverse of parseBoard, for readable assertion diffs. */
export function formatBoard(board: Board, cols: number): string {
  const lines: string[] = [];
  for (let row = 0; row * cols < board.length; row++) {
    let line = '';
    for (let col = 0; col < cols; col++) {
      const color = board[row * cols + col];
      line += color === EMPTY ? '.' : COLOR_CHARS[color];
    }
    lines.push(line);
  }
  return lines.join('/');
}
