import type {ReactNode} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {typography} from '../../../shared/theme/typography';
import {ui} from '../../../shared/theme/ui';
import {RingMark, SearchOffMark, SlidersMark} from './ListingIcons';

/** "A more personal search", "Rentals for you." and the Edit preferences pill (it drops below the title when the row is too narrow). */
export function ForYouHero({editLabel, onEdit}: {editLabel: string; onEdit: () => void}) {
  return <View style={styles.hero}>
    <View style={styles.heroCopy}>
      <Text style={styles.eyebrow}>A more personal search</Text>
      <Text accessibilityRole="header" style={styles.headline}>Rentals for you.</Text>
    </View>
    <Pressable accessibilityRole="button" onPress={onEdit} style={styles.pill}>
      <SlidersMark />
      <Text style={styles.pillText}>{editLabel}</Text>
    </Pressable>
  </View>;
}

/** "Recommended rentals" with the How it works toggle. */
export function RecommendedHeading({expanded, onToggle}: {expanded: boolean; onToggle: () => void}) {
  return <View style={styles.headingRow}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>Recommended rentals</Text>
    <Pressable accessibilityLabel="How recommendations work" accessibilityRole="button" accessibilityState={{expanded}} onPress={onToggle} style={styles.how}>
      <RingMark kind="help" size={20} /><Text style={styles.howText}>How it works</Text>
    </Pressable>
  </View>;
}

/** The one quiet info box: the suggestion note, the coverage count and the session note, in one block. */
export function InfoBox({text}: {text: string}) {
  return <View accessibilityLabel={text} accessible style={styles.info}>
    <RingMark kind="info" size={20} color={colors.textSecondary} />
    <Text style={styles.infoText}>{text}</Text>
  </View>;
}

/** A state of the For You tab in the same card style: an icon (or a spinner while loading), the message, and an optional action. */
export function ForYouStateCard({kind, title, body, actionLabel, onAction, alert = false}: {kind: 'search' | 'loading' | 'info'; title?: string | undefined; body: string; actionLabel?: string | undefined; onAction?: (() => void) | undefined; alert?: boolean}) {
  return <View accessibilityLiveRegion="polite" style={styles.state}>
    <View accessible={false} style={styles.stateIcon}>
      {kind === 'loading' ? <ActivityIndicator accessibilityLabel="Loading recommendations" color={colors.primaryAction} /> : kind === 'search' ? <SearchOffMark /> : <RingMark kind="info" size={30} />}
    </View>
    {title ? <Text accessibilityRole="header" style={styles.stateTitle}>{title}</Text> : null}
    <Text accessibilityRole={alert ? 'alert' : undefined} style={styles.stateBody}>{body}</Text>
    {actionLabel && onAction ? <Pressable accessibilityRole="button" onPress={onAction} style={styles.stateButton}><Text style={styles.stateButtonText}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

export function ExplanationBox({children}: {children: ReactNode}) {
  return <View style={styles.explanation}>{children}</View>;
}

const styles = StyleSheet.create({
  hero: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', columnGap: spacing.sm, rowGap: spacing.sm, paddingTop: spacing.xs},
  heroCopy: {flexGrow: 1, flexShrink: 1, flexBasis: 200, minWidth: 200, gap: 6},
  eyebrow: {...ui.supporting, color: colors.primaryAction, fontWeight: '600'},
  headline: {...ui.pageTitle, fontSize: 26, lineHeight: 33, color: colors.ink},
  pill: {minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.controlBorder, backgroundColor: colors.background},
  pillText: {color: colors.ink, fontFamily: typography.family, fontSize: 15, fontWeight: '700'},
  headingRow: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.sm},
  sectionTitle: {...ui.sectionTitle, fontSize: 20, lineHeight: 26, fontWeight: '700'},
  how: {minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.xxs},
  howText: {color: colors.primaryAction, fontFamily: typography.family, fontSize: 15, fontWeight: '700'},
  info: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.card, backgroundColor: colors.surface},
  infoText: {...ui.supporting, flex: 1, minWidth: 0, color: colors.textSecondary},
  state: {alignItems: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg + 4, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background},
  stateIcon: {width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryPale, alignItems: 'center', justifyContent: 'center'},
  stateTitle: {...ui.sectionTitle, fontSize: 20, lineHeight: 26, fontWeight: '700', textAlign: 'center'},
  stateBody: {...ui.body, color: colors.textSecondary, textAlign: 'center'},
  stateButton: {alignSelf: 'stretch', minHeight: 52, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primaryAction},
  stateButtonText: {color: colors.white, fontFamily: typography.family, fontSize: 16, fontWeight: '700', textAlign: 'center'},
  explanation: {padding: spacing.sm, gap: spacing.xs, backgroundColor: colors.primaryPale, borderRadius: radius.card},
});
