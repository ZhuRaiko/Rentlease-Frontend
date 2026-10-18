import { useEffect } from 'react';
import { Modal, StatusBar, StyleSheet, Text, View } from 'react-native';
import { traceAuthBoot } from '../../../shared/utils/authBootTrace';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { AuthButton } from '../components/AuthButton';
import type { UserRole } from '../models/AuthProfile';
import type { AuthProfilesViewModel } from '../viewModels/useAuthProfilesViewModel';
import { EditProfileView } from './EditProfileView';
import { ProfileView } from './ProfileView';
import { RegistrationView } from './RegistrationView';
import { RestrictedAccountView } from './RestrictedAccountView';
import { SettingsView } from './SettingsView';
import { SignInView } from './SignInView';
import { WelcomeView } from './WelcomeView';

const registrationScreens = new Set([
  'registrationName', 'registrationNickname', 'registrationEmail', 'registrationPassword',
  'emailConfirmation', 'registrationPhone', 'mobileConfirmation', 'verificationPending', 'roleSelection',
]);

interface AuthProfilesFlowViewProps {
  viewModel: AuthProfilesViewModel;
  activeRole: UserRole;
  onSwitchRole: (role: UserRole) => void;
  onOpenAdminModeration?: () => void;
  onOpenDiscovery?: () => void;
  onOpenMatchingPreferences?: () => void;
  onOpenNotifications?: () => void;
  onOpenProperties?: () => void;
  onOpenRatingsReports?: () => void;
}

export function AuthProfilesFlowView({
  viewModel, onOpenAdminModeration, onOpenDiscovery, onOpenMatchingPreferences,
  onOpenNotifications, onOpenProperties, onOpenRatingsReports, activeRole, onSwitchRole,
}: AuthProfilesFlowViewProps) {
  useEffect(() => {
    traceAuthBoot('AUTH_VIEW_MOUNT');
    return () => traceAuthBoot('AUTH_VIEW_UNMOUNT');
  }, []);
  useEffect(() => {
    traceAuthBoot('AUTH_VIEW_STATE', { screen: viewModel.screen, asyncState: viewModel.asyncState,
      retryVisible: viewModel.screen === 'bootstrap' && viewModel.asyncState === 'error' });
  }, [viewModel.screen, viewModel.asyncState]);
  let content;
  if (viewModel.screen === 'bootstrap') {
    content = <View style={styles.bootstrap}>
      <Text style={styles.title}>Connecting to RENTLEASE</Text>
      <Text style={styles.body}>{viewModel.notice ?? 'Checking your session and profile…'}</Text>
      {viewModel.asyncState === 'error' ? <AuthButton label="Retry" onPress={() => void viewModel.bootstrap()} /> : null}
    </View>;
  } else if (viewModel.screen === 'welcome') {
    content = <WelcomeView notice={viewModel.notice} onCreateAccount={() => viewModel.navigate('registrationName')} onSignIn={() => viewModel.navigate('signIn')} />;
  } else if (viewModel.screen === 'signIn') {
    content = <SignInView viewModel={viewModel} />;
  } else if (registrationScreens.has(viewModel.screen)) {
    content = <RegistrationView viewModel={viewModel} />;
  } else if (viewModel.screen === 'profile') {
    content = <ProfileView viewModel={viewModel} activeRole={activeRole} onSwitchRole={onSwitchRole} onOpenAdminModeration={onOpenAdminModeration} onOpenDiscovery={onOpenDiscovery} onOpenMatchingPreferences={onOpenMatchingPreferences} onOpenNotifications={onOpenNotifications} onOpenProperties={viewModel.hasLandlordRole ? onOpenProperties : undefined} onOpenRatingsReports={onOpenRatingsReports} />;
  } else if (viewModel.screen === 'editProfile') {
    content = <EditProfileView viewModel={viewModel} />;
  } else if (viewModel.screen === 'settings') {
    content = <SettingsView viewModel={viewModel} />;
  } else {
    content = <RestrictedAccountView viewModel={viewModel} />;
  }

  return <ScreenContainer padded={false}>
    <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
    {content}
    <Modal animationType="fade" onRequestClose={() => viewModel.setShowSignOutConfirmation(false)} transparent visible={viewModel.showSignOutConfirmation}>
      <View style={styles.modalBackdrop}><View accessibilityViewIsModal style={styles.modalCard}>
        <Text accessibilityRole="header" style={styles.title}>Sign out?</Text>
        <Text style={styles.body}>Your RENTLEASE session will end on this device.</Text>
        <AuthButton disabled={viewModel.asyncState === 'loading'} label="Sign out" onPress={() => void viewModel.signOut()} variant="danger" />
        <AuthButton label="Cancel" onPress={() => viewModel.setShowSignOutConfirmation(false)} variant="secondary" />
        {viewModel.notice ? <Text style={styles.body}>{viewModel.notice}</Text> : null}
      </View></View>
    </Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  bootstrap: { flex: 1, gap: spacing.md, justifyContent: 'center', padding: spacing.lg },
  modalBackdrop: { alignItems: 'center', backgroundColor: colors.overlay, flex: 1, justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.background, borderRadius: radius.card, gap: spacing.md, maxWidth: 360, padding: spacing.lg, width: '100%' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 26, fontWeight: '800' },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 15, lineHeight: 22 },
});
