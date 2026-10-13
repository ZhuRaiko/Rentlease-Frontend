import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthBrand } from '../components/AuthBrand';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function SignInView({ viewModel }: { viewModel: AuthProfilesViewModel }) {
  const busy = viewModel.asyncState === 'loading';
  return (
    <AuthScaffold description="Sign in to continue to RENTLEASE" onBack={viewModel.goBack} title="Sign in">
      <AuthBrand compact />
      <AuthField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Email address"
        onChangeText={viewModel.setSignInIdentifier}
        placeholder="Enter your email"
        value={viewModel.signInIdentifier}
      />
      <AuthField
        autoComplete="password"
        label="Password"
        onChangeText={viewModel.setSignInPassword}
        placeholder="Enter your password"
        secureTextEntry
        value={viewModel.signInPassword}
      />
      <AuthButton
        disabled={busy || !viewModel.signInIdentifier.trim() || !viewModel.signInPassword}
        label={busy ? 'Signing in…' : 'Sign in'}
        onPress={() => void viewModel.submitSignIn()}
      />
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('registrationName')}>
        <Text style={styles.signUpText}>Don't have an account? <Text style={styles.signUpLink}>Sign up</Text></Text>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  notice: {
    backgroundColor: colors.primaryPale,
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.sm,
  },
  signUpText: { color: colors.textMuted, fontFamily: typography.family, fontSize: 15, textAlign: 'center' },
  signUpLink: { color: colors.text, fontWeight: '700', textDecorationLine: 'underline' },
});
