import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AuthButton, AuthScreen, BackButton } from '@/features/auth/components';
import { useAuth } from '@/features/auth/auth-context';
import { requestPhoneOtp } from '@/features/auth/auth-service';
import { authRoutes } from '@/features/auth/routes';
import { useTheme } from '@/hooks/use-theme';

// DEV ONLY: keep this true while Twilio/Supabase SMS is not configured.
// When testing real phone verification, remove this branch and require requestPhoneOtp() to succeed.
const ENABLE_DEV_OTP_BYPASS = __DEV__;

function normalizePhilippinePhone(value: string) {
  const digits = value.replace(/\D/g, '');

  if (digits.startsWith('63')) {
    return `+${digits}`;
  }

  if (digits.startsWith('0')) {
    return `+63${digits.slice(1)}`;
  }

  return `+63${digits}`;
}

export default function SignupPhoneScreen() {
  const { signupDraft, updateSignupDraft } = useAuth();
  const theme = useTheme();
  const [phone, setPhone] = useState(signupDraft.phone.replace(/^\+63/, ''));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstName = signupDraft.nickname || signupDraft.firstName || 'there';

  async function handleNext() {
    const normalizedPhone = normalizePhilippinePhone(phone);

    if (!/^\+639\d{9}$/.test(normalizedPhone)) {
      Alert.alert('Valid phone required', 'Enter a valid Philippine mobile number.');
      return;
    }

    updateSignupDraft({ phone: normalizedPhone });

    try {
      setIsSubmitting(true);
      await requestPhoneOtp(normalizedPhone);
    } catch (error) {
      if (ENABLE_DEV_OTP_BYPASS) {
        console.warn('Dev OTP bypass active. Supabase SMS send was skipped/failed.', error);
      } else {
        Alert.alert(
          'SMS setup needed',
          error instanceof Error
            ? error.message
            : 'Supabase could not send an SMS code. Check your Supabase phone auth provider.'
        );
        return;
      }
    } finally {
      setIsSubmitting(false);
    }

    router.push(authRoutes.signupPassword);
  }

  return (
    <AuthScreen>
      <BackButton onPress={() => router.back()} />
      <View style={styles.content}>
        <ThemedText style={styles.title}>
          {`You're nearly set, ${firstName}! Lastly verify your Phone number`}
        </ThemedText>
        <ThemedText style={styles.helper}>
          {"We'll send a short code to confirm it's really you - takes less than a minute."}
        </ThemedText>

        <View style={[styles.phoneField, { borderColor: theme.text }]}>
          <View style={styles.prefix}>
            <ThemedText style={styles.prefixText}>+63</ThemedText>
            <ThemedText style={styles.caret}>v</ThemedText>
          </View>
          <TextInput
            keyboardType="phone-pad"
            maxLength={10}
            onChangeText={setPhone}
            placeholder="Enter Phone Number"
            placeholderTextColor={theme.textMuted}
            style={[styles.phoneInput, { color: theme.text }]}
            value={phone}
          />
          <ThemedText style={styles.phoneIcon}>tel</ThemedText>
        </View>

        <AuthButton
          disabled={isSubmitting}
          label={isSubmitting ? 'Sending...' : 'Next'}
          onPress={handleNext}
          style={styles.nextButton}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 174,
  },
  title: {
    fontSize: 32,
    lineHeight: 42,
    fontWeight: '800',
    letterSpacing: 0,
  },
  helper: {
    marginTop: 8,
    width: 274,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '200',
  },
  phoneField: {
    marginTop: 36,
    marginHorizontal: 10,
    height: 48,
    borderWidth: 0.2,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  prefix: {
    width: 72,
    height: '100%',
    borderRightWidth: 0.2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  prefixText: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '400',
  },
  caret: {
    fontSize: 18,
    lineHeight: 18,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 16,
    lineHeight: 20,
  },
  phoneIcon: {
    width: 40,
    opacity: 0.24,
    fontSize: 22,
    textAlign: 'center',
  },
  nextButton: {
    marginTop: 91,
    marginHorizontal: 49,
  },
});
