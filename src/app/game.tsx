import { Link } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { newGame } from '../core/game';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState, type ChainState } from '../input/use-board-gesture';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

/**
 * Placeholder release handler — task 19 replaces this with the real commit
 * pipeline. Kept as a plain function (not inline in the component body)
 * because `react-hooks/immutability` forbids a component from writing to a
 * shared value returned by one of its own hooks; the write is legitimate
 * Reanimated usage, so it moves outside the component instead of being
 * suppressed.
 */
function logAndClearResolving(chainState: ChainState, chain: number[]): void {
  console.log('committed', chain.length, 'dots');
  chainState.isResolving.value = 0;
}

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const state = useMemo(() => newGame(DEFAULT_CONFIG, 2026), []);
  const anim = useBoardAnimation(DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols);
  const chainState = useChainState(state.board);

  // Task 19 replaces this with the real commit pipeline.
  const onCommit = useCallback(
    (chain: number[]) => logAndClearResolving(chainState, chain),
    [chainState],
  );

  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: DEFAULT_CONFIG.minChain,
    lineLength: DEFAULT_CONFIG.lineLength,
    onCommit,
  });

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <View>
          <BoardCanvas board={state.board} layout={layout} anim={anim} chainState={chainState} />
        </View>
      </GestureDetector>
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  link: { fontSize: 18, color: TEXT_COLOR },
});
