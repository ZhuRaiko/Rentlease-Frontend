import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import type { UserRole } from '../models/AuthProfile';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

export function RegistrationView({ viewModel }: { viewModel: AuthProfilesViewModel }) {
  const { screen, draft } = viewModel;
  const busy = viewModel.asyncState === 'loading';
  const notice = viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null;
  const accountActions = viewModel.account ? <View style={styles.accountActions}>
    <Text style={styles.body}>Signed in as {viewModel.account.user.email || viewModel.displayName}</Text>
    <AuthButton disabled={busy} label="Sign out / use another account" onPress={() => void viewModel.switchAccount()} variant="secondary" />
  </View> : null;

  if (screen === 'registrationName') return (
    <AuthScaffold largeTitle onBack={viewModel.goBack} title="Please enter your name.">
      <AuthField autoCapitalize="words" label="First name" onChangeText={(value) => viewModel.updateDraft('firstName', value)} value={draft.firstName} />
      <AuthField autoCapitalize="words" label="Last name" onChangeText={(value) => viewModel.updateDraft('lastName', value)} value={draft.lastName} />
      <AuthButton disabled={!draft.firstName.trim() || !draft.lastName.trim()} label="Next" onPress={() => viewModel.navigate('registrationNickname')} />
    </AuthScaffold>
  );

  if (screen === 'registrationNickname') return (
    <AuthScaffold description="This name will appear on your profile." largeTitle onBack={viewModel.goBack} title="What should we call you?">
      <AuthField autoCapitalize="words" label="Display name" onChangeText={(value) => viewModel.updateDraft('nickname', value)} value={draft.nickname} />
      <AuthButton disabled={!draft.nickname.trim()} label="Next" onPress={() => viewModel.navigate('registrationEmail')} />
    </AuthScaffold>
  );

  if (screen === 'registrationEmail') return (
    <AuthScaffold description="We'll send a confirmation link to this address." largeTitle onBack={viewModel.goBack} title="Enter your email address">
      <AuthField autoCapitalize="none" autoComplete="email" keyboardType="email-address" label="Email address" onChangeText={(value) => viewModel.updateDraft('email', value)} value={draft.email} />
      <AuthButton disabled={!draft.email.includes('@')} label="Next" onPress={() => viewModel.navigate('registrationPassword')} />
    </AuthScaffold>
  );

  if (screen === 'registrationPassword') return (
    <AuthScaffold description="Use at least 8 characters. Your account will be created when you continue." onBack={viewModel.goBack} title="Create a password">
      <AuthField autoComplete="new-password" label="Password" onChangeText={(value) => viewModel.updateDraft('password', value)} secureTextEntry value={draft.password} />
      <AuthButton disabled={busy || draft.password.length < 8} label={busy ? 'Creating account…' : 'Create account'} onPress={() => void viewModel.register()} />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'emailConfirmation') return (
    <AuthScaffold description={`Open the confirmation link sent to ${draft.email || viewModel.account?.user.email || 'your email'}, then return here.`} footer={accountActions} title="Confirm your email">
      <Text style={styles.body}>Email verification happens through the secure link from Supabase. There is no in-app four-digit email code.</Text>
      <AuthButton disabled={busy} label={busy ? 'Checking…' : 'I confirmed my email'} onPress={() => void viewModel.continueAfterEmailConfirmation()} />
      <AuthButton disabled={busy || viewModel.resendSeconds > 0} label={viewModel.resendSeconds ? `Resend in ${viewModel.resendSeconds}s` : 'Resend confirmation email'} onPress={() => void viewModel.resendEmail()} variant="secondary" />
      {!viewModel.account ? <AuthButton disabled={busy} label="Back to sign in" onPress={() => viewModel.navigate('signIn')} variant="secondary" /> : null}
      {notice}
    </AuthScaffold>
  );

  if (screen === 'registrationPhone') return (
    <AuthScaffold description="You're signed in. This account still needs a confirmed mobile number before you can enter RENTLEASE." footer={accountActions} title="Verify your phone">
      <AuthField inputMode="tel" keyboardType="phone-pad" label="Mobile number" maxLength={10} onChangeText={(value) => viewModel.updateDraft('phone', value.replace(/\D/g, ''))} placeholder="9XXXXXXXXX" prefix="+63" value={draft.phone} />
      <AuthButton disabled={busy || !/^9\d{9}$/.test(draft.phone)} label={busy ? 'Sending code…' : 'Send SMS code'} onPress={() => void viewModel.requestPhoneOtp()} />
      <AuthButton disabled={busy} label="Already verified? Refresh status" onPress={() => void viewModel.refreshVerificationState()} variant="secondary" />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'mobileConfirmation') return (
    <AuthScaffold description={`Enter the six-digit SMS code sent to +63${draft.phone}.`} footer={accountActions} title="Confirm your mobile number">
      <AuthField keyboardType="number-pad" label="Six-digit code" maxLength={6} onChangeText={(value) => viewModel.updateDraft('mobileCode', value.replace(/\D/g, ''))} placeholder="000000" value={draft.mobileCode} />
      <AuthButton disabled={busy || !/^\d{6}$/.test(draft.mobileCode)} label={busy ? 'Verifying…' : 'Verify phone'} onPress={() => void viewModel.verifyPhoneOtp()} />
      <AuthButton disabled={busy || viewModel.resendSeconds > 0} label={viewModel.resendSeconds ? `Resend in ${viewModel.resendSeconds}s` : 'Resend SMS code'} onPress={() => void viewModel.resendPhoneOtp()} variant="secondary" />
      <AuthButton disabled={busy} label="Refresh Tier 1 status" onPress={() => void viewModel.refreshVerificationState()} variant="secondary" />
      <AuthButton disabled={busy} label="Change phone number" onPress={() => viewModel.navigate('registrationPhone')} variant="secondary" />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'verificationPending') return (
    <AuthScaffold description="Your email and phone are confirmed. Your account verification has not finished updating yet." footer={accountActions} title="Checking account verification">
      <Text style={styles.body}>You don't need to request another SMS code. Refresh your status to continue. If it stays pending, contact RENTLEASE support to check your account.</Text>
      <AuthButton disabled={busy} label={busy ? 'Checking…' : 'Refresh verification status'} onPress={() => void viewModel.refreshVerificationState()} />
      {notice}
    </AuthScaffold>
  );

  return (
    <AuthScaffold description="Choose how you want to use RENTLEASE. You can select both. Landlord verification is a separate trust step." footer={accountActions} title="Choose your role">
      {(['tenant', 'landlord'] as UserRole[]).map((role) => (
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: viewModel.selectedRoles.includes(role) }} key={role} onPress={() => viewModel.toggleRole(role)} style={[styles.roleCard, viewModel.selectedRoles.includes(role) && styles.roleSelected]}>
          <Text style={styles.roleTitle}>{role === 'tenant' ? 'Tenant' : 'Landlord'}</Text>
          <Text style={styles.body}>{role === 'tenant' ? 'Discover rental homes and manage your tenancy.' : 'Manage properties and rental listings.'}</Text>
        </Pressable>
      ))}
      <AuthButton disabled={busy || viewModel.selectedRoles.length === 0} label={busy ? 'Saving roles…' : 'Continue'} onPress={() => void viewModel.submitRoles()} />
      {notice}
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  accountActions: { gap: spacing.sm },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 18, padding: spacing.sm },
  roleCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, padding: spacing.md },
  roleSelected: { backgroundColor: colors.primaryPale, borderColor: colors.primary },
  roleTitle: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '700' },
});
