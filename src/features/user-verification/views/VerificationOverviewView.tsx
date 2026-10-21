import { FlatList, StyleSheet, Text } from 'react-native';
import { AppButton } from '../../../shared/components/AppButton';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { VerificationTierCard } from '../components/VerificationTierCard';
import { tierTwoStatusLabels } from '../models/TierTwoVerification';
import type { TierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';

const tierOneIcon = require('../../../assets/verification/verification-mark.png');
const tierTwoIcon = require('../../../assets/verification/trusted-badge.png');
const tierThreeIcon = require('../../../assets/verification/premium-badge.png');

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
    title: 'Tier 1 verification',
    subtitle: 'Mandatory for all users',
    badge: 'Required',
    icon: tierOneIcon,
    items: ['Email confirmation', 'Philippine mobile number via SMS OTP', 'Unlocks: Application access'],
  },
  {
    tier: 2 as const,
    title: 'Tier 2 — Trusted',
    subtitle: 'Optional · all users',
    badge: 'Trusted',
    icon: tierTwoIcon,
    items: [
      'Government-issued ID (passport, driver’s license, UMID, PhilSys)',
      'Identity verification reviewed by admin',
    ],
  },
  {
    tier: 3 as const,
    title: 'Tier 3 — Premium',
    subtitle: 'Optional - Tier 1-verified landlords',
    badge: 'Premium',
    icon: tierThreeIcon,
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
      description="Complete tiers to unlock platform features and build trust with other users."
      onBack={onClose}
      onClose={onClose}
      title="Verification level"
    >
      <FlatList
        contentContainerStyle={styles.tierList}
        data={tierDefinitions}
        horizontal
        keyExtractor={(item) => String(item.tier)}
        renderItem={({ item }) => (
          <VerificationTierCard
            {...item}
            title={
              item.tier === 1 && tierOneVerified
                ? 'Tier 1 — Verified'
                : item.title
            }
            onPress={() => item.tier === 3 ? onOpenTierThree() : viewModel.navigate(viewModel.submission ? 'tier2Status' : 'tier2Intro')}
            disabled={item.tier === 3 ? !tierThreeEligible || viewModel.busy : item.tier !== 2 || !viewModel.loaded || viewModel.requiresRefresh || viewModel.busy}
            actionLabel={item.tier === 1 ? tierOneVerified ? 'Tier 1 verified' : 'Managed in onboarding'
              : item.tier === 3 ? tierThreeEligible ? 'Verify property / view status' : 'Requires Tier 1 + Landlord' : viewModel.isLoading ? 'Loading…'
              : viewModel.submission ? `View ${tierTwoStatusLabels[viewModel.submission.status]}` : 'Verify'}
            status={item.tier === 1 && tierOneVerified ? 'approved' : item.tier === 3 && !tierThreeEligible ? 'locked' : 'notStarted'}
          />
        )}
        showsHorizontalScrollIndicator={false}
        snapToInterval={353}
        decelerationRate="fast"
      />
      <Text style={styles.swipeHint}>Swipe horizontally to see other tiers</Text>
      {viewModel.error ? <Text accessibilityRole="alert" style={styles.notice}>{viewModel.error}</Text> : null}
      {viewModel.submission && !viewModel.submission.hasDocument ? <Text style={styles.notice}>An existing Tier 2 submission has no confirmed document attachment. A new submission is not available.</Text> : null}
      <AppButton disabled={viewModel.busy} label={viewModel.isLoading ? 'Loading verification…' : 'Refresh verification'} onPress={() => void viewModel.refresh()} variant="secondary" />
    </VerificationScaffold>
  );
}

const styles = StyleSheet.create({
  tierList: { gap: spacing.md, paddingHorizontal: 36 },
  swipeHint: {
    color: colors.textMuted,
    fontFamily: typography.family,
    fontSize: 14,
    fontWeight: '700',
    opacity: 0.5,
    textAlign: 'center',
  },
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
