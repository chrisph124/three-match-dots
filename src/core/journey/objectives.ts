import type { CellIndex, Color, Resolution } from '../types';

/**
 * Journey objective kinds. `clearColor` counts cleared dots of one colour;
 * `freeCaged` completes when every caged cell has been freed. The `type`
 * discriminator matches the level-script JSON (see docs/level-script-schema.md).
 */
export type Objective =
  | { readonly type: 'clearColor'; readonly color: Color; readonly count: number }
  | { readonly type: 'freeCaged' };

export type ObjectiveProgress = {
  readonly objective: Objective;
  readonly current: number;
  readonly target: number;
  readonly done: boolean;
};

/**
 * Seeds progress for each objective. `freeCaged`'s target is the initial cage
 * count, so a level with no cages completes it immediately (a degenerate case
 * the level parser rejects, but kept honest here).
 */
export function initObjectives(
  objectives: readonly Objective[],
  initialCagedCount: number,
): ObjectiveProgress[] {
  return objectives.map((objective) => {
    const target = objective.type === 'clearColor' ? objective.count : initialCagedCount;
    return { objective, current: 0, target, done: target <= 0 };
  });
}

/**
 * Advances every objective off one resolution. Pure: returns a new array and
 * never mutates the input.
 *
 * - `clearColor` adds the cleared cells of its colour, clamped to target.
 * - `freeCaged` is derived from how many cages remain (`target - remaining`),
 *   so it needs the post-free/post-remap caged set for this resolution.
 */
export function foldObjectives(
  progress: readonly ObjectiveProgress[],
  resolution: Resolution,
  cagedRemaining: ReadonlySet<CellIndex>,
): ObjectiveProgress[] {
  return progress.map((entry) => {
    const { objective, target } = entry;
    if (objective.type === 'clearColor') {
      const freshlyCleared = resolution.cleared.reduce(
        (sum, cell) => (cell.color === objective.color ? sum + 1 : sum),
        0,
      );
      const current = Math.min(target, entry.current + freshlyCleared);
      return { objective, current, target, done: current >= target };
    }
    const current = Math.max(0, target - cagedRemaining.size);
    return { objective, current, target, done: cagedRemaining.size === 0 };
  });
}
