import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { signOut } from '@/features/auth/auth-service';
import { authRoutes } from '@/features/auth/routes';
import {
  AppScreen,
  BottomNav,
  BrandHeader,
  Chip,
  PrimaryAction,
  ScreenSlide,
  SectionLabel,
} from '@/features/listings/components';
import { profileRoutes } from '@/features/profile/routes';
import { TrustBadgeCard } from '@/features/profile/components';
import {
  calculateTrustScore,
  getMyProfile,
  getMyVerifications,
  trustBadgeForScore,
  updateMyRole,
} from '@/features/profile/profile-service';
import { trustRoutes } from '@/features/trust/routes';
import { UserProfile, Verification } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';

export default function ProfileScreen() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const theme = useTheme();

  useEffect(() => {
    let isMounted = true;

    Promise.all([getMyProfile(session?.user.id), getMyVerifications(session?.user.id)]).then(
      ([nextProfile, nextVerifications]) => {
        if (!isMounted) return;
        setProfile(nextProfile);
        setVerifications(nextVerifications);
      }
    );

    return () => {
      isMounted = false;
    };
  }, [session?.user.id]);

  async function handleRole(role: 'tenant' | 'landlord') {
    try {
      setProfile(await updateMyRole(role));
    } catch (error) {
      Alert.alert('Could not update role', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function handleSignOut() {
    await signOut();
    router.replace(authRoutes.welcome);
  }

  const trustScore = calculateTrustScore(verifications);
  const trustBadge = trustBadgeForScore(trustScore);
  const displayName = profile?.nickname || profile?.firstName || 'RentLease user';
  const isSuspended = profile?.accountStatus === 'suspended';

  return (
    <View style={styles.root}>
      <ScreenSlide from="right">
        <AppScreen>
          <BrandHeader title="Profile" />
          <View style={styles.profileHeader}>
            <View style={[styles.avatarLarge, { backgroundColor: theme.primarySoft, borderColor: theme.pricePanelBorder }]}>
              <ThemedText style={[styles.avatarText, { color: theme.success }]}>
                {displayName.slice(0, 2).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText style={styles.name}>{displayName}</ThemedText>
            <ThemedText style={styles.contact}>{profile?.email ?? session?.user.email ?? 'No email yet'}</ThemedText>
            <View style={styles.chips}>
              <Chip label={profile?.role ?? 'tenant'} color="neutral" />
              <Chip label={trustBadge} />
            </View>
          </View>

          {isSuspended ? (
            <View style={[styles.suspendedBanner, { borderColor: theme.danger }]}>
              <ThemedText style={[styles.suspendedTitle, { color: theme.danger }]}>Account suspended</ThemedText>
              <ThemedText style={styles.suspendedCopy}>
                Admins have upheld reports against this account. Posting and trust-sensitive actions should remain paused.
              </ThemedText>
            </View>
          ) : null}

          <TrustBadgeCard score={trustScore} badge={trustBadge} />

          <View style={[styles.scoreCard, { borderColor: theme.pricePanelBorder, backgroundColor: theme.pricePanel }]}>
            <View>
              <ThemedText style={[styles.scoreLabel, { color: theme.success }]}>Trust score</ThemedText>
              <ThemedText style={[styles.scoreValue, { color: theme.success }]}>{Math.round(trustScore * 100)}%</ThemedText>
            </View>
            <View style={styles.scoreCopy}>
              <ThemedText style={[styles.scoreText, { color: theme.success }]}>Tier 1 email + phone</ThemedText>
              <ThemedText style={[styles.scoreText, { color: theme.success }]}>Tier 2 government ID</ThemedText>
              <ThemedText style={[styles.scoreText, { color: theme.success }]}>Tier 3 landlord proof</ThemedText>
            </View>
          </View>

          <SectionLabel>Account Type</SectionLabel>
          <View style={styles.roleRow}>
            <Chip label="Tenant" selected={profile?.role !== 'landlord'} onPress={() => handleRole('tenant')} />
            <Chip label="Landlord" selected={profile?.role === 'landlord'} onPress={() => handleRole('landlord')} />
          </View>

          <SectionLabel>Verification</SectionLabel>
          <View style={styles.actions}>
            <PrimaryAction label="Open Verification Center" onPress={() => router.push(profileRoutes.verification)} />
            {profile?.role === 'admin' ? (
              <>
                <PrimaryAction label="Admin Review Queue" tone="green" onPress={() => router.push(profileRoutes.adminQueue)} />
                <PrimaryAction label="Report Queue" onPress={() => router.push(trustRoutes.adminReports)} />
              </>
            ) : null}
          </View>

          <SectionLabel>Verification Status</SectionLabel>
          <View style={styles.statusList}>
            {(['tier_1', 'tier_2', 'tier_3'] as const).map((tier) => (
              <StatusRow key={tier} tier={tier} verifications={verifications} />
            ))}
          </View>

          <Pressable onPress={handleSignOut} style={styles.signOut}>
            <ThemedText style={styles.signOutText}>Sign out</ThemedText>
          </Pressable>
        </AppScreen>
      </ScreenSlide>
      <BottomNav active="profile" />
    </View>
  );
}

function StatusRow({ tier, verifications }: { tier: Verification['tier']; verifications: Verification[] }) {
  const theme = useTheme();
  const verification = verifications.find((item) => item.tier === tier);
  const status = verification?.status ?? (tier === 'tier_1' ? 'pending' : 'not submitted');

  return (
    <View style={[styles.statusRow, { borderColor: theme.border }]}>
      <ThemedText style={styles.statusTier}>{tier.replace('_', ' ').toUpperCase()}</ThemedText>
      <ThemedText style={styles.statusText}>{status}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 8,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  name: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '900',
  },
  contact: {
    marginTop: 4,
    fontSize: 13,
    opacity: 0.55,
  },
  chips: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  scoreCard: {
    marginTop: 14,
    minHeight: 118,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 18,
    flexDirection: 'row',
    gap: 18,
  },
  suspendedBanner: {
    marginTop: 20,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 14,
    backgroundColor: '#FFF7F6',
    gap: 4,
  },
  suspendedTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  suspendedCopy: {
    fontSize: 13,
    lineHeight: 19,
    opacity: 0.68,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  scoreValue: {
    marginTop: 6,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '900',
  },
  scoreCopy: {
    flex: 1,
    gap: 8,
  },
  scoreText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  roleRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  actions: {
    marginTop: 12,
    gap: 10,
  },
  statusList: {
    marginTop: 12,
    gap: 10,
  },
  statusRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusTier: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '800',
  },
  statusText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    opacity: 0.62,
  },
  signOut: {
    marginTop: 28,
    alignSelf: 'center',
    padding: 12,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
    opacity: 0.55,
  },
});
