import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, Chip, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getMyProfile, submitVerification } from '@/features/profile/profile-service';
import { profileRoutes } from '@/features/profile/routes';
import { UserProfile } from '@/features/profile/types';

export default function Tier3VerificationScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [documentType, setDocumentType] = useState('Proof of Ownership');
  const [documentUrl, setDocumentUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getMyProfile(session?.user.id).then(setProfile);
  }, [session?.user.id]);

  async function handleSubmit() {
    if (profile?.role !== 'landlord') {
      Alert.alert('Landlords only', 'Switch your profile role to landlord before submitting Tier 3.');
      return;
    }
    if (!session?.user.id || !documentUrl.trim()) {
      Alert.alert('Missing document', 'Add a landlord proof reference before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);
      await submitVerification(session.user.id, {
        tier: 'tier_3',
        documentType,
        documentUrl: documentUrl.trim(),
        notes,
      });
      router.replace(profileRoutes.verification);
    } catch (error) {
      Alert.alert('Could not submit Tier 3', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Tier 3" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Prove landlord eligibility.</ThemedText>
        <ThemedText style={styles.copy}>
          Tier 3 is for landlords who can show proof of ownership or authorization to lease a property.
        </ThemedText>
      </View>

      {profile?.role !== 'landlord' ? (
        <View style={styles.warning}>
          <ThemedText style={styles.warningText}>Only landlord accounts can submit Tier 3 documents.</ThemedText>
        </View>
      ) : null}

      <SectionLabel>Proof Type</SectionLabel>
      <View style={styles.chips}>
        {['Proof of Ownership', 'Authorization Letter', 'Tax Declaration'].map((type) => (
          <Chip key={type} label={type} selected={documentType === type} onPress={() => setDocumentType(type)} />
        ))}
      </View>

      <SectionLabel>Document Reference</SectionLabel>
      <FormInput value={documentUrl} onChangeText={setDocumentUrl} placeholder="storage://tier-3/property-proof.pdf" />

      <SectionLabel>Notes</SectionLabel>
      <FormInput
        multiline
        value={notes}
        onChangeText={setNotes}
        placeholder="Property address, owner name, or extra context"
        style={styles.notes}
      />

      <PrimaryAction label={isSubmitting ? 'Submitting...' : 'Submit Tier 3'} onPress={handleSubmit} style={styles.submit} />
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
  warning: {
    marginTop: 18,
    borderRadius: 8,
    backgroundColor: '#F4ECF7',
    padding: 12,
  },
  warningText: {
    color: '#80479A',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
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
