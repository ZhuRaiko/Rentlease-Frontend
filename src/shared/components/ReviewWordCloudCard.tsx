import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppButton } from './AppButton';
import { HighlightedText } from './HighlightedText';
import { StarRow } from './ReviewParts';
import { ChatIcon, CheckIcon, CloseIcon, OfflineIcon } from './ReviewCloudIcons';
import {
  CLOUD_ERROR_TITLE, CLOUD_FADED, CLOUD_HINT, CLOUD_LOADING_COPY, CLOUD_LOADING_TITLE, CLOUD_SELECTED, CLOUD_TITLE, MATCH_PREVIEW, matchHeading, showMoreLabel,
  type CloudChip, type CloudView, type MatchingReview,
} from '../models/reviewCloudPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';
import { ui } from '../theme/ui';

/**
 * "What tenants wrote": the words reviewers use, one tappable pill each with how many reviews use it. Tapping a word selects it (dark pill with a check, the others fade) and a
 * card under the cloud shows how many reviews mention it, a Clear button and those reviews with the word highlighted. A pure view: every state, pill and highlighted text comes from
 * the view model, and choosing a word makes no request. `reviewCount` is every approved review on the property (the "18" in "7 of 18 reviews").
 */
export interface ReviewWordCloudCardProps { view: CloudView; chips: readonly CloudChip[]; selectedId: string | null; matching: readonly MatchingReview[]; reviewCount?: number; onSelect: (id: string) => void; onClear: () => void; onRetry: () => void }

/** Placeholder pills while the cloud loads. Decorative: the loading message is what a screen reader hears. */
const SKELETON_WIDTHS = [96, 128, 108, 84, 116, 92] as const;
function SkeletonPills() {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={styles.pills}>{SKELETON_WIDTHS.map((width, index) => <View key={index} style={[styles.skeleton, { width }]} />)}</View>;
}

function Pill({ chip, selected, faded, onPress }: { chip: CloudChip; selected: boolean; faded: boolean; onPress: () => void }) {
  const tint = selected ? CLOUD_SELECTED : faded ? CLOUD_FADED : chip.tint;
  // The pressable is the 48dp touch area; the pill inside it may look smaller for the small words.
  return <Pressable accessibilityLabel={chip.accessibilityLabel} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={styles.pillTarget}>
    <View style={[styles.pill, { backgroundColor: tint.background, borderColor: tint.border }]}>
      {selected ? <CheckIcon color={CLOUD_SELECTED.text} size={chip.fontSize} /> : null}
      <Text style={[styles.pillText, { color: tint.text, fontSize: chip.fontSize, lineHeight: Math.round(chip.fontSize * 1.3) }]}>{chip.text}</Text>
      <View style={[styles.count, selected && styles.countOn]}><Text style={[styles.countText, selected && styles.countTextOn]}>{chip.reviewCount}</Text></View>
    </View>
  </Pressable>;
}

/** The reviews that contain the selected word. Keyed by the word, so "Show N more" starts closed for each new choice. */
function Matches({ heading, matching, onClear }: { heading: string; matching: readonly MatchingReview[]; onClear: () => void }) {
  const [all, setAll] = useState(false);
  const shown = all ? matching : matching.slice(0, MATCH_PREVIEW), hidden = matching.length - shown.length;
  return <View style={styles.matches}>
    <View style={styles.matchHead}>
      <Text accessibilityLiveRegion="polite" accessibilityRole="header" style={styles.matchTitle}>{heading}</Text>
      <Pressable accessibilityLabel="Clear" accessibilityRole="button" onPress={onClear} style={styles.clear}><CloseIcon size={16} /><Text style={styles.clearText}>Clear</Text></Pressable>
    </View>
    {shown.map(review => <View key={review.id} style={styles.review}>
      <View style={styles.reviewMeta}>
        <View accessible accessibilityLabel={`${review.stars} out of 5 stars`}><StarRow filled={review.stars} /></View>
        {review.meta ? <Text style={ui.supporting}>{review.meta}</Text> : null}
      </View>
      <HighlightedText segments={review.segments} />
    </View>)}
    {hidden > 0 ? <Pressable accessibilityRole="button" onPress={() => setAll(true)} style={styles.more}><Text style={styles.moreText}>{showMoreLabel(hidden)}</Text></Pressable> : null}
  </View>;
}

export function ReviewWordCloudCard({ view, chips, selectedId, matching, reviewCount = 0, onSelect, onClear, onRetry }: ReviewWordCloudCardProps) {
  // Large text or a narrow screen: the icon sits above its copy instead of squeezing the copy into a thin column (same rule as the Messages and Matching preferences screens).
  const { width, fontScale } = useWindowDimensions(), stacked = fontScale > 1.2 || width < 360, row = [styles.row, stacked && styles.rowStacked], grow = [styles.grow, stacked && styles.growStacked];
  if (view.kind === 'hidden') return null;
  const selected = chips.find(chip => chip.id === selectedId);
  return <>
    <View style={styles.card}>
      {view.kind === 'loading' ? <>
        <View accessibilityLiveRegion="polite" style={row}>
          <View style={styles.spinner}><ActivityIndicator accessibilityLabel="Loading the word cloud" color={colors.primaryAction} size="large" /></View>
          <View style={grow}><Text accessibilityRole="header" style={styles.title}>{CLOUD_LOADING_TITLE}</Text><Text style={ui.supporting}>{CLOUD_LOADING_COPY}</Text></View>
        </View>
        <SkeletonPills />
      </> : null}
      {view.kind === 'notice' ? <View accessibilityLiveRegion="polite" style={row}>
        <View accessible={false} style={[styles.badge, styles.badgeGreen]}><ChatIcon /></View>
        <View style={grow}><Text accessibilityRole="header" style={styles.title}>{CLOUD_TITLE}</Text><Text style={ui.body}>{view.message}</Text></View>
      </View> : null}
      {view.kind === 'error' ? <>
        <View style={row}>
          <View accessible={false} style={[styles.badge, styles.badgeGrey]}><OfflineIcon /></View>
          <View style={grow}><Text accessibilityRole="header" style={styles.title}>{CLOUD_ERROR_TITLE}</Text><Text accessibilityLiveRegion="polite" accessibilityRole="alert" style={ui.body}>{view.message}</Text></View>
        </View>
        <AppButton label="Try again" onPress={onRetry} />
      </> : null}
      {view.kind === 'ready' ? <>
        <View><Text accessibilityRole="header" style={styles.title}>{CLOUD_TITLE}</Text><Text style={ui.supporting}>{CLOUD_HINT}</Text></View>
        <View style={styles.pills}>{chips.map(chip => {
          const on = chip.id === selectedId;
          return <Pill key={chip.id} chip={chip} faded={!!selected && !on} onPress={() => (on ? onClear() : onSelect(chip.id))} selected={on} />;
        })}</View>
      </> : null}
    </View>
    {view.kind === 'ready' && selected ? <Matches key={selected.id} heading={matchHeading(matching.length, reviewCount, selected.text)} matching={matching} onClear={onClear} /> : null}
  </>;
}

const styles = StyleSheet.create({
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  title: { ...ui.sectionTitle, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0, gap: spacing.xxs },
  growStacked: { flex: 0, alignSelf: 'stretch' },
  spinner: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  badge: { width: 48, height: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  badgeGreen: { backgroundColor: colors.primaryPale },
  badgeGrey: { backgroundColor: colors.surface },
  pills: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.xs, rowGap: spacing.xxs },
  pillTarget: { minHeight: 48, minWidth: 48, maxWidth: '100%', flexShrink: 1, justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '100%', gap: spacing.xs, minHeight: 36, paddingVertical: spacing.xxs, paddingLeft: spacing.md, paddingRight: spacing.xs, borderRadius: radius.pill, borderWidth: 1 },
  pillText: { fontFamily: typography.family, fontWeight: '700', flexShrink: 1 },
  count: { minWidth: 28, height: 28, paddingHorizontal: spacing.xxs, borderRadius: radius.pill, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  countOn: { backgroundColor: colors.white },
  countText: { fontFamily: typography.family, fontSize: 13, fontWeight: '700', color: colors.ink },
  countTextOn: { color: colors.ink },
  skeleton: { height: 40, maxWidth: '100%', borderRadius: radius.pill, backgroundColor: colors.surface },
  matches: { ...ui.panel, borderColor: colors.ink, borderWidth: 1.5, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  matchHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: spacing.sm, rowGap: spacing.xs },
  matchTitle: { ...ui.sectionTitle, fontWeight: '700', flexGrow: 1, flexShrink: 1, flexBasis: 200 },
  clear: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.controlBorder, backgroundColor: colors.background },
  clearText: { fontFamily: typography.family, fontSize: 15, fontWeight: '700', color: colors.ink },
  review: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.outline },
  reviewMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: spacing.sm },
  more: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primaryPale },
  moreText: { fontFamily: typography.family, fontSize: 15, fontWeight: '700', color: colors.accountCredentialInk },
});
