import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BrandHeader, Chip, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getMyProfile, getMyVerifications } from '@/features/profile/profile-service';
import { profileRoutes } from '@/features/profile/routes';
import { UserProfile, Verification } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';

export default function VerificationScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);

  useEffect(() => {
    async function load() {
      const [nextProfile, nextVerifications] = await Promise.all([
        getMyProfile(session?.user.id),
        getMyVerifications(session?.user.id),
      ]);
      setProfile(nextProfile);
      setVerifications(nextVerifications);
    }

    load();
  }, [session?.user.id]);

  return (
    <AppScreen>
      <BrandHeader title="Verification" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Build trust before the lease.</ThemedText>
        <ThemedText style={styles.copy}>
          Tier 1 is your email and phone. Tier 2 adds a government ID. Tier 3 is landlord-only proof of ownership.
        </ThemedText>
      </View>

      <View style={styles.cards}>
        <VerificationCard
          tier="Tier 1"
          title="Email and phone"
          body="Required for posting, messaging, and reporting."
          status={statusFor('tier_1', verifications)}
          actionLabel="Already handled"
          disabled
        />
        <VerificationCard
          tier="Tier 2"
          title="Government ID"
          body="Submit a valid ID for admin review and a stronger verified badge."
          status={statusFor('tier_2', verifications)}
          actionLabel="Submit Tier 2"
          onPress={() => router.push(profileRoutes.tier2)}
        />
        <VerificationCard
          tier="Tier 3"
          title="Landlord proof"
          body="Landlords can prove ownership or authorization for premium trust."
          status={profile?.role === 'landlord' ? statusFor('tier_3', verifications) : 'landlord only'}
          actionLabel="Submit Tier 3"
          disabled={profile?.role !== 'landlord'}
          onPress={() => router.push(profileRoutes.tier3)}
        />
      </View>
    </AppScreen>
  );
}

function statusFor(tier: Verification['tier'], verifications: Verification[]) {
  return verifications.find((verification) => verification.tier === tier)?.status ?? 'not submitted';
}

function VerificationCard({
  tier,
  title,
  body,
  status,
  actionLabel,
  disabled = false,
  onPress,
}: {
  tier: string;
  title: string;
  body: string;
  status: string;
  actionLabel: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <Chip label={tier} color="neutral" />
        <ThemedText style={styles.status}>{status}</ThemedText>
      </View>
      <SectionLabel>{title}</SectionLabel>
      <ThemedText style={styles.body}>{body}</ThemedText>
      <PrimaryAction
        label={actionLabel}
        tone={disabled ? 'green' : 'dark'}
        onPress={onPress ?? (() => {})}
        style={[styles.cardAction, disabled && styles.disabledAction]}
      />
    </View>
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
  cards: {
    marginTop: 24,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontSize: 12,
    fontWeight: '800',
    opacity: 0.58,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 13,
    lineHeight: 20,
    opacity: 0.72,
  },
  cardAction: {
    minHeight: 46,
  },
  disabledAction: {
    opacity: 0.45,
  },
});
