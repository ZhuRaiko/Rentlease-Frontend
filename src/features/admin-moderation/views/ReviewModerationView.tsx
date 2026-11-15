import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { ui } from '../../../shared/theme/ui';
import { AdminCard, AdminChip, AdminChipRow, AdminDisclosure, AdminRadioOption, AdminSectionLabel, DetailRow } from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import { formatAdminAge, reviewKindLabel, reviewStatusLabel, reviewStatusTone, reviewTypeLabel } from '../models/AdminQueuePresentation';
import { formatVerificationDate } from '../models/AdminVerification';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

/** One structured review moderation screen. Decisions map onto the existing moderate_rental_review inputs: status and a required private note. */
export function ReviewModerationView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  const row = viewModel.selectedReview;
  if (!row) return (
    <AdminScaffold onBack={viewModel.requestBack} title="Review moderation">
      {viewModel.reviewsBusy || viewModel.reviewsSaving ? <ActivityIndicator accessibilityLabel="Loading review" color={colors.primaryAction} /> : <Text style={ui.body}>{viewModel.reviewsError ? 'This review could not be loaded.' : 'This review is no longer in the current list.'}</Text>}
      <FeedbackNotice tone="error" message={viewModel.reviewsError} />
      {viewModel.reviewsPending ? <AppButton disabled={!viewModel.reviewsReady || viewModel.reviewsBusy || viewModel.reviewsSaving} label="Retry pending review action" onPress={() => void viewModel.retryReviews()} /> : null}
      <AppButton disabled={viewModel.reviewsSaving} label="Back to review queue" onPress={() => viewModel.openSection('reviewQueues', 'reviews')} variant="secondary" />
    </AdminScaffold>
  );
  const locked = viewModel.reviewsLocked;
  const open = viewModel.reviewOptions.length > 0;
  const footer = open ? <AppButton disabled={!viewModel.reviewCanSave} label={viewModel.reviewsSaving ? 'Saving decision...' : 'Save decision'} onPress={viewModel.saveReviewDecision} /> : undefined;
  return (
    <AdminScaffold footer={footer} onBack={viewModel.requestBack} title="Review moderation">
      <Text accessibilityRole="header" style={styles.name}>{reviewKindLabel(row.kind)}</Text>
      <AdminChipRow>
        <AdminChip label={reviewTypeLabel(row.kind)} />
        <AdminChip label={reviewStatusLabel(row.status)} tone={reviewStatusTone(row.status)} />
      </AdminChipRow>
      <Text style={styles.submitted}>{`Submitted ${formatAdminAge(row.createdAt).toLowerCase()}`}</Text>

      <View style={styles.notices}>
        {viewModel.reviewsBusy ? <ActivityIndicator accessibilityLabel="Loading reviews" color={colors.primaryAction} /> : null}
        <FeedbackNotice tone="error" message={viewModel.reviewsError} />
        {viewModel.reviewsPending ? <>
          <FeedbackNotice tone="warning" message="A review action needs reconciliation. Retry the same saved operation; keep app data until it is confirmed." />
          <AppButton disabled={!viewModel.reviewsReady || viewModel.reviewsBusy || viewModel.reviewsSaving} label="Retry pending review action" onPress={() => void viewModel.retryReviews()} />
        </> : null}
      </View>

      <AdminSectionLabel>The review</AdminSectionLabel>
      <AdminCard>
        <Text accessibilityLabel={`Rating ${row.rating} out of 5`} style={styles.rating}>{`${row.rating} / 5`}</Text>
        {row.text ? <Text style={ui.body}>{row.text}</Text> : <Text style={ui.supporting}>Rating only; no written feedback.</Text>}
      </AdminCard>
      <Text style={ui.supporting}>Check the text for personal or contact information and inappropriate material before approving. Internal notes stay private.</Text>

      <AdminSectionLabel>Your decision</AdminSectionLabel>
      {open ? <>
        <View accessibilityRole="radiogroup">
          {viewModel.reviewOptions.map((option) => (
            <AdminRadioOption description={option.description} disabled={locked} key={option.status} label={option.label} onSelect={() => viewModel.setReviewDecision(option.status)} selected={viewModel.reviewDecision === option.status} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Private note (admins only, required)</Text>
        <TextInput accessibilityLabel="Private moderation note" editable={!locked} maxLength={1000} multiline onChangeText={viewModel.setReviewNote} style={styles.textArea} textAlignVertical="top" value={viewModel.reviewNote} />
        {!viewModel.reviewCanSave && !viewModel.reviewsSaving ? <Text style={ui.supporting}>Choose a decision and enter a private note to save.</Text> : null}
      </> : <Text style={ui.supporting}>No decision is available for this review.</Text>}

      <AdminSectionLabel>History</AdminSectionLabel>
      {row.history.length > 0 ? (
        <View style={styles.timeline}>
          {row.history.map((entry, index) => (
            <View key={`${entry.createdAt}-${index}`} style={styles.event}>
              <View style={styles.dot} />
              <View style={styles.eventCopy}>
                <Text style={styles.cardTitle}>{entry.action}</Text>
                <Text style={ui.supporting}>{formatVerificationDate(entry.createdAt)}</Text>
                <Text style={ui.supporting}>{entry.note ?? 'No internal note'}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : <Text style={ui.supporting}>No moderation decisions recorded for this review yet.</Text>}

      <AdminDisclosure title="IDs and technical details">
        <DetailRow label="Review ID" value={row.id} />
        {row.propertyId ? <DetailRow label="Property reference" value={row.propertyId} /> : null}
      </AdminDisclosure>
    </AdminScaffold>
  );
}

const styles = StyleSheet.create({
  name: { ...ui.pageTitle },
  submitted: { ...ui.supporting, marginTop: spacing.xs },
  notices: { gap: spacing.xs, marginTop: spacing.xs },
  cardTitle: { ...ui.body, fontWeight: '600' },
  rating: { ...ui.sectionTitle },
  fieldLabel: { ...ui.supporting, fontWeight: '700', marginTop: spacing.xs },
  textArea: { borderColor: colors.controlBorder, borderRadius: radius.control, borderWidth: 1, color: colors.ink, fontFamily: typography.family, fontSize: 16, lineHeight: 22, minHeight: 96, padding: spacing.sm },
  timeline: { borderLeftColor: colors.outline, borderLeftWidth: 2, gap: spacing.sm, marginLeft: spacing.xxs, paddingLeft: spacing.sm },
  event: { flexDirection: 'row' },
  eventCopy: { flex: 1, minWidth: 0 },
  dot: { backgroundColor: colors.primaryAction, borderColor: colors.background, borderRadius: radius.pill, borderWidth: 2, height: 12, left: -(spacing.sm + 7), marginTop: 5, position: 'absolute', width: 12 },
});
