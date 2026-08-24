import { StyleSheet, Text, View } from 'react-native';
import type { ObjectiveProgress } from '../../core/journey/objectives';
import type { LevelScript } from '../../core/level/level-script';
import type { Board, CellIndex } from '../../core/types';
import type { VoyageBudget } from '../../core/voyage/voyage-state';
import { colorFor, TEXT_COLOR } from '../palette';
import type { BossSignals } from './boss-modifier';
import { BossHpBar } from './voyage-boss-hpbar';

type VoyageHudProps = {
  readonly budget: VoyageBudget;
  readonly objectives: readonly ObjectiveProgress[];
  readonly signals: BossSignals;
  readonly level: LevelScript;
  readonly board: Board;
  readonly caged: ReadonlyMap<CellIndex, number>;
  readonly reduceMotion: boolean;
};

/** M:SS from remaining ms; `ceil` so the clock hits 0:00 only at a real loss. */
function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
}

/** The one budget readout, switched on the constraint the level plays under. */
function BudgetReadout({ budget, emphasis }: { budget: VoyageBudget; emphasis: boolean }) {
  if (budget.kind === 'timed') {
    return (
      <Text style={[styles.metric, emphasis && styles.emphasis]}>
        {formatTime(budget.remainingMs)}
      </Text>
    );
  }
  const value = budget.remaining;
  const noun = budget.kind === 'moves' ? 'moves' : 'mistakes';
  return (
    <Text style={[styles.metric, emphasis && styles.emphasis]}>
      {value} <Text style={styles.metricNoun}>{noun}</Text>
    </Text>
  );
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
 * The Voyage HUD: constraint-aware budget (moves / seconds / mistakes) plus the
 * objective progress. On a boss it swaps the plain objective row for the
 * color-grouped HP bar (Phase 8) and emphasizes the budget — the same non-art
 * signal set `bossSignals` describes.
 */
export function VoyageHud({
  budget,
  objectives,
  signals,
  level,
  board,
  caged,
  reduceMotion,
}: VoyageHudProps) {
  return (
    <View style={styles.hud}>
      <BudgetReadout budget={budget} emphasis={signals.contrastEmphasis} />
      {signals.hpBar ? (
        <BossHpBar level={level} board={board} caged={caged} reduceMotion={reduceMotion} />
      ) : (
        <View style={styles.objectives}>
          {objectives.map((entry, index) => (
            <ObjectiveBadge key={index} entry={entry} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hud: { alignItems: 'center', gap: 10, width: '100%' },
  metric: { fontSize: 36, fontWeight: '700', color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  emphasis: { color: '#ffffff', textShadowColor: 'rgba(255,138,101,0.6)', textShadowRadius: 8 },
  metricNoun: { fontSize: 18, fontWeight: '500', color: 'rgba(232,234,240,0.7)' },
  objectives: { flexDirection: 'row', gap: 16 },
  objective: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  objectiveLabel: { fontSize: 14, color: TEXT_COLOR },
  objectiveCount: { fontSize: 18, color: TEXT_COLOR, fontVariant: ['tabular-nums'] },
  objectiveDone: { color: '#3ddc84' },
});
