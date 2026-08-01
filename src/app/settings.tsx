import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function SettingsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Settings.</Text>
      <Link href="/" style={styles.link}>
        Back
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 18 },
  link: { fontSize: 18, color: '#4f8cff' },
});
