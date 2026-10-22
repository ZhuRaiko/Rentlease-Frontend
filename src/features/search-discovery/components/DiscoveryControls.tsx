import type { PropsWithChildren } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { DiscoveryIcon } from './DiscoveryIcon';

import { AppButton } from '../../../shared/components/AppButton';
import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import { ui } from '../../../shared/theme/ui';

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
  return <ScreenHeader title={title} onBack={onBack} onClose={onBack ? undefined : onClose}
    action={actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.headerControl}><Text style={styles.headerAction}>{actionLabel}</Text></Pressable> : undefined} />;
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
  return <AppButton label={label} onPress={onPress} disabled={disabled}
    variant={tone === 'outline' ? 'secondary' : tone === 'dark' ? 'dark' : 'primary'} />;
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
        <Pressable accessibilityRole="button" onPress={() => onChangeText('')} style={styles.headerControl}>
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
  headerControl: { minHeight: 48, minWidth: 48, justifyContent: 'center' },
  headerAction: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  chip: { ...ui.control, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipSelected: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  chipLabel: { ...ui.supporting, flexShrink: 1, fontWeight: '500' },
  chipLabelSelected: { color: colors.white },
  counterRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 50 },
  counterLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  counterControls: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  counterButton: { ...ui.control, alignItems: 'center', justifyContent: 'center', minWidth: 48 },
  counterValue: { color: colors.text, fontFamily: typography.family, fontSize: 13, minWidth: 30, textAlign: 'center' },
  minusIcon: { backgroundColor: colors.text, borderRadius: 2, height: 2, width: 12 },
  plusIcon: { backgroundColor: colors.text, borderRadius: 2, height: 2, position: 'relative', width: 12 },
  plusVertical: { backgroundColor: colors.text, borderRadius: 2, height: 12, left: 5, position: 'absolute', top: -5, width: 2 },
  searchBar: { ...ui.control, alignItems: 'center', backgroundColor: colors.background, flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 0 },
  searchInput: { ...ui.body, flex: 1, minWidth: 0, paddingVertical: spacing.sm },
  clearLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '700' },
  sectionCard: { ...ui.panel, gap: spacing.sm, padding: spacing.md },
  sectionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '800' },
  sectionDescription: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 17 },
  pressed: { opacity: 0.72 },
});
