import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { VerificationStatusIndicator } from '../../../shared/components/VerificationStatusIndicator';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { tierTwoSubmissionPresentation } from '../models/TierTwoVerification';
import type { TierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';

const pendingIcon = require('../../../assets/verification/pending-clock.png');
const approvedIcon = require('../../../assets/verification/approved-check.png');
const verificationIcon = require('../../../assets/verification/verification-mark.png');

export function VerificationStatusView({ viewModel, onClose }: { viewModel: TierTwoVerificationViewModel; onClose: () => void }) {
  const submission = viewModel.submission;
  const status = submission?.status;
  const messages = {
    pending: submission?.hasDocument ? 'Your identity verification is pending review.' : 'This pending application has no registered document. Resume it with a selected document; the same application will be used. An earlier private upload may already exist.',
    under_review: 'Your identity verification is under review.',
    approved: 'Your Tier 2 identity verification has been approved.',
    rejected: 'Your document was not accepted. Review the reason below, then choose a clear, current ID to submit a corrected application.',
    cancelled: 'Your identity verification was cancelled. Starting another submission is not available in this phase.',
    revoked: 'Your identity verification was revoked. Starting another submission is not available in this phase.',
  };
  return (
    <VerificationScaffold onBack={viewModel.goBack} onClose={onClose} title="Tier 2 verification">
      <View style={styles.centeredState}>
        <Image resizeMode="contain" source={status === 'approved' ? approvedIcon : status === 'pending' || status === 'under_review' ? pendingIcon : verificationIcon} style={styles.stateIcon} />
        <VerificationStatusIndicator {...tierTwoSubmissionPresentation(submission, viewModel.requiresRefresh)} />
        <Text style={styles.message}>{viewModel.requiresRefresh ? 'The latest application or attachment could not be confirmed. Check status before another attempt.' : status ? messages[status] : 'Check status to load your submission.'}</Text>
        {submission && !submission.hasDocument ? (
          <Text style={styles.message}>Missing metadata does not prove that no file was uploaded. Recovery uses a fresh, non-overwriting file name; earlier private files are not deleted.</Text>
        ) : null}
        {submission?.review_note ? <Text style={styles.message}>Review note: {submission.review_note}</Text> : null}
        {submission ? <Text style={styles.message}>Submitted: {formatVerificationDate(submission.submitted_at)}</Text> : null}
        {submission?.reviewed_at ? <Text style={styles.message}>Reviewed: {formatVerificationDate(submission.reviewed_at)}</Text> : null}
      </View>
      {status === 'rejected' ? <View style={[styles.decisionCard, styles.rejectionCard]}>
        <Text accessibilityRole="header" style={styles.decisionTitle}>Reason for Rejection</Text>
        <Text style={styles.decisionCopy}>{submission?.rejection_reason || 'No rejection reason provided. Choose a clear, current identity document.'}</Text>
      </View> : null}
      {viewModel.previousRejection ? <View style={styles.decisionCard}>
        <Text accessibilityRole="header" style={styles.decisionTitle}>Previous Rejection</Text>
        <Text style={styles.decisionCopy}>{viewModel.previousRejection.rejection_reason || 'No rejection reason provided.'}</Text>
        <Text style={styles.decisionCopy}>{viewModel.previousRejection.reviewed_at ? 'Reviewed' : 'Submitted'}: {formatVerificationDate(viewModel.previousRejection.reviewed_at ?? viewModel.previousRejection.submitted_at)}</Text>
      </View> : null}
      <FeedbackNotice message={viewModel.historyError} />
      <FeedbackNotice tone="error" message={viewModel.error} />
      {viewModel.canStartRecovery ? <AppButton disabled={viewModel.busy} label={status === 'rejected' ? 'Submit Corrected Documents' : 'Complete Document Upload'} onPress={viewModel.startRecovery} /> : null}
      {viewModel.showRecovery ? <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Checking...' : 'Check status'} onPress={() => void viewModel.refresh()} /> : null}
      <AppButton disabled={viewModel.busy} label="Back to verification levels" onPress={() => viewModel.navigate('overview')} variant="secondary" />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  centeredState: { alignItems: 'flex-start', gap: spacing.md, paddingVertical: spacing.md },
  stateIcon: { height: 48, width: 48 },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'left',
  },
  message: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 21,
    textAlign: 'left',
  },
  decisionCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.sm, padding: spacing.md },
  rejectionCard: { backgroundColor: colors.restrictedSurface },
  decisionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '600' },
  decisionCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 14, lineHeight: 21 },
});
