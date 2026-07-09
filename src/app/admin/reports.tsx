import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { AppScreen, BrandHeader, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getAdminReportQueue, reviewReport } from '@/features/trust/trust-service';
import { AdminReportItem } from '@/features/trust/types';
import { useTheme } from '@/hooks/use-theme';

export default function AdminReportsScreen() {
  const [items, setItems] = useState<AdminReportItem[]>([]);

  async function reload() {
    setItems(await getAdminReportQueue());
  }

  useEffect(() => {
    let isMounted = true;
    getAdminReportQueue().then((nextItems) => {
      if (isMounted) setItems(nextItems);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  async function handleReview(id: string, status: 'upheld' | 'dismissed') {
    try {
      await reviewReport(id, status);
      await reload();
    } catch (error) {
      Alert.alert('Could not review report', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Reports" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Report queue</ThemedText>
        <ThemedText style={styles.copy}>
          Upheld user reports count toward suspension. Three upheld user reports automatically mark the account suspended.
        </ThemedText>
      </View>

      <SectionLabel>Reports</SectionLabel>
      <View style={styles.list}>
        {items.length === 0 ? <ThemedText style={styles.empty}>No reports available.</ThemedText> : null}
        {items.map((item) => (
          <ReportCard
            key={item.id}
            item={item}
            onUphold={() => handleReview(item.id, 'upheld')}
            onDismiss={() => handleReview(item.id, 'dismissed')}
          />
        ))}
      </View>
    </AppScreen>
  );
}

function ReportCard({
  item,
  onUphold,
  onDismiss,
}: {
  item: AdminReportItem;
  onUphold: () => void;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const reporter = item.reporter?.nickname || item.reporter?.firstName || item.reporter?.email || 'Unknown reporter';

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <View>
          <ThemedText style={styles.cardTitle}>{item.reason}</ThemedText>
          <ThemedText style={styles.reporter}>{reporter}</ThemedText>
        </View>
        <ThemedText style={styles.status}>{item.status}</ThemedText>
      </View>
      <Info label="Subject" value={`${item.subjectType}: ${item.subjectId}`} />
      <Info label="Details" value={item.details || 'No details'} />
      <View style={styles.actions}>
        <PrimaryAction label="Uphold" tone="green" onPress={onUphold} style={styles.action} />
        <PrimaryAction label="Dismiss" onPress={onDismiss} style={styles.action} />
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.info}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 10,
    gap: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
  },
  copy: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.66,
  },
  list: {
    marginTop: 12,
    gap: 14,
  },
  empty: {
    opacity: 0.56,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 16,
    gap: 10,
    backgroundColor: '#FFFFFF',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
  },
  reporter: {
    marginTop: 3,
    fontSize: 13,
    opacity: 0.58,
  },
  status: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    opacity: 0.62,
  },
  info: {
    gap: 3,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.48,
    textTransform: 'uppercase',
  },
  infoValue: {
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  action: {
    flex: 1,
    minHeight: 46,
  },
});
