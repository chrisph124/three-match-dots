import type { CellIndex, Color, Resolution } from '../types';

/**
 * Journey objective kinds. `clearColor` counts cleared dots of one colour;
 * `freeCaged` completes when every caged cell has been freed; `clearAnchors`
 * completes when every anchor weight has been removed. `freeCaged` and
 * `clearAnchors` share the same "drain an overlay to empty" shape, differing only
 * in which overlay they read. The `type` discriminator matches the level-script
 * JSON (see docs/level-script-schema.md).
 */
export type Objective =
  | { readonly type: 'clearColor'; readonly color: Color; readonly count: number }
  | { readonly type: 'freeCaged' }
  | { readonly type: 'clearAnchors' };

export type ObjectiveProgress = {
  readonly objective: Objective;
  readonly current: number;
  readonly target: number;
  readonly done: boolean;
};

/**
 * Seeds progress for each objective. `freeCaged`'s target is the initial cage
 * count and `clearAnchors`'s is the initial anchor count, so a level with none of
 * the matching overlay completes that objective immediately (a degenerate case
 * the level parser rejects, but kept honest here). `initialAnchorCount` defaults
 * to 0 so callers that predate anchors stay unchanged; the state layer passes the
 * real anchor-overlay size the same way it passes `initialCagedCount`.
 */
export function initObjectives(
  objectives: readonly Objective[],
  initialCagedCount: number,
  initialAnchorCount = 0,
): ObjectiveProgress[] {
  return objectives.map((objective) => {
    let target = initialCagedCount;
    if (objective.type === 'clearColor') {
      target = objective.count;
    } else if (objective.type === 'clearAnchors') {
      target = initialAnchorCount;
    }
    return { objective, current: 0, target, done: target <= 0 };
  });
}

/**
 * Advances every objective off one resolution. Pure: returns a new array and
 * never mutates the input.
 *
 * - `clearColor` adds the cleared cells of its colour, clamped to target. It
 *   reads ONLY `resolution.cleared`, so a chipped multi-layer cage (which lands
 *   in `resolution.protectedHits`, never `cleared`) does NOT advance it — only an
 *   actual pop counts toward a colour objective.
 * - `freeCaged` is derived from how many cages remain (`target - remaining`),
 *   so it needs the post-chip/post-remap caged overlay for this resolution. The
 *   overlay is a `Map<index, layers>`; only its `.size` (cages still present)
 *   matters here — a cage still counts as unfreed while any layer remains.
 * - `clearAnchors` is the same shape over the anchor overlay (a `Set<index>`):
 *   `target - remaining`, done at zero remaining. `anchorsRemaining` defaults to
 *   an empty set so pre-anchor callers stay unchanged; the state layer passes the
 *   post-removal overlay the same way it passes `cagedRemaining`.
 */
export function foldObjectives(
  progress: readonly ObjectiveProgress[],
  resolution: Resolution,
  cagedRemaining: ReadonlyMap<CellIndex, number>,
  anchorsRemaining: ReadonlySet<CellIndex> = new Set(),
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
    const remaining =
      objective.type === 'clearAnchors' ? anchorsRemaining.size : cagedRemaining.size;
    const current = Math.max(0, target - remaining);
    return { objective, current, target, done: remaining === 0 };
  });
}
