import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import type { NotificationTarget } from '../models/Notification';
import { useNotificationsViewModel } from '../viewModels/useNotificationsViewModel';
import { NotificationCenterView } from './NotificationCenterView';
import { NotificationPermissionView } from './NotificationPermissionView';

interface NotificationsFlowViewProps {
  canPostProperty: boolean;
  onClose: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
  onCreateListing: () => void;
  onOpenChat: () => void;
  onOpenDiscover: () => void;
  onOpenListings: () => void;
  onOpenMaintenance: () => void;
  onOpenRatingsReports: () => void;
  onOpenVerification: () => void;
}

export function NotificationsFlowView({
  canPostProperty,
  onClose,
  registerBackAction,
  onCreateListing,
  onOpenChat,
  onOpenDiscover,
  onOpenListings,
  onOpenMaintenance,
  onOpenRatingsReports,
  onOpenVerification,
}: NotificationsFlowViewProps) {
  const viewModel = useNotificationsViewModel();
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose));
    return () => registerBackAction?.(null);
  });

  const openTarget = (target: NotificationTarget) => {
    if (target === 'messages') onOpenChat();
    else if (target === 'maintenance') onOpenMaintenance();
    else if (target === 'verification') onOpenVerification();
    else if (target === 'ratingsReports') onOpenRatingsReports();
    else if (target === 'discovery') onOpenDiscover();
    else if (target === 'listings' && canPostProperty) onOpenListings();
    else if (target === 'listings') {
      viewModel.setNotice('Complete account verification to manage listings.');
    }
  };

  const content = viewModel.screen === 'center' || viewModel.screen === 'empty' ? (
    <NotificationCenterView onClose={onClose} onOpenTarget={openTarget} viewModel={viewModel} />
  ) : (
    <NotificationPermissionView viewModel={viewModel} />
  );

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      <RentLeaseBottomNavigation
        active={null}
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (canPostProperty) {
            onOpenListings();
            return;
          }
          viewModel.openCenter();
          viewModel.setNotice('Complete account verification to manage listings.');
        }}
        onPost={() => {
          if (canPostProperty) {
            onCreateListing();
            return;
          }
          viewModel.openCenter();
          viewModel.setNotice('Complete account verification before posting.');
        }}
        onTenancy={onOpenMaintenance}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
