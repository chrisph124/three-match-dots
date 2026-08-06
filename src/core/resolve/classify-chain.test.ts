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

  it('classifies a chain that traces a square and keeps going as plain', () => {
    // [0,1,7,6] is the 2x2 at rows 0-1, cols 0-1, but the chain continues to 13
    // instead of closing back onto 0 — so formsSquareLoop's equality check is
    // what rejects it, not the length guard.
    expect(classifyChain([0, 1, 7, 6, 13], COLS, LINE)).toBe('plain');
  });

  it('classifies a bent five-chain as plain', () => {
    expect(classifyChain([12, 13, 14, 15, 21], COLS, LINE)).toBe('plain');
  });

  it('honours a raised line length', () => {
    expect(classifyChain([12, 13, 14, 15, 16], COLS, 6)).toBe('plain');
  });
});
