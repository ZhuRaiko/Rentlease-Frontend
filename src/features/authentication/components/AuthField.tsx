import type { TextInputProps } from 'react-native';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  prefix?: string;
}

export function AuthField({ label, prefix, ...inputProps }: AuthFieldProps) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputShell}>
        {prefix ? (
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          {...inputProps}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, width: '100%' },
  label: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: typography.label,
    fontWeight: '600',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 52,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontFamily: typography.family,
    fontSize: typography.body,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  prefix: {
    borderRightColor: colors.border,
    borderRightWidth: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: spacing.sm,
  },
  prefixText: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: typography.body,
  },
});
