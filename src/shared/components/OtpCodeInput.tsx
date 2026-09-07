import { StyleSheet, TextInput, View } from 'react-native';

import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

interface OtpCodeInputProps {
  value: string;
  onChangeDigit: (index: number, digit: string) => void;
}

export function OtpCodeInput({ value, onChangeDigit }: OtpCodeInputProps) {
  const digits = value.padEnd(4, ' ').slice(0, 4).split('');

  return (
    <View style={styles.row}>
      {digits.map((digit, index) => (
        <TextInput
          accessibilityLabel={`Verification code digit ${index + 1}`}
          autoComplete="one-time-code"
          inputMode="numeric"
          key={index}
          maxLength={1}
          onChangeText={(nextDigit) => onChangeDigit(index, nextDigit)}
          selectTextOnFocus
          style={[styles.input, index === 2 && styles.activeInput]}
          value={digit.trim()}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  input: {
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1.6,
    color: colors.textSecondary,
    flex: 1,
    fontFamily: typography.family,
    fontSize: 24,
    fontWeight: '700',
    height: 71,
    maxWidth: 71,
    minWidth: 52,
    textAlign: 'center',
  },
  activeInput: { borderColor: colors.primary },
});
