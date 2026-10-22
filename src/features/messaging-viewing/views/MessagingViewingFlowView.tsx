import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { MessagingActor } from '../models/MessagingViewing';
import { useMessagingViewingViewModel } from '../viewModels/useMessagingViewingViewModel';
import { MessagingConversationView } from './MessagingConversationView';
import { MessagingInboxView } from './MessagingInboxView';
import { ViewingScheduleView } from './ViewingScheduleView';

interface MessagingViewingFlowViewProps {
  actor: MessagingActor;
  initialScreen?: 'inbox' | 'newInquiry';
  isLandlord: boolean;
  onClose: () => void;
  onRootBack: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onCreateListing: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
  onOpenMaintenance: () => void;
}

const inboxScreens = new Set(['inbox', 'emptyInbox']);
const conversationScreens = new Set([
  'conversation',
  'newInquiry',
  'attachment',
  'listingUnavailable',
]);

export function MessagingViewingFlowView({
  actor,
  initialScreen = 'inbox',
  isLandlord,
  onClose,
  onRootBack,
  registerBackAction,
  onCreateListing,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
}: MessagingViewingFlowViewProps) {
  const viewModel = useMessagingViewingViewModel(actor, initialScreen);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onRootBack));
    return () => registerBackAction?.(null);
  });
  let content;

  if (inboxScreens.has(viewModel.screen)) {
    content = <MessagingInboxView onClose={onClose} viewModel={viewModel} />;
  } else if (conversationScreens.has(viewModel.screen)) {
    content = <MessagingConversationView viewModel={viewModel} />;
  } else {
    content = <ViewingScheduleView viewModel={viewModel} />;
  }

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active="chat"
        onChat={viewModel.openInbox}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (isLandlord) {
            onOpenListings();
            return;
          }
          viewModel.openInbox();
          viewModel.setNotice('Listings require the Landlord role. You can continue browsing in Discover.');
        }}
        onPost={() => {
          if (isLandlord) {
            onCreateListing();
            return;
          }
          viewModel.openInbox();
          viewModel.setNotice('Posting requires the Landlord role. Verification does not grant roles.');
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
