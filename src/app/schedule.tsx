import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { requestViewing } from '@/features/post-listing/post-listing-service';

export default function ScheduleViewingScreen() {
  const { listingId, landlordId } = useLocalSearchParams<{ listingId?: string; landlordId?: string }>();
  const { session } = useAuth();
  const [requestedAt, setRequestedAt] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [message, setMessage] = useState('I would like to schedule a viewing for this property.');

  async function submit() {
    if (!session?.user.id || !listingId) return;
    try {
      await requestViewing({
        listingRef: listingId,
        tenantId: session.user.id,
        landlordId,
        requestedAt: new Date(requestedAt).toISOString(),
        message,
      });
      router.back();
    } catch (error) {
      Alert.alert('Could not schedule viewing', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Viewing" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Request a viewing</ThemedText>
        <ThemedText style={styles.copy}>Send the landlord your preferred time. They can approve, decline, or reschedule later.</ThemedText>
      </View>
      <SectionLabel>Date and Time</SectionLabel>
      <FormInput value={requestedAt} onChangeText={setRequestedAt} placeholder="2026-07-10T14:00" />
      <SectionLabel>Message</SectionLabel>
      <FormInput multiline value={message} onChangeText={setMessage} style={styles.message} />
      <PrimaryAction label="Request Viewing" tone="green" onPress={submit} style={styles.submit} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: 10, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 22, opacity: 0.66 },
  message: { minHeight: 120, textAlignVertical: 'top' },
  submit: { marginTop: 24 },
});
