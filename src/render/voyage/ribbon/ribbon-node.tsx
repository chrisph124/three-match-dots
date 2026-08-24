import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { LevelProgress } from '../../../meta/voyage-progress-storage';

export const NODE_SIZE = 76;

type RibbonNodeProps = {
  readonly progress: LevelProgress;
  readonly isBoss: boolean;
  readonly trim: string;
  readonly x: number;
  readonly y: number;
  readonly onPress: (index: number) => void;
};

/** The spoken state suffix for a node's accessibility label. */
function statusLabel(disabled: boolean, cleared: boolean, stars: number): string {
  if (disabled) {
    return ' locked';
  }
  return cleared ? ` cleared ${stars} stars` : ' unlocked';
}

/** Three pips, filled up to `stars` — the earned-medal readout under an index. */
function Stars({ stars }: { stars: number }) {
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.pip, i < stars ? styles.pipOn : styles.pipOff]} />
      ))}
    </View>
  );
}

/**
 * One level node on the ribbon. Absolutely positioned by the virtualizer, so it
 * only exists while on screen. Shows index, lock state, stars, and a boss ring —
 * all from plain views/text (no bespoke art). A locked node is non-interactive.
 */
function RibbonNodeBase({ progress, isBoss, trim, x, y, onPress }: RibbonNodeProps) {
  const { index, stars, cleared, unlocked } = progress;
  const disabled = !unlocked;

  return (
    <Pressable
      disabled={disabled}
      onPress={() => onPress(index)}
      style={[styles.node, { left: x, top: y, width: NODE_SIZE, height: NODE_SIZE }]}
      accessibilityRole="button"
      accessibilityLabel={`Level ${index}${isBoss ? ' boss' : ''}${statusLabel(disabled, cleared, stars)}`}
    >
      <View
        style={[
          styles.disc,
          isBoss && styles.boss,
          cleared && styles.cleared,
          disabled && styles.locked,
          { borderColor: isBoss ? '#ff7043' : trim },
        ]}
      >
        <Text style={[styles.index, disabled && styles.indexLocked]}>
          {disabled ? '🔒' : index}
        </Text>
        {isBoss ? <Text style={styles.bossTag}>BOSS</Text> : null}
      </View>
      {cleared ? <Stars stars={stars} /> : null}
    </Pressable>
  );
}

export const RibbonNode = memo(RibbonNodeBase);

const styles = StyleSheet.create({
  node: { position: 'absolute', alignItems: 'center', justifyContent: 'flex-start' },
  disc: {
    width: NODE_SIZE - 12,
    height: NODE_SIZE - 12,
    borderRadius: (NODE_SIZE - 12) / 2,
    borderWidth: 2,
    backgroundColor: 'rgba(35, 33, 43, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boss: { borderWidth: 3, backgroundColor: 'rgba(58, 26, 26, 0.94)' },
  cleared: { backgroundColor: 'rgba(30, 58, 40, 0.94)' },
  locked: { backgroundColor: 'rgba(28, 28, 34, 0.85)', opacity: 0.75 },
  index: { fontSize: 22, fontWeight: '700', color: '#e8eaf0', fontVariant: ['tabular-nums'] },
  indexLocked: { fontSize: 18 },
  bossTag: { fontSize: 9, fontWeight: '800', color: '#ff8a65', letterSpacing: 1 },
  stars: { flexDirection: 'row', gap: 3, marginTop: 4 },
  pip: { width: 7, height: 7, borderRadius: 4 },
  pipOn: { backgroundColor: '#f0e442' },
  pipOff: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
