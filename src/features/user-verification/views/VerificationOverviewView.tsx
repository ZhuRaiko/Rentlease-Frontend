import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { VerificationTierCard } from '../components/VerificationTierCard';
import { tierTwoSubmissionPresentation } from '../models/TierTwoVerification';
import type { TierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';


interface VerificationOverviewViewProps {
  viewModel: TierTwoVerificationViewModel;
  tierOneVerified: boolean;
  onClose: () => void;
  tierThreeEligible: boolean;
  onOpenTierThree: () => void;
}

const tierDefinitions = [
  {
    tier: 1 as const,
    title: 'Account Verification',
    subtitle: 'Required for ordinary accounts',
    items: ['Email and Philippine mobile number, confirmed during account setup.'],
  },
  {
    tier: 2 as const,
    title: 'Identity Verification',
    subtitle: 'Optional · all users',
    items: [
      'Submit one government-issued ID for Admin review.',
    ],
  },
  {
    tier: 3 as const,
    title: 'Property Verification',
    subtitle: 'Optional - Tier 1-verified landlords',
    items: [
      'Provide ownership or leasing authority for a property you own.',
      'Approval applies to the selected property only.',
    ],
  },
];

export function VerificationOverviewView({
  viewModel,
  tierOneVerified,
  onClose,
  tierThreeEligible,
  onOpenTierThree,
}: VerificationOverviewViewProps) {
  return (
    <VerificationScaffold
      compact
      description="Check your status or submit documents for review."
      onBack={onClose}
      title="Verification"
    >
      <View style={styles.tierList}>{tierDefinitions.map(item => (
          <VerificationTierCard
            key={item.tier}
            {...item}
            title={item.title}
            presentation={item.tier === 1
              ? { label: tierOneVerified ? 'Verified' : 'Required in Onboarding', tone: tierOneVerified ? 'success' : 'info' }
              : item.tier === 2 ? viewModel.submission ? tierTwoSubmissionPresentation(viewModel.submission, viewModel.requiresRefresh)
                : { label: viewModel.isLoading ? 'Checking Status' : !viewModel.loaded || viewModel.requiresRefresh ? 'Status Unavailable' : 'Not Started', tone: 'info' }
              : { label: tierThreeEligible ? 'Checked per Property' : 'Landlord Access Required', tone: 'info' }}
            onPress={() => item.tier === 3 ? onOpenTierThree() : viewModel.navigate(viewModel.submission ? 'tier2Status' : 'tier2Intro')}
            disabled={item.tier === 3 ? !tierThreeEligible || viewModel.busy : item.tier !== 2 || !viewModel.loaded || viewModel.requiresRefresh || viewModel.busy}
            actionLabel={item.tier === 1 ? ''
              : item.tier === 3 ? tierThreeEligible ? 'Choose property' : 'Requires Tier 1 + Landlord' : viewModel.isLoading ? 'Loading…'
              : viewModel.submission?.status === 'pending' && !viewModel.submission.hasDocument ? 'View incomplete upload' : viewModel.submission ? 'View submission' : 'Verify identity'}
          />
      ))}</View>
      <FeedbackNotice tone="error" message={viewModel.error} />
      {viewModel.submission && !viewModel.submission.hasDocument ? <Text style={styles.notice}>This application has no confirmed attachment. Open Tier 2 to check status and resume its upload; a private file may already exist.</Text> : null}
      {viewModel.showRecovery ? <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Checking...' : 'Check status'} onPress={() => void viewModel.refresh()} variant="secondary" /> : null}
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  tierList: { gap: spacing.md, paddingHorizontal: spacing.md },
  notice: {
    alignSelf: 'center',
    backgroundColor: colors.warningSurface,
    borderRadius: radius.sm,
    color: colors.warning,
    fontFamily: typography.family,
    fontSize: 13,
    lineHeight: 18,
    marginHorizontal: spacing.lg,
    maxWidth: 364,
    padding: spacing.sm,
  },
});
