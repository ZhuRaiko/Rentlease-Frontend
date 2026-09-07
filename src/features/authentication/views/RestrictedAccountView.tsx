import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

interface RestrictedAccountViewProps {
  viewModel: AuthProfilesViewModel;
}

export function RestrictedAccountView({ viewModel }: RestrictedAccountViewProps) {
  return (
    <AuthScaffold
      description="This is a frontend-only preview of the account state shown when trusted backend moderation restricts access."
      onBack={viewModel.goBack}
      title="Account restricted"
    >
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>TEMPORARILY RESTRICTED</Text>
        <Text style={styles.statusTitle}>Your RENTLEASE access is limited</Text>
        <Text style={styles.statusBody}>
          You can still review your profile and account information, but marketplace actions are
          unavailable while this status is active.
        </Text>
      </View>
      <View style={styles.referenceCard}>
        <Text style={styles.referenceLabel}>Reference</Text>
        <Text style={styles.referenceValue}>RL-ACCOUNT-REVIEW</Text>
        <Text style={styles.referenceBody}>
          Account status remains backend-authoritative. This preview does not assign or clear a
          restriction.
        </Text>
      </View>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <AuthButton
        label="Contact support"
        onPress={() => viewModel.setNotice('Support contact is not connected in this frontend preview.')}
      />
      <AuthButton
        label="Sign out"
        onPress={() => viewModel.setShowSignOutConfirmation(true)}
        variant="secondary"
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    backgroundColor: colors.restrictedSurface,
    borderColor: '#F4C7C3',
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  statusLabel: {
    color: colors.restricted,
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  statusTitle: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 22,
    fontWeight: '800',
  },
  statusBody: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 15,
    lineHeight: 22,
  },
  referenceCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    gap: spacing.xs,
    padding: spacing.md,
  },
  referenceLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12 },
  referenceValue: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '700',
  },
  referenceBody: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
  },
  notice: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
  },
});
