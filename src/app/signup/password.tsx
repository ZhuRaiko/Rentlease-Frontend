import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthButton, AuthInput, AuthScreen, BackButton } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { authRoutes } from '@/features/auth/routes';

function isStrongPassword(password: string) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(password);
}

export default function SignupPasswordScreen() {
  const { signupDraft, updateSignupDraft } = useAuth();
  const [password, setPassword] = useState(signupDraft.password);

  function handleNext() {
    if (!isStrongPassword(password)) {
      Alert.alert(
        'Stronger password needed',
        'Use at least 8 characters with uppercase, lowercase, a number, and a special character.'
      );
      return;
    }

    updateSignupDraft({ password });
    router.push(authRoutes.signupOtp);
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <ThemedText style={styles.title}>Enter your password.</ThemedText>
        <ThemedText style={styles.helper}>
          Must be at least 8 characters long and include uppercase and lowercase letters, a number,
          and a special character (e.g., !@#$%).
        </ThemedText>
        <View style={styles.field}>
          <AuthInput
            autoComplete="new-password"
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
            textContentType="newPassword"
            value={password}
          />
        </View>
        <AuthButton label="Next" onPress={handleNext} style={styles.nextButton} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 230,
  },
  title: {
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: 0,
  },
  helper: {
    marginTop: 0,
    width: 318,
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '200',
  },
  field: {
    marginTop: 45,
    marginHorizontal: 14,
  },
  nextButton: {
    marginTop: 42,
    marginHorizontal: 49,
  },
});
