import { Link } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { levelToConfig, parseLevelScript, type LevelScript } from '../core/level/level-script';
import type { ObjectiveProgress } from '../core/journey/objectives';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { useJourneyState } from '../meta/use-journey-state';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { colorFor, DOT_COLORS, SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';
import rawLevel from '../../assets/levels/japan-01.json';

/** Turns remaining milliseconds into a M:SS countdown. `ceil` so the clock
 *  reads 1:00…0:01 and only shows 0:00 exactly when the run is lost. */
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function ObjectiveBadge({ entry }: { entry: ObjectiveProgress }) {
  const { objective, current, target, done } = entry;
  return (
    <View style={styles.objective}>
      {objective.type === 'clearColor' ? (
        <View style={[styles.swatch, { backgroundColor: colorFor(objective.color) }]} />
      ) : (
        <Text style={styles.objectiveLabel}>Cages</Text>
      )}
      <Text style={[styles.objectiveCount, done && styles.objectiveDone]}>
        {current}/{target}
      </Text>
    </View>
  );
}

/**
 * One playable run of a level. Owns the same board/anim/gesture wiring as the
 * Endless screen, but drives it through `useJourneyState` (timer + objectives +
 * cages) instead of `useGameState`. Mounted with a `key` by the route so
 * "Play again" fully resets every hook — including the countdown's interval.
 */
function JourneyRun({ level, onRestart }: { level: LevelScript; onRestart: () => void }) {
  const config = useMemo(() => levelToConfig(level), [level]);
  const cellCount = config.rows * config.cols;

  const { width } = useWindowDimensions();
  const boardSize = Math.min(width - 32, 400);
  const layout = useMemo(
    () => makeLayout(config.rows, config.cols, boardSize),
    [config.rows, config.cols, boardSize],
  );
  const anim = useBoardAnimation(cellCount);
  const chainState = useChainState(new Array<number>(cellCount).fill(0));

  const journey = useJourneyState({ level, layout, anim, chainState });

  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: config.minChain,
    lineLength: config.lineLength,
    onCommit: journey.commit,
  });

  const over = journey.status !== 'playing';

  return (
    <View style={styles.container}>
      <View style={styles.hud}>
        <Text style={styles.timer}>{formatTime(journey.timeRemainingMs)}</Text>
        <View style={styles.objectives}>
          {journey.objectives.map((entry, index) => (
            <ObjectiveBadge key={index} entry={entry} />
          ))}
        </View>
      </View>

      <GestureDetector gesture={gesture}>
        <View>
          <BoardCanvas board={journey.board} layout={layout} anim={anim} chainState={chainState} />
        </View>
      </GestureDetector>

      <Link href="/" style={styles.link}>
        Back
      </Link>

      {over ? (
        <View style={styles.overlay}>
          <Text style={styles.result}>
            {journey.status === 'won' ? 'Level Clear!' : "Time's Up"}
          </Text>
          <Pressable onPress={onRestart} style={styles.button}>
            <Text style={styles.buttonText}>Play again</Text>
          </Pressable>
          <Link href="/" style={styles.overlayLink}>
            Back to title
          </Link>
        </View>
      ) : null}
    </View>
  );
}

export default function JourneyScreen() {
  // The one shipped level, validated against the live palette exactly as the
  // fixture test does. Parsing a fixed asset can only fail if someone ships a
  // broken level; the fixture test guards that before it ever reaches a device.
  // DOT_COLORS.length is the drawable-colour count the parser caps a level at.
  const level = useMemo(() => parseLevelScript(rawLevel, DOT_COLORS.length), []);
  const [runId, setRunId] = useState(0);
  return <JourneyRun key={runId} level={level} onRestart={() => setRunId((n) => n + 1)} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    backgroundColor: SCREEN_BACKGROUND,
  },
  hud: { alignItems: 'center', gap: 8 },
  timer: { fontSize: 40, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  objectives: { flexDirection: 'row', gap: 16 },
  objective: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  objectiveLabel: { fontSize: 14, color: TEXT_COLOR },
  objectiveCount: { fontSize: 18, color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  objectiveDone: { color: '#3ddc84' },
  link: { fontSize: 18, color: TEXT_COLOR },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    backgroundColor: 'rgba(15, 17, 23, 0.88)',
  },
  result: { fontSize: 34, fontWeight: '700', color: TEXT_COLOR },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
    backgroundColor: '#4f8cff',
  },
  buttonText: { fontSize: 18, fontWeight: '600', color: '#0f1117' },
  overlayLink: { fontSize: 16, color: TEXT_COLOR },
});
