import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { HighlightedText } from './HighlightedText';
import { ReviewTagsCard } from './ReviewTagsCard';
import { ReviewWordCloudCard } from './ReviewWordCloudCard';
import { StarRow, TagPills } from './ReviewParts';
import { NO_REVIEWS_CARD, PREVIEW_ROWS, STAYS_WITH_PROPERTY, cloudWords, feedbackLayout, publishedRowView, seeAllLabel, summaryView, type FeedbackTab } from '../models/ReviewPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';
import { useRentalReviews } from '../viewModels/useRentalReviews';
import { useReviewWordCloud } from '../viewModels/useReviewWordCloud';

const TABS: readonly FeedbackTab[] = ['Themes', 'Reviews'];

/**
 * Listing ratings (f4b v10). The summary (average, count, tag counts) comes from get_review_summary('property'). Once it has loaded the
 * layout is decided by feedbackLayout: no reviews -> one muted card; fewer than three tag selections -> the reviews only, no tabs;
 * otherwise two tabs, Themes and Reviews, opening on Themes. Themes shows the word cloud FIRST ("What tenants wrote": the words in the written comments, loaded once per property
 * view, see useReviewWordCloud) and then "Tags tenants picked" (the tag counts from the summary). The tags card does not depend on the cloud and is shown in every cloud state.
 */
export function RentalFeedbackSection({ accountId, propertyId, visible = true }: { accountId: string | undefined; propertyId: string; visible?: boolean }) {
  const [picked, setPicked] = useState<FeedbackTab | null>(null);
  const [all, setAll] = useState(false);
  const summaryVm = useRentalReviews(accountId, { mode: 'summary', kind: 'property', id: propertyId }, visible);
  const rowsVm = useRentalReviews(accountId, { mode: 'property', id: propertyId }, visible);
  const summary = summaryVm.data?.type === 'summary' ? summaryVm.data.value : null;
  const view = summary ? summaryView(summary, 'property') : null;
  const layout = feedbackLayout(view, !!summaryVm.error);
  const tab: FeedbackTab = picked ?? layout.defaultTab ?? 'Reviews';
  const published = rowsVm.data?.type === 'public' ? rowsVm.data.value : null;
  const rows = published ? published.rows.map(publishedRowView) : [];
  const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
  const showReviews = layout.mode === 'reviews_only' || (layout.mode === 'tabs' && tab === 'Reviews');
  const words = view ? cloudWords(view.tags) : [];
  const cloudOn = !!accountId && !!view && !view.empty && (layout.mode === 'tabs' || layout.mode === 'reviews_only');
  const cloud = useReviewWordCloud(accountId, propertyId, { enabled: cloudOn && !!published, ...(published ? { count: published.count } : {}) });
  const cloudCard = cloudOn ? <ReviewWordCloudCard view={cloud.view} chips={cloud.chips} selectedId={cloud.selected} matching={cloud.matching} reviewCount={cloud.corpus?.count ?? 0} onSelect={cloud.select} onClear={() => cloud.select(null)} onRetry={cloud.retry} /> : null;
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Ratings and reviews</Text>
    {!accountId ? <Text style={ui.supporting}>Sign in to see reviews from past tenants.</Text> : <>
      {summaryVm.busy && !summary ? <ActivityIndicator accessibilityLabel="Loading ratings" color={colors.primaryAction} /> : null}
      {summaryVm.error && !summary ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.supporting}>Ratings are not available right now.</Text><AppButton label="Retry" variant="secondary" disabled={summaryVm.busy} onPress={() => void summaryVm.workflow.load()} /></View> : null}
      {layout.mode === 'empty' ? <View style={[styles.card, styles.muted]}><Text style={ui.body}>{NO_REVIEWS_CARD}</Text></View> : null}
      {view && !view.empty ? <>
        {layout.mode === 'tabs' ? <View accessibilityRole="tablist" style={styles.tabs}>{TABS.map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => { if (label === 'Reviews' && tab !== 'Reviews') { void rowsVm.workflow.load(); void summaryVm.workflow.load(); } setPicked(label); }} style={[styles.tab, tab === label && styles.tabOn]}><Text style={[ui.body, tab === label ? styles.tabTextOn : null]}>{label}</Text></Pressable>)}</View> : null}
        <View style={styles.card}>
          <View style={styles.summary}>
            <Text accessibilityLabel={`Average ${view.average} out of 5`} style={styles.average}>{view.average}</Text>
            <View style={styles.grow}><StarRow filled={view.starsFilled} size={18} /><Text style={ui.supporting}>{view.countLine}</Text></View>
          </View>
          <Text style={ui.supporting}>{STAYS_WITH_PROPERTY}</Text>
        </View>
      </> : null}
      {layout.mode === 'tabs' && tab === 'Themes' ? <>
        {cloudCard}
        <ReviewTagsCard tags={words} />
        {rows.length > 0 || (published?.count ?? 0) > 0 ? <AppButton label={seeAllLabel(published?.count ?? rows.length)} variant="secondary" onPress={() => { setAll(true); setPicked('Reviews'); }} /> : null}
      </> : null}
      {layout.mode === 'reviews_only' && view ? <View style={[styles.card, styles.muted]}><Text style={ui.supporting}>Themes appear once a few tenants have added tags.</Text></View> : null}
      {layout.mode === 'reviews_only' ? cloudCard : null}
      {showReviews ? <>
        {rowsVm.busy && !published ? <ActivityIndicator accessibilityLabel="Loading reviews" color={colors.primaryAction} /> : null}
        {rowsVm.error ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.supporting}>Reviews are not available right now.</Text><AppButton label="Retry" variant="secondary" disabled={rowsVm.busy} onPress={() => void rowsVm.workflow.load()} /></View> : null}
        {shown.map(r => <View key={r.key} style={styles.card}>
          <View style={styles.rowHead}><View accessible accessibilityLabel={`${r.stars} out of 5 stars`}><StarRow filled={r.stars} /></View><Text style={ui.supporting}>{[r.role, r.month].filter(Boolean).join(' · ')}</Text></View>
          {r.text ? (cloud.highlight(r.key, r.text) ? <HighlightedText segments={cloud.highlight(r.key, r.text)!} /> : <Text style={ui.body}>{r.text}</Text>) : null}
          <TagPills labels={r.tags} />
        </View>)}
        {!all && rows.length > PREVIEW_ROWS ? <AppButton label={seeAllLabel(published?.count ?? rows.length)} variant="secondary" onPress={() => setAll(true)} /> : null}
        {all && rowsVm.offset > 0 ? <AppButton label="Newer reviews" variant="secondary" disabled={rowsVm.busy} onPress={() => void rowsVm.workflow.load(Math.max(0, rowsVm.offset - 20))} /> : null}
        {all && rows.length === 20 ? <AppButton label="Older reviews" variant="secondary" disabled={rowsVm.busy || rowsVm.offset >= 10000} onPress={() => void rowsVm.workflow.load(rowsVm.offset + 20)} /> : null}
        {published && rows.length === 0 && view && !view.empty ? <Text style={ui.supporting}>No written reviews on this page.</Text> : null}
        <Text style={ui.supporting}>Only approved feedback is included. Reviewer names are never shown.</Text>
      </> : null}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grow: { flex: 1, minWidth: 0, gap: spacing.xxs },
  tabs: { flexDirection: 'row', gap: spacing.xxs, padding: spacing.xxs, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.background },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  // The selected tab is a dark filled pill with light bold text (design pack); the label also gets heavier, so it never relies on colour alone.
  tabOn: { backgroundColor: colors.ink },
  tabTextOn: { color: colors.white, fontWeight: '700' },
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  average: { ...ui.pageTitle, fontSize: 40, lineHeight: 48 },
  muted: { backgroundColor: colors.surface },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
});
