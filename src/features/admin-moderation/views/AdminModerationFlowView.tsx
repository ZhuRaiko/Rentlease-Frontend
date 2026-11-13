import { useEffect } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';

import { ScreenContainer } from '../../../shared/components/ScreenContainer';
import { colors } from '../../../shared/theme/colors';
import { AdminBottomNavigation } from '../components/AdminScaffold';
import type { AdminNavigationSection } from '../models/AdminModeration';
import { useAdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';
import { AdminDashboardView } from './AdminDashboardView';
import { AdminNotConnectedView } from './AdminNotConnectedView';
import { AdminQueueView } from './AdminQueueView';
import { ReportModerationView } from './ReportModerationView';
import { ReviewModerationView } from './ReviewModerationView';
import { VerificationModerationView } from './VerificationModerationView';

interface AdminModerationFlowViewProps {
  accountId?: string | undefined;
  onClose: () => void;
  registerBackAction?: ((action: (() => void) | null) => void) | undefined;
}

// Decision screens own the bottom edge (sticky action bar), so the section bar is hidden there.
const detailScreens = new Set(['verificationDetails', 'reportDetails', 'reviewDetails']);

export function AdminModerationFlowView({ onClose, registerBackAction, accountId }: AdminModerationFlowViewProps) {
  const viewModel = useAdminModerationViewModel(accountId);
  useEffect(() => {
    registerBackAction?.(() => viewModel.backFromWorkspace(onClose));
    return () => registerBackAction?.(null);
  });

  let content;
  if (viewModel.screen === 'dashboard') {
    content = <AdminDashboardView onExit={onClose} viewModel={viewModel} />;
  } else if (viewModel.screen === 'reviewQueues') {
    content = <AdminQueueView viewModel={viewModel} />;
  } else if (viewModel.screen === 'verificationDetails') {
    content = <VerificationModerationView viewModel={viewModel} />;
  } else if (viewModel.screen === 'reportDetails') {
    content = <ReportModerationView viewModel={viewModel} />;
  } else if (viewModel.screen === 'reviewDetails') {
    content = <ReviewModerationView viewModel={viewModel} />;
  } else if (viewModel.screen === 'activeRestrictions') {
    content = <AdminNotConnectedView section="enforcement" />;
  } else {
    content = <AdminNotConnectedView section="audit" />;
  }

  const active: AdminNavigationSection = viewModel.screen === 'auditHistory' ? 'audit' : viewModel.screen === 'activeRestrictions' ? 'enforcement' : viewModel.screen === 'dashboard' ? 'dashboard' : 'queues';

  return (
    <ScreenContainer includeBottomInset={false} padded={false}>
      <StatusBar backgroundColor={colors.background} barStyle="dark-content" />
      <View style={styles.content}>{content}</View>
      {!detailScreens.has(viewModel.screen) ? <AdminBottomNavigation
        active={active}
        onAudit={() => viewModel.openSection('auditHistory')}
        onDashboard={() => viewModel.openSection('dashboard')}
        onEnforcement={() => viewModel.openSection('activeRestrictions')}
        onQueues={() => viewModel.openSection('reviewQueues')}
      /> : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({ content: { flex: 1 } });
