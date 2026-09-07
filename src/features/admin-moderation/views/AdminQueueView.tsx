import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import {
  AdminHeading,
  ReportQueueCard,
  VerificationQueueCard,
} from '../components/AdminCards';
import { AdminScaffold } from '../components/AdminScaffold';
import type { AdminModerationViewModel } from '../viewModels/useAdminModerationViewModel';

export function AdminQueueView({ viewModel }: { viewModel: AdminModerationViewModel }) {
  if (viewModel.screen === 'reviewQueues') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Admin review queues">
        <AdminHeading
          body="Prioritize verification and safety work by age, risk, and required action."
          eyebrow="QUEUE OVERVIEW"
          title="Work requiring review"
        />
        <View style={styles.overviewList}>
          <QueueOverview
            count={viewModel.pendingVerificationCount}
            label="Verification"
            meta="Oldest item · 21h"
            onPress={() => viewModel.navigate('verificationQueue')}
            tone="warning"
          />
          <QueueOverview
            count={viewModel.openReportCount}
            label="Reports"
            meta="1 urgent item"
            onPress={() => viewModel.navigate('reportsQueue')}
            tone="danger"
          />
        </View>
        <View style={styles.guidanceCard}>
          <Text style={styles.guidanceTitle}>Queue handling guidance</Text>
          <Text style={styles.guidanceBody}>Review urgent safety reports first, then age-sensitive verification requests. Every frontend decision creates a local audit preview.</Text>
        </View>
      </AdminScaffold>
    );
  }

  if (viewModel.screen === 'verificationQueue') {
    return (
      <AdminScaffold onBack={viewModel.goBack} title="Verification queue">
        <AdminHeading
          body="Review submitted identity and property-authorization materials."
          eyebrow={`${viewModel.pendingVerificationCount} PENDING`}
          title="Verification submissions"
        />
        <FilterRow labels={['All', 'Tier 2', 'Tier 3', 'Oldest']} />
        <View style={styles.queueList}>
          {viewModel.verificationSubmissions.map((item) => (
            <VerificationQueueCard item={item} key={item.id} onPress={() => viewModel.openVerification(item.id)} />
          ))}
        </View>
      </AdminScaffold>
    );
  }

  return (
    <AdminScaffold onBack={viewModel.goBack} title="Reports queue">
      <AdminHeading
        body="Review reported users, listings, and conversations using the available context."
        eyebrow={`${viewModel.openReportCount} OPEN REPORTS`}
        title="Safety reports"
      />
      <FilterRow labels={['All', 'Urgent', 'Users', 'Listings', 'Messages']} />
      <View style={styles.queueList}>
        {viewModel.reports.map((item) => (
          <ReportQueueCard item={item} key={item.id} onPress={() => viewModel.openReport(item.id)} />
        ))}
      </View>
    </AdminScaffold>
  );
}

function FilterRow({ labels }: { labels: readonly string[] }) {
  return (
    <View style={styles.filters}>
      {labels.map((label, index) => (
        <Pressable accessibilityRole="button" key={label} style={[styles.filter, index === 0 && styles.filterActive]}>
          <Text style={[styles.filterLabel, index === 0 && styles.filterLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function QueueOverview({ label, count, meta, tone, onPress }: { label: string; count: number; meta: string; tone: 'warning' | 'danger'; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.overviewCard}>
      <Text style={[styles.overviewCount, tone === 'danger' ? styles.danger : styles.warning]}>{count}</Text>
      <Text style={styles.overviewLabel}>{label}</Text>
      <Text style={styles.overviewMeta}>{meta}</Text>
      <Text style={styles.openQueue}>Open queue ›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overviewList: { flexDirection: 'row', gap: spacing.sm },
  overviewCard: { borderColor: colors.border, borderRadius: radius.card, borderWidth: 1, flex: 1, padding: spacing.md },
  overviewCount: { fontFamily: typography.family, fontSize: 32, fontWeight: '900' },
  warning: { color: colors.warning },
  danger: { color: colors.restricted },
  overviewLabel: { color: colors.text, fontFamily: typography.family, fontSize: 14, fontWeight: '900', marginTop: 3 },
  overviewMeta: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, marginTop: 3 },
  openQueue: { color: '#2E7552', fontFamily: typography.family, fontSize: 9, fontWeight: '900', marginTop: spacing.md },
  guidanceCard: { backgroundColor: '#EAF1ED', borderRadius: radius.card, gap: 5, marginTop: spacing.lg, padding: spacing.md },
  guidanceTitle: { color: '#173C2C', fontFamily: typography.family, fontSize: 12, fontWeight: '900' },
  guidanceBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, lineHeight: 16 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.md },
  filter: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  filterActive: { backgroundColor: '#173C2C' },
  filterLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 9, fontWeight: '800' },
  filterLabelActive: { color: colors.white },
  queueList: { gap: spacing.sm },
});
