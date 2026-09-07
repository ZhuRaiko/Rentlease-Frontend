import { Image, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import type { UserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';

const pendingIcon = require('../../../assets/verification/pending-clock.png');
const approvedIcon = require('../../../assets/verification/approved-check.png');
const verificationIcon = require('../../../assets/verification/verification-mark.png');

interface VerificationStatusViewProps {
  viewModel: UserVerificationViewModel;
  onClose: () => void;
}

export function VerificationStatusView({
  viewModel,
  onClose,
}: VerificationStatusViewProps) {
  const { screen } = viewModel;
  const isTierOne = screen === 'tier1Complete';
  const isTierTwo = screen.startsWith('tier2');
  const isPending = screen === 'tier2Pending' || screen === 'tier3Pending';
  const isApproved = isTierOne || screen === 'tier2Approved' || screen === 'tier3Approved';
  const tierLabel = isTierOne ? 'Tier 1' : isTierTwo ? 'Tier 2' : 'Tier 3';
  const title = isPending
    ? 'Pending Verification'
    : isApproved
      ? isTierOne
        ? 'Tier 1 completed!'
        : isTierTwo
          ? 'Your ID has been verified!'
          : 'Premium verification approved!'
      : 'Correction required';
  const message = isPending
    ? `We received your ${tierLabel} preview request. A real submission would be reviewed by an admin and updates would be sent to samuel.feliciano@example.com.`
    : isApproved
      ? isTierOne
        ? 'Email and mobile presentation steps are complete. Tier 2 is now available in this local preview.'
        : isTierTwo
          ? 'Your local preview now shows the Trusted state and profile badge.'
          : 'Your local preview now shows the Premium Landlord state and listing-priority benefit.'
      : isTierTwo
        ? 'The ID image is blurry or cropped. Retake it in good light with all four corners visible.'
        : 'The property document is incomplete or does not clearly show ownership or authorization to lease.';

  return (
    <VerificationScaffold onBack={viewModel.goBack} onClose={onClose} title="">
      <View style={styles.centeredState}>
        <Image
          resizeMode="contain"
          source={isPending ? pendingIcon : isApproved ? approvedIcon : verificationIcon}
          style={styles.stateIcon}
        />
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
      {isPending ? (
        <View style={styles.decisionCard}>
          <Text style={styles.decisionTitle}>Admin decision preview</Text>
          <Text style={styles.decisionCopy}>These controls change local UI state only.</Text>
          <AppButton
            label="Preview approval"
            onPress={() =>
              isTierTwo
                ? viewModel.previewTierTwoDecision('approved')
                : viewModel.previewTierThreeDecision('approved')
            }
          />
          <AppButton
            label="Preview correction required"
            onPress={() =>
              isTierTwo
                ? viewModel.previewTierTwoDecision('rejected')
                : viewModel.previewTierThreeDecision('rejected')
            }
            variant="secondary"
          />
        </View>
      ) : null}
      {!isPending && !isApproved ? (
        <AppButton
          label="Correct and resubmit"
          onPress={
            isTierTwo
              ? viewModel.startTierTwoResubmission
              : viewModel.startTierThreeResubmission
          }
        />
      ) : null}
      {isTierOne ? (
        <AppButton label="Continue to Tier 2" onPress={() => viewModel.startTier(2)} />
      ) : null}
      {screen === 'tier2Approved' ? (
        <AppButton label="Continue to Tier 3" onPress={() => viewModel.startTier(3)} />
      ) : null}
      <AppButton label="Back to verification levels" onPress={viewModel.goToOverview} variant="secondary" />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  centeredState: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  stateIcon: { height: 145, width: 145 },
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
