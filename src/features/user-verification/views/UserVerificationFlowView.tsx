import { StatusBar } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { VerificationActor } from '../models/Verification';
import { useUserVerificationViewModel } from '../viewModels/useUserVerificationViewModel';
import { TierOneVerificationView } from './TierOneVerificationView';
import { TierThreeVerificationView } from './TierThreeVerificationView';
import { TierTwoVerificationView } from './TierTwoVerificationView';
import { VerificationOverviewView } from './VerificationOverviewView';
import { VerificationStatusView } from './VerificationStatusView';

interface UserVerificationFlowViewProps {
  initialActor: VerificationActor;
  onClose: () => void;
  onLandlordVerified?: () => void;
}

const tierOneScreens = new Set(['tier1Intro', 'tier1Email', 'tier1Mobile']);
const tierTwoScreens = new Set([
  'tier2Intro',
  'tier2IdType',
  'tier2Upload',
  'tier2Review',
  'tier2Resubmission',
]);
const tierThreeScreens = new Set(['tier3Intro', 'tier3Property', 'tier3Document', 'tier3Review']);

export function UserVerificationFlowView({
  initialActor,
  onClose,
  onLandlordVerified,
}: UserVerificationFlowViewProps) {
  const viewModel = useUserVerificationViewModel(initialActor, onLandlordVerified);
  let content;

  if (viewModel.screen === 'overview') {
    content = <VerificationOverviewView onClose={onClose} viewModel={viewModel} />;
  } else if (tierOneScreens.has(viewModel.screen)) {
    content = <TierOneVerificationView onClose={onClose} viewModel={viewModel} />;
  } else if (tierTwoScreens.has(viewModel.screen)) {
    content = <TierTwoVerificationView onClose={onClose} viewModel={viewModel} />;
  } else if (tierThreeScreens.has(viewModel.screen)) {
    content = <TierThreeVerificationView onClose={onClose} viewModel={viewModel} />;
  } else {
    content = <VerificationStatusView onClose={onClose} viewModel={viewModel} />;
  }

  return (
    <ScreenContainer padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      {content}
    </ScreenContainer>
  );
}
