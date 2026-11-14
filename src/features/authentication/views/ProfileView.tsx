import {LandlordExperienceSection} from '../../../shared/components/LandlordExperienceSection';
import {usePublicIdentitiesViewModel} from '../../../shared/viewModels/usePublicIdentitiesViewModel';
import { ProfileAvatar } from '../components/ProfileAvatar';
import { InterfaceIcon } from '../../../shared/components/InterfaceIcon';
import type { ReactNode } from 'react';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
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
  const ownPublic=usePublicIdentitiesViewModel(viewModel.account?.user.id,viewModel.account?[viewModel.account.user.id]:[]);
  const publicIdentity=viewModel.account?ownPublic[viewModel.account.user.id]:undefined;
  const avatarUrl=publicIdentity?.avatarUrl;
  const initials = viewModel.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  const roles = viewModel.roleLabels.join(' · ');
  return <View style={styles.screen}>
    <ScreenHeader title="Profile" onBack={onBack} />
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.folio}>
        <View style={styles.identityStage}>
          <View style={styles.identityTop}>
            <ProfileAvatar initials={initials} name={publicIdentity?.nickname} {...(avatarUrl?{source:{uri:avatarUrl}}:{})} />
            <View style={styles.membership}>
              <Text accessibilityRole="header" style={styles.name}>{publicIdentity?.nickname??'RentLease member'}</Text>
              <Text style={styles.role}>{roles || 'RentLease member'}</Text>
            </View>

          </View>
          {viewModel.account?.profile.bio ? <Text style={styles.bio}>{viewModel.account.profile.bio}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityLabel="Edit Profile" onPress={() => viewModel.navigate('editProfile')} style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}>
              <Image accessible={false} resizeMode="contain" source={editIcon} style={styles.editIcon} />
              <Text style={styles.editLabel}>Edit profile</Text>
            </Pressable>
        </View>
        <FeedbackNotice message={viewModel.notice} tone={viewModel.noticeTone} />
        <View style={styles.credentials}>
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Verification</Text>
            {!viewModel.isAdmin ? <Pressable accessibilityRole="button" accessibilityLabel="View verification details" onPress={() => onOpenVerification?.()} style={({ pressed }) => [styles.detailsAction, pressed && styles.pressed]}>
              <InterfaceIcon name="verification" size={18} />
              <Text style={styles.detailsLabel}>View details</Text>
              <Text accessible={false} style={styles.arrow}>{'\u2197'}</Text>
            </Pressable> : null}
          </View>
          <AccountVerificationSummary items={viewModel.verificationSummary} />{viewModel.account?<LandlordExperienceSection key={viewModel.account.user.id} accountId={viewModel.account.user.id}/>:null}
        </View>
        <View style={styles.accountTools}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{viewModel.isAdmin ? 'Administration' : 'Preferences'}</Text>
          {!viewModel.isAdmin ? <ProfileActionRow icon={preferencesIcon} label="Matching Preferences" onPress={() => onOpenMatchingPreferences?.()} /> : <ProfileActionRow icon={settingsIcon} label="Admin Moderation" onPress={() => onOpenAdminModeration?.()} />}
        </View>
        <View style={styles.accountTools}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Account & safety</Text>
          {!viewModel.isAdmin ? <ProfileActionRow leading={<InterfaceIcon name="reviews" color={colors.textSecondary} />} label="Ratings & Reports" onPress={() => onOpenRatingsReports?.()} /> : null}
          <ProfileActionRow icon={settingsIcon} label="Account Settings" onPress={() => viewModel.navigate('settings')} />
        </View>
      </View>
    </ScrollView>
    {marketplaceNavigation}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  folio: { width: '100%', maxWidth: 520, alignSelf: 'center', paddingHorizontal: spacing.md, gap: spacing.md },
  identityStage: { marginTop: spacing.sm, paddingTop: spacing.lg, paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, backgroundColor: colors.primaryPale, borderRadius: radius.panel },
  identityTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  membership: { flex: 1, minWidth: 0, gap: spacing.xs },
  role: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 13, lineHeight: 20 },
  name: { ...ui.pageTitle, fontSize: 20, lineHeight: 26 },
  bio: { ...ui.body, fontSize: 14, lineHeight: 21 },
  editButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 48, minWidth: 48, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderColor: colors.controlBorder, borderWidth: 1, borderRadius: radius.control, backgroundColor: colors.background },
  editIcon: { width: 16, height: 16, tintColor: colors.primaryAction },
  editLabel: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  credentials: { gap: spacing.xs },
  sectionHeading: { borderBottomColor: colors.outline, borderBottomWidth: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  sectionTitle: { ...ui.sectionTitle, flexShrink: 1 },
  detailsAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 48, minWidth: 48, paddingVertical: spacing.xs, paddingHorizontal: spacing.xxs, flexShrink: 1 },
  detailsLabel: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  arrow: { color: colors.primaryAction, fontSize: 20 },
  accountTools: { gap: spacing.xs, borderTopColor: colors.outline, borderTopWidth: 1, paddingTop: spacing.sm },
  pressed: { backgroundColor: colors.primaryPale },
});
