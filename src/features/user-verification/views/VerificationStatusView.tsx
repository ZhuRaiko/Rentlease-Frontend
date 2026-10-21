import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { VerificationStatusBadge } from '../../../shared/components/VerificationStatusBadge';
import { verificationStatusPresentation } from '../../../shared/models/verificationPresentation';
import { Image, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { tierTwoStatusLabels } from '../models/TierTwoVerification';
import type { TierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';
import { formatVerificationDate } from '../../../shared/utils/formatVerificationDate';

const pendingIcon = require('../../../assets/verification/pending-clock.png');
const approvedIcon = require('../../../assets/verification/approved-check.png');
const verificationIcon = require('../../../assets/verification/verification-mark.png');

export function VerificationStatusView({ viewModel, onClose }: { viewModel: TierTwoVerificationViewModel; onClose: () => void }) {
  const submission = viewModel.submission;
  const status = submission?.status;
  const messages = {
    pending: 'Your identity verification is pending review.',
    under_review: 'Your identity verification is under review.',
    approved: 'Your Tier 2 identity verification has been approved.',
    rejected: 'Your identity verification was rejected. Resubmission is not available in this phase.',
    cancelled: 'Your identity verification was cancelled. Starting another submission is not available in this phase.',
    revoked: 'Your identity verification was revoked. Starting another submission is not available in this phase.',
  };
  return (
    <VerificationScaffold onBack={viewModel.goBack} onClose={onClose} title="Tier 2 verification">
      <View style={styles.centeredState}>
        <Image resizeMode="contain" source={status === 'approved' ? approvedIcon : status === 'pending' || status === 'under_review' ? pendingIcon : verificationIcon} style={styles.stateIcon} />
        {status ? <VerificationStatusBadge {...verificationStatusPresentation(status)} /> : <Text style={styles.title}>Status unavailable</Text>}
        {submission && !submission.hasDocument ? (
          <Text style={styles.message}>No document attachment could be confirmed for this submission. It may be incomplete. Creating another submission or replacing the document is not available here.</Text>
        ) : <Text style={styles.message}>{status ? messages[status] : 'Refresh to check your submission.'}</Text>}
        {submission?.rejection_reason ? <Text style={styles.message}>Rejection reason: {submission.rejection_reason}</Text> : null}
        {submission?.review_note ? <Text style={styles.message}>Review note: {submission.review_note}</Text> : null}
        {submission ? <Text style={styles.message}>Submitted: {formatVerificationDate(submission.submitted_at)}</Text> : null}
        {submission?.reviewed_at ? <Text style={styles.message}>Reviewed: {formatVerificationDate(submission.reviewed_at)}</Text> : null}
      </View>
      <FeedbackNotice tone="error" message={viewModel.error} />
      {viewModel.showRecovery ? <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Checking...' : 'Check status'} onPress={() => void viewModel.refresh()} /> : null}
      <AppButton disabled={viewModel.busy} label="Back to verification levels" onPress={() => viewModel.navigate('overview')} variant="secondary" />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  centeredState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  stateIcon: { height: 80, width: 80 },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  message: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 15,
    fontWeight: '300',
    lineHeight: 21,
    textAlign: 'center',
  },
  decisionCard: { backgroundColor: colors.surface, borderRadius: radius.card, gap: spacing.sm, padding: spacing.md },
  decisionTitle: { color: colors.text, fontFamily: typography.family, fontSize: 17, fontWeight: '800' },
  decisionCopy: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13 },
});
