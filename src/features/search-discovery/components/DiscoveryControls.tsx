import type { PropsWithChildren } from 'react';
import { Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryIcon } from './DiscoveryIcon';

const backIcon = require('../../../assets/verification/back.png');

interface DiscoveryHeaderProps {
  title: string;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

export function DiscoveryHeader({
  title,
  onBack,
  onClose,
  actionLabel,
  onAction,
}: DiscoveryHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack}>
            <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
          </Pressable>
        ) : onClose ? (
          <Pressable accessibilityRole="button" onPress={onClose}>
            <Text style={styles.headerAction}>Close</Text>
          </Pressable>
        ) : null}
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        {actionLabel && onAction ? (
          <Pressable accessibilityRole="button" onPress={onAction}>
            <Text style={styles.headerAction}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface DiscoveryButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'green' | 'dark' | 'outline';
  disabled?: boolean;
}

export function DiscoveryButton({
  label,
  onPress,
  tone = 'green',
  disabled = false,
}: DiscoveryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'green' && styles.buttonGreen,
        tone === 'dark' && styles.buttonDark,
        tone === 'outline' && styles.buttonOutline,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.buttonLabel, tone === 'outline' && styles.buttonOutlineLabel]}>{label}</Text>
    </Pressable>
  );
}

interface DiscoveryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function DiscoveryChip({ label, selected, onPress }: DiscoveryChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

interface DiscoveryCounterProps {
  label: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}

export function DiscoveryCounter({ label, value, onDecrease, onIncrease }: DiscoveryCounterProps) {
  return (
    <View style={styles.counterRow}>
      <Text style={styles.counterLabel}>{label}</Text>
      <View style={styles.counterControls}>
        <Pressable accessibilityLabel={`Decrease ${label}`} accessibilityRole="button" onPress={onDecrease} style={styles.counterButton}>
          <View style={styles.minusIcon} />
        </Pressable>
        <Text style={styles.counterValue}>{value || 'Any'}</Text>
        <Pressable accessibilityLabel={`Increase ${label}`} accessibilityRole="button" onPress={onIncrease} style={styles.counterButton}>
          <View style={styles.plusIcon}><View style={styles.plusVertical} /></View>
        </Pressable>
      </View>
    </View>
  );
}

interface DiscoverySearchBarProps {
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: (() => void) | undefined;
  onSubmit: () => void;
  placeholder?: string;
}

export function DiscoverySearchBar({
  value,
  onChangeText,
  onFocus,
  onSubmit,
  placeholder = 'Search city or location',
}: DiscoverySearchBarProps) {
  return (
    <View style={styles.searchBar}>
      <DiscoveryIcon color={colors.textSecondary} name="search" size={20} />
      <TextInput
        accessibilityLabel="Search location"
        onChangeText={onChangeText}
        onFocus={onFocus}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
        style={styles.searchInput}
        value={value}
      />
      {value ? (
        <Pressable accessibilityRole="button" onPress={() => onChangeText('')}>
          <Text style={styles.clearLabel}>Clear</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface SectionCardProps extends PropsWithChildren {
  title: string;
  description?: string;
}

export function DiscoverySectionCard({ title, description, children }: SectionCardProps) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', flexDirection: 'row', minHeight: 64, paddingHorizontal: spacing.md },
  headerSide: { alignItems: 'flex-start', minWidth: 72 },
  headerSideRight: { alignItems: 'flex-end' },
  backIcon: { height: 38, width: 38 },
  headerTitle: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  headerAction: { color: colors.primary, fontFamily: typography.family, fontSize: 14, fontWeight: '800' },
  button: { alignItems: 'center', borderRadius: radius.md, height: 52, justifyContent: 'center', paddingHorizontal: spacing.lg, width: '100%' },
  buttonGreen: { backgroundColor: colors.primary },
  buttonDark: { backgroundColor: colors.text },
  buttonOutline: { backgroundColor: colors.background, borderColor: colors.border, borderWidth: 1.5 },
  buttonDisabled: { backgroundColor: colors.surfaceStrong },
  buttonLabel: { color: colors.white, fontFamily: typography.family, fontSize: 15, fontWeight: '800' },
  buttonOutlineLabel: { color: colors.text },
  chip: { borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  chipLabelSelected: { color: colors.white },
  counterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50 },
  counterLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  counterControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  counterButton: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  counterValue: { color: colors.text, fontFamily: typography.family, fontSize: 13, minWidth: 30, textAlign: 'center' },
  minusIcon: { backgroundColor: colors.text, borderRadius: 2, height: 2, width: 12 },
  plusIcon: { backgroundColor: colors.text, borderRadius: 2, height: 2, position: 'relative', width: 12 },
  plusVertical: { backgroundColor: colors.text, borderRadius: 2, height: 12, left: 5, position: 'absolute', top: -5, width: 2 },
  searchBar: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 50, paddingHorizontal: spacing.md },
  searchInput: { color: colors.text, flex: 1, fontFamily: typography.family, fontSize: 14, paddingVertical: spacing.sm },
  clearLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  sectionCard: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  sectionDescription: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
