import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  const lastNameInput = useRef<TextInput>(null);
  const confirmationInput = useRef<TextInput>(null);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const scaffold = { progress: viewModel.registrationProgress, backDisabled: busy };
  const notice = <FeedbackNotice message={viewModel.notice} tone={viewModel.noticeTone} />;
  const accountActions = viewModel.account ? <View style={styles.accountActions}>
    <Text style={styles.body}>Signed in as {viewModel.account.user.email || viewModel.displayName}</Text>
    <AuthButton disabled={busy} label="Sign out / use another account" onPress={() => void viewModel.switchAccount()} variant="secondary" />
  </View> : null;

  if (screen === 'registrationName') return (
    <AuthScaffold {...scaffold} largeTitle onBack={viewModel.goBack} title="What's your name?" description="Start with your first and last name.">
      <AuthField editable={!busy} autoCapitalize="words" autoCorrect={false} label="First name" returnKeyType="next" onSubmitEditing={() => lastNameInput.current?.focus()} onChangeText={(value) => viewModel.updateDraft('firstName', value)} value={draft.firstName} />
      <AuthField editable={!busy} inputRef={lastNameInput} autoCapitalize="words" autoCorrect={false} label="Last name" returnKeyType="next" onSubmitEditing={() => viewModel.continueRegistration()} onChangeText={(value) => viewModel.updateDraft('lastName', value)} value={draft.lastName} />
      <AuthButton disabled={busy || !!viewModel.registrationError} label="Continue" onPress={() => viewModel.continueRegistration()} />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'registrationNickname') return (
    <AuthScaffold {...scaffold} description="Optional. This name will appear on your profile. Skip to use your first and last name." largeTitle onBack={viewModel.goBack} title="What should we call you?">
      <AuthField editable={!busy} autoCapitalize="words" label="Preferred name (optional)" returnKeyType="next" onSubmitEditing={() => viewModel.continueRegistration()} onChangeText={(value) => viewModel.updateDraft('nickname', value)} value={draft.nickname} />
      <AuthButton disabled={busy} label="Continue" onPress={() => viewModel.continueRegistration()} />
      <AuthButton disabled={busy} label="Skip for now" variant="secondary" onPress={() => viewModel.continueRegistration(true)} />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'registrationEmail') return (
    <AuthScaffold {...scaffold} description="Use this email to sign in. We'll send a confirmation link after you create your account." largeTitle onBack={viewModel.goBack} title="What's your email address?">
      <AuthField editable={!busy} autoCapitalize="none" autoCorrect={false} autoComplete="email" keyboardType="email-address" label="Email address" returnKeyType="next" onBlur={() => setEmailBlurred(true)} errorMessage={emailBlurred && draft.email ? viewModel.registrationError ?? undefined : undefined} onSubmitEditing={() => viewModel.continueRegistration()} onChangeText={(value) => viewModel.updateDraft('email', value)} value={draft.email} />
      <AuthButton disabled={busy || !!viewModel.registrationError} label="Continue" onPress={() => viewModel.continueRegistration()} />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'registrationPassword') return (
    <AuthScaffold {...scaffold} description="Use at least 8 characters. Create your account only when both passwords match." onBack={viewModel.goBack} title="Create your password">
      <AuthField editable={!busy && !viewModel.signupNeedsRecovery} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" allowVisibilityToggle label="Password" returnKeyType="next" onSubmitEditing={() => confirmationInput.current?.focus()} onChangeText={(value) => viewModel.updateDraft('password', value)} secureTextEntry value={draft.password} />
      <AuthField editable={!busy && !viewModel.signupNeedsRecovery} inputRef={confirmationInput} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" allowVisibilityToggle label="Confirm password" returnKeyType="done" errorMessage={draft.confirmPassword && draft.confirmPassword !== draft.password ? 'Passwords do not match.' : undefined} onSubmitEditing={() => void viewModel.register()} onChangeText={(value) => viewModel.updateDraft('confirmPassword', value)} secureTextEntry value={draft.confirmPassword} />
      <AuthButton disabled={busy || !!viewModel.registrationError || viewModel.signupNeedsRecovery} label={busy ? 'Creating account…' : 'Create account'} onPress={() => void viewModel.register()} />
      {notice}
      {viewModel.signupNeedsRecovery ? <>
        <AuthButton label="Check email confirmation" variant="secondary" onPress={() => viewModel.navigate('emailConfirmation')} />
        <AuthButton label="Go to sign in" variant="secondary" onPress={() => viewModel.navigate('signIn')} />
      </> : null}
    </AuthScaffold>
  );

  if (screen === 'emailConfirmation') return (
    <AuthScaffold {...scaffold} description={`Open the confirmation link sent to ${draft.email || viewModel.account?.user.email || 'your email'}, then return here.`} footer={accountActions} title="Verify your email">
      <Text style={styles.body}>Check your inbox and spam folder. After opening the link, return here to continue.</Text>
      <AuthButton disabled={busy} label={busy ? 'Checking…' : 'I confirmed my email'} onPress={() => void viewModel.continueAfterEmailConfirmation()} />
      <AuthButton disabled={busy || viewModel.resendSeconds > 0} label={viewModel.resendSeconds ? `Resend in ${viewModel.resendSeconds}s` : 'Resend confirmation email'} onPress={() => void viewModel.resendEmail()} variant="secondary" />
      {!viewModel.account ? <AuthButton disabled={busy} label="Back to sign in" onPress={() => viewModel.navigate('signIn')} variant="secondary" /> : null}
      {notice}
    </AuthScaffold>
  );

  if (screen === 'registrationPhone') return (
    <AuthScaffold {...scaffold} description="We'll send an SMS code to confirm your Philippine mobile number." footer={accountActions} title="What's your mobile number?">
      <AuthField editable={!busy} inputMode="tel" keyboardType="phone-pad" label="Mobile number" maxLength={10} onChangeText={(value) => viewModel.updateDraft('phone', value.replace(/\D/g, ''))} placeholder="9XXXXXXXXX" prefix="+63" value={draft.phone} />
      <AuthButton disabled={busy || !/^9\d{9}$/.test(draft.phone)} label={busy ? 'Sending code…' : 'Send SMS code'} onPress={() => void viewModel.requestPhoneOtp()} />
      <AuthButton disabled={busy} label="Already verified? Refresh status" onPress={() => void viewModel.refreshVerificationState()} variant="secondary" />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'mobileConfirmation') return (
    <AuthScaffold {...scaffold} description={`Enter the six-digit SMS code sent to +63${draft.phone}.`} footer={accountActions} title="Verify your mobile number">
      <AuthField editable={!busy} keyboardType="number-pad" autoComplete="sms-otp" label="Six-digit code" maxLength={6} onChangeText={(value) => viewModel.updateDraft('mobileCode', value.replace(/\D/g, ''))} placeholder="000000" value={draft.mobileCode} />
      <AuthButton disabled={busy || !/^\d{6}$/.test(draft.mobileCode)} label={busy ? 'Verifying…' : 'Verify phone'} onPress={() => void viewModel.verifyPhoneOtp()} />
      <AuthButton disabled={busy || viewModel.resendSeconds > 0} label={viewModel.resendSeconds ? `Resend in ${viewModel.resendSeconds}s` : 'Resend SMS code'} onPress={() => void viewModel.resendPhoneOtp()} variant="secondary" />
      <AuthButton disabled={busy} label="Refresh Tier 1 status" onPress={() => void viewModel.refreshVerificationState()} variant="secondary" />
      <AuthButton disabled={busy} label="Change phone number" onPress={() => viewModel.navigate('registrationPhone')} variant="secondary" />
      {notice}
    </AuthScaffold>
  );

  if (screen === 'verificationPending') return (
    <AuthScaffold {...scaffold} description="Your email and phone are confirmed. Your account verification has not finished updating yet." footer={accountActions} title="Checking account verification">
      <Text style={styles.body}>You don't need to request another SMS code. Refresh your status to continue. If it stays pending, contact RENTLEASE support to check your account.</Text>
      <AuthButton disabled={busy} label={busy ? 'Checking…' : 'Refresh verification status'} onPress={() => void viewModel.refreshVerificationState()} />
      {notice}
    </AuthScaffold>
  );

  return (
    <AuthScaffold {...scaffold} description="Choose Tenant, Landlord, or select both. Property verification is a separate trust step." footer={accountActions} title="How will you use RentLease?">
      {(['tenant', 'landlord'] as UserRole[]).map((role) => (
        <Pressable disabled={busy} accessibilityRole="checkbox" accessibilityState={{ checked: viewModel.selectedRoles.includes(role), disabled: busy }} key={role} onPress={() => viewModel.toggleRole(role)} style={[styles.roleCard, viewModel.selectedRoles.includes(role) && styles.roleSelected]}>
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
