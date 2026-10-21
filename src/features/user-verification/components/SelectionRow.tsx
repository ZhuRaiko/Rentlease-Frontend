import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const chevron = require('../../../assets/verification/chevron-right.png');

interface SelectionRowProps {
  label: string;
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}

export function SelectionRow({ label, detail, selected = false, onPress }: SelectionRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {selected ? <Text style={styles.selectionLabel}>Selected</Text> : null}
      <Image resizeMode="contain" source={chevron} style={styles.chevron} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  selectionLabel: { color: colors.trustedText, fontFamily: typography.family, fontSize: 12, marginHorizontal: spacing.xs },
  row: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 64,
    paddingHorizontal: spacing.md,
  },
  selected: { backgroundColor: colors.primaryPale },
  pressed: { backgroundColor: colors.surface },
  copy: { flex: 1, gap: spacing.xxs },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 16,
    fontWeight: '700',

  },
  detail: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12 },
  chevron: { height: 32, width: 18 },
});
