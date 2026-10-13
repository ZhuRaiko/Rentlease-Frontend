import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ProfileActionRow } from '../components/ProfileActionRow';
import type { UserRole } from '../models/AuthProfile';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

const coverImage = require('../../../assets/authentication/profile-cover.png');
const editIcon = require('../../../assets/authentication/edit-profile.png');
const preferencesIcon = require('../../../assets/authentication/preferences.png');
const settingsIcon = require('../../../assets/authentication/settings.png');
const verificationIcon = require('../../../assets/authentication/verification.png');
const propertyIcon = require('../../../assets/verification/property.png');

interface ProfileViewProps {
  viewModel: AuthProfilesViewModel;
  activeRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
  onOpenAdminModeration?: (() => void) | undefined;
  onOpenDiscovery?: (() => void) | undefined;
  onOpenMatchingPreferences?: (() => void) | undefined;
  onOpenNotifications?: (() => void) | undefined;
  onOpenProperties?: (() => void) | undefined;
  onOpenRatingsReports?: (() => void) | undefined;
}

export function ProfileView({ viewModel, activeRole, onSwitchRole, onOpenAdminModeration, onOpenDiscovery, onOpenMatchingPreferences, onOpenNotifications, onOpenProperties, onOpenRatingsReports }: ProfileViewProps) {
  const initials = viewModel.displayName.split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase()).join('');
  const roles = viewModel.isAdmin
    ? 'Admin'
    : viewModel.roles.map((role) => role === 'tenant' ? 'Tenant' : 'Landlord').join(' · ');
  return <ScrollView contentContainerStyle={styles.scrollContent}>
    <Image resizeMode="cover" source={coverImage} style={styles.cover} />
    <View style={styles.profileCard}>
      <View style={styles.identityRow}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials || '?'}</Text></View>
        <View style={styles.identityCopy}>
          <Text accessibilityRole="header" style={styles.name}>{viewModel.displayName}</Text>
          <Text style={styles.role}>{roles || 'Role not selected'}</Text>
          {!viewModel.isAdmin ? <Text style={styles.role}>{viewModel.account?.profile.tier1_verified_at ? 'Tier 1 verified' : 'Tier 1 not verified'}</Text> : null}
        </View>
      </View>
      {viewModel.account?.profile.bio ? <Text style={styles.bio}>{viewModel.account.profile.bio}</Text> : null}
      {!viewModel.isAdmin && viewModel.hasTenantRole && viewModel.hasLandlordRole ? <View style={styles.roleSwitch}>
        {(['tenant', 'landlord'] as UserRole[]).map((role) => <Pressable accessibilityRole="button" accessibilityState={{ selected: activeRole === role }} key={role} onPress={() => onSwitchRole(role)} style={[styles.roleOption, activeRole === role && styles.roleOptionActive]}>
          <Text style={styles.role}>{role === 'tenant' ? 'Tenant view' : 'Landlord view'}</Text>
        </Pressable>)}
      </View> : null}
      <View style={styles.profileActions}>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('editProfile')} style={styles.editButton}>
          <Image resizeMode="contain" source={editIcon} style={styles.editIcon} /><Text style={styles.editLabel}>Edit profile</Text>
        </Pressable>
        <Pressable accessibilityLabel="Account settings" accessibilityRole="button" onPress={() => viewModel.navigate('settings')} style={styles.circleButton}>
          <Image resizeMode="contain" source={settingsIcon} style={styles.circleIcon} />
        </Pressable>
      </View>
    </View>
    {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
    <View style={styles.menu}>
      {viewModel.isAdmin ? (
        <ProfileActionRow icon={settingsIcon} label="Admin Moderation" onPress={() => onOpenAdminModeration?.()} />
      ) : (
        <>
          <ProfileActionRow detail="Browse listings" icon={propertyIcon} label="Discover Properties" onPress={() => onOpenDiscovery?.()} />
          <ProfileActionRow detail="Set your search preferences" icon={preferencesIcon} label="Matching Preferences" onPress={() => onOpenMatchingPreferences?.()} />
          <ProfileActionRow detail={viewModel.account?.profile.tier1_verified_at ? 'Tier 1 verified' : 'Tier 1 pending'} icon={verificationIcon} label="Verification" onPress={() => viewModel.setNotice('Tier 2 and Tier 3 backend submissions are not connected yet. Your verified status above comes from Supabase.')} />
          {viewModel.hasLandlordRole ? <ProfileActionRow detail="Manage listings" icon={propertyIcon} label="My Properties" onPress={() => onOpenProperties?.()} /> : null}
          <ProfileActionRow icon={require('../../../assets/verification/pending-clock.png')} label="Notifications" onPress={() => onOpenNotifications?.()} />
          <ProfileActionRow detail="Reviews and safety" icon={verificationIcon} label="Ratings & Reports" onPress={() => onOpenRatingsReports?.()} />
        </>
      )}
      <ProfileActionRow icon={settingsIcon} label="Settings" onPress={() => viewModel.navigate('settings')} />
    </View>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scrollContent: { backgroundColor: colors.background, flexGrow: 1, paddingBottom: spacing.xxl },
  cover: { height: 194, width: '100%' },
  profileCard: { alignSelf: 'center', backgroundColor: colors.background, borderRadius: radius.card, elevation: 4, marginHorizontal: 28, marginTop: -110, maxWidth: 358, padding: 20, shadowColor: colors.text, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.2, shadowRadius: 4, width: '86%' },
  identityRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
  initials: { color: colors.primary, fontFamily: typography.family, fontSize: 18, fontWeight: '800' },
  identityCopy: { flex: 1, gap: spacing.xxs },
  name: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '700' },
  role: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12 },
  bio: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, marginTop: spacing.md },
  roleSwitch: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  roleOption: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  roleOptionActive: { backgroundColor: colors.primaryPale, borderColor: colors.primary },
  profileActions: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  editButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1.3, flex: 1, flexDirection: 'row', gap: spacing.xs, height: 40, justifyContent: 'center' },
  editIcon: { height: 14, width: 14 },
  editLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  circleButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1.3, height: 40, justifyContent: 'center', width: 40 },
  circleIcon: { height: 20, opacity: 0.7, width: 20 },
  menu: { marginTop: spacing.xl },
  notice: { alignSelf: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18, marginHorizontal: spacing.lg, marginTop: spacing.lg, maxWidth: 364, padding: spacing.sm },
});
