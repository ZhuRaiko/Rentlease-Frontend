import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BottomNav, BrandHeader, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getThreads } from '@/features/post-listing/post-listing-service';
import { postListingRoutes } from '@/features/post-listing/routes';
import { ChatThread } from '@/features/post-listing/types';

export default function ChatListScreen() {
  const { session } = useAuth();
  const [threads, setThreads] = useState<ChatThread[]>([]);

  useEffect(() => {
    getThreads(session?.user.id).then(setThreads);
  }, [session?.user.id]);

  return (
    <View style={styles.root}>
      <AppScreen>
        <BrandHeader title="Chat" />
        <View style={styles.heading}>
          <ThemedText style={styles.title}>Messages</ThemedText>
          <ThemedText style={styles.copy}>Keep every viewing, lease, and maintenance conversation in one place.</ThemedText>
        </View>
        <SectionLabel>Threads</SectionLabel>
        <View style={styles.list}>
          {threads.length === 0 ? <ThemedText style={styles.empty}>No chats yet. Start one from a listing detail screen.</ThemedText> : null}
          {threads.map((thread) => (
            <PrimaryAction
              key={thread.id}
              label={thread.lastMessage || `Listing ${thread.listingRef ?? ''}`}
              onPress={() => router.push(postListingRoutes.chatThread(thread.id))}
            />
          ))}
        </View>
      </AppScreen>
      <BottomNav active="chat" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { marginTop: 10, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 22, opacity: 0.66 },
  list: { marginTop: 12, gap: 12 },
  empty: { opacity: 0.58 },
});
