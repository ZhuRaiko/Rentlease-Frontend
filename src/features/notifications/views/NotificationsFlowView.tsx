import { useEffect,useState,type ReactNode } from 'react';
import type {InAppTarget} from '../models/InAppNotification';
import type {InAppNotificationsViewModel} from '../viewModels/useInAppNotifications';
import { StatusBar, StyleSheet, View } from 'react-native';

import { RentLeaseBottomNavigation } from '../../../shared/components/RentLeaseBottomNavigation';
import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';

import { NotificationCenterView } from './NotificationCenterView';

interface NotificationsFlowViewProps {
  viewModel:InAppNotificationsViewModel;
  renderTarget:(target:InAppTarget,onBack:()=>void)=>ReactNode;
  accountId:string|undefined;
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
  viewModel,renderTarget,accountId,
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
  const [selected,setSelected]=useState<{owner:string|undefined;target:InAppTarget}|null>(null);
  const active=selected?.owner===accountId?selected?.target:null;
  const closeTarget=()=>{setSelected(null);void viewModel.workflow.refresh();};
  useEffect(()=>{if(active)return;registerBackAction?.(onClose);return()=>registerBackAction?.(null);});
  const content=active?renderTarget(active,closeTarget):<NotificationCenterView onClose={onClose} viewModel={viewModel} onOpenTarget={target=>setSelected({owner:accountId,target})}/>;

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      {!active?<RentLeaseBottomNavigation
        active={null}
        onChat={onOpenChat}
        onDiscover={onOpenDiscover}
        onListing={() => {
          if (canPostProperty) {
            onOpenListings();
            return;
          }


        }}
        onPost={() => {
          if (canPostProperty) {
            onCreateListing();
            return;
          }


        }}
        onTenancy={onOpenMaintenance}
      />:null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
