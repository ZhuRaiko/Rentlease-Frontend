import type {ReactNode} from 'react';
import {Pressable, StyleSheet, Switch, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {CheckMark, Chevron} from './PreferenceIcons';

/** A card of the Matching preferences screen: a rounded panel with the shared look. */
export function PreferencePanel({children}: {children: ReactNode}) {
  return <View style={styles.panel}>{children}</View>;
}

/** "About you" folded to one line, with Change. Shown whenever another card is the open one. */
export function AboutFolded({summary, onChange}: {summary: string; onChange: () => void}) {
  return <View style={[styles.panel, styles.folded]}>
    <View style={styles.foldedCopy}>
      <Text style={styles.cardTitle}>About you</Text>
      <Text numberOfLines={1} ellipsizeMode="tail" style={ui.supporting}>{summary}</Text>
    </View>
    <Pressable accessibilityLabel={`Change About you. ${summary}`} accessibilityRole="button" onPress={onChange} style={styles.change}>
      <Text style={styles.changeLabel}>Change</Text>
    </Pressable>
  </View>;
}

/**
 * Property, Budget and What matters most: a card with a live one-line summary. Closed it shows the summary (and, while About you is the open card,
 * the icon and the Optional tag); open it shows its icon, title, Optional tag and the controls.
 */
export function PreferenceCard({title, summary, summaryLines = 1, hint, icon, open, roomy, onToggle, children}: {title: string; summary: string; /** Lines the closed summary may use before it is cut with an ellipsis; two on tight layouts so large text does not hide the values. */ summaryLines?: number; hint?: string; icon: ReactNode; open: boolean; roomy: boolean; onToggle: () => void; children: ReactNode}) {
  const showIcon = open || roomy;
  return <View style={styles.panel}>
    <Pressable accessibilityLabel={`${title}, optional. ${summary}`} accessibilityRole="button" accessibilityState={{expanded: open}} onPress={onToggle} style={styles.cardHead}>
      {showIcon ? <View accessible={false} style={styles.iconCircle}>{icon}</View> : null}
      <View style={styles.headCopy}>
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{title}</Text>
          {showIcon ? <View style={styles.tag}><Text style={styles.tagText}>Optional</Text></View> : null}
        </View>
        {open ? (hint ? <Text style={ui.supporting}>{hint}</Text> : null) : <Text numberOfLines={summaryLines} ellipsizeMode="tail" style={ui.supporting}>{summary}</Text>}
      </View>
      <Chevron up={open} />
    </Pressable>
    {open ? <View style={styles.body}>{children}</View> : null}
  </View>;
}

/**
 * One option of a group. Single choice is a filled dark pill; multi-select is an outlined green pill with a check. The two look different on purpose:
 * a filled pill is "this one", an outlined pill with a check is "this one too".
 */
export function ChoicePill({label, selected, multi = false, onPress, accessibilityLabel}: {label: string; selected: boolean; multi?: boolean; onPress: () => void; accessibilityLabel?: string}) {
  return <Pressable accessibilityLabel={accessibilityLabel ?? label} accessibilityRole={multi ? 'checkbox' : 'radio'} accessibilityState={multi ? {checked: selected} : {selected}} onPress={onPress}
    style={({pressed}) => [styles.pill, multi ? selected && styles.pillMulti : selected && styles.pillSingle, pressed && styles.pressed]}>
    {multi && selected ? <CheckMark /> : null}
    <Text style={[styles.pillLabel, selected && (multi ? styles.pillLabelMulti : styles.pillLabelSingle)]}>{label}</Text>
  </Pressable>;
}

/** A length-of-stay option: a title and a detail line. The accessibility label is the full stored label. */
export function StayChoice({title, detail, label, selected, full, onPress}: {title: string; detail: string; label: string; selected: boolean; full: boolean; onPress: () => void}) {
  return <Pressable accessibilityLabel={label} accessibilityRole="radio" accessibilityState={{selected}} onPress={onPress} style={({pressed}) => [styles.stay, full && styles.stayFull, selected && styles.pillSingle, pressed && styles.pressed]}>
    <Text style={[styles.stayTitle, selected && styles.pillLabelSingle]}>{title}</Text>
    <Text style={[ui.supporting, styles.stayDetail, selected && styles.stayDetailOn]}>{detail}</Text>
  </Pressable>;
}

export function GroupTitle({children, note}: {children: ReactNode; note?: string}) {
  return <Text accessibilityRole="header" style={styles.groupTitle}>{children}{note ? <Text style={styles.groupNote}>{`  ·  ${note}`}</Text> : null}</Text>;
}

/** "Prioritize nearby essentials": a switch row, on every state of the screen. */
export function NearbySwitchRow({value, onChange}: {value: boolean; onChange: (next: boolean) => void}) {
  return <Pressable accessibilityRole="switch" accessibilityState={{checked: value}} accessibilityLabel="Prioritize nearby essentials. Schools, hospitals, malls, and transport terminals." onPress={() => onChange(!value)} style={[styles.panel, styles.switchRow]}>
    <View style={styles.headCopy}>
      <Text style={styles.cardTitle}>Prioritize nearby essentials</Text>
      <Text style={ui.supporting}>Schools, hospitals, malls, and transport terminals.</Text>
    </View>
    <Switch accessible={false} importantForAccessibility="no" pointerEvents="none" value={value} onValueChange={onChange} thumbColor={colors.white} trackColor={{false: colors.border, true: colors.primaryAction}} />
  </Pressable>;
}

const styles = StyleSheet.create({
  panel: {backgroundColor: colors.background, borderColor: colors.outline, borderWidth: 1, borderRadius: radius.lg, padding: spacing.md},
  folded: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm},
  foldedCopy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  change: {minHeight: 48, minWidth: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs},
  changeLabel: {color: colors.primaryAction, fontFamily: typography.family, fontSize: 15, fontWeight: '700'},
  cardTitle: {color: colors.ink, fontFamily: typography.family, fontSize: 17, lineHeight: 23, fontWeight: '700'},
  cardHead: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48},
  iconCircle: {width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center'},
  headCopy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  titleRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: spacing.xs},
  tag: {minHeight: 22, paddingHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: colors.surface, justifyContent: 'center'},
  tagText: {color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, fontWeight: '500'},
  body: {gap: spacing.md, paddingTop: spacing.md},
  pill: {minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background},
  pillSingle: {backgroundColor: colors.ink, borderColor: colors.ink},
  pillMulti: {backgroundColor: colors.primaryPale, borderColor: colors.primaryAction},
  pillLabel: {color: colors.ink, fontFamily: typography.family, fontSize: 14, fontWeight: '500', flexShrink: 1},
  pillLabelSingle: {color: colors.white},
  pillLabelMulti: {color: colors.primaryAction, fontWeight: '600'},
  stay: {flexBasis: '48%', flexGrow: 1, minHeight: 60, justifyContent: 'center', gap: spacing.xxs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background},
  stayFull: {flexBasis: '100%'},
  stayTitle: {color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 20, fontWeight: '700'},
  stayDetail: {lineHeight: 16},
  stayDetailOn: {color: colors.outline},
  groupTitle: {color: colors.ink, fontFamily: typography.family, fontSize: 15, lineHeight: 22, fontWeight: '700'},
  groupNote: {color: colors.textSecondary, fontWeight: '400', fontSize: 13},
  switchRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 64},
  pressed: {opacity: 0.72},
});
