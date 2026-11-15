import type { PropsWithChildren } from 'react';
import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardAwareScrollView } from '../../../shared/components/KeyboardAwareScrollView';
import { KeyboardViewport } from '../../../shared/components/KeyboardViewport';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import type { AdminChipTone } from '../models/AdminQueuePresentation';

const chevron = '›';

/** Status or meta chip. Always carries text, never color alone; wraps instead of truncating. */
export function AdminChip({ label, tone = 'neutral' }: { label: string; tone?: AdminChipTone }) {
  return (
    <View style={[styles.chip, chipSurface[tone]]}>
      <Text style={[styles.chipText, { color: chipInk[tone] }]}>{label}</Text>
    </View>
  );
}

export function AdminChipRow({ children }: PropsWithChildren) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function AdminSectionLabel({ children }: { children: string }) {
  return <Text accessibilityRole="header" style={styles.sectionLabel}>{children}</Text>;
}

export function AdminHeading({ title, body }: { title: string; body?: string | undefined }) {
  return (
    <View style={styles.headingBlock}>
      <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
      {body ? <Text style={styles.headingBody}>{body}</Text> : null}
    </View>
  );
}

export function AdminCountBadge({ count, lowerBound = false }: { count: number | null; lowerBound?: boolean }) {
  const zero = count === 0;
  return (
    <View style={[styles.count, zero && styles.countZero]}>
      <Text style={[styles.countText, zero && styles.countTextZero]}>{count === null ? '--' : `${count}${lowerBound ? '+' : ''}`}</Text>
    </View>
  );
}

/** Dashboard row: icon-free attention card with a real count. */
export function AdminAttentionCard({ title, body, count, lowerBound, tone, onPress }: { title: string; body: string; count: number | null; lowerBound?: boolean; tone: 'warning' | 'danger' | 'info'; onPress: () => void }) {
  const countLabel = count === null ? 'count unavailable' : `${count}${lowerBound ? ' or more' : ''}`;
  const markTone = count ? tone : 'neutral';
  return (
    <Pressable accessibilityLabel={`${title}, ${countLabel}. ${body}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.attention, pressed && styles.pressed]}>
      <View style={[styles.attentionMark, markSurface[markTone]]}><Text style={[styles.attentionMarkText, { color: markInk[markTone] }]}>{count === null ? '--' : `${count}${lowerBound ? '+' : ''}`}</Text></View>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={ui.supporting}>{body}</Text>
      </View>
      <Text accessible={false} style={styles.chevron}>{chevron}</Text>
    </Pressable>
  );
}

/** One review-queue row for any tab: title, type, status chip and age. */
export function AdminQueueCard({ title, type, statusLabel, statusTone, age, flag, onPress }: { title: string; type: string; statusLabel: string; statusTone: AdminChipTone; age: string; flag?: string | undefined; onPress: () => void }) {
  return (
    <Pressable accessibilityLabel={`${title}. ${type}. ${statusLabel}. ${age}${flag ? `. ${flag}` : ''}`} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.queueCard, pressed && styles.pressed]}>
      <View style={styles.cardCopy}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={ui.supporting}>{type}</Text>
        <AdminChipRow><AdminChip label={statusLabel} tone={statusTone} /><AdminChip label={age} />{flag ? <AdminChip label={flag} tone="warning" /> : null}</AdminChipRow>
      </View>
      <Text accessible={false} style={styles.chevron}>{chevron}</Text>
    </Pressable>
  );
}

/** Tab strip for the Queues screen. Stacks vertically at large text so labels are never cut. */
export function AdminTabs<T extends string>({ tabs, selected, onSelect }: { tabs: readonly { id: T; label: string; count: number | null; lowerBound?: boolean }[]; selected: T; onSelect: (id: T) => void }) {
  const { width, fontScale } = useWindowDimensions();
  const stacked = width / fontScale < 280;
  return (
    <View accessibilityRole="tablist" style={[styles.tabs, stacked && styles.tabsStacked]}>
      {tabs.map((tab) => {
        const on = tab.id === selected;
        return (
          <Pressable accessibilityLabel={`${tab.label}, ${tab.count === null ? 'count unavailable' : `${tab.count}${tab.lowerBound ? ' or more' : ''} waiting`}`} accessibilityRole="tab" accessibilityState={{ selected: on }} key={tab.id} onPress={() => onSelect(tab.id)} style={[styles.tab, on && styles.tabOn]}>
            <Text style={[styles.tabLabel, on && styles.tabLabelOn]}>{tab.label}</Text>
            <AdminCountBadge count={tab.count} lowerBound={tab.lowerBound ?? false} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single-select filter pills (existing queue filter behavior). */
export function AdminPills<T extends string>({ options, selected, onSelect, disabled = false }: { options: readonly { id: T; label: string }[]; selected: T; onSelect: (id: T) => void; disabled?: boolean }) {
  return (
    <View style={styles.pills}>
      {options.map((option) => {
        const on = option.id === selected;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected: on, disabled }} disabled={disabled} key={option.id} onPress={() => onSelect(option.id)} style={[styles.pill, on && styles.pillOn]}>
            <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Filter chips on one horizontally scrolling row (48dp tall). The selected chip is scrolled into view; nothing wraps or is cut mid-label. */
export function AdminScrollChips<T extends string>({ options, selected, onSelect, disabled = false }: { options: readonly { id: T; label: string }[]; selected: T; onSelect: (id: T) => void; disabled?: boolean }) {
  const scroller = useRef<ScrollView>(null);
  const offsets = useRef(new Map<string, number>());
  const reveal = (id: string) => { const x = offsets.current.get(id); if (x !== undefined) scroller.current?.scrollTo({ x: Math.max(0, x - spacing.md), animated: true }); };
  return (
    <ScrollView accessibilityRole="tablist" contentContainerStyle={styles.scrollChips} horizontal ref={scroller} showsHorizontalScrollIndicator={false} style={styles.scrollChipsOuter}>
      {options.map((option) => {
        const on = option.id === selected;
        return (
          <Pressable
            accessibilityRole="tab" accessibilityState={{ selected: on, disabled }} disabled={disabled} key={option.id}
            onLayout={(event) => { offsets.current.set(option.id, event.nativeEvent.layout.x); if (on) reveal(option.id); }}
            onPress={() => { onSelect(option.id); reveal(option.id); }} style={[styles.pill, on && styles.pillOn]}>
            <Text style={[styles.pillLabel, on && styles.pillLabelOn]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function AdminEmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body ? <Text style={styles.emptyBody}>{body}</Text> : null}
    </View>
  );
}

export function AdminCard({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}

/** Collapsed by default. Keeps secondary detail out of the decision path. */
export function AdminDisclosure({ title, children }: PropsWithChildren<{ title: string }>) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.disclosure}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen((current) => !current)} style={styles.disclosureHeader}>
        <Text style={styles.disclosureTitle}>{title}</Text>
        <Text accessible={false} style={styles.disclosureMark}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <View style={styles.disclosureBody}>{children}</View> : null}
    </View>
  );
}

export function AdminDiffRow({ label, from, to, last = false }: { label: string; from: string; to: string; last?: boolean }) {
  return (
    <View accessible accessibilityLabel={`${label}: changed from ${from} to ${to}`} style={[styles.diffRow, !last && styles.diffRowRule]}>
      <Text style={ui.supporting}>{label}</Text>
      <Text style={styles.diffFrom}>{from}</Text>
      <Text style={styles.diffTo}>{`→ ${to}`}</Text>
    </View>
  );
}

export function AdminDiffCard({ children }: PropsWithChildren) {
  return <View style={styles.diffCard}>{children}</View>;
}

export function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text selectable style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function AdminCheckbox({ checked, label, onChange, disabled = false }: { checked: boolean; label: string; onChange: (next: boolean) => void; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} disabled={disabled} onPress={() => onChange(!checked)} style={[styles.option, checked && styles.optionOn]}>
      <View style={[styles.box, checked && styles.boxOn]}>{checked ? <Text accessible={false} style={styles.boxMark}>{'✓'}</Text> : null}</View>
      <Text style={styles.optionLabel}>{label}</Text>
    </Pressable>
  );
}

export function AdminRadioOption({ label, description, selected, disabled = false, disabledReason, onSelect }: { label: string; description: string; selected: boolean; disabled?: boolean; disabledReason?: string | null; onSelect: () => void }) {
  return (
    <Pressable accessibilityHint={disabledReason ?? undefined} accessibilityRole="radio" accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onSelect} style={[styles.option, selected && styles.optionOn, disabled && styles.optionDisabled]}>
      <View style={[styles.radio, selected && styles.radioOn]}>{selected ? <View style={styles.radioDot} /> : null}</View>
      <View style={styles.cardCopy}>
        <Text style={[styles.optionLabel, disabled && styles.optionLabelMuted]}>{label}</Text>
        <Text style={ui.supporting}>{disabledReason ?? description}</Text>
      </View>
    </Pressable>
  );
}

/** Bottom sheet: scrolls when content outgrows the window (large text), respects the keyboard and the bottom inset. */
export function AdminBottomSheet({ visible, title, onClose, closeDisabled = false, children }: PropsWithChildren<{ visible: boolean; title: string; onClose: () => void; closeDisabled?: boolean }>) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal animationType="slide" onRequestClose={() => { if (!closeDisabled) onClose(); }} transparent visible={visible}>
      <KeyboardViewport>
        <View style={styles.scrim}>
          <Pressable accessibilityLabel="Dismiss" accessibilityRole="button" disabled={closeDisabled} onPress={onClose} style={StyleSheet.absoluteFill} />
          <View style={[styles.sheet, { maxHeight: height * 0.9, paddingBottom: Math.max(spacing.md, insets.bottom) }]}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>
            <KeyboardAwareScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</KeyboardAwareScrollView>
          </View>
        </View>
      </KeyboardViewport>
    </Modal>
  );
}

const chipSurface: Record<AdminChipTone, { backgroundColor: string }> = {
  success: { backgroundColor: colors.primaryPale }, warning: { backgroundColor: colors.warningSurface }, danger: { backgroundColor: colors.restrictedSurface },
  info: { backgroundColor: colors.identitySurface }, neutral: { backgroundColor: colors.surface },
};
const chipInk: Record<AdminChipTone, string> = { success: colors.primaryAction, warning: colors.warning, danger: colors.restricted, info: colors.identityInk, neutral: colors.textSecondary };
/** Tone colors for marks drawn outside AdminChip (for example the outcome icon on an audit row). */
export const adminToneColors = { surface: chipSurface, ink: chipInk };
const markSurface = { warning: chipSurface.warning, danger: chipSurface.danger, info: chipSurface.info, neutral: chipSurface.neutral };
const markInk = { warning: colors.warning, danger: colors.restricted, info: colors.identityInk, neutral: colors.textSecondary };

const styles = StyleSheet.create({
  chip: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: spacing.xs + 2, paddingVertical: 2 },
  chipText: { fontFamily: typography.family, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  chipRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs - 2, marginTop: spacing.xs },
  sectionLabel: { ...ui.supporting, color: colors.textSecondary, fontWeight: '700', marginBottom: spacing.xs, marginTop: spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  headingBlock: { marginBottom: spacing.sm },
  heading: { ...ui.pageTitle },
  headingBody: { ...ui.supporting, marginTop: spacing.xxs },
  count: { alignItems: 'center', backgroundColor: colors.primaryAction, borderRadius: radius.pill, justifyContent: 'center', minHeight: 24, minWidth: 28, paddingHorizontal: spacing.xs },
  countZero: { backgroundColor: colors.surfaceStrong },
  countText: { color: colors.white, fontFamily: typography.family, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  countTextZero: { color: colors.textSecondary },
  attention: { ...ui.panel, alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48, padding: spacing.sm },
  attentionMark: { alignItems: 'center', borderRadius: radius.sm, justifyContent: 'center', minHeight: 44, minWidth: 44, paddingHorizontal: spacing.xs },
  attentionMarkText: { fontFamily: typography.family, fontSize: 20, fontWeight: '700' },
  cardCopy: { flex: 1, minWidth: 0 },
  cardTitle: { ...ui.body, fontWeight: '600' },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 27 },
  queueCard: { ...ui.panel, alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 48, padding: spacing.sm },
  tabs: { backgroundColor: colors.surface, borderRadius: radius.md, flexDirection: 'row', gap: 2, marginBottom: spacing.sm, padding: 3 },
  tabsStacked: { flexDirection: 'column' },
  tab: { alignItems: 'center', borderRadius: radius.sm + 2, flex: 1, flexDirection: 'row', gap: spacing.xs - 2, justifyContent: 'center', minHeight: 48, paddingHorizontal: spacing.xxs },
  tabOn: { backgroundColor: colors.background, borderColor: colors.controlBorder, borderWidth: 1 },
  tabLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, fontWeight: '700', flexShrink: 1 },
  tabLabelOn: { color: colors.ink },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.sm },
  scrollChipsOuter: { flexGrow: 0, marginBottom: spacing.sm },
  scrollChips: { gap: spacing.xs, paddingRight: spacing.md },
  pill: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.controlBorder, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center', minHeight: 48, minWidth: 48, paddingHorizontal: spacing.xs },
  pillOn: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  pillLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, fontWeight: '600' },
  pillLabelOn: { color: colors.white },
  empty: { ...ui.panel, gap: spacing.xxs, padding: spacing.md },
  emptyTitle: { ...ui.body, fontWeight: '600' },
  emptyBody: { ...ui.supporting },
  card: { ...ui.panel, gap: spacing.xs, padding: spacing.sm },
  disclosure: { ...ui.panel, marginTop: spacing.xs, paddingHorizontal: spacing.sm },
  disclosureHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, justifyContent: 'space-between', minHeight: 48 },
  disclosureTitle: { ...ui.body, flex: 1, fontWeight: '600' },
  disclosureMark: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 22, fontWeight: '600' },
  disclosureBody: { gap: spacing.xs, paddingBottom: spacing.sm },
  diffCard: { ...ui.panel, overflow: 'hidden' },
  diffRow: { gap: 2, padding: spacing.sm },
  diffRowRule: { borderBottomColor: colors.outline, borderBottomWidth: 1 },
  diffFrom: { ...ui.supporting, textDecorationLine: 'line-through' },
  diffTo: { ...ui.body, fontWeight: '700' },
  detailRow: { gap: 2 },
  detailLabel: { ...ui.supporting },
  detailValue: { ...ui.body },
  option: { ...ui.control, alignItems: 'center', backgroundColor: colors.background, borderColor: colors.outline, flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xs, paddingHorizontal: spacing.sm },
  optionOn: { backgroundColor: colors.primaryPale, borderColor: colors.primaryAction },
  optionDisabled: { backgroundColor: colors.surface, borderColor: colors.outline },
  optionLabelMuted: { color: colors.textSecondary },
  optionLabel: { ...ui.body, flex: 1, fontWeight: '600' },
  box: { alignItems: 'center', borderColor: colors.controlBorder, borderRadius: radius.firm, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  boxOn: { backgroundColor: colors.primaryAction, borderColor: colors.primaryAction },
  boxMark: { color: colors.white, fontFamily: typography.family, fontSize: 16, fontWeight: '700', lineHeight: 20 },
  radio: { alignItems: 'center', borderColor: colors.controlBorder, borderRadius: radius.pill, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioOn: { borderColor: colors.primaryAction },
  radioDot: { backgroundColor: colors.primaryAction, borderRadius: radius.pill, height: 12, width: 12 },
  scrim: { backgroundColor: colors.overlay, flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.background, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  sheetTitle: { ...ui.sectionTitle, fontSize: 18, lineHeight: 24 },
  sheetContent: { gap: spacing.xs, paddingTop: spacing.xs },
  pressed: { opacity: 0.72 },
});
