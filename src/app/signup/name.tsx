import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AuthButton, AuthInput, AuthScreen, BackButton, SignupHeading } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { authRoutes } from '@/features/auth/routes';

export default function SignupNameScreen() {
  const { signupDraft, updateSignupDraft } = useAuth();
  const [firstName, setFirstName] = useState(signupDraft.firstName);
  const [lastName, setLastName] = useState(signupDraft.lastName);

  function handleNext() {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Name required', 'Please enter your first and last name.');
      return;
    }

    updateSignupDraft({ firstName: firstName.trim(), lastName: lastName.trim() });
    router.push(authRoutes.signupNickname);
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <SignupHeading title="Please enter your name." />
        <View style={styles.fields}>
          <AuthInput onChangeText={setFirstName} placeholder="First Name" value={firstName} />
          <AuthInput onChangeText={setLastName} placeholder="Last Name" value={lastName} />
        </View>
        <AuthButton label="Next" onPress={handleNext} style={styles.nextButton} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 194,
  },
  fields: {
    marginTop: 48,
    marginHorizontal: 18,
    gap: 9,
  },
  nextButton: {
    marginTop: 16,
    marginHorizontal: 53,
  },
});
