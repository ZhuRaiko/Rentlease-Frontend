import type { TextInputProps } from 'react-native';
import { useEffect, useState, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { authInputIdentity } from '../models/authInputPresentation';

interface AuthFieldProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  prefix?: string;
  inputRef?: Ref<TextInput>;
  allowVisibilityToggle?: boolean;
  errorMessage?: string | undefined;
}

export function AuthField({ label, prefix, inputRef, allowVisibilityToggle = false, errorMessage, ...inputProps }: AuthFieldProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { setVisible(false); }, [label, inputProps.secureTextEntry]);
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputShell, !!errorMessage && styles.invalid]}>
        {prefix ? (
          <View style={styles.prefix}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          {...inputProps}
          key={authInputIdentity(label, !!inputProps.secureTextEntry)}
          ref={inputRef}
          keyboardType={inputProps.secureTextEntry ? 'default' : inputProps.keyboardType}
          accessibilityLabel={inputProps.accessibilityLabel ?? label}
          secureTextEntry={!!inputProps.secureTextEntry && !visible}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
        {allowVisibilityToggle && inputProps.secureTextEntry ? <Pressable accessibilityRole="button" accessibilityLabel={`${visible ? 'Hide' : 'Show'} ${label?.toLowerCase() ?? 'password'}`} disabled={inputProps.editable === false} onPress={() => setVisible(current => !current)} style={styles.visibility}><Text style={styles.visibilityText}>{visible ? 'Hide' : 'Show'}</Text></Pressable> : null}
      </View>
      {errorMessage ? <Text accessibilityRole="alert" style={styles.error}>{errorMessage}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.xs, width: '100%' },
  invalid: { borderColor: colors.restricted },
  error: { color: colors.restricted, fontFamily: typography.family, fontSize: typography.caption, lineHeight: 18 },
  visibility: { minWidth: 56, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  visibilityText: { color: colors.primary, fontFamily: typography.family, fontSize: typography.caption, fontWeight: '700' },
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
