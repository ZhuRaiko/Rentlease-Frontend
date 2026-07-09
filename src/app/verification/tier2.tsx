import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { submitVerification } from '@/features/profile/profile-service';
import { profileRoutes } from '@/features/profile/routes';

export default function Tier2VerificationScreen() {
  const { session } = useAuth();
  const [documentType, setDocumentType] = useState('Government ID');
  const [documentUrl, setDocumentUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (!session?.user.id || !documentUrl.trim()) {
      Alert.alert('Missing document', 'Add a document reference or file URL before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitVerification(session.user.id, {
        tier: 'tier_2',
        documentType,
        documentUrl: documentUrl.trim(),
        notes,
      });
      router.replace(profileRoutes.verification);
    } catch (error) {
      Alert.alert('Could not submit Tier 2', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Tier 2" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Submit your ID for review.</ThemedText>
        <ThemedText style={styles.copy}>
          For now, paste a storage path, file URL, or document reference. Actual file upload can be wired to Supabase Storage later.
        </ThemedText>
      </View>

      <SectionLabel>Document Type</SectionLabel>
      <View style={styles.chips}>
        {['Government ID', 'Student ID', 'Passport'].map((type) => (
          <Chip key={type} label={type} selected={documentType === type} onPress={() => setDocumentType(type)} />
        ))}
      </View>

      <SectionLabel>Document Reference</SectionLabel>
      <FormInput value={documentUrl} onChangeText={setDocumentUrl} placeholder="storage://tier-2/id-front.jpg" />

      <SectionLabel>Notes</SectionLabel>
      <FormInput
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Name on ID, extra context, or admin notes"
        style={styles.notes}
      />

      <PrimaryAction label={isSubmitting ? 'Submitting...' : 'Submit Tier 2'} onPress={handleSubmit} style={styles.submit} />
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
  chips: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  notes: {
    minHeight: 116,
    textAlignVertical: 'top',
  },
  submit: {
    marginTop: 24,
  },
});
