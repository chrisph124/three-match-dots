import { Link, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SLICE_LADDER_LENGTH, voyageLadder } from '../meta/voyage-ladder';
import { loadLadderProgress, type LevelProgress } from '../meta/voyage-progress-storage';
import { DOT_COLORS, SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';
import { BackdropCanvas } from '../render/voyage/backdrop-canvas';
import { themeToScene } from '../render/voyage/biomes';
import { Ribbon } from '../render/voyage/ribbon/ribbon';

/**
 * The Voyage map: a diorama backdrop behind the virtualized level ribbon. Reads
 * packed progress (stars + derived unlock) on focus so a level cleared in a run
 * shows its medal the moment you return. Tapping an unlocked node routes into the
 * game screen with the level index; locked nodes are inert (handled in the node).
 *
 * On mount it warms the ladder cache AFTER first paint, so the first tap into a
 * level doesn't pay the whole-ladder generation cost inline.
 */
export default function VoyageMapScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [progress, setProgress] = useState<LevelProgress[]>(() =>
    loadLadderProgress(SLICE_LADDER_LENGTH),
  );
  useFocusEffect(
    useCallback(() => {
      setProgress(loadLadderProgress(SLICE_LADDER_LENGTH));
    }, []),
  );

  // Warm the (expensive, one-time) ladder generation after the map is on screen.
  useEffect(() => {
    voyageLadder(DOT_COLORS.length);
  }, []);

  // The menu backdrop: the neutral fallback scene (no level theme yet).
  const scene = useMemo(() => themeToScene(undefined), []);

  return (
    <View style={styles.container}>
      <BackdropCanvas scene={scene} width={width} height={height} />
      <View style={styles.header}>
        <Text style={styles.title}>Voyage</Text>
        <Link href="/" style={styles.back}>
          Back
        </Link>
      </View>
      <Ribbon
        count={SLICE_LADDER_LENGTH}
        progress={progress}
        trim={scene.trim}
        onSelect={(index) =>
          router.push({ pathname: '/voyage-game', params: { index: String(index) } })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: SCREEN_BACKGROUND },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: TEXT_COLOR, letterSpacing: 1 },
  back: { fontSize: 18, color: '#4f8cff' },
});
