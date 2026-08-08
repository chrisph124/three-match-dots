import { Link } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { resetScore } from '../meta/score-storage';
import { SCREEN_BACKGROUND, TEXT_COLOR } from '../render/palette';

export default function SettingsScreen() {
  const confirmReset = () => {
    Alert.alert('Reset score?', 'Your score goes back to zero. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: resetScore },
    ]);
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={confirmReset} accessibilityRole="button">
        <Text style={styles.destructive}>Reset score</Text>
      </Pressable>
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
  destructive: { fontSize: 18, color: '#ff4d5e' },
  link: { fontSize: 18, color: TEXT_COLOR },
});
