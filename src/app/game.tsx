import { Link } from 'expo-router';
import { useMemo } from 'react';
import { GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { readScore, writeScore } from '../meta/score-storage';
import { useGameState } from '../meta/use-game-state';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

const CELL_COUNT = DEFAULT_CONFIG.rows * DEFAULT_CONFIG.cols;

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const anim = useBoardAnimation(CELL_COUNT);
  const chainState = useChainState(new Array<number>(CELL_COUNT).fill(0));
  const initialScore = useMemo(() => readScore(), []);
  const game = useGameState({
    layout,
    anim,
    chainState,
    initialScore,
    onScoreChange: writeScore,
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
