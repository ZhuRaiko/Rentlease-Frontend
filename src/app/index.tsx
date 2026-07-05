import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthScreen, ChoiceCard, RentLeaseLogo } from '@/features/auth/components';
import { authRoutes } from '@/features/auth/routes';

export default function WelcomeScreen() {
  return (
    <AuthScreen>
      <View style={styles.logoBlock}>
        <RentLeaseLogo />
        <ThemedText style={styles.tagline}>Home found. Community approved.</ThemedText>
      </View>

      <View style={styles.choices}>
        <ChoiceCard
          title="Already have an account?"
          subtitle="Click here to log-in"
          onPress={() => router.push(authRoutes.login)}
        />
        <ChoiceCard
          title="Let's Make an Account!"
          variant="green"
          onPress={() => router.push(authRoutes.signupName)}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logoBlock: {
    marginTop: 154,
    marginLeft: 20,
    alignItems: 'flex-start',
  },
  tagline: {
    alignSelf: 'center',
    marginTop: 8,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '300',
    textAlign: 'center',
  },
  choices: {
    marginTop: 70,
    gap: 23,
  },
});
