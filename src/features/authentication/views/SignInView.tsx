import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthBrand } from '../components/AuthBrand';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

const googleLogo = require('../../../assets/authentication/google-logo.png');

interface SignInViewProps {
  viewModel: AuthProfilesViewModel;
  onSignInComplete?: (() => void) | undefined;
}

export function SignInView({ viewModel, onSignInComplete }: SignInViewProps) {
  const canSubmit = Boolean(viewModel.signInIdentifier.trim() && viewModel.signInPassword);
  const handleSignIn = () => {
    if (viewModel.submitSignIn()) onSignInComplete?.();
  };

  return (
    <AuthScaffold
      description="Please enter your information to proceed"
      onBack={viewModel.goBack}
      title="Sign in"
    >
      <AuthBrand compact />
      <AuthField
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        label="Email or phone number"
        onChangeText={viewModel.setSignInIdentifier}
        placeholder="Insert Email or Phone Number"
        value={viewModel.signInIdentifier}
      />
      <AuthField
        autoComplete="password"
        label="Password"
        onChangeText={viewModel.setSignInPassword}
        placeholder="Insert Password"
        secureTextEntry
        value={viewModel.signInPassword}
      />
      <View style={styles.options}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: viewModel.rememberMe }}
          onPress={() => viewModel.setRememberMe(!viewModel.rememberMe)}
          style={styles.remember}
        >
          <View style={[styles.checkbox, viewModel.rememberMe && styles.checkboxSelected]} />
          <Text style={styles.optionText}>Remember me</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            viewModel.setNotice('Password recovery is ready for a future Supabase Auth connection.')
          }
        >
          <Text style={styles.optionText}>Forgot password?</Text>
        </Pressable>
      </View>
      <AuthButton disabled={!canSubmit} label="Sign In" onPress={handleSignIn} />
      <View style={styles.dividerRow}>
        <View style={styles.divider} />
        <Text style={styles.orText}>Or</Text>
        <View style={styles.divider} />
      </View>
      <AuthButton
        icon={googleLogo}
        label="Continue with Google"
        onPress={() =>
          viewModel.setNotice('Google authentication is not connected in this frontend preview.')
        }
        variant="secondary"
      />
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => viewModel.navigate('registrationName')}
      >
        <Text style={styles.signUpText}>
          Don’t have an account? <Text style={styles.signUpLink}>Sign up</Text>
        </Text>
      </Pressable>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  options: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  remember: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  checkbox: {
    borderColor: colors.text,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 18,
    width: 18,
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: {
    color: '#595959',
    fontFamily: typography.family,
    fontSize: 14,
  },
  dividerRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  divider: { backgroundColor: colors.border, flex: 1, height: 1 },
  orText: { color: colors.textMuted, fontFamily: typography.family, fontSize: 13 },
  notice: {
    backgroundColor: colors.primaryPale,
    borderRadius: radius.sm,
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    padding: spacing.sm,
  },
  signUpText: {
    color: colors.textMuted,
    fontFamily: typography.family,
    fontSize: 15,
    textAlign: 'center',
  },
  signUpLink: { color: '#595959', fontWeight: '700', textDecorationLine: 'underline' },
});
