import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { DEFAULT_CONFIG } from '../core/config';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useReduceMotion } from '../effects/use-reduce-motion';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { readScore, writeScore } from '../meta/score-storage';
import { useGameState } from '../meta/use-game-state';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

const CELL_COUNT = DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols;

export default function GameScreen() {
  const { width } = useWindowDimensions();
  // Rendered like Journey: the board is a centered square floated on the plain
  // dark SCREEN_BACKGROUND, sized to the screen width and capped so it stays a
  // comfortable touch size on large screens. No backdrop and no inset panel — the
  // canvas is sized exactly to the board, so the layout origin stays (0,0).
  const boardSize = Math.min(width - 32, 400);

  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const anim = useBoardAnimation(CELL_COUNT);
  const chainState = useChainState(new Array<number>(CELL_COUNT).fill(0));
  const initialScore = useMemo(() => readScore(), []);
  const reduceMotion = useReduceMotion();
  const game = useGameState({
    layout,
    anim,
    chainState,
    initialScore,
    onScoreChange: writeScore,
    reduceMotion,
  });

  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: DEFAULT_CONFIG.minChain,
    lineLength: DEFAULT_CONFIG.lineLength,
    onCommit: game.commit,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.score}>{game.score}</Text>
      <GestureDetector gesture={gesture}>
        {/* Keep this View style-less so it auto-sizes to the Canvas and the
            gesture's event.x/y stay in canvas-pixel space. With the layout origin
            at (0,0) the canvas and board share one space; padding or centering
            this wrapper would silently reintroduce a hit offset that Vitest cannot
            catch (geometry.ts is pure; the wrapper is native). */}
        <View>
          <BoardCanvas board={game.board} layout={layout} anim={anim} chainState={chainState} />
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
  score: { fontSize: 40, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  link: { fontSize: 18, color: TEXT_COLOR },
});
