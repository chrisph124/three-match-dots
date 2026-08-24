import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { cagedCells, type LevelScript } from '../../core/level/level-script';
import type { Board, CellIndex } from '../../core/types';
import { colorFor } from '../palette';

type BossHpBarProps = {
  readonly level: LevelScript;
  readonly board: Board;
  readonly caged: ReadonlyMap<CellIndex, number>;
  readonly reduceMotion: boolean;
};

type Segment = { readonly color: number; readonly initial: number };

/** Tally caged LAYERS by their dot colour, summing `layers` per `[index, layers]`
 *  pair. A still-caged cell's `board` entry is its colour, so this reads the same
 *  source of truth as the state machine. A `Map` is itself an `Iterable<[k, v]>`,
 *  so the live `caged` map feeds this directly; the mount snapshot passes
 *  `cagedCells` entries (which carry the dealt layer counts). */
function tallyLayersByColor(
  entries: Iterable<readonly [CellIndex, number]>,
  board: Board,
): Map<number, number> {
  const counts = new Map<number, number>();
  for (const [idx, layers] of entries) {
    const color = board[idx];
    counts.set(color, (counts.get(color) ?? 0) + layers);
  }
  return counts;
}

/**
 * The color-grouped boss HP bar: one segment per colour present in the cage
 * cluster, each draining as that colour's cage LAYERS are chipped away. Turns a
 * deep multi-layer cage fight into a legible multi-phase one — a colour with
 * four 3-layer cages reads 12 and ticks down per chip, not per free. Reads live
 * `caged` + `board` (no parallel counter); the per-colour layer totals are
 * snapshotted once at mount so a segment's denominator can't shift as the board
 * settles.
 */
export function BossHpBar({ level, board, caged, reduceMotion }: BossHpBarProps) {
  // Snapshot the initial per-colour layer totals from the dealt board once at
  // mount (a lazy useState initializer runs exactly once). The parent keys the
  // run per level, so a new level remounts this and re-snapshots. Kept out of a
  // ref because reading a ref during render trips the React Compiler lint.
  const [segments] = useState<Segment[]>(() => {
    const initial = tallyLayersByColor(
      cagedCells(level).map((cage) => [cage.index, cage.layers] as const),
      board,
    );
    return [...initial.entries()].map((entry) => ({ color: entry[0], initial: entry[1] }));
  });

  const current = tallyLayersByColor(caged, board);
  const totalInitial = segments.reduce((sum, s) => sum + s.initial, 0) || 1;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Caged Core</Text>
      <View style={styles.track}>
        {segments.map((seg) => {
          const remaining = current.get(seg.color) ?? 0;
          const fillFraction = seg.initial === 0 ? 0 : remaining / seg.initial;
          const hex = colorFor(seg.color);
          return (
            <View key={seg.color} style={[styles.segment, { flex: seg.initial / totalInitial }]}>
              <Animated.View
                layout={reduceMotion ? undefined : LinearTransition.duration(300)}
                style={[styles.fill, { flexBasis: `${fillFraction * 100}%`, backgroundColor: hex }]}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 6, width: '100%' },
  label: { fontSize: 16, fontWeight: '800', color: '#ff8a65', letterSpacing: 2 },
  track: {
    flexDirection: 'row',
    width: '86%',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 2,
  },
  segment: { height: '100%', backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center' },
  fill: { height: '100%', borderRadius: 6 },
});
