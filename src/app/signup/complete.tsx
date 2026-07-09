import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthButton, AuthScreen } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { recommendationRoutes } from '@/features/recommendations/routes';

export default function SignupCompleteScreen() {
  const { resetSignupDraft, signupDraft } = useAuth();
  const firstName = signupDraft.nickname || signupDraft.firstName || 'there';

  function handleContinue() {
    resetSignupDraft();
    router.replace(recommendationRoutes.intro);
  }

  return (
    <AuthScreen>
      <View style={styles.content}>
        <ThemedText style={styles.title}>{`You're all set, ${firstName}!`}</ThemedText>
        <ThemedText style={styles.helper}>
          Your account is verified and ready to go. Start exploring homes near you.
        </ThemedText>
        <AuthButton label="Start exploring" onPress={handleContinue} style={styles.button} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 256,
  },
  title: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '800',
    letterSpacing: 0,
  },
  helper: {
    marginTop: -4,
    marginLeft: 5,
    width: 262,
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '200',
  },
  button: {
    marginTop: 48,
    marginHorizontal: 49,
  },
});
