import { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthScreenProps = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

export function AuthScreen({ children, contentStyle }: AuthScreenProps) {
  const theme = useTheme();

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      <SafeAreaView style={[styles.safeArea, contentStyle]}>{children}</SafeAreaView>
    </KeyboardAvoidingView>
  );
}

export function RentLeaseLogo({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();

  return (
    <View style={[styles.logoWrap, compact && styles.logoWrapCompact]}>
      <View style={[styles.logoMark, compact && styles.logoMarkCompact, { borderColor: theme.text }]}>
        <ThemedText style={[styles.logoMarkText, compact && styles.logoMarkTextCompact]}>RL</ThemedText>
      </View>
      <ThemedText style={[styles.logoText, compact && styles.logoTextCompact]}>RentLease</ThemedText>
    </View>
  );
}

export function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      onPress={onPress}
      style={({ pressed }) => [
        styles.backButton,
        { borderColor: theme.borderStrong },
        pressed && styles.pressed,
      ]}>
      <ThemedText style={styles.backButtonText}>{'<'}</ThemedText>
    </Pressable>
  );
}

type AuthInputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function AuthInput({ label, error, style, ...props }: AuthInputProps) {
  const theme = useTheme();

  return (
    <View style={styles.inputGroup}>
      {label ? <ThemedText style={styles.inputLabel}>{label}</ThemedText> : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          {
            backgroundColor: theme.backgroundElement,
            borderColor: error ? theme.danger : theme.borderStrong,
            color: theme.text,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

type AuthButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'green' | 'outline' | 'ghost';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function AuthButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: AuthButtonProps) {
  const theme = useTheme();
  const isFilled = variant === 'primary' || variant === 'green';
  const backgroundColor =
    variant === 'primary' ? theme.authButton : variant === 'green' ? theme.primary : 'transparent';
  const borderColor = variant === 'outline' ? theme.border : backgroundColor;
  const color = isFilled ? theme.inverseText : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.45 : pressed ? 0.78 : 1,
        },
        variant === 'ghost' && styles.ghostButton,
        style,
      ]}>
      <ThemedText style={[styles.buttonText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

type ChoiceCardProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  variant?: 'neutral' | 'green';
};

export function ChoiceCard({ title, subtitle, onPress, variant = 'neutral' }: ChoiceCardProps) {
  const theme = useTheme();
  const backgroundColor = variant === 'green' ? theme.createAccount : theme.welcomeChoice;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        { backgroundColor },
        pressed && styles.pressed,
      ]}>
      <View style={styles.choiceText}>
        <ThemedText style={styles.choiceTitle}>{title}</ThemedText>
        {subtitle ? <ThemedText style={styles.choiceSubtitle}>{subtitle}</ThemedText> : null}
      </View>
      <ThemedText style={[styles.choiceArrow, { color: theme.text }]}>{'>'}</ThemedText>
    </Pressable>
  );
}

export function SignupHeading({ title, helper }: { title: string; helper?: string }) {
  return (
    <View style={styles.signupHeading}>
      <ThemedText style={styles.signupTitle}>{title}</ThemedText>
      {helper ? <ThemedText style={styles.signupHelper}>{helper}</ThemedText> : null}
    </View>
  );
}

export function OtpBoxes({ value, focusedIndex = 0 }: { value: string; focusedIndex?: number }) {
  const theme = useTheme();
  const digits = Array.from({ length: 4 }, (_, index) => value[index] ?? '');

  return (
    <View style={styles.otpRow}>
      {digits.map((digit, index) => (
        <View
          key={index}
          style={[
            styles.otpBox,
            {
              borderColor: index === focusedIndex ? theme.primary : '#DDDDDD',
            },
          ]}>
          <ThemedText style={styles.otpDigit}>{digit}</ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: 21,
  },
  logoWrap: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoWrapCompact: {
    gap: 6,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMarkCompact: {
    width: 34,
    height: 34,
    borderRadius: 9,
  },
  logoMarkText: {
    fontSize: 17,
    lineHeight: 20,
    fontWeight: '800',
  },
  logoMarkTextCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  logoText: {
    ...Typography.display,
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    letterSpacing: 0,
  },
  logoTextCompact: {
    fontSize: 30,
    lineHeight: 36,
  },
  backButton: {
    position: 'absolute',
    left: 14,
    top: 50,
    zIndex: 2,
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 34,
    lineHeight: 36,
    fontWeight: '300',
    marginTop: -3,
  },
  inputGroup: {
    alignSelf: 'stretch',
    gap: Spacing.xs,
  },
  inputLabel: {
    ...Typography.body,
  },
  input: {
    ...Typography.body,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostButton: {
    minHeight: 0,
    borderWidth: 0,
    paddingVertical: Spacing.xs,
  },
  buttonText: {
    ...Typography.body,
  },
  choiceCard: {
    width: '100%',
    minHeight: 170,
    borderRadius: Radius.md,
    paddingHorizontal: 20,
    paddingVertical: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceText: {
    flex: 1,
    gap: 12,
  },
  choiceTitle: {
    ...Typography.display,
    fontWeight: '800',
  },
  choiceSubtitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '200',
    letterSpacing: 0,
  },
  choiceArrow: {
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '200',
  },
  signupHeading: {
    gap: Spacing.md,
  },
  signupTitle: {
    fontSize: 48,
    lineHeight: 56,
    fontWeight: '800',
    letterSpacing: 0,
  },
  signupHelper: {
    fontSize: 14,
    lineHeight: 24,
    fontWeight: '200',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  otpBox: {
    flex: 1,
    maxWidth: 71,
    aspectRatio: 1,
    borderWidth: 1.6,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpDigit: {
    fontSize: 24,
    lineHeight: 29,
    fontWeight: '700',
    color: '#757575',
  },
  pressed: {
    opacity: 0.75,
  },
});
