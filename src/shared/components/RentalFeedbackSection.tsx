import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from './AppButton';
import { PropertyReviewWordCloud } from './PropertyReviewWordCloud';
import { StarRow, TagPills } from './ReviewParts';
import { PREVIEW_ROWS, publishedRowView, seeAllLabel, summaryView } from '../models/ReviewPresentation';
import { colors } from '../theme/colors';
import { radius } from '../theme/radius';
import { spacing } from '../theme/spacing';
import { ui } from '../theme/ui';
import { useRentalReviews } from '../viewModels/useRentalReviews';

type Tab = 'Reviews' | 'Themes';

/**
 * Listing ratings: the summary (average, count, top tags) comes from get_review_summary('property'); the Reviews tab lists the published
 * reviews with their tags; the Themes tab counts the tags first and keeps the free-text word cloud as a quiet secondary view.
 * Tag counts and the list never depend on the word-cloud service.
 */
export function RentalFeedbackSection({ accountId, propertyId }: { accountId: string | undefined; propertyId: string }) {
  const [tab, setTab] = useState<Tab>('Reviews');
  const [all, setAll] = useState(false);
  const summaryVm = useRentalReviews(accountId, { mode: 'summary', kind: 'property', id: propertyId });
  const rowsVm = useRentalReviews(accountId, { mode: 'property', id: propertyId });
  const summary = summaryVm.data?.type === 'summary' ? summaryVm.data.value : null;
  const view = summary ? summaryView(summary, 'property') : null;
  const published = rowsVm.data?.type === 'public' ? rowsVm.data.value : null;
  const rows = published ? published.rows.map(publishedRowView) : [];
  const shown = all ? rows : rows.slice(0, PREVIEW_ROWS);
  return <View style={styles.wrap}>
    <Text accessibilityRole="header" style={ui.sectionTitle}>Ratings and reviews</Text>
    {!accountId ? <Text style={ui.supporting}>Sign in to see reviews from past tenants.</Text> : <>
      <View accessibilityRole="tablist" style={styles.tabs}>{(['Reviews', 'Themes'] as const).map(label => <Pressable key={label} accessibilityRole="tab" accessibilityState={{ selected: tab === label }} onPress={() => setTab(label)} style={[styles.tab, tab === label && styles.tabOn]}><Text style={[ui.body, { fontWeight: '600', color: tab === label ? colors.primaryAction : colors.ink }]}>{label}</Text></Pressable>)}</View>
      <View style={styles.card}>
        {summaryVm.busy && !summary ? <ActivityIndicator accessibilityLabel="Loading ratings" color={colors.primaryAction} /> : null}
        {summaryVm.error && !summary ? <><Text accessibilityRole="alert" style={ui.supporting}>Ratings are not available right now.</Text><AppButton label="Retry" variant="secondary" disabled={summaryVm.busy} onPress={() => void summaryVm.workflow.load()} /></> : null}
        {view && view.empty ? <Text style={ui.body}>{view.countLine}</Text> : null}
        {view && !view.empty ? <View style={styles.summary}>
          <Text accessibilityLabel={`Average ${view.average} out of 5`} style={styles.average}>{view.average}</Text>
          <View style={styles.grow}><StarRow filled={view.starsFilled} size={18} /><Text style={ui.supporting}>{view.countLine}</Text></View>
        </View> : null}
        {view && !view.empty && tab === 'Reviews' ? <TagPills labels={view.tags.map(t => t.label)} counts={view.tags.map(t => t.count)} /> : null}
      </View>
      {tab === 'Reviews' ? <>
        {rowsVm.busy && !published ? <ActivityIndicator accessibilityLabel="Loading reviews" color={colors.primaryAction} /> : null}
        {rowsVm.error ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.supporting}>Reviews are not available right now.</Text><AppButton label="Retry" variant="secondary" disabled={rowsVm.busy} onPress={() => void rowsVm.workflow.load()} /></View> : null}
        {shown.map(r => <View key={r.key} style={styles.card}>
          <View style={styles.rowHead}><View accessible accessibilityLabel={`${r.stars} out of 5 stars`}><StarRow filled={r.stars} /></View><Text style={ui.supporting}>{[r.role, r.month].filter(Boolean).join(' · ')}</Text></View>
          {r.text ? <Text style={ui.body}>{r.text}</Text> : null}
          <TagPills labels={r.tags} />
        </View>)}
        {!all && rows.length > PREVIEW_ROWS ? <AppButton label={seeAllLabel(published?.count ?? rows.length)} variant="secondary" onPress={() => setAll(true)} /> : null}
        {all && rowsVm.offset > 0 ? <AppButton label="Newer reviews" variant="secondary" disabled={rowsVm.busy} onPress={() => void rowsVm.workflow.load(Math.max(0, rowsVm.offset - 20))} /> : null}
        {all && rows.length === 20 ? <AppButton label="Older reviews" variant="secondary" disabled={rowsVm.busy || rowsVm.offset >= 10000} onPress={() => void rowsVm.workflow.load(rowsVm.offset + 20)} /> : null}
        {published && rows.length === 0 && view && !view.empty ? <Text style={ui.supporting}>No written reviews on this page.</Text> : null}
        <Text style={ui.supporting}>Only approved feedback is included. Reviewer names are never shown.</Text>
      </> : <View style={styles.card}>
        <Text accessibilityRole="header" style={[ui.body, { fontWeight: '700' }]}>What tenants mention</Text>
        {view && view.tags.length > 0 ? <TagPills labels={view.tags.map(t => t.label)} counts={view.tags.map(t => t.count)} /> : <Text style={ui.supporting}>{summary ? 'No tags yet.' : 'Not available right now'}</Text>}
        <PropertyReviewWordCloud compact quiet accountId={accountId} propertyId={propertyId} />
      </View>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grow: { flex: 1, minWidth: 0, gap: spacing.xxs },
  tabs: { flexDirection: 'row', gap: spacing.xxs, padding: spacing.xxs, borderRadius: radius.control, backgroundColor: colors.surface },
  tab: { flex: 1, minHeight: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.background },
  card: { ...ui.panel, padding: spacing.md, gap: spacing.sm, borderRadius: radius.card },
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  average: { ...ui.pageTitle, fontSize: 40, lineHeight: 48 },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
});
