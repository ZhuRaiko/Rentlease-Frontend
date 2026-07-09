import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { saveRentReminder } from '@/features/post-listing/post-listing-service';

export default function RentReminderScreen() {
  const { session } = useAuth();
  const [day, setDay] = useState('5');

  async function submit() {
    if (!session?.user.id) return;
    const rentDueDay = Math.min(28, Math.max(1, Number(day) || 1));
    try {
      await saveRentReminder(session.user.id, rentDueDay);
      Alert.alert('Reminder set', `Rent reminder saved for day ${rentDueDay} of each month.`);
    } catch (error) {
      Alert.alert('Could not set reminder', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Rent Reminder" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Never miss rent day.</ThemedText>
        <ThemedText style={styles.copy}>Choose a monthly due day. This milestone stores the preference and schedules a local test notification.</ThemedText>
      </View>
      <SectionLabel>Due Day</SectionLabel>
      <FormInput keyboardType="numeric" value={day} onChangeText={setDay} placeholder="1-28" />
      <PrimaryAction label="Save Reminder" tone="green" onPress={submit} style={styles.submit} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: 10, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 22, opacity: 0.66 },
  submit: { marginTop: 24 },
});
