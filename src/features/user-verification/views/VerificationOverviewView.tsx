import { FlatList, StyleSheet, Text } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { VerificationScaffold } from '../components/VerificationScaffold';
import { VerificationTierCard } from '../components/VerificationTierCard';
import type { VerificationTier } from '../models/Verification';
import type { UserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';

const tierOneIcon = require('../../../assets/verification/verification-mark.png');
const tierTwoIcon = require('../../../assets/verification/trusted-badge.png');
const tierThreeIcon = require('../../../assets/verification/premium-badge.png');

interface VerificationOverviewViewProps {
  viewModel: UserVerificationViewModel;
  onClose: () => void;
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
      'Reviewed by admin · visible badge on profile',
    ],
  },
  {
    tier: 3 as const,
    title: 'Tier 3 — Premium',
    subtitle: 'Required to become a Landlord',
    badge: 'Premium',
    icon: tierThreeIcon,
    items: [
      'Proof of ownership or authorization to lease',
      'Listing visibility priority + Premium badge',
    ],
  },
];

export function VerificationOverviewView({
  viewModel,
  onClose,
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
              item.tier === 1 && viewModel.statuses[1] === 'approved'
                ? 'Tier 1 — Verified'
                : item.title
            }
            onPress={() => viewModel.openTier(item.tier as VerificationTier)}
            status={viewModel.statuses[item.tier]}
          />
        )}
        showsHorizontalScrollIndicator={false}
        snapToInterval={353}
        decelerationRate="fast"
      />
      <Text style={styles.swipeHint}>Swipe horizontally to see other tiers</Text>
      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
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
