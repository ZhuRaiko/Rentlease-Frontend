import {ReviewModerationPanel} from '../../../shared/components/RentalReviews';
import {KeyboardAwareScrollView} from '../../../shared/components/KeyboardAwareScrollView';
import {ScreenHeader} from '../../../shared/components/ScreenHeader';
import { useCallback,useEffect,useRef,useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { AdminBottomNavigation } from '../components/AdminScaffold';
import type { AdminNavigationSection } from '../models/AdminModeration';
import { useAdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminQueueView } from './AdminQueueView';
import { AuditView } from './AuditView';
import { EnforcementView } from './EnforcementView';
import { ReportModerationView } from './ReportModerationView';
import { VerificationModerationView } from './VerificationModerationView';

interface AdminModerationFlowViewProps {
  accountId?:string|undefined;
  onClose: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
}

const queueScreens = new Set(['reviewQueues', 'verificationQueue', 'reportsQueue']);
const verificationScreens = new Set(['verificationDetails', 'verificationDocument', 'approveVerification', 'rejectVerification', 'requestVerificationInfo']);
const reportScreens = new Set(['reportDetails', 'evidenceViewer', 'reportedUserDetails', 'reportedListingDetails', 'reportedMessageContext', 'requestReportInfo', 'dismissReport']);
const enforcementScreens = new Set(['moderationAction', 'warnUser', 'restrictAccount', 'suspendAccount', 'removeListing', 'permanentRemoval', 'moderationConfirmation', 'activeRestrictions', 'restoreAccount']);
const auditScreens = new Set(['auditHistory', 'caseHistory']);

export function AdminModerationFlowView({ onClose, registerBackAction, accountId }: AdminModerationFlowViewProps) {
  const viewModel = useAdminModerationViewModel();
  const [reviewOwner,setReviewOwner]=useState<string|null>(null),reviewOpen=!!accountId&&reviewOwner===accountId,reviewGuard=useRef<(()=>boolean)|null>(null),registerReviewGuard=useCallback((guard:(()=>boolean)|null)=>{reviewGuard.current=guard;},[]),closeReviews=()=>{if(!reviewGuard.current||reviewGuard.current())setReviewOwner(null);};
  useEffect(() => {
    registerBackAction?.(reviewOpen?closeReviews:() => viewModel.backFromWorkspace(onClose));
    return () => registerBackAction?.(null);
  });
  let content;

  if(reviewOpen){content=<View style={{flex:1}}><ScreenHeader title="Review moderation" onBack={closeReviews}/><KeyboardAwareScrollView contentContainerStyle={{padding:16,gap:12}}><ReviewModerationPanel key={accountId} accountId={accountId} registerExitGuard={registerReviewGuard}/></KeyboardAwareScrollView></View>;} else if (viewModel.screen === 'dashboard') {
    content = <AdminDashboardView onExit={onClose} viewModel={viewModel} onReviewModeration={()=>{if(accountId)setReviewOwner(accountId);}}/>;
  } else if (queueScreens.has(viewModel.screen)) {
    content = <AdminQueueView viewModel={viewModel} />;
  } else if (verificationScreens.has(viewModel.screen)) {
    content = <VerificationModerationView viewModel={viewModel} />;
  } else if (reportScreens.has(viewModel.screen)) {
    content = <ReportModerationView viewModel={viewModel} />;
  } else if (enforcementScreens.has(viewModel.screen)) {
    content = <EnforcementView viewModel={viewModel} />;
  } else {
    content = <AuditView viewModel={viewModel} />;
  }

  const active: AdminNavigationSection = auditScreens.has(viewModel.screen)
    ? 'audit'
    : enforcementScreens.has(viewModel.screen)
      ? 'enforcement'
      : viewModel.screen === 'dashboard'
        ? 'dashboard'
        : 'queues';

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      {!reviewOpen?<AdminBottomNavigation
        active={active}
        onAudit={() => viewModel.openSection('auditHistory')}
        onDashboard={() => viewModel.openSection('dashboard')}
        onEnforcement={() => viewModel.openSection('activeRestrictions')}
        onQueues={() => viewModel.openSection('reviewQueues')}
      />:null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
