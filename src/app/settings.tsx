import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { resetScore } from '../meta/score-storage';
import { fontSize, radius, space, ui } from '../render/ui-theme';

export default function SettingsScreen() {
  const confirmReset = () => {
    Alert.alert('Reset score?', 'Your score goes back to zero. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetScore },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.body}>Manage your Endless run.</Text>
        <Pressable
          onPress={confirmReset}
          accessibilityRole="button"
          style={({ pressed }) => [styles.reset, pressed && styles.resetPressed]}
        >
          <Text style={styles.resetLabel}>Reset score</Text>
        </Pressable>
      </View>
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
    paddingHorizontal: space.xxl,
    backgroundColor: ui.night,
  },
  card: {
    width: '100%',
    backgroundColor: ui.paper,
    borderWidth: 1,
    borderColor: ui.paperEdge,
    borderRadius: radius.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    shadowColor: ui.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 4,
  },
  heading: { fontSize: fontSize.body, fontWeight: '700', color: ui.ink },
  body: { marginTop: space.xs, marginBottom: space.lg, fontSize: 13, color: ui.inkSoft },
  reset: {
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
    backgroundColor: ui.paper,
    borderWidth: 1.5,
    borderColor: ui.shu,
  },
  resetPressed: { backgroundColor: ui.paperPressed },
  resetLabel: { fontSize: fontSize.link, fontWeight: '700', color: ui.shu },
  back: { fontSize: fontSize.link, color: ui.nightInk },
});
