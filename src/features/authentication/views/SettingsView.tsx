import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthScaffold } from '../components/AuthScaffold';
import { ProfileActionRow } from '../components/ProfileActionRow';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

const settingsIcon = require('../../../assets/authentication/settings.png');
const verificationIcon = require('../../../assets/authentication/verification.png');

interface SettingsViewProps {
  viewModel: AuthProfilesViewModel;
}

export function SettingsView({ viewModel }: SettingsViewProps) {
  return (
    <AuthScaffold
      description="Manage your profile details and account state."
      onBack={viewModel.goBack}
      title="Account settings"
    >
      <View style={styles.summaryCard}>
        <Text style={styles.summaryName}>{viewModel.displayName}</Text>
        <Text style={styles.summaryDetail}>{viewModel.profile.email}</Text>
        <Text style={styles.summaryDetail}>{viewModel.profile.phone}</Text>
      </View>
      <View style={styles.rows}>
        <ProfileActionRow
          detail={viewModel.profile.role === 'tenant' ? 'Tenant' : 'Landlord'}
          icon={settingsIcon}
          label="Active role"
          onPress={() => viewModel.setNotice('Role changes require a confirmed backend contract.')}
        />
        <ProfileActionRow
          detail="Good standing"
          icon={verificationIcon}
          label="Account status"
          onPress={() => viewModel.navigate('restricted')}
        />
      </View>
      <Text style={styles.previewHint}>
        Select Account status to preview the required restricted-account state.
      </Text>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <AuthButton
        label="Sign out"
        onPress={() => viewModel.setShowSignOutConfirmation(true)}
        variant="secondary"
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    backgroundColor: colors.primaryPale,
    borderRadius: radius.card,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryName: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 20,
    fontWeight: '800',
  },
  summaryDetail: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 14,
  },
  rows: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, overflow: 'hidden' },
  previewHint: {
    color: colors.textMuted,
    fontFamily: typography.family,
    fontSize: 12,
    lineHeight: 17,
  },
  notice: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.sm,
  },
});
