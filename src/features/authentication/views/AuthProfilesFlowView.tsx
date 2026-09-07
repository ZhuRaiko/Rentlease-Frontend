import { Modal, StatusBar, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import type { UserRole } from '../models/AuthProfile';
import { useAuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';
import { EditProfileView } from './EditProfileView';
import { ProfileView } from './ProfileView';
import { RegistrationView } from './RegistrationView';
import { RestrictedAccountView } from './RestrictedAccountView';
import { SettingsView } from './SettingsView';
import { SignInView } from './SignInView';
import { WelcomeView } from './WelcomeView';

const registrationScreens = new Set([
  'registrationName',
  'registrationNickname',
  'registrationEmail',
  'emailConfirmation',
  'registrationPhone',
  'mobileConfirmation',
  'registrationPassword',
  'registrationComplete',
]);

interface AuthProfilesFlowViewProps {
  accountRole?: UserRole;
  onOpenAdminModeration?: () => void;
  onOpenDiscovery?: () => void;
  onOpenMatchingPreferences?: () => void;
  onOpenNotifications?: () => void;
  onOpenProperties?: () => void;
  onOpenRatingsReports?: () => void;
  onOpenVerification?: () => void;
  onSignInComplete?: () => void;
}

export function AuthProfilesFlowView({
  accountRole = 'tenant',
  onOpenAdminModeration,
  onOpenDiscovery,
  onOpenMatchingPreferences,
  onOpenNotifications,
  onOpenProperties,
  onOpenRatingsReports,
  onOpenVerification,
  onSignInComplete,
}: AuthProfilesFlowViewProps) {
  const viewModel = useAuthProfilesViewModel(accountRole);
  let content;

  if (viewModel.screen === 'welcome') {
    content = (
      <WelcomeView
        onCreateAccount={() => viewModel.navigate('registrationName')}
        onSignIn={() => viewModel.navigate('signIn')}
      />
    );
  } else if (viewModel.screen === 'signIn') {
    content = <SignInView onSignInComplete={onSignInComplete} viewModel={viewModel} />;
  } else if (registrationScreens.has(viewModel.screen)) {
    content = (
      <RegistrationView
        onCompleteAccountSetup={onOpenMatchingPreferences}
        viewModel={viewModel}
      />
    );
  } else if (viewModel.screen === 'profile') {
    content = (
      <ProfileView
        onOpenAdminModeration={onOpenAdminModeration}
        onOpenDiscovery={onOpenDiscovery}
        onOpenMatchingPreferences={onOpenMatchingPreferences}
        onOpenNotifications={onOpenNotifications}
        onOpenProperties={
          viewModel.profile.role === 'landlord' ? onOpenProperties : undefined
        }
        onOpenRatingsReports={onOpenRatingsReports}
        onOpenVerification={onOpenVerification}
        viewModel={viewModel}
      />
    );
  } else if (viewModel.screen === 'editProfile') {
    content = <EditProfileView viewModel={viewModel} />;
  } else if (viewModel.screen === 'settings') {
    content = <SettingsView viewModel={viewModel} />;
  } else {
    content = <RestrictedAccountView viewModel={viewModel} />;
  }

  return (
    <ScreenContainer padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      {content}
      <Modal
        animationType="fade"
        onRequestClose={() => viewModel.setShowSignOutConfirmation(false)}
        transparent
        visible={viewModel.showSignOutConfirmation}
      >
        <View style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.modalCard}>
            <Text accessibilityRole="header" style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>
              You’ll return to the RENTLEASE welcome screen. No backend session is changed in this
              frontend preview.
            </Text>
            <AuthButton label="Sign out" onPress={viewModel.signOutPreview} variant="danger" />
            <AuthButton
              label="Cancel"
              onPress={() => viewModel.setShowSignOutConfirmation(false)}
              variant="secondary"
            />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.background,
    borderRadius: radius.card,
    gap: spacing.md,
    maxWidth: 360,
    padding: spacing.lg,
    width: '100%',
  },
  modalTitle: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 28,
    fontWeight: '800',
  },
  modalBody: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 15,
    lineHeight: 22,
  },
});
