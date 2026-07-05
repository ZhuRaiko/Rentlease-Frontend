import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PostingShell } from '@/features/listings/components';
import { listingRoutes } from '@/features/listings/routes';
import { useTheme } from '@/hooks/use-theme';

export default function PostingMediaScreen() {
  const theme = useTheme();

  return (
    <PostingShell
      step={1}
      title="Add Photos or videos to your listing."
      onNext={() => router.push(listingRoutes.newDetails)}>
      <Pressable style={[styles.uploadBox, { borderColor: theme.text }]}>
        <ThemedText style={styles.uploadIcon}>+</ThemedText>
        <ThemedText style={styles.uploadText}>Add Photos/videos</ThemedText>
      </Pressable>
    </PostingShell>
  );
}

const styles = StyleSheet.create({
  uploadBox: {
    marginTop: 28,
    height: 290,
    borderWidth: 0.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadIcon: {
    fontSize: 54,
    opacity: 0.42,
  },
  uploadText: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    opacity: 0.44,
  },
});
