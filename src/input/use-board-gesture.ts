import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { canAppend } from '../core/hot/can-append';
import { formsSquareLoop } from '../core/hot/closes-square';
import { isCollinearRun } from '../core/hot/is-line';
import type { BoardAnimation } from '../effects/use-board-animation';
import { cellAtPoint, type BoardLayout } from '../render/geometry';

export type ChainState = {
  /** The live chain of cell indices. Owned by the gesture worklet. */
  readonly chain: SharedValue<number[]>;
  /** Current finger position, or {x: -1, y: -1} when not touching. */
  readonly finger: SharedValue<{ x: number; y: number }>;
  /** Mirror of the committed board, so the worklet can validate appends. */
  readonly board: SharedValue<number[]>;
  /** 1 while a commit is animating; the gesture ignores touches then. */
  readonly isResolving: SharedValue<number>;
  /** Colour id of the live chain, or -1 when there is no chain. */
  readonly linkColor: SharedValue<number>;
};

export function useChainState(initialBoard: readonly number[]): ChainState {
  const chain = useSharedValue<number[]>([]);
  const finger = useSharedValue({ x: -1, y: -1 });
  const board = useSharedValue<number[]>([...initialBoard]);
  const isResolving = useSharedValue(0);
  const linkColor = useSharedValue(-1);

  // Same reasoning as `useBoardAnimation`: each shared value keeps its
  // identity across renders, so memoising the object they are bundled into
  // (rather than returning a fresh literal every render) lets everything
  // downstream that depends on this hook's return value actually memoise.
  return useMemo(() => ({ chain, finger, board, isResolving, linkColor }), []);
}

type GestureOptions = {
  readonly state: ChainState;
  readonly anim: BoardAnimation;
  readonly layout: BoardLayout;
  readonly minChain: number;
  readonly lineLength: number;
  readonly onCommit: (chain: number[]) => void;
};

/**
 * Builds the actual `Gesture.Pan()`. Deliberately a plain function, not a
 * hook: `react-hooks/immutability` (the React Compiler lint rule bundled
 * with eslint-config-expo) forbids a hook's own callbacks from writing to
 * values derived from that hook's parameters, which is exactly what every
 * Reanimated shared-value assignment below does. Reanimated's whole API is
 * built on mutating `.value` outside React's render cycle, so that rule does
 * not apply here — moving the gesture out of the hook body sidesteps it
 * without disabling anything.
 */
function buildPanGesture({ state, anim, layout, minChain, lineLength, onCommit }: GestureOptions) {
  const { chain, finger, board, isResolving, linkColor } = state;

  return Gesture.Pan()
    .minDistance(0)
    .maxPointers(1)
    .onStart((event) => {
      'worklet';
      if (isResolving.value === 1) {
        return;
      }
      finger.value = { x: event.x, y: event.y };
      const cell = cellAtPoint(event.x, event.y, layout);
      chain.value = cell >= 0 ? [cell] : [];
      linkColor.value = cell >= 0 ? board.value[cell] : -1;
    })
    .onUpdate((event) => {
      'worklet';
      if (isResolving.value === 1) {
        return;
      }
      finger.value = { x: event.x, y: event.y };
      const cell = cellAtPoint(event.x, event.y, layout);
      if (cell < 0) {
        return;
      }
      const verdict = canAppend(chain.value, cell, board.value, layout.cols);
      if (verdict === 'append' || verdict === 'close-square') {
        chain.value = [...chain.value, cell];
      } else if (verdict === 'undo') {
        chain.value = chain.value.slice(0, -1);
      } else {
        return;
      }

      const live = chain.value;
      linkColor.value = live.length > 0 ? board.value[live[0]] : -1;
      const armed =
        formsSquareLoop(live, layout.cols) || isCollinearRun(live, layout.cols, lineLength);
      anim.highlight.value = armed ? linkColor.value : -1;
    })
    .onEnd(() => {
      'worklet';
      const committed = chain.value;
      if (isResolving.value === 0 && committed.length >= minChain) {
        isResolving.value = 1;
        runOnJS(onCommit)(committed);
      }
    })
    .onFinalize(() => {
      'worklet';
      chain.value = [];
      finger.value = { x: -1, y: -1 };
      linkColor.value = -1;
      anim.highlight.value = -1;
    });
}

/**
 * Everything the returned gesture does runs on the UI thread. The only
 * bridge crossing is the single runOnJS on release, so touch-frequency work
 * never leaves the worklet.
 *
 * Reassigning `chain.value` allocates a new array per accepted step. That is
 * unavoidable — Reanimated only observes assignment, not mutation — but it
 * happens once per linked dot, not once per frame.
 */
export function useBoardGesture(options: GestureOptions) {
  const { state, anim, layout, minChain, lineLength, onCommit } = options;

  // `state` is now a memoised, identity-stable object (see `useChainState`),
  // so depending on it alone is sufficient — no need to also depend on its
  // individual shared values just to keep this memo honest.
  return useMemo(
    () => buildPanGesture({ state, anim, layout, minChain, lineLength, onCommit }),
    [state, anim, layout, minChain, lineLength, onCommit],
  );
}
