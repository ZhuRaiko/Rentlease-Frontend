import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import { AuthField } from '../components/AuthField';
import { AuthScaffold } from '../components/AuthScaffold';
import { OtpCodeInput } from '../components/OtpCodeInput';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';

interface RegistrationViewProps {
  viewModel: AuthProfilesViewModel;
  onCompleteAccountSetup?: (() => void) | undefined;
}

export function RegistrationView({ viewModel, onCompleteAccountSetup }: RegistrationViewProps) {
  const { screen, draft } = viewModel;

  if (screen === 'registrationName') {
    const canContinue = Boolean(draft.firstName.trim() && draft.lastName.trim());
    return (
      <AuthScaffold largeTitle onBack={viewModel.goBack} title="Please enter your name.">
        <AuthField
          autoCapitalize="words"
          onChangeText={(value) => viewModel.updateDraft('firstName', value)}
          placeholder="First Name"
          value={draft.firstName}
        />
        <AuthField
          autoCapitalize="words"
          onChangeText={(value) => viewModel.updateDraft('lastName', value)}
          placeholder="Last Name"
          value={draft.lastName}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!canContinue}
            label="Next"
            onPress={() => viewModel.navigate('registrationNickname')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'registrationNickname') {
    return (
      <AuthScaffold
        description="We’ll use this in notifications and messages from us."
        largeTitle
        onBack={viewModel.goBack}
        title="What should we call you?"
      >
        <AuthField
          autoCapitalize="words"
          onChangeText={(value) => viewModel.updateDraft('nickname', value)}
          placeholder="Nickname"
          value={draft.nickname}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!draft.nickname.trim()}
            label="Next"
            onPress={() => viewModel.navigate('registrationEmail')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'registrationEmail') {
    return (
      <AuthScaffold
        description="We’ll use this in notifications and messages from us."
        largeTitle
        onBack={viewModel.goBack}
        title="Enter your E-mail address"
      >
        <AuthField
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={(value) => viewModel.updateDraft('email', value)}
          placeholder="E-mail Address"
          value={draft.email}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!draft.email.includes('@')}
            label="Next"
            onPress={() => viewModel.navigate('emailConfirmation')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'emailConfirmation') {
    return (
      <AuthScaffold
        description="Email delivery is not connected. Enter four digits to preview the confirmation state."
        onBack={viewModel.goBack}
        title="Confirm your email address"
      >
        <OtpCodeInput
          onChangeDigit={(index, digit) => viewModel.updateCodeDigit('emailCode', index, digit)}
          value={draft.emailCode}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!/^\d{4}$/.test(draft.emailCode)}
            label="Verify"
            onPress={() => viewModel.navigate('registrationPhone')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'registrationPhone') {
    return (
      <AuthScaffold
        description="We’ll send a short code to confirm it’s really you — takes less than a minute."
        onBack={viewModel.goBack}
        title={`You're nearly set, ${draft.nickname || draft.firstName || 'there'}! Lastly verify your Phone number`}
      >
        <AuthField
          inputMode="tel"
          maxLength={10}
          onChangeText={(value) => viewModel.updateDraft('phone', value.replace(/\D/g, ''))}
          placeholder="Enter Phone Number"
          prefix="+63"
          value={draft.phone}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={draft.phone.length < 10}
            label="Next"
            onPress={() => viewModel.navigate('mobileConfirmation')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'mobileConfirmation') {
    return (
      <AuthScaffold
        description="SMS delivery is not connected. Enter four digits to preview the confirmation state."
        onBack={viewModel.goBack}
        title="Enter the 4-digit code we sent to you."
      >
        <OtpCodeInput
          onChangeDigit={(index, digit) => viewModel.updateCodeDigit('mobileCode', index, digit)}
          value={draft.mobileCode}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!/^\d{4}$/.test(draft.mobileCode)}
            label="Verify"
            onPress={() => viewModel.navigate('registrationPassword')}
          />
        </View>
      </AuthScaffold>
    );
  }

  if (screen === 'registrationPassword') {
    return (
      <AuthScaffold
        description="Must be at least 8 characters long and include uppercase and lowercase letters, a number, and a special character (e.g., !@#$%)."
        onBack={viewModel.goBack}
        title="Enter your password."
      >
        <AuthField
          autoComplete="new-password"
          onChangeText={(value) => viewModel.updateDraft('password', value)}
          placeholder="Password"
          secureTextEntry
          value={draft.password}
        />
        <View style={styles.narrowButton}>
          <AuthButton
            disabled={!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(draft.password)}
            label="Finish setup"
            onPress={viewModel.completeRegistrationPreview}
          />
        </View>
      </AuthScaffold>
    );
  }

  return (
    <AuthScaffold
      description="Frontend preview complete. No account, session, email confirmation, or mobile verification was created."
      largeTitle
      title={`You're all set, ${draft.nickname || draft.firstName || 'there'}!`}
    >
      <Text style={styles.completeCopy}>
        Your profile preview is ready. Once backend authentication is connected, this boundary can
        be replaced without redesigning the screen.
      </Text>
      <AuthButton
        label="Set matching preferences"
        onPress={() => {
          viewModel.openProfilePreview();
          onCompleteAccountSetup?.();
        }}
      />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  narrowButton: { alignSelf: 'center', marginTop: spacing.sm, maxWidth: 272, width: '100%' },
  completeCopy: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 16,
    lineHeight: 24,
  },
});
