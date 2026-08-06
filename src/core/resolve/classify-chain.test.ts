import { describe, expect, it } from 'vitest';
import { classifyChain } from './classify-chain';

const COLS = 6;
const LINE = 5;

describe('classifyChain', () => {
  it('classifies a short chain as plain', () => {
    expect(classifyChain([0, 1, 7], COLS, LINE)).toBe('plain');
  });

  it('classifies a sealed chain as square-loop', () => {
    expect(classifyChain([0, 1, 7, 6, 0], COLS, LINE)).toBe('square-loop');
  });

  it('classifies a straight run of five as line', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS, LINE)).toBe('line');
  });

  it('classifies a diagonal run of five as line', () => {
    expect(classifyChain([0, 7, 14, 21, 28], COLS, LINE)).toBe('line');
  });

  // Guards the reason the closing cell is appended.
  it('classifies four square-shaped cells without a revisit as plain', () => {
    expect(classifyChain([0, 1, 7, 6], COLS, LINE)).toBe('plain');
  });

  it('classifies a bent five-chain as plain', () => {
    expect(classifyChain([12, 13, 14, 15, 21], COLS, LINE)).toBe('plain');
  });

  it('honours a raised line length', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS, 6)).toBe('plain');
  });
});
