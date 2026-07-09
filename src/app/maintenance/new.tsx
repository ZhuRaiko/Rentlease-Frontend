import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { createMaintenanceRequest } from '@/features/post-listing/post-listing-service';
import { MaintenanceUrgency } from '@/features/post-listing/types';

export default function NewMaintenanceScreen() {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState<MaintenanceUrgency>('normal');

  async function submit() {
    if (!session?.user.id || !title.trim()) return;
    try {
      await createMaintenanceRequest({ tenantId: session.user.id, title: title.trim(), description, urgency });
      router.back();
    } catch (error) {
      Alert.alert('Could not create request', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="New Request" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>What needs fixing?</ThemedText>
        <ThemedText style={styles.copy}>Keep it short and clear. You can add photos later when storage upload is wired.</ThemedText>
      </View>
      <SectionLabel>Title</SectionLabel>
      <FormInput value={title} onChangeText={setTitle} placeholder="Leaking sink" />
      <SectionLabel>Urgency</SectionLabel>
      <View style={styles.chips}>
        {(['low', 'normal', 'urgent'] as MaintenanceUrgency[]).map((item) => (
          <Chip key={item} label={item} selected={urgency === item} onPress={() => setUrgency(item)} />
        ))}
      </View>
      <SectionLabel>Description</SectionLabel>
      <FormInput multiline value={description} onChangeText={setDescription} style={styles.description} />
      <PrimaryAction label="Submit Request" tone="green" onPress={submit} style={styles.submit} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { marginTop: 10, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 22, opacity: 0.66 },
  chips: { marginTop: 12, flexDirection: 'row', gap: 8 },
  description: { minHeight: 140, textAlignVertical: 'top' },
  submit: { marginTop: 24 },
});
