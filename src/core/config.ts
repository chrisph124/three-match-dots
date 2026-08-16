import type { GameConfig } from './types';

/**
 * Three colours plus a 3-dot minimum is what makes the board feel dense.
 * lineLength and sweepMultiplier are the tuning dials: with only three
 * colours a straight five is easy to draw, so expect to raise lineLength
 * or lower sweepMultiplier after playing on device.
 */
export const DEFAULT_CONFIG: GameConfig = {
  rows: 6,
  cols: 6,
  colors: 3,
  minChain: 3,
  lineLength: 5,
  baseScore: 10,
  sweepMultiplier: 3,
};
