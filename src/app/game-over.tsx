import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function GameOverScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Game over.</Text>
      <Link href="/" style={styles.link}>
        Back to title
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 18 },
  link: { fontSize: 18, color: '#4f8cff' },
});
