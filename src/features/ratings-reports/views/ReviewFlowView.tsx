import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  FlowHeading,
  PersonCard,
  ReviewCard,
  StarRating,
} from '../components/RatingsReportsCards';
import { RatingsReportsScaffold } from '../components/RatingsReportsScaffold';
import type { RatingsReportsViewModel } from '../viewModels/useRatingsReportsViewModel';

export function ReviewFlowView({ viewModel }: { viewModel: RatingsReportsViewModel }) {
  const roleLabel = viewModel.reviewSubject.role.toLowerCase();

  if (viewModel.screen === 'reviewAvailable') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Review available">
        <FlowHeading
          body="Reviews become available after confirmed rental activity. Keep feedback honest, relevant, and respectful."
          eyebrow="COMPLETED TENANCY"
          title={`Share your experience with this ${roleLabel}`}
        />
        <PersonCard subject={viewModel.reviewSubject} />
        <View style={styles.contextCard}>
          <Text style={styles.contextLabel}>REVIEW WINDOW</Text>
          <Text style={styles.contextValue}>{viewModel.reviewSubject.completedAt}</Text>
          <Text style={styles.contextMeta}>Available until September 30, 2026</Text>
        </View>
        <AppButton label="Start review" onPress={() => viewModel.navigate('rateParticipant')} />
        <Text style={styles.helper}>You can submit one review for this completed tenancy.</Text>
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'rateParticipant') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title={`Rate ${roleLabel}`}>
        <FlowHeading
          body={`Your feedback helps other RENTLEASE members understand what it is like to rent with this ${roleLabel}.`}
          eyebrow="STEP 1 OF 3"
          title={`How was your experience with ${viewModel.reviewSubject.name}?`}
        />
        <PersonCard subject={viewModel.reviewSubject} />
        <View style={styles.guidelineCard}>
          <Text style={styles.guidelineTitle}>A helpful review is:</Text>
          <Text style={styles.guidelineItem}>• Based on your direct rental experience</Text>
          <Text style={styles.guidelineItem}>• Focused on communication, reliability, and conduct</Text>
          <Text style={styles.guidelineItem}>• Free of private contact or financial information</Text>
        </View>
        <AppButton label="Choose a rating" onPress={() => viewModel.navigate('starRating')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'starRating') {
    const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Star rating">
        <View style={styles.centeredState}>
          <Text style={styles.step}>STEP 2 OF 3</Text>
          <Text accessibilityRole="header" style={styles.centeredTitle}>Choose your overall rating</Text>
          <Text style={styles.centeredBody}>Consider communication, reliability, and respect throughout the tenancy.</Text>
          <View style={styles.largeRatingCard}>
            <StarRating onChange={viewModel.setRating} value={viewModel.reviewDraft.rating} />
            <Text style={styles.ratingLabel}>{ratingLabels[viewModel.reviewDraft.rating] || 'Tap a star to rate'}</Text>
            <Text style={styles.ratingNumber}>{viewModel.reviewDraft.rating || '—'} / 5</Text>
          </View>
          <AppButton disabled={viewModel.reviewDraft.rating === 0} label="Write your review" onPress={() => viewModel.navigate('writtenReview')} />
        </View>
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'writtenReview') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Written review">
        <FlowHeading
          body="Describe the parts of the rental experience that would be useful to future tenants or landlords."
          eyebrow="STEP 3 OF 3"
          title="Add a few helpful details"
        />
        <View style={styles.ratingInline}>
          <StarRating compact readonly value={viewModel.reviewDraft.rating} />
          <Text style={styles.inlineRating}>{viewModel.reviewDraft.rating}.0 overall</Text>
        </View>
        <Text style={styles.inputLabel}>YOUR REVIEW</Text>
        <TextInput
          accessibilityLabel="Written review"
          maxLength={500}
          multiline
          onChangeText={viewModel.setReviewText}
          placeholder="What went well? What should others know?"
          placeholderTextColor={colors.textMuted}
          style={styles.textArea}
          textAlignVertical="top"
          value={viewModel.reviewDraft.text}
        />
        <View style={styles.inputMeta}>
          <Pressable accessibilityRole="button" onPress={() => viewModel.setReviewText('Clear communication, respectful coordination, and quick responses throughout the tenancy.')}>
            <Text style={styles.previewFill}>Use preview review</Text>
          </Pressable>
          <Text style={styles.characterCount}>{viewModel.reviewDraft.text.length}/500</Text>
        </View>
        <AppButton disabled={viewModel.reviewDraft.text.trim().length < 10} label="Review submission" onPress={() => viewModel.navigate('reviewConfirmation')} />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reviewConfirmation') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Review confirmation">
        <FlowHeading
          body="Check your rating and written feedback before submitting."
          eyebrow="FINAL CHECK"
          title="Ready to publish when eligible?"
        />
        <PersonCard subject={viewModel.reviewSubject} />
        <View style={styles.reviewPreview}>
          <StarRating readonly value={viewModel.reviewDraft.rating} />
          <Text style={styles.reviewPreviewText}>{viewModel.reviewDraft.text}</Text>
        </View>
        <View style={styles.publicationNote}>
          <Text style={styles.publicationTitle}>Double-blind publication</Text>
          <Text style={styles.publicationBody}>This preview holds the review until both participants submit or the review period ends.</Text>
        </View>
        <AppButton label="Submit review" onPress={viewModel.submitReview} />
        <Text style={styles.helper}>No review will be sent to Supabase.</Text>
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'reviewSubmitted') {
    return (
      <RatingsReportsScaffold title="Review submitted">
        <SuccessMark />
        <View style={styles.successCopy}>
          <Text style={styles.successEyebrow}>REVIEW SAVED LOCALLY</Text>
          <Text accessibilityRole="header" style={styles.successTitle}>Thank you for sharing fair feedback</Text>
          <Text style={styles.successBody}>Your review is ready for publication once the reciprocal review condition is met.</Text>
        </View>
        <AppButton label="View publication status" onPress={() => viewModel.replace('awaitingPublication')} />
        <AppButton label="Return to ratings & reports" onPress={viewModel.openHome} variant="secondary" />
      </RatingsReportsScaffold>
    );
  }

  if (viewModel.screen === 'awaitingPublication') {
    return (
      <RatingsReportsScaffold onBack={viewModel.goBack} title="Publication status">
        <View style={styles.waitingMark}><View style={styles.clockHandLong} /><View style={styles.clockHandShort} /></View>
        <View style={styles.successCopy}>
          <Text style={styles.waitingEyebrow}>WAITING FOR PUBLICATION</Text>
          <Text accessibilityRole="header" style={styles.successTitle}>Your feedback is private for now</Text>
          <Text style={styles.successBody}>It will be shown after both parties submit a review or when the review window closes on September 30.</Text>
        </View>
        <View style={styles.timelineCard}>
          <Text style={styles.timelineDone}>●  Your review submitted</Text>
          <View style={styles.timelineLine} />
          <Text style={styles.timelinePending}>○  Waiting for reciprocal review</Text>
          <View style={styles.timelineLineMuted} />
          <Text style={styles.timelinePending}>○  Review published</Text>
        </View>
        <AppButton label="View published reviews" onPress={() => viewModel.replace('reviewsSummary')} />
        <AppButton label="Done" onPress={viewModel.openHome} variant="secondary" />
      </RatingsReportsScaffold>
    );
  }

  return (
    <RatingsReportsScaffold onBack={viewModel.goBack} title="User reviews">
      <View style={styles.summaryHero}>
        <Text style={styles.summaryScore}>{viewModel.averageRating}</Text>
        <StarRating readonly value={5} />
        <Text style={styles.summaryCount}>Based on {viewModel.publishedReviews.length} published reviews</Text>
        <View style={styles.ratingBars}>
          {[5, 4, 3].map((rating, index) => (
            <View key={rating} style={styles.barRow}>
              <Text style={styles.barLabel}>{rating}</Text>
              <View style={styles.barTrack}><View style={[styles.barFill, { width: index === 0 ? '72%' : index === 1 ? '24%' : '4%' }]} /></View>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.sectionLabel}>RECENT REVIEWS</Text>
      <View style={styles.reviewList}>
        {viewModel.publishedReviews.map((review) => <ReviewCard key={review.id} review={review} />)}
      </View>
    </RatingsReportsScaffold>
  );
}

function SuccessMark() {
  return (
    <View style={styles.successMark}>
      <View style={styles.checkShort} />
      <View style={styles.checkLong} />
    </View>
  );
}

const styles = StyleSheet.create({
  contextCard: { backgroundColor: colors.primaryPale, borderRadius: radius.card, gap: 4, marginVertical: spacing.md, padding: spacing.md },
  contextLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  contextValue: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '800' },
  contextMeta: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10 },
  helper: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, lineHeight: 14, marginTop: spacing.sm, textAlign: 'center' },
  guidelineCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.xs, marginVertical: spacing.md, padding: spacing.md },
  guidelineTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  guidelineItem: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 17 },
  centeredState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xl },
  step: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  centeredTitle: { color: colors.text, fontFamily: typography.family, fontSize: 27, fontWeight: '900', lineHeight: 33, textAlign: 'center' },
  centeredBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 19, maxWidth: 330, textAlign: 'center' },
  largeRatingCard: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.xs, marginVertical: spacing.md, padding: spacing.lg },
  ratingLabel: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900' },
  ratingNumber: { color: colors.textMuted, fontFamily: typography.family, fontSize: 11 },
  ratingInline: { alignItems: 'center', backgroundColor: colors.warningSurface, borderRadius: radius.sm, flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md, padding: spacing.sm },
  inlineRating: { color: colors.warning, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  inputLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs },
  textArea: { borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontFamily: typography.family, fontSize: 13, minHeight: 180, padding: spacing.md },
  inputMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg, marginTop: spacing.xs },
  previewFill: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  characterCount: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  reviewPreview: { alignItems: 'center', borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, gap: spacing.md, marginVertical: spacing.md, padding: spacing.md },
  reviewPreviewText: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  publicationNote: { backgroundColor: '#EFF7FC', borderRadius: radius.sm, gap: 4, marginBottom: spacing.md, padding: spacing.sm },
  publicationTitle: { color: '#33799E', fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  publicationBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 15 },
  successMark: { alignSelf: 'center', backgroundColor: colors.primaryPale, borderRadius: 55, height: 110, marginBottom: spacing.md, marginTop: spacing.xl, position: 'relative', width: 110 },
  checkShort: { backgroundColor: colors.primary, height: 5, left: 25, position: 'absolute', top: 58, transform: [{ rotate: '45deg' }], width: 27 },
  checkLong: { backgroundColor: colors.primary, height: 5, left: 43, position: 'absolute', top: 50, transform: [{ rotate: '-45deg' }], width: 47 },
  successCopy: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  successEyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  successTitle: { color: colors.text, fontFamily: typography.family, fontSize: 25, fontWeight: '900', lineHeight: 31, maxWidth: 340, textAlign: 'center' },
  successBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 330, textAlign: 'center' },
  waitingMark: { alignSelf: 'center', borderColor: colors.warning, borderRadius: 50, borderWidth: 5, height: 100, marginBottom: spacing.md, marginTop: spacing.xl, position: 'relative', width: 100 },
  clockHandLong: { backgroundColor: colors.warning, borderRadius: 2, height: 4, left: 48, position: 'absolute', top: 46, transform: [{ rotate: '-35deg' }], transformOrigin: 'left', width: 27 },
  clockHandShort: { backgroundColor: colors.warning, borderRadius: 2, height: 25, left: 46, position: 'absolute', top: 25, width: 4 },
  waitingEyebrow: { color: colors.warning, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  timelineCard: { alignSelf: 'stretch', backgroundColor: colors.surface, borderRadius: radius.card, marginBottom: spacing.lg, padding: spacing.md },
  timelineDone: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  timelinePending: { color: colors.textMuted, fontFamily: typography.family, fontSize: 12, fontWeight: '700' },
  timelineLine: { backgroundColor: colors.primary, height: 18, marginLeft: 4, width: 2 },
  timelineLineMuted: { backgroundColor: colors.border, height: 18, marginLeft: 4, width: 2 },
  summaryHero: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, padding: spacing.lg },
  summaryScore: { color: colors.text, fontFamily: typography.family, fontSize: 48, fontWeight: '900' },
  summaryCount: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.xs },
  ratingBars: { alignSelf: 'stretch', gap: 5, marginTop: spacing.md },
  barRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  barLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, width: 9 },
  barTrack: { backgroundColor: colors.surfaceStrong, borderRadius: 3, flex: 1, height: 6, overflow: 'hidden' },
  barFill: { backgroundColor: '#F0A927', borderRadius: 3, height: 6 },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  reviewList: { gap: spacing.sm },
});
