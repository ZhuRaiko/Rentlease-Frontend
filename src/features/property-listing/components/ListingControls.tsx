import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

interface ListingFieldProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric';
  prefix?: string;
  helper?: string;
}

export function ListingField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = 'default',
  prefix,
  helper,
}: ListingFieldProps) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
      <View style={[styles.inputShell, multiline && styles.inputShellMultiline]}>
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          keyboardType={keyboardType}
          multiline={multiline}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, multiline && styles.multiline]}
          textAlignVertical={multiline ? 'top' : 'center'}
          value={value}
        />
      </View>
    </View>
  );
}

interface ChoiceChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: 'green' | 'orange' | 'purple';
}

export function ChoiceChip({ label, selected, onPress, tone = 'green' }: ChoiceChipProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles[`${tone}Chip`],
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

interface CounterRowProps {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

export function CounterRow({ label, value, onDecrease, onIncrease }: CounterRowProps) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <Pressable accessibilityLabel={`Decrease ${label}`} onPress={onDecrease} style={styles.counterButton}>
          <Text style={styles.counterButtonLabel}>−</Text>
        </Pressable>
        <Text style={styles.counterValue}>{value}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} onPress={onIncrease} style={styles.counterButton}>
          <Text style={styles.counterButtonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

interface SectionCardProps {
  children: ReactNode;
}

export function SectionCard({ children }: SectionCardProps) {
  return <View style={styles.sectionCard}>{children}</View>;
}

const styles = StyleSheet.create({
  fieldGroup: { gap: spacing.xs },
  fieldLabel: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '800' },
  helper: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  inputShell: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
  },
  inputShellMultiline: { alignItems: 'flex-start', minHeight: 116, paddingVertical: spacing.sm },
  prefix: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '700' },
  input: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, padding: 0 },
  multiline: { minHeight: 90 },
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  greenChip: { backgroundColor: '#147A2D', borderColor: '#147A2D' },
  orangeChip: { backgroundColor: '#DF9415', borderColor: '#DF9415' },
  purpleChip: { backgroundColor: '#9341B3', borderColor: '#9341B3' },
  chipLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  chipLabelSelected: { color: colors.white },
  pressed: { opacity: 0.72 },
  counterRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  counterLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  counterControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  counterButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  counterButtonLabel: { color: colors.text, fontFamily: typography.family, fontSize: 22 },
  counterValue: { color: colors.text, fontFamily: typography.family, fontSize: 15, minWidth: 18, textAlign: 'center' },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.card,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
});
