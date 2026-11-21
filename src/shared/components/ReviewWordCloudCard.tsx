import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { HighlightedText } from './HighlightedText';
import { CLOUD_HINT, CLOUD_LOADING_COPY, CLOUD_TITLE, type CloudChip, type CloudView, type MatchingReview } from '../models/reviewCloudPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';

/**
 * The word cloud under the Themes: each word is a tappable chip (48dp high), sized by how many reviews mention it. Tapping a word shows the reviews that contain it, with the
 * words highlighted, right under the chips; tapping it again (or Clear) puts it away. A pure view: every state, chip and highlighted text comes from the view model.
 */
export interface ReviewWordCloudCardProps { view: CloudView; chips: readonly CloudChip[]; selectedId: string | null; matching: readonly MatchingReview[]; onSelect: (id: string) => void; onClear: () => void; onRetry: () => void }
export function ReviewWordCloudCard({ view, chips, selectedId, matching, onSelect, onClear, onRetry }: ReviewWordCloudCardProps) {
  if (view.kind === 'hidden') return null;
  const selected = chips.find(chip => chip.id === selectedId);
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{CLOUD_TITLE}</Text>
    {view.kind === 'loading' ? <View accessibilityLiveRegion="polite" style={styles.row}><ActivityIndicator accessibilityLabel="Loading the word cloud" color={colors.primaryAction} /><Text style={[ui.supporting, styles.grow]}>{CLOUD_LOADING_COPY}</Text></View> : null}
    {view.kind === 'notice' ? <Text accessibilityLiveRegion="polite" style={ui.supporting}>{view.message}</Text> : null}
    {view.kind === 'error' ? <>
      <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={ui.supporting}>{view.message}</Text>
      <AppButton label="Try again" variant="secondary" onPress={onRetry} />
    </> : null}
    {view.kind === 'ready' ? <>
      <Text style={ui.supporting}>{CLOUD_HINT}</Text>
      <View style={styles.chips}>{chips.map(chip => {
        const on = chip.id === selectedId;
        return <Pressable key={chip.id} accessibilityRole="button" accessibilityLabel={chip.accessibilityLabel} accessibilityState={{ selected: on }} onPress={() => (on ? onClear() : onSelect(chip.id))} style={[styles.chip, on && styles.chipOn]}>
          <Text style={[styles.chipText, { color: chip.color, fontSize: chip.fontSize, lineHeight: Math.round(chip.fontSize * 1.3) }, on && styles.chipTextOn]}>{chip.text}</Text>
        </Pressable>;
      })}</View>
      {selected ? <View style={styles.matches}>
        <Text accessibilityLiveRegion="polite" style={[ui.body, styles.matchHead]}>{`“${selected.text}” is in ${matching.length} ${matching.length === 1 ? 'review' : 'reviews'}`}</Text>
        {matching.map(review => <View key={review.id} style={styles.review}><HighlightedText segments={review.segments} /></View>)}
        <AppButton label="Clear" variant="secondary" onPress={onClear} />
      </View> : null}
    </> : null}
  </View>;
}
const styles = StyleSheet.create({
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  title: { ...ui.body, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  grow: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { minHeight: 48, minWidth: 48, maxWidth: '100%', flexShrink: 1, justifyContent: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs, borderRadius: radius.control, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background },
  chipOn: { borderColor: colors.primaryAction, borderWidth: 2, backgroundColor: colors.primaryPale },
  chipText: { fontWeight: '600', flexShrink: 1 },
  chipTextOn: { fontWeight: '800' },
  matches: { gap: spacing.sm, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: colors.outline },
  matchHead: { fontWeight: '700' },
  review: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.surface },
});
