import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import type { ReactNode } from 'react';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ProfileActionRow } from '../components/ProfileActionRow';
import { AccountVerificationSummary } from '../components/AccountVerificationSummary';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

const editIcon = require('../../../assets/authentication/edit-profile.png');
const preferencesIcon = require('../../../assets/authentication/preferences.png');
const settingsIcon = require('../../../assets/authentication/settings.png');

interface ProfileViewProps {
  viewModel: AuthProfilesViewModel;
  marketplaceNavigation?: ReactNode;
  onOpenAdminModeration?: (() => void) | undefined;
  onOpenMatchingPreferences?: (() => void) | undefined;
  onBack?: (() => void) | undefined;
  onOpenRatingsReports?: (() => void) | undefined;
  onOpenVerification?: (() => void) | undefined;
}

export function ProfileView({ viewModel, marketplaceNavigation, onOpenAdminModeration, onOpenMatchingPreferences, onBack, onOpenRatingsReports, onOpenVerification }: ProfileViewProps) {
  const initials = viewModel.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  const roles = viewModel.isAdmin
    ? 'Admin'
    : viewModel.roleLabels.join(' · ');
  return <View style={styles.screen}><ScreenHeader title="Profile" onBack={onBack} /><ScrollView contentContainerStyle={styles.scrollContent}>
    <View style={styles.profileCard}>
      <View style={styles.identityRow}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials || '?'}</Text></View>
        <View style={styles.identityCopy}>
          <Text accessibilityRole="header" style={styles.name}>{viewModel.displayName}</Text>
          <Text style={styles.role}>{roles || 'Role not selected'}</Text>
        </View>
      </View>
      {viewModel.account?.profile.bio ? <Text style={styles.bio}>{viewModel.account.profile.bio}</Text> : null}
      <AccountVerificationSummary items={viewModel.verificationSummary} />
      <View style={styles.profileActions}>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('editProfile')} style={styles.editButton}>
          <Image resizeMode="contain" source={editIcon} style={styles.editIcon} /><Text style={styles.editLabel}>Edit Profile</Text>
        </Pressable>
      </View>
    </View>
    <FeedbackNotice message={viewModel.notice} tone={viewModel.noticeTone} />
    <View style={styles.menu}>
      {viewModel.isAdmin ? (
        <ProfileActionRow icon={settingsIcon} label="Admin Moderation" onPress={() => onOpenAdminModeration?.()} />
      ) : (
        <>
          <ProfileActionRow detail="Set your search preferences" icon={preferencesIcon} label="Matching Preferences" onPress={() => onOpenMatchingPreferences?.()} />
          <ProfileActionRow detail="Identity and property submission details" leading={<InterfaceIcon name="verification" />} label="Verification" onPress={() => onOpenVerification?.()} />
          <ProfileActionRow detail="Reviews and safety" leading={<InterfaceIcon name="reviews" />} label="Ratings & Reports" onPress={() => onOpenRatingsReports?.()} />
        </>
      )}
      <ProfileActionRow icon={settingsIcon} detail="Sign-in details and account access" label="Account Settings" onPress={() => viewModel.navigate('settings')} />
    </View>
  </ScrollView>{marketplaceNavigation}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { backgroundColor: colors.background, flexGrow: 1, paddingBottom: spacing.xxl },
  profileCard: { alignSelf: 'center', backgroundColor: colors.background, borderRadius: radius.card, marginTop: 0, maxWidth: 412, padding: spacing.lg, width: '100%' },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
  initials: { color: colors.primary, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  identityCopy: { flex: 1, gap: spacing.xxs },
  name: { color: colors.text, fontFamily: typography.family, fontSize: 22, fontWeight: '700' },
  role: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14 },
  bio: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  profileActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  editButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 48, justifyContent: 'center' },
  editIcon: { height: 14, width: 14 },
  editLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  menu: { marginTop: spacing.md },
});
