import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PostingShell } from '@/features/listings/components';
import { listingRoutes } from '@/features/listings/routes';
import { useTheme } from '@/hooks/use-theme';

export default function PostingStartScreen() {
  return (
    <PostingShell title="What are you posting?">
      <View style={styles.cards}>
        <PostTypeCard title="A Listing" onPress={() => router.push(listingRoutes.newMedia)} />
        <PostTypeCard title="A Community Post\n\n(no function yet)" disabled onPress={() => {}} />
      </View>
    </PostingShell>
  );
}

function PostTypeCard({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { borderColor: theme.text, opacity: disabled ? 0.42 : pressed ? 0.7 : 0.9 },
      ]}>
      <ThemedText style={styles.cardIcon}>+</ThemedText>
      <ThemedText style={styles.cardTitle}>{title}</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cards: {
    marginTop: 42,
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    height: 299,
    borderWidth: 0.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  cardIcon: {
    fontSize: 48,
    opacity: 0.3,
  },
  cardTitle: {
    marginTop: 20,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
});
