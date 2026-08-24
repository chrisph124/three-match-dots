import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { constraintOf, levelToConfig, type LevelScript } from '../core/level/level-script';
import type { VoyageBudget } from '../core/voyage/voyage-state';
import { useBoardAnimation } from '../effects/use-board-animation';
import { useBoardGesture, useChainState } from '../input/use-board-gesture';
import { useVoyageState } from '../meta/use-voyage-state';
import { SLICE_LADDER_LENGTH, voyageLevelAt } from '../meta/voyage-ladder';
import { recordLevelResult } from '../meta/voyage-progress-storage';
import { BoardCanvas } from '../render/board-canvas';
import { makeLayout } from '../render/geometry';
import { DOT_COLORS, SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';
import { BackdropCanvas } from '../render/voyage/backdrop-canvas';
import { themeToScene } from '../render/voyage/biomes';
import { BoardPanel } from '../render/voyage/board-panel';
import { bossSignals } from '../render/voyage/boss-modifier';
import { useReduceMotion, useVoyageEffects } from '../render/voyage/voyage-effects';
import { VoyageEffectsLayer } from '../render/voyage/voyage-effects-layer';
import { fireCageJuice, fireClearJuice } from '../render/voyage/voyage-juice';
import { VoyageHud } from '../render/voyage/voyage-hud';

/** Reads the ladder index from the route param, clamped into the slice range. */
function readIndex(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? '1', 10);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  return Math.min(SLICE_LADDER_LENGTH, Math.max(1, parsed));
}

/**
 * Stars for a win, from how much of the budget survived: ≥50% left = 3, ≥20% = 2,
 * else 1. Expressed in the level's own constraint metric (time / moves / mistakes)
 * so a fast clear and a frugal one both read as mastery. A win is always ≥1 star.
 */
function starsForWin(level: LevelScript, budget: VoyageBudget): number {
  const constraint = constraintOf(level);
  let fraction = 0;
  if (budget.kind === 'timed' && constraint.type === 'timed') {
    fraction = budget.remainingMs / constraint.startMs;
  } else if (budget.kind === 'moves' && constraint.type === 'moves') {
    fraction = budget.remaining / constraint.budget;
  } else if (budget.kind === 'mistakes' && constraint.type === 'mistakes') {
    fraction = budget.remaining / constraint.cap;
  }
  if (fraction >= 0.5) {
    return 3;
  }
  return fraction >= 0.2 ? 2 : 1;
}

/**
 * One playable Voyage run. Same board/anim/gesture wiring as Journey, but on a
 * diorama backdrop with the constraint-aware HUD, boss signals, and pooled juice.
 * The board Canvas stays origin-(0,0) inside a board-sized view, so the panel
 * around it and the effects overlay on top can't perturb the gesture hit-test.
 * Mounted with a `key` so "Retry" resets every hook (including the countdown).
 */
function VoyageRun({
  index,
  level,
  onRestart,
}: {
  index: number;
  level: LevelScript;
  onRestart: () => void;
}) {
  const router = useRouter();
  const config = useMemo(() => levelToConfig(level), [level]);
  const cellCount = config.rows * config.cols;

  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width - 72, 360);
  const layout = useMemo(
    () => makeLayout(config.rows, config.cols, boardSize),
    [config.rows, config.cols, boardSize],
  );
  const anim = useBoardAnimation(cellCount);
  const chainState = useChainState(new Array<number>(cellCount).fill(0));

  const voyage = useVoyageState({ level, layout, anim, chainState });
  const gesture = useBoardGesture({
    state: chainState,
    anim,
    layout,
    minChain: config.minChain,
    lineLength: config.lineLength,
    onCommit: voyage.commit,
  });

  const scene = useMemo(() => themeToScene(level.theme), [level]);
  const signals = useMemo(() => bossSignals(level), [level]);
  const fx = useVoyageEffects();
  const reduceMotion = useReduceMotion();

  // Clear → shards/ripple. Guarded by the event's seq so it fires once per clear.
  const lastSeq = useRef(0);
  useEffect(() => {
    const ev = voyage.event;
    if (!ev || ev.seq === lastSeq.current) {
      return;
    }
    lastSeq.current = ev.seq;
    fireClearJuice(fx, ev.cleared, ev.sweep, layout, reduceMotion);
  }, [voyage.event, fx, layout, reduceMotion]);

  // Cage-set shrink → seal-thud (see fireCageJuice for the no-spurious-fire gate).
  const prevCaged = useRef(voyage.caged);
  useEffect(() => {
    const prev = prevCaged.current;
    const next = voyage.caged;
    if (next !== prev) {
      fireCageJuice(fx, prev, next, layout, reduceMotion);
      prevCaged.current = next;
    }
  }, [voyage.caged, fx, layout, reduceMotion]);

  const won = voyage.status === 'won';
  const over = voyage.status !== 'playing';
  const stars = won ? starsForWin(level, voyage.budget) : 0;

  // Persist the medal once when the run is won (stars ratchet up in storage).
  const recorded = useRef(false);
  useEffect(() => {
    if (won && !recorded.current) {
      recorded.current = true;
      recordLevelResult(index, starsForWin(level, voyage.budget));
    }
  }, [won, index, level, voyage.budget]);

  const hasNext = won && index < SLICE_LADDER_LENGTH;

  // Pop back to the ladder instead of pushing a second one — in a near-infinite
  // mode, pushing would stack mounted game screens (each with a live frame clock
  // and countdown). Falls back to replace when deep-linked with no ladder below.
  const goToLadder = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/voyage');
    }
  };

  return (
    <View style={styles.container}>
      <BackdropCanvas scene={scene} width={width} height={height} />

      <VoyageHud
        budget={voyage.budget}
        objectives={voyage.objectives}
        signals={signals}
        level={level}
        board={voyage.board}
        caged={voyage.caged}
        reduceMotion={reduceMotion}
      />

      <BoardPanel trim={scene.trim}>
        <GestureDetector gesture={gesture}>
          <View style={{ width: boardSize, height: boardSize }}>
            <BoardCanvas board={voyage.board} layout={layout} anim={anim} chainState={chainState} />
            <VoyageEffectsLayer fx={fx} width={boardSize} height={boardSize} />
          </View>
        </GestureDetector>
      </BoardPanel>

      <Pressable onPress={goToLadder}>
        <Text style={styles.link}>Back</Text>
      </Pressable>

      {over ? (
        <View style={styles.overlay}>
          <Text style={styles.result}>{won ? 'Level Clear!' : 'Out of Budget'}</Text>
          {won ? <Text style={styles.stars}>{'★'.repeat(stars)}</Text> : null}
          <View style={styles.actions}>
            {hasNext ? (
              <Link
                href={{ pathname: '/voyage-game', params: { index: String(index + 1) } }}
                replace
                style={styles.button}
              >
                Next
              </Link>
            ) : null}
            <Pressable onPress={onRestart} style={styles.button}>
              <Text style={styles.buttonText}>Retry</Text>
            </Pressable>
          </View>
          <Pressable onPress={goToLadder}>
            <Text style={styles.overlayLink}>Ladder</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

export default function VoyageGameScreen() {
  const params = useLocalSearchParams<{ index?: string }>();
  const index = readIndex(params.index);
  const level = useMemo(() => voyageLevelAt(index, DOT_COLORS.length), [index]);
  const [runId, setRunId] = useState(0);

  if (!level) {
    return (
      <View style={styles.container}>
        <Text style={styles.result}>No such level</Text>
        <Link href="/voyage" style={styles.link}>
          Back to ladder
        </Link>
      </View>
    );
  }

  return (
    <VoyageRun
      key={`${index}-${runId}`}
      index={index}
      level={level}
      onRestart={() => setRunId((n) => n + 1)}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 22,
    backgroundColor: SCREEN_BACKGROUND,
  },
  link: { fontSize: 18, color: TEXT_COLOR },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    backgroundColor: 'rgba(10, 12, 20, 0.9)',
  },
  result: { fontSize: 34, fontWeight: '700', color: TEXT_COLOR },
  stars: { fontSize: 30, color: '#f0e442', letterSpacing: 4 },
  actions: { flexDirection: 'row', gap: 14 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 12,
    backgroundColor: '#4f8cff',
    color: '#0f1117',
    fontSize: 18,
    fontWeight: '600',
    overflow: 'hidden',
  },
  buttonText: { fontSize: 18, fontWeight: '600', color: '#0f1117' },
  overlayLink: { fontSize: 16, color: TEXT_COLOR },
});
