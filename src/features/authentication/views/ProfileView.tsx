import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ProfileActionRow } from '../components/ProfileActionRow';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

const coverImage = require('../../../assets/authentication/profile-cover.png');
const avatarImage = require('../../../assets/authentication/profile-avatar.png');
const editIcon = require('../../../assets/authentication/edit-profile.png');
const preferencesIcon = require('../../../assets/authentication/preferences.png');
const settingsIcon = require('../../../assets/authentication/settings.png');
const verificationIcon = require('../../../assets/authentication/verification.png');
const propertyIcon = require('../../../assets/verification/property.png');

interface ProfileViewProps {
  viewModel: AuthProfilesViewModel;
  onOpenAdminModeration?: (() => void) | undefined;
  onOpenDiscovery?: (() => void) | undefined;
  onOpenMatchingPreferences?: (() => void) | undefined;
  onOpenNotifications?: (() => void) | undefined;
  onOpenProperties?: (() => void) | undefined;
  onOpenRatingsReports?: (() => void) | undefined;
  onOpenVerification?: (() => void) | undefined;
}

interface RatingCardProps {
  backgroundColor: string;
  label: string;
  rating: string;
}

function RatingCard({ backgroundColor, label, rating }: RatingCardProps) {
  return (
    <View style={[styles.ratingCard, { backgroundColor }]}>
      <Text style={styles.ratingValue}>{rating}</Text>
      <Text style={styles.ratingLabel}>{label}</Text>
    </View>
  );
}

export function ProfileView({
  viewModel,
  onOpenAdminModeration,
  onOpenDiscovery,
  onOpenMatchingPreferences,
  onOpenNotifications,
  onOpenProperties,
  onOpenRatingsReports,
  onOpenVerification,
}: ProfileViewProps) {
  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Image resizeMode="cover" source={coverImage} style={styles.cover} />
      <View style={styles.profileCard}>
        <View style={styles.identityRow}>
          <Image resizeMode="cover" source={avatarImage} style={styles.avatar} />
          <View style={styles.identityCopy}>
            <Text accessibilityRole="header" style={styles.name}>{viewModel.displayName}</Text>
            <Text style={styles.role}>{viewModel.profile.role === 'tenant' ? 'Tenant' : 'Landlord'} · {viewModel.profile.city}</Text>
          </View>
        </View>
        <View style={styles.ratings}>
          <RatingCard backgroundColor={colors.reviewBlue} label="Landlord Reviews" rating="4.7" />
          <RatingCard backgroundColor={colors.reviewOrange} label="Renter Reviews" rating="4.3" />
        </View>
        <View style={styles.profileActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => viewModel.navigate('editProfile')}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Image resizeMode="contain" source={editIcon} style={styles.editIcon} />
            <Text style={styles.editLabel}>Edit profile</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Account settings"
            accessibilityRole="button"
            onPress={() => viewModel.navigate('settings')}
            style={({ pressed }) => [styles.circleButton, pressed && styles.pressed]}
          >
            <Image resizeMode="contain" source={settingsIcon} style={styles.circleIcon} />
          </Pressable>
        </View>
      </View>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <View style={styles.menu}>
        <ProfileActionRow
          detail="Search Cavite"
          icon={propertyIcon}
          label="Discover Properties"
          onPress={() => {
            if (onOpenDiscovery) {
              onOpenDiscovery();
              return;
            }
            viewModel.setNotice('Search & Discovery is not available from this host.');
          }}
        />
        <ProfileActionRow
          detail="Not configured"
          icon={preferencesIcon}
          label="Matching Preferences"
          onPress={() => {
            if (onOpenMatchingPreferences) {
              onOpenMatchingPreferences();
              return;
            }
            viewModel.setNotice('Matching Preferences is not available from this host.');
          }}
        />
        <ProfileActionRow
          detail="Not submitted"
          icon={verificationIcon}
          label="Verification"
          onPress={() => {
            if (onOpenVerification) {
              onOpenVerification();
              return;
            }
            viewModel.setNotice('User Verification is not available from this host.');
          }}
        />
        <ProfileActionRow
          detail={viewModel.profile.role === 'landlord' ? 'Manage listings' : 'Tier 3 required'}
          icon={propertyIcon}
          label="My Properties"
          onPress={() => {
            if (viewModel.profile.role === 'landlord' && onOpenProperties) {
              onOpenProperties();
              return;
            }
            viewModel.setNotice('Complete Tier 3 verification to unlock Landlord property management.');
          }}
        />
        <ProfileActionRow
          detail="3 unread"
          icon={require('../../../assets/verification/pending-clock.png')}
          label="Notifications"
          onPress={() => {
            if (onOpenNotifications) {
              onOpenNotifications();
              return;
            }
            viewModel.setNotice('Notifications are not available from this host.');
          }}
        />
        <ProfileActionRow
          detail="Reviews and safety"
          icon={verificationIcon}
          label="Ratings & Reports"
          onPress={() => {
            if (onOpenRatingsReports) {
              onOpenRatingsReports();
              return;
            }
            viewModel.setNotice('Ratings & Reports is not available from this host.');
          }}
        />
        <ProfileActionRow
          detail="Frontend evaluation"
          icon={settingsIcon}
          label="Admin Moderation Preview"
          onPress={() => {
            if (onOpenAdminModeration) {
              onOpenAdminModeration();
              return;
            }
            viewModel.setNotice('Admin Moderation Preview is not available from this host.');
          }}
        />
        <ProfileActionRow
          icon={settingsIcon}
          label="Settings"
          onPress={() => viewModel.navigate('settings')}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { backgroundColor: colors.background, flexGrow: 1, paddingBottom: spacing.xxl },
  cover: { height: 194, width: '100%' },
  profileCard: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.card,
    elevation: 4,
    marginHorizontal: 28,
    marginTop: -110,
    maxWidth: 358,
    padding: 20,
    shadowColor: colors.text,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    width: '86%',
  },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { borderRadius: 26, height: 52, width: 52 },
  identityCopy: { flex: 1, gap: spacing.xxs },
  name: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  role: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  ratings: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.md },
  ratingCard: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 55,
    padding: spacing.xs,
  },
  ratingValue: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: '700',
  },
  ratingLabel: {
    color: colors.white,
    fontFamily: typography.family,
    fontSize: 9,
    fontWeight: '700',
  },
  profileActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  editButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1.3,
    flex: 1,
    flexDirection: 'row',
    height: 40,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  editIcon: { height: 14, width: 14 },
  editLabel: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: '700',
  },
  circleButton: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1.3,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  circleIcon: { height: 20, opacity: 0.7, width: 20 },
  menu: { marginTop: spacing.xl },
  notice: {
    alignSelf: 'center',
    backgroundColor: colors.primaryPale,
    borderRadius: radius.sm,
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    maxWidth: 364,
    padding: spacing.sm,
  },
  pressed: { opacity: 0.72 },
});
