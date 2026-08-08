import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { DEFAULT_CONFIG } from '../core/config';
import { newGame } from '../core/game';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function GameScreen() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(DEFAULT_CONFIG.rows, DEFAULT_CONFIG.cols, boardSize),
    [boardSize],
  );
  const state = useMemo(() => newGame(DEFAULT_CONFIG, 2026), []);

  return (
    <View style={styles.container}>
      <BoardCanvas board={state.board} layout={layout} />
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
