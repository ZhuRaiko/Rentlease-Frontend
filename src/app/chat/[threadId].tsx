import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, FormInput, PrimaryAction } from '@/features/listings/components';
import { getMessages, sendMessage } from '@/features/post-listing/post-listing-service';
import { ChatMessage } from '@/features/post-listing/types';
import { useTheme } from '@/hooks/use-theme';

export default function ChatThreadScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const { session } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');

  async function reload() {
    setMessages(await getMessages(threadId));
  }

  useEffect(() => {
    let isMounted = true;
    getMessages(threadId).then((nextMessages) => {
      if (isMounted) setMessages(nextMessages);
    });
    return () => {
      isMounted = false;
    };
  }, [threadId]);

  async function handleSend() {
    if (!session?.user.id || !body.trim()) return;
    try {
      await sendMessage(threadId, session.user.id, body.trim());
      setBody('');
      await reload();
    } catch (error) {
      Alert.alert('Message failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Thread" />
      <View style={styles.messages}>
        {messages.map((message) => (
          <Bubble key={message.id} message={message} mine={message.senderId === session?.user.id} />
        ))}
      </View>
      <View style={styles.composer}>
        <FormInput value={body} onChangeText={setBody} placeholder="Write a message..." style={styles.input} />
        <PrimaryAction label="Send" onPress={handleSend} style={styles.send} />
      </View>
    </AppScreen>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? theme.primarySoft : theme.backgroundSubtle }]}>
      <ThemedText style={styles.bubbleText}>{message.body}</ThemedText>
      <ThemedText style={styles.time}>{new Date(message.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  messages: { marginTop: 16, gap: 10 },
  bubble: { maxWidth: '82%', borderRadius: 14, padding: 12, gap: 4 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  time: { fontSize: 10, opacity: 0.48 },
  composer: { marginTop: 22, gap: 10 },
  input: { minHeight: 54 },
  send: { minHeight: 48 },
});
