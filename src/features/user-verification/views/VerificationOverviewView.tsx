import { verificationStatusPresentation } from '../../../shared/models/verificationPresentation';
import { FeedbackNotice } from '../../../shared/components/FeedbackNotice';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { VerificationTierCard } from '../components/VerificationTierCard';
import { tierTwoStatusLabels } from '../models/TierTwoVerification';
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
    subtitle: 'Managed in account onboarding',
    items: ['Email confirmation', 'Philippine mobile number via SMS OTP', 'Unlocks: Application access'],
  },
  {
    tier: 2 as const,
    title: 'Tier 2 — Trusted',
    subtitle: 'Optional · all users',
    items: [
      'Government-issued ID (passport, driver’s license, UMID, PhilSys)',
      'Identity verification reviewed by Admin',
    ],
  },
  {
    tier: 3 as const,
    title: 'Tier 3 — Premium',
    subtitle: 'Optional - Tier 1-verified landlords',
    items: [
      'Proof of ownership or authorization to lease',
      'Choose an existing property you own',
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
      description="Your account, identity and property documents have separate verification requirements."
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
              : item.tier === 2 ? viewModel.submission ? verificationStatusPresentation(viewModel.submission.status)
                : { label: viewModel.isLoading ? 'Checking Status' : !viewModel.loaded || viewModel.requiresRefresh ? 'Status Unavailable' : 'Not Started', tone: 'info' }
              : { label: tierThreeEligible ? 'Checked per Property' : 'Landlord Access Required', tone: 'info' }}
            onPress={() => item.tier === 3 ? onOpenTierThree() : viewModel.navigate(viewModel.submission ? 'tier2Status' : 'tier2Intro')}
            disabled={item.tier === 3 ? !tierThreeEligible || viewModel.busy : item.tier !== 2 || !viewModel.loaded || viewModel.requiresRefresh || viewModel.busy}
            actionLabel={item.tier === 1 ? tierOneVerified ? 'Tier 1 verified' : 'Managed in onboarding'
              : item.tier === 3 ? tierThreeEligible ? 'Choose property' : 'Requires Tier 1 + Landlord' : viewModel.isLoading ? 'Loading…'
              : viewModel.submission ? `View ${tierTwoStatusLabels[viewModel.submission.status]}` : 'Verify identity'}
          />
      ))}</View>
      <FeedbackNotice tone="error" message={viewModel.error} />
      {viewModel.submission && !viewModel.submission.hasDocument ? <Text style={styles.notice}>An existing Tier 2 submission has no confirmed document attachment. A new submission is not available.</Text> : null}
      {viewModel.showRecovery ? <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Checking...' : 'Check status'} onPress={() => void viewModel.refresh()} variant="secondary" /> : null}
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  tierList: { gap: spacing.md, paddingHorizontal: spacing.lg },
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
