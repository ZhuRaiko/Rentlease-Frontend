import {PublishedRentalReviews} from '../../../shared/components/RentalReviews';
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
  accountId,
}: {
  accountId?: string|undefined;
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
        <Text style={styles.availableTitle}>Reviews after a completed tenancy</Text>
        <Text style={styles.availableBody}>Share property feedback and a separate review of your rental participant. New feedback remains pending until approved.</Text>
        <AppButton label="Review completed rentals" onPress={viewModel.startReview}/>
      </View>
      {accountId?<PublishedRentalReviews accountId={accountId} kind="user" targetId={accountId}/>:null}

      <Text style={styles.sectionLabel}>REPORT A CONCERN (PREVIEW)</Text>
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
