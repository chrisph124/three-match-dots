import { Link } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { ENDLESS_CONFIG } from '../core/config';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useReduceMotion } from '../effects/use-reduce-motion';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { readScore, writeScore } from '../meta/score-storage';
import { useGameState } from '../meta/use-game-state';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { fontSize, labelTracking, radius, space, ui } from '../render/ui-theme';

const CELL_COUNT = ENDLESS_CONFIG.rows * ENDLESS_CONFIG.cols;

export default function GameScreen() {
  const { width } = useWindowDimensions();
  // Rendered like Journey: the board is a centered square floated on the plain
  // dark ground (ui.night, the shipped board background), sized to the screen
  // width and capped so it stays a comfortable touch size on large screens. No
  // backdrop and no inset panel — the
  // canvas is sized exactly to the board, so the layout origin stays (0,0).
  const boardSize = Math.min(width - 32, 400);

  const layout = useMemo(
    () => makeLayout(ENDLESS_CONFIG.rows, ENDLESS_CONFIG.cols, boardSize),
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
    minChain: ENDLESS_CONFIG.minChain,
    lineLength: ENDLESS_CONFIG.lineLength,
    onCommit: game.commit,
  });

  return (
    <View style={styles.container}>
      <View style={styles.chip}>
        <Text style={styles.chipLabel}>SCORE</Text>
        <Text style={styles.chipValue}>{game.score}</Text>
      </View>
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
      <Link href="/" style={styles.back}>
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
    gap: space.xl,
    backgroundColor: ui.night,
  },
  // Vellum paper chip: a warm plate behind the score, floated over the dark board.
  chip: {
    alignItems: 'center',
    minWidth: 128,
    paddingHorizontal: space.xl,
    paddingTop: 9,
    paddingBottom: space.sm,
    backgroundColor: ui.paper,
    borderWidth: 1,
    borderColor: ui.paperEdge,
    borderRadius: radius.md,
    shadowColor: ui.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  chipLabel: {
    fontSize: fontSize.label,
    letterSpacing: labelTracking,
    color: ui.inkSoft,
    fontWeight: '600',
  },
  chipValue: {
    fontSize: fontSize.hudScore,
    fontWeight: '800',
    color: ui.ink,
    fontVariant: ['tabular-nums'],
  },
  back: {
    fontSize: fontSize.link,
    color: ui.nightInk,
    paddingVertical: space.sm,
    paddingHorizontal: space.xl,
  },
});
