import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthButton, AuthInput, AuthScreen, BackButton, RentLeaseLogo } from '@/features/auth/components';
import { signInWithEmail } from '@/features/auth/auth-service';
import { authRoutes } from '@/features/auth/routes';
import { Spacing } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing details', 'Enter your email and password to sign in.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signInWithEmail(email.trim(), password);
      router.replace(authRoutes.home);
    } catch (error) {
      Alert.alert('Sign in failed', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.logoBlock}>
        <RentLeaseLogo />
        <ThemedText style={styles.tagline}>Home found. Community approved.</ThemedText>
      </View>

      <View style={styles.formCard}>
        <AuthInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          label="Email"
          onChangeText={setEmail}
          placeholder="Insert Email or Phone Number"
          textContentType="emailAddress"
          value={email}
        />
        <AuthInput
          autoComplete="password"
          label="Password"
          onChangeText={setPassword}
          placeholder="Insert Password"
          secureTextEntry
          textContentType="password"
          value={password}
        />
        <AuthButton disabled={isSubmitting} label={isSubmitting ? 'Signing In...' : 'Sign In'} onPress={handleSignIn} />
        <AuthButton label="Forgot password?" variant="ghost" onPress={() => Alert.alert('Coming soon', 'Password recovery will be added after the core auth flow.')} />
      </View>

      <View style={styles.social}>
        <AuthButton label="Continue with Google" variant="outline" onPress={() => Alert.alert('Coming soon', 'Google sign-in is present in the design but not configured for this milestone.')} />
        <AuthButton label="Let's Make an Account!" variant="green" onPress={() => router.push(authRoutes.signupName)} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logoBlock: {
    marginTop: 96,
    marginLeft: 17,
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
  formCard: {
    marginTop: 40,
    marginHorizontal: 17,
    padding: Spacing.lg,
    gap: Spacing.lg,
    borderWidth: 1,
    borderColor: '#D9D9D9',
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  social: {
    marginTop: 20,
    marginHorizontal: 17,
    gap: 13,
  },
});
