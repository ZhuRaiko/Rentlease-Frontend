import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { ReportSubjectType } from '@/features/trust/types';
import { submitReport } from '@/features/trust/trust-service';

const reasons = ['Misleading listing', 'Unsafe behavior', 'Scam or fraud', 'Harassment', 'Other'];

export default function ReportScreen() {
  const { subjectType, subjectId } = useLocalSearchParams<{
    subjectType?: ReportSubjectType;
    subjectId?: string;
  }>();
  const { session } = useAuth();
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState('');

  async function handleSubmit() {
    if (!session?.user.id || !subjectType || !subjectId) {
      Alert.alert('Missing report target', 'Please try reporting again from the listing or profile.');
      return;
    }

    try {
      await submitReport(session.user.id, {
        subjectType,
        subjectId,
        reason,
        details,
      });
      router.back();
    } catch (error) {
      Alert.alert('Report failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Report" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Tell us what happened.</ThemedText>
        <ThemedText style={styles.copy}>
          Reports go to the admin queue. Upheld user reports can lead to a suspended account state.
        </ThemedText>
      </View>

      <SectionLabel>Reason</SectionLabel>
      <View style={styles.reasons}>
        {reasons.map((item) => (
          <Chip key={item} label={item} selected={reason === item} onPress={() => setReason(item)} />
        ))}
      </View>

      <SectionLabel>Details</SectionLabel>
      <FormInput
        multiline
        value={details}
        onChangeText={setDetails}
        placeholder="Add specific dates, messages, behavior, or listing claims."
        style={styles.details}
      />
      <PrimaryAction label="Submit Report" onPress={handleSubmit} style={styles.submit} />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.66,
  },
  reasons: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  details: {
    minHeight: 150,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 24,
  },
});
