import { StatusBar, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from './src/shared/components/ScreenContainer';

export default function App() {
  return (
    <ScreenContainer>
      <StatusBar barStyle="dark-content" />
      <View style={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>RentLease</Text>
        <Text style={styles.description}>
          Mobile frontend foundation ready for feature implementation.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: 8 },
  title: { color: '#111827', fontSize: 28, fontWeight: '700' },
  description: { color: '#4B5563', fontSize: 16, lineHeight: 24 },
});
