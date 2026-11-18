import {Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import {AppButton} from '../../../shared/components/AppButton';
import {GlyphIcon} from '../../../shared/components/GlyphIcon';
import {RefreshHint, SkeletonBlock} from '../../../shared/components/RefreshHint';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import {PENDING_NOTE, reviewDay, reviewStatusLabel, stayEndedText} from '../../../shared/models/ReviewsOverview';
import {colors} from '../../../shared/theme/colors';
import {radius} from '../../../shared/theme/radius';
import {spacing} from '../../../shared/theme/spacing';
import {ui} from '../../../shared/theme/ui';
import {useReviewsOverview} from '../viewModels/useReviewsOverview';
import type {RatingsReportsViewModel} from '../viewModels/useRatingsReportsViewModel';

export const RATING_NOTE = 'You are rating the property, like rating a restaurant.';

function Stars({value}: {value: number}) {
  return <Text accessible accessibilityLabel={`${value} out of 5 stars`} style={styles.stars}>{'★'.repeat(value)}<Text style={styles.starsOff}>{'★'.repeat(5 - value)}</Text></Text>;
}
function HomeTile({size = 56}: {size?: number}) {
  return <View accessible={false} style={[styles.tile, {width: size, height: size}]}><GlyphIcon kind="house" size={Math.round(size * 0.43)} /></View>;
}

export function RatingsReportsHomeView({onClose, viewModel, accountId, onReviewProperty}: {accountId?: string | undefined; onClose: () => void; viewModel: RatingsReportsViewModel; onReviewProperty: (tenancyId: string) => void}) {
  const overview = useReviewsOverview(accountId), data = overview.data;
  return <View style={styles.screen}>
    <ScreenHeader title="Reviews & reports" onBack={onClose} />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={false} onRefresh={overview.refresh} />}>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <RefreshHint refreshing={overview.busy && !!data} failed={!!overview.error && !!data} onRetry={overview.refresh} />
      {overview.busy && !data ? <View accessible accessibilityLabel="Loading reviews" accessibilityLiveRegion="polite" style={styles.card}>
        <SkeletonBlock height={56} radius={12} style={styles.fill} />
        <SkeletonBlock height={14} width="60%" style={styles.fill} />
        <SkeletonBlock height={48} radius={24} style={styles.fill} />
      </View> : null}
      {overview.error && !data ? <View style={styles.card}><Text accessibilityRole="alert" style={ui.body}>{overview.error}</Text><AppButton label="Retry" onPress={overview.refresh} /></View> : null}

      {data?.waiting.map(w => <View key={w.tenancyId} style={styles.card}>
        <View style={styles.head}>
          <HomeTile />
          <View style={styles.headCopy}>
            <View style={styles.waitingChip}><Text style={styles.waitingChipText}>Waiting for your review</Text></View>
            <Text style={styles.cardTitle}>{w.title}</Text>
            <Text style={ui.supporting}>{stayEndedText(w.ended)}</Text>
          </View>
        </View>
        <View style={styles.note}><Text style={styles.noteText}>{RATING_NOTE}</Text></View>
        <AppButton label="Review this property" onPress={() => onReviewProperty(w.tenancyId)} />
      </View>)}

      {data && data.reviews.length ? <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Your reviews</Text>
        {data.reviews.map(r => <View key={r.id} style={styles.card}>
          <View style={styles.reviewRow}>
            <HomeTile size={48} />
            <View style={styles.headCopy}>
              <View style={styles.titleRow}>
                <Text style={[styles.cardTitle, styles.grow]}>{r.title}</Text>
                <View style={[styles.statusChip, r.status === 'approved' ? styles.statusPublished : r.status === 'pending' ? styles.statusPending : styles.statusOther]}>
                  <Text style={[styles.statusText, r.status === 'approved' ? styles.statusPublishedText : r.status === 'pending' ? styles.statusPendingText : null]}>{reviewStatusLabel(r.status)}</Text>
                </View>
              </View>
              <View style={styles.starsRow}><Stars value={r.rating} /><Text style={ui.supporting}>{`· ${reviewDay(r.createdAt)}`}</Text></View>
              {r.status === 'pending' ? <Text style={ui.supporting}>{PENDING_NOTE}</Text> : null}
            </View>
          </View>
        </View>)}
      </View> : null}

      {data && data.stays > 0 ? <Pressable accessibilityRole="button" onPress={viewModel.startReview} style={styles.linkRow}><Text style={styles.linkText}>See all completed rentals</Text></Pressable> : null}
      {/* The participant-review block (PublishedRentalReviews, kind "user") is hidden from this screen on purpose; its code path is unchanged. */}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Report a concern</Text>
        <View style={styles.listCard}>
          <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('reportStatus')} style={styles.listRow}>
            <Text style={[ui.body, styles.grow]}>My submitted reports</Text>
            <Text accessible={false} style={styles.chevron}>{'›'}</Text>
          </Pressable>
        </View>
        <Text style={ui.supporting}>Report a listing from Rental Details, or report the other participant from a relevant conversation. Reports are confidential and do not automatically restrict accounts.</Text>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.canvas},
  content: {padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl},
  notice: {...ui.supporting, backgroundColor: colors.primaryPale, borderRadius: radius.sm, padding: spacing.sm},
  card: {backgroundColor: colors.background, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, padding: spacing.md, gap: spacing.sm},
  fill: {backgroundColor: colors.outline},
  head: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm},
  headCopy: {flex: 1, minWidth: 0, gap: spacing.xxs},
  tile: {backgroundColor: colors.outline, borderRadius: radius.md - 3, alignItems: 'center', justifyContent: 'center'},
  waitingChip: {alignSelf: 'flex-start', backgroundColor: colors.warningSurface, borderColor: colors.propertyCredentialSurface, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, minHeight: 28, justifyContent: 'center'},
  waitingChipText: {...ui.supporting, color: colors.propertyProofInk, lineHeight: 18},
  cardTitle: {...ui.sectionTitle, fontWeight: '700'},
  note: {backgroundColor: colors.identityCredentialSurface, borderRadius: radius.md - 3, padding: spacing.sm},
  noteText: {...ui.supporting, color: colors.identityInk},
  section: {gap: spacing.xs},
  sectionTitle: {...ui.sectionTitle, fontWeight: '700', paddingHorizontal: spacing.xxs},
  reviewRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm},
  titleRow: {flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, flexWrap: 'wrap'},
  grow: {flex: 1, minWidth: 0},
  statusChip: {borderRadius: radius.pill, borderWidth: 1, borderColor: colors.outline, paddingHorizontal: spacing.sm, minHeight: 28, justifyContent: 'center'},
  statusPublished: {backgroundColor: colors.primaryPale, borderColor: colors.primaryAction},
  statusPending: {backgroundColor: colors.warningSurface, borderColor: colors.propertyCredentialSurface},
  statusOther: {backgroundColor: colors.surface},
  statusText: {...ui.supporting, lineHeight: 18},
  statusPublishedText: {color: colors.accountCredentialInk},
  statusPendingText: {color: colors.propertyProofInk},
  starsRow: {flexDirection: 'row', alignItems: 'center', gap: spacing.xs},
  stars: {color: colors.warning, fontSize: 18, lineHeight: 24},
  starsOff: {color: colors.border},
  linkRow: {minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start'},
  linkText: {...ui.body, color: colors.primaryAction, fontWeight: '600'},
  listCard: {backgroundColor: colors.background, borderRadius: radius.card, borderWidth: 1, borderColor: colors.outline, overflow: 'hidden'},
  listRow: {minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md},
  chevron: {...ui.sectionTitle, color: colors.textSecondary},
});
