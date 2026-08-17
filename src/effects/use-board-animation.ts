import { useMemo } from 'react';
import { runOnJS, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { ClearedCell } from '../core/types';

export const CLEAR_MS = 200;
export const FALL_MS = 220;
export const SHUFFLE_MS = 260;

/** Fraction of the clear timeline spent staggering starts, not shrinking. */
export const STAGGER_SPAN = 0.5;

/** Duration of the pre-clear chase->merge, in ms. Tunable on device. */
export const MERGE_MS = 110;

/** Fraction of the merge timeline spent staggering starts, not travelling. */
export const MERGE_STAGGER = 0.5;

export type BoardAnimation = {
  /** Per-cell pixel offset a dot is drawn at when moveT is 0. */
  readonly offsetX: SharedValue<number[]>;
  readonly offsetY: SharedValue<number[]>;
  /** 0 = dots at their start offsets, 1 = settled. */
  readonly moveT: SharedValue<number>;
  /** Per-cell stagger rank while clearing; -1 means the dot is not clearing. */
  readonly clearRank: SharedValue<number[]>;
  /** How many ranks the current clear spans; never 0. */
  readonly clearSpan: SharedValue<number>;
  /** 0 -> 1 across the whole clear, stagger included. */
  readonly clearT: SharedValue<number>;
  /** Per-cell stagger rank while merging; -1 means the dot is not merging. */
  readonly mergeRank: SharedValue<number[]>;
  /** Per-cell target cell whose static centre a merging dot chases; -1 = stay. */
  readonly mergeTarget: SharedValue<number[]>;
  /** Chain length the merge stagger normalises against; never 0. */
  readonly mergeSpan: SharedValue<number>;
  /** 0 -> 1 across the whole merge, stagger included. */
  readonly mergeT: SharedValue<number>;
  /** Colour id to emphasise while a sweep is armed; -1 means none. */
  readonly highlight: SharedValue<number>;
};

export function useBoardAnimation(cellCount: number): BoardAnimation {
  const offsetX = useSharedValue<number[]>(new Array(cellCount).fill(0));
  const offsetY = useSharedValue<number[]>(new Array(cellCount).fill(0));
  const moveT = useSharedValue(1);
  const clearRank = useSharedValue<number[]>(new Array(cellCount).fill(-1));
  const clearSpan = useSharedValue(1);
  const clearT = useSharedValue(0);
  const mergeRank = useSharedValue<number[]>(new Array(cellCount).fill(-1));
  const mergeTarget = useSharedValue<number[]>(new Array(cellCount).fill(-1));
  const mergeSpan = useSharedValue(1);
  const mergeT = useSharedValue(0);
  const highlight = useSharedValue(-1);

  // Every shared value above keeps the same identity across re-renders of
  // this hook — that is Reanimated's whole point. Wrapping them in a memoised
  // object (rather than a fresh literal every render) lets every downstream
  // useCallback/useMemo that depends on `anim` actually memoise, instead of
  // rebuilding on every render for no reason. An empty dependency array is
  // correct because none of these values ever change identity.
  return useMemo(
    () => ({
      offsetX,
      offsetY,
      moveT,
      clearRank,
      clearSpan,
      clearT,
      mergeRank,
      mergeTarget,
      mergeSpan,
      mergeT,
      highlight,
    }),
    [],
  );
}

/**
 * Shrinks the cleared dots away, staggered along the order `Resolution`
 * guarantees: chain cells in drag order, then sweep cells row-major.
 */
export function playClear(
  anim: BoardAnimation,
  cleared: readonly ClearedCell[],
  onDone: () => void,
): void {
  const ranks = new Array<number>(anim.clearRank.value.length).fill(-1);
  cleared.forEach((cell, rank) => {
    ranks[cell.index] = rank;
  });
  anim.clearRank.value = ranks;
  anim.clearSpan.value = Math.max(cleared.length, 1);
  anim.clearT.value = 0;
  // `onDone` fires unconditionally, not just when `finished === true`. A
  // platform event (app backgrounding, a dropped frame callback, low memory)
  // can interrupt this tween outside any path this codebase controls, and
  // guarding on `finished` left `isResolving` locked forever when that
  // happened — a permanently dead board with no in-screen recovery. Nothing
  // here can double-invoke `onDone`: the next write to `clearT` happens only
  // inside `resetClear`, which only ever runs from `applyAndDrop`, which is
  // itself only reachable from this very callback — so at most one tween
  // targeting `clearT` is ever in flight.
  anim.clearT.value = withTiming(1, { duration: CLEAR_MS }, () => {
    'worklet';
    runOnJS(onDone)();
  });
}

/** Clears the pop state so every dot draws at full size again. */
export function resetClear(anim: BoardAnimation): void {
  anim.clearRank.value = new Array<number>(anim.clearRank.value.length).fill(-1);
  anim.clearSpan.value = 1;
  anim.clearT.value = 0;
}

/**
 * Chases the linked dots into their collapse point before the pop. Each chain
 * dot travels toward the next chain dot's static centre, staggered first->last;
 * on a sweep (>=5 line / 2x2 loop) the extra cleared dots that were never in
 * the drawn chain all rush toward the terminal cell (`chain[len-1]`) too.
 *
 * A cell's chain membership is read straight off its assigned rank: chain cells
 * get rank `0..len-1` in the loop below, so any cleared cell still at `-1`
 * afterwards is a sweep extra. That doubles as the allocation-lean membership
 * test — no Set/`includes` — matching `playClear`'s per-commit allocate style
 * (the no-per-frame-alloc rule governs the worklet hot path, not this once-per-
 * commit JS function). A sealed 2x2 loop repeats its closing cell as
 * `chain[len-1]`; iterating in order lets the last assignment win, leaving that
 * cell as a `-1` target (the anchor everyone else collapses onto).
 */
export function playMerge(
  anim: BoardAnimation,
  chain: readonly number[],
  cleared: readonly ClearedCell[],
  onDone: () => void,
): void {
  const len = chain.length;
  const rank = new Array<number>(anim.mergeRank.value.length).fill(-1);
  const target = new Array<number>(anim.mergeTarget.value.length).fill(-1);
  for (let i = 0; i < len; i += 1) {
    rank[chain[i]] = i;
    target[chain[i]] = i < len - 1 ? chain[i + 1] : -1;
  }
  const terminal = chain[len - 1];
  cleared.forEach((cell) => {
    if (rank[cell.index] < 0) {
      rank[cell.index] = len;
      target[cell.index] = terminal;
    }
  });
  anim.mergeRank.value = rank;
  anim.mergeTarget.value = target;
  anim.mergeSpan.value = Math.max(len, 1);
  anim.mergeT.value = 0;
  // Same single-tween-in-flight guarantee as `playClear`/`playMove`: the
  // gesture's `isResolving` lock blocks a second commit until this whole chain
  // unlocks, and the next write to `mergeT` is `resetMerge`, reachable only from
  // `applyAndDrop` — itself only reachable from the `playClear` this `onDone`
  // triggers. So at most one tween targeting `mergeT` is ever in flight and
  // `onDone` cannot double-fire.
  anim.mergeT.value = withTiming(1, { duration: MERGE_MS }, () => {
    'worklet';
    runOnJS(onDone)();
  });
}

/** Clears the merge state so every dot draws at its own cell centre again. */
export function resetMerge(anim: BoardAnimation): void {
  anim.mergeRank.value = new Array<number>(anim.mergeRank.value.length).fill(-1);
  anim.mergeTarget.value = new Array<number>(anim.mergeTarget.value.length).fill(-1);
  anim.mergeSpan.value = 1;
  anim.mergeT.value = 0;
}

/**
 * Places every dot at its start offset, then slides them all home together.
 * Offsets are set before moveT so a dot never renders at its destination for
 * a frame first.
 */
export function playMove(
  anim: BoardAnimation,
  offsetX: number[],
  offsetY: number[],
  duration: number,
  onDone: () => void,
): void {
  anim.offsetX.value = offsetX;
  anim.offsetY.value = offsetY;
  anim.moveT.value = 0;
  // Same unconditional-fire reasoning as `playClear`: the next write to
  // `moveT` (another `playMove` call, from `applyAndDrop` or `settle`) is
  // only reachable from inside this very callback, so only one tween
  // targeting `moveT` is ever in flight and `onDone` cannot double-fire.
  anim.moveT.value = withTiming(1, { duration }, () => {
    'worklet';
    runOnJS(onDone)();
  });
}
