import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthButton, AuthInput, AuthScreen, BackButton, SignupHeading } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { ThemedText } from '@/components/themed-text';
import { authRoutes } from '@/features/auth/routes';

export default function SignupNicknameScreen() {
  const { signupDraft, updateSignupDraft } = useAuth();
  const [nickname, setNickname] = useState(signupDraft.nickname);

  function handleNext() {
    if (!nickname.trim()) {
      Alert.alert('Nickname required', 'Tell us what we should call you.');
      return;
    }

    updateSignupDraft({ nickname: nickname.trim() });
    router.push(authRoutes.signupEmail);
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <SignupHeading title="What should we call you?" />
        <View style={styles.fields}>
          <AuthInput onChangeText={setNickname} placeholder="Nickname" value={nickname} />
          <ThemedText style={styles.helper}>
            {"We'll use this in notifications and messages from us."}
          </ThemedText>
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
    gap: 10,
  },
  helper: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '200',
    opacity: 0.57,
  },
  nextButton: {
    marginTop: 54,
    marginHorizontal: 49,
  },
});
