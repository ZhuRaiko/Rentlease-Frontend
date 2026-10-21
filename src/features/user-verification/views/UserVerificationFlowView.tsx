import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { useTierTwoVerificationViewModel } from '../viewModels/useTierTwoVerificationViewModel';
import { TierTwoVerificationView } from './TierTwoVerificationView';
import { VerificationOverviewView } from './VerificationOverviewView';
import { VerificationStatusView } from './VerificationStatusView';
import { useTierThreeVerificationViewModel } from '../viewModels/useTierThreeVerificationViewModel';
import { canEnterTierThree } from '../models/TierThreeVerification';
import { TierThreeVerificationView } from './TierThreeVerificationView';

interface UserVerificationFlowViewProps {
  tierOneVerified: boolean;
  hasLandlordRole: boolean;
  onClose: () => void;
  registerBackAction: (action: (() => void) | null) => void;
}

const tierTwoScreens = new Set([
  'tier2Intro',
  'tier2IdType',
  'tier2Upload',
  'tier2Review',
]);

export function UserVerificationFlowView({
  tierOneVerified,
  hasLandlordRole,
  onClose,
  registerBackAction,
}: UserVerificationFlowViewProps) {
  const viewModel = useTierTwoVerificationViewModel();
  const eligible = canEnterTierThree(tierOneVerified, hasLandlordRole);
  const [showTierThree, setShowTierThree] = useState(false);
  const tierThree = useTierThreeVerificationViewModel(showTierThree && eligible);
  const isTierThree = showTierThree && eligible;
  const toOverview = () => {
    const current = tierThree.getSnapshot();
    if (!current.isSubmitting && !current.isSelectingDocument && !current.isLoading) setShowTierThree(false);
  };
  const close = () => {
    const current = isTierThree ? tierThree.getSnapshot() : viewModel.getSnapshot();
    if (!current.isSubmitting && !current.isSelectingDocument) onClose();
  };
  useEffect(() => {
    registerBackAction(() => {
      if (isTierThree) { if (tierThree.getSnapshot().screen === 'intro') toOverview(); else tierThree.goBack(); }
      else if (viewModel.getSnapshot().screen === 'overview') close();
      else viewModel.goBack();
    });
    return () => registerBackAction(null);
  });
  let content;

  if (isTierThree) {
    content = <TierThreeVerificationView onClose={close} onOverview={toOverview} viewModel={tierThree} />;
  } else if (viewModel.screen === 'overview') {
    content = <VerificationOverviewView onClose={close} tierOneVerified={tierOneVerified} viewModel={viewModel} tierThreeEligible={eligible} onOpenTierThree={() => setShowTierThree(true)} />;
  } else if (tierTwoScreens.has(viewModel.screen)) {
    content = <TierTwoVerificationView onClose={close} viewModel={viewModel} />;
  } else {
    content = <VerificationStatusView onClose={close} viewModel={viewModel} />;
  }

  return (
    <ScreenContainer padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      {content}
    </ScreenContainer>
  );
}
