import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthButton, AuthScreen, BackButton, OtpBoxes } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { completeVerifiedPhoneSignup, verifyPhoneOtp } from '@/features/auth/auth-service';
import { recommendationRoutes } from '@/features/recommendations/routes';

// DEV ONLY: use 0000 to walk through signup before Twilio/Supabase SMS is configured.
// When testing real phone verification, set this false or remove this block so verifyPhoneOtp() is required.
const ENABLE_DEV_OTP_BYPASS = __DEV__;
const DEV_OTP_CODE = '0000';

export default function SignupOtpScreen() {
  const { resetSignupDraft, signupDraft } = useAuth();
  const [code, setCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleVerify() {
    if (code.length !== 4) {
      Alert.alert('Code required', 'Enter the 4-digit code sent to your phone.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (ENABLE_DEV_OTP_BYPASS && code === DEV_OTP_CODE) {
        resetSignupDraft();
        router.replace(recommendationRoutes.intro);
        return;
      }

      await verifyPhoneOtp(signupDraft.phone, code);
      await completeVerifiedPhoneSignup(signupDraft);
      resetSignupDraft();
      router.replace(recommendationRoutes.intro);
    } catch (error) {
      Alert.alert(
        'Verification failed',
        error instanceof Error ? error.message : 'Please check the code and try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <ThemedText style={styles.title}>Enter the 4-digit code we sent to you.</ThemedText>
        <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpPressable}>
          <OtpBoxes value={code} focusedIndex={Math.min(code.length, 3)} />
        </Pressable>
        <TextInput
          ref={inputRef}
          autoFocus
          caretHidden
          keyboardType="number-pad"
          maxLength={4}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 4))}
          style={styles.hiddenInput}
          value={code}
        />
        <AuthButton
          disabled={isSubmitting}
          label={isSubmitting ? 'Verifying...' : 'Verify'}
          onPress={handleVerify}
          style={styles.nextButton}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 190,
  },
  title: {
    fontSize: 34,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: 0,
  },
  otpPressable: {
    marginTop: 34,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  nextButton: {
    marginTop: 42,
    marginHorizontal: 49,
  },
});
