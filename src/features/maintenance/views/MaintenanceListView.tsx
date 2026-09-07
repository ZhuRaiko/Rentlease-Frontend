import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { MaintenanceRequestCard } from '../components/MaintenanceCards';
import { MaintenanceScaffold } from '../components/MaintenanceScaffold';
import type { MaintenanceRequestsViewModel } from '../viewModels/useMaintenanceRequestsViewModel';

interface MaintenanceListViewProps {
  onClose: () => void;
  viewModel: MaintenanceRequestsViewModel;
}

export function MaintenanceListView({ onClose, viewModel }: MaintenanceListViewProps) {
  if (viewModel.screen === 'empty') {
    return (
      <MaintenanceScaffold
        actionLabel="Restore"
        onAction={viewModel.openRequests}
        onClose={onClose}
        title="Maintenance"
      >
        <View style={styles.emptyState}>
          <View style={styles.emptyGraphic}>
            <View style={styles.toolHandle} />
            <View style={styles.toolHead} />
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>No maintenance requests</Text>
          <Text style={styles.emptyBody}>
            {viewModel.actor === 'landlord'
              ? 'Tenant repair requests for your active properties will appear here.'
              : 'Report a repair or property issue and track every update here.'}
          </Text>
          <AppButton label="Create maintenance request" onPress={viewModel.startRequest} />
        </View>
      </MaintenanceScaffold>
    );
  }

  return (
    <MaintenanceScaffold
      actionLabel="Empty"
      onAction={() => viewModel.navigate('empty')}
      onClose={onClose}
      title="Maintenance"
    >
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <Text style={styles.eyebrow}>{viewModel.actor === 'landlord' ? 'LANDLORD QUEUE' : 'MY HOME'}</Text>
          <Text style={styles.heading}>Maintenance requests</Text>
          <Text style={styles.headingBody}>
            {viewModel.actor === 'landlord'
              ? 'Review tenant reports and coordinate repairs.'
              : 'Report issues and follow repair progress.'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={viewModel.startRequest} style={styles.newButton}>
          <Text style={styles.newButtonLabel}>New request</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}><Text style={styles.statValue}>{viewModel.openCount}</Text><Text style={styles.statLabel}>OPEN</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}><Text style={styles.statValue}>{viewModel.requests.filter((item) => item.status === 'Scheduled').length}</Text><Text style={styles.statLabel}>SCHEDULED</Text></View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}><Text style={styles.statValue}>{viewModel.requests.filter((item) => item.status === 'Resolved').length}</Text><Text style={styles.statLabel}>RESOLVED</Text></View>
      </View>

      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}
      <Text style={styles.sectionLabel}>{viewModel.actor === 'landlord' ? 'TENANT REQUESTS' : 'RECENT REQUESTS'}</Text>
      <View style={styles.requestList}>
        {viewModel.requests.map((request) => (
          <MaintenanceRequestCard
            key={request.id}
            onPress={() => viewModel.openRequest(request.id)}
            request={request}
          />
        ))}
      </View>
    </MaintenanceScaffold>
  );
}

const styles = StyleSheet.create({
  headingRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  headingCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', marginTop: 4 },
  headingBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, marginTop: 4 },
  newButton: { backgroundColor: colors.primaryPale, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  newButtonLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  statsRow: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', marginTop: spacing.lg, minHeight: 76, paddingVertical: spacing.sm },
  statCard: { alignItems: 'center', flex: 1 },
  statValue: { color: colors.text, fontFamily: typography.family, fontSize: 20, fontWeight: '900' },
  statLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 8, fontWeight: '800', marginTop: 2 },
  statDivider: { backgroundColor: colors.border, height: 32, width: 1 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: spacing.md, padding: spacing.sm },
  sectionLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.xs, marginTop: spacing.lg },
  requestList: { gap: spacing.sm },
  emptyState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xxl },
  emptyGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 60, height: 120, justifyContent: 'center', position: 'relative', width: 120 },
  toolHandle: { backgroundColor: colors.primary, borderRadius: 5, height: 58, transform: [{ rotate: '-42deg' }], width: 12 },
  toolHead: { borderColor: colors.primary, borderRadius: 22, borderWidth: 7, height: 43, left: 31, position: 'absolute', top: 23, width: 43 },
  emptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 320, textAlign: 'center' },
});
