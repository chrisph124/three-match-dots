import type { ChainKind, GameConfig } from '../types';

/**
 * A plain chain of n dots scores on the triangular curve, so each extra dot
 * is worth more than the last. A sweep scores per dot removed board-wide,
 * multiplied. `clearedCount` is always the deduplicated cleared-cell count,
 * which for a plain chain is exactly its distinct length.
 *
 * The two curves—triangular (quadratic) and linear sweep—intersect at
 * clearedCount = 5. Below 5, a sweep is more rewarding; above 5, a long
 * plain chain is. This is an intentional balance point. When adjusting
 * `sweepMultiplier` in GameConfig, note that this crossover will shift.
 */
export function scoreFor(kind: ChainKind, clearedCount: number, config: GameConfig): number {
  if (kind === 'plain') {
    return (config.baseScore * (clearedCount * (clearedCount + 1))) / 2;
  }
  return config.baseScore * clearedCount * config.sweepMultiplier;
}
