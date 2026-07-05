import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthButton, AuthInput, AuthScreen, BackButton, SignupHeading } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { authRoutes } from '@/features/auth/routes';

export default function SignupEmailScreen() {
  const { signupDraft, updateSignupDraft } = useAuth();
  const [email, setEmail] = useState(signupDraft.email);

  function handleNext() {
    const normalizedEmail = email.trim().toLowerCase();

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      Alert.alert('Valid email required', 'Enter the email address you want to use for RentLease.');
      return;
    }

    updateSignupDraft({ email: normalizedEmail });
    router.push(authRoutes.signupPhone);
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <SignupHeading title="Enter your E-mail address" />
        <View style={styles.fields}>
          <AuthInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="E-mail Address"
            textContentType="emailAddress"
            value={email}
          />
        </View>
        <AuthButton label="Next" onPress={handleNext} style={styles.nextButton} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 190,
  },
  fields: {
    marginTop: 76,
    marginHorizontal: 14,
  },
  nextButton: {
    marginTop: 62,
    marginHorizontal: 49,
  },
});
