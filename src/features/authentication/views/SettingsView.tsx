import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function SettingsView({ viewModel }: { viewModel: AuthProfilesViewModel }) {
  return <AuthScaffold description="Your account information is loaded from Supabase." onBack={viewModel.goBack} title="Account settings">
    <View style={styles.summaryCard}>
      <Text style={styles.summaryName}>{viewModel.displayName}</Text>
      <Text style={styles.detail}>Email: {viewModel.account?.user.email || 'Not available'}</Text>
      <Text style={styles.detail}>Phone: {viewModel.account?.user.phone || 'Not verified'}</Text>
      <Text style={styles.detail}>Roles: {viewModel.roles.join(', ') || 'None selected'}</Text>
      <Text style={styles.detail}>Tier 1: {viewModel.account?.profile.tier1_verified_at ? 'Verified' : 'Pending'}</Text>
      <Text style={styles.detail}>Account status: {viewModel.account?.profile.account_status || 'Unknown'}</Text>
    </View>
    <AuthButton label="Edit profile" onPress={() => viewModel.navigate('editProfile')} variant="secondary" />
    <AuthButton label="Sign out" onPress={() => viewModel.setShowSignOutConfirmation(true)} variant="secondary" />
    {viewModel.notice ? <Text style={styles.detail}>{viewModel.notice}</Text> : null}
  </AuthScaffold>;
}

const styles = StyleSheet.create({
  summaryCard: { backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: spacing.xs, padding: spacing.md },
  summaryName: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '800' },
  detail: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14 },
});
