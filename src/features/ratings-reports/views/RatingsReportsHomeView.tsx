import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { SelectionCard, StarRating } from '../components/RatingsReportsCards';
import { RatingsReportsScaffold } from '../components/RatingsReportsScaffold';
import type { RatingsReportsViewModel } from '../viewModels/useRatingsReportsViewModel';

export function RatingsReportsHomeView({
  onClose,
  viewModel,
}: {
  onClose: () => void;
  viewModel: RatingsReportsViewModel;
}) {
  return (
    <RatingsReportsScaffold onClose={onClose} title="Ratings & reports">
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TRUST & SAFETY</Text>
        <Text accessibilityRole="header" style={styles.heroTitle}>Build trust in every rental</Text>
        <Text style={styles.heroBody}>Share fair feedback after completed rental activity or tell RENTLEASE about a safety concern.</Text>
      </View>

      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}

      <View style={styles.reviewAvailableCard}>
        <View style={styles.availableTop}>
          <View style={styles.availableBadge}><Text style={styles.availableBadgeText}>1 AVAILABLE</Text></View>
          <Text style={styles.availableMeta}>Until September 30</Text>
        </View>
        <Text style={styles.availableTitle}>{viewModel.reviewSubject.role} review available</Text>
        <Text style={styles.availableBody}>Your tenancy at 2-Bedroom House with Balcony has ended. Share your experience with {viewModel.reviewSubject.name}.</Text>
        <AppButton label={`Rate ${viewModel.reviewSubject.role.toLowerCase()}`} onPress={viewModel.startReview} />
      </View>

      <Text style={styles.sectionLabel}>YOUR REPUTATION</Text>
      <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('reviewsSummary')} style={styles.ratingSummary}>
        <View>
          <Text style={styles.ratingValue}>{viewModel.averageRating}</Text>
          <StarRating compact readonly value={5} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{viewModel.publishedReviews.length} published reviews</Text>
          <Text style={styles.summaryBody}>See what tenants and landlords shared</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.sectionLabel}>REPORT A CONCERN</Text>
      <View style={styles.actions}>
        <SelectionCard
          body="Report a user, listing, or message for the safety team to review."
          onPress={viewModel.openReportMenu}
          title="Start a report"
          tone="danger"
        />
        <SelectionCard
          body="Follow updates or respond when more information is requested."
          meta={viewModel.reportPreview.id}
          onPress={() => viewModel.navigate('reportStatus')}
          title="Track report status"
          tone="blue"
        />
      </View>
      <Text style={styles.safetyNote}>Reports are confidential. The reported person will not see who submitted the report in this frontend presentation.</Text>
    </RatingsReportsScaffold>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.xs, paddingBottom: spacing.md },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colors.text, fontFamily: typography.family, fontSize: 28, fontWeight: '900', letterSpacing: -0.5, lineHeight: 34 },
  heroBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginBottom: spacing.md, padding: spacing.sm },
  reviewAvailableCard: { backgroundColor: colors.primaryPale, borderColor: '#CBE8CE', borderRadius: radius.card, borderWidth: 1, gap: spacing.sm, padding: spacing.md },
  availableTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  availableBadge: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 5 },
  availableBadgeText: { color: colors.white, fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  availableMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  availableTitle: { color: colors.text, fontFamily: typography.family, fontSize: 19, fontWeight: '900' },
  availableBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  ratingSummary: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  ratingValue: { color: colors.text, fontFamily: typography.family, fontSize: 30, fontWeight: '900', textAlign: 'center' },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  summaryBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15, marginTop: 3 },
  chevron: { color: colors.textMuted, fontFamily: typography.family, fontSize: 28 },
  actions: { gap: spacing.sm },
  safetyNote: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: spacing.md, textAlign: 'center' },
});
