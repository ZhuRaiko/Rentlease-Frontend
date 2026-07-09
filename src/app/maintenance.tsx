import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { AppScreen, BottomNav, BrandHeader, Chip, PrimaryAction, SectionLabel } from '@/features/listings/components';
import { getMaintenanceRequests, updateMaintenanceStatus } from '@/features/post-listing/post-listing-service';
import { postListingRoutes } from '@/features/post-listing/routes';
import { MaintenanceRequest, MaintenanceStatus } from '@/features/post-listing/types';
import { useTheme } from '@/hooks/use-theme';

export default function MaintenanceScreen() {
  const { session } = useAuth();
  const [items, setItems] = useState<MaintenanceRequest[]>([]);

  async function reload() {
    setItems(await getMaintenanceRequests(session?.user.id));
  }

  useEffect(() => {
    let isMounted = true;
    getMaintenanceRequests(session?.user.id).then((nextItems) => {
      if (isMounted) setItems(nextItems);
    });
    return () => {
      isMounted = false;
    };
  }, [session?.user.id]);

  async function setStatus(id: string, status: MaintenanceStatus) {
    try {
      await updateMaintenanceStatus(id, status);
      await reload();
    } catch (error) {
      Alert.alert('Could not update request', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <View style={styles.root}>
      <AppScreen>
        <BrandHeader title="Tenancy" />
        <View style={styles.heading}>
          <ThemedText style={styles.title}>Maintenance</ThemedText>
          <ThemedText style={styles.copy}>A simpler queue for repair requests: open, in progress, resolved.</ThemedText>
        </View>
        <View style={styles.actions}>
          <PrimaryAction label="New Request" tone="green" onPress={() => router.push(postListingRoutes.maintenanceNew)} style={styles.action} />
          <PrimaryAction label="Rent Reminder" onPress={() => router.push(postListingRoutes.reminders)} style={styles.action} />
        </View>
        <SectionLabel>Requests</SectionLabel>
        <View style={styles.list}>
          {items.length === 0 ? <ThemedText style={styles.empty}>No maintenance requests yet.</ThemedText> : null}
          {items.map((item) => (
            <MaintenanceCard key={item.id} item={item} onStatus={setStatus} />
          ))}
        </View>
      </AppScreen>
      <BottomNav active="tenancy" />
    </View>
  );
}

function MaintenanceCard({ item, onStatus }: { item: MaintenanceRequest; onStatus: (id: string, status: MaintenanceStatus) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
        <Chip label={item.urgency} color={item.urgency === 'urgent' ? 'accent' : 'neutral'} />
      </View>
      <ThemedText style={styles.description}>{item.description || 'No description.'}</ThemedText>
      <View style={styles.statusRow}>
        {(['open', 'in_progress', 'resolved'] as MaintenanceStatus[]).map((status) => (
          <Pressable key={status} onPress={() => onStatus(item.id, status)} style={[styles.statusPill, { borderColor: item.status === status ? theme.primary : theme.borderStrong }]}>
            <ThemedText style={styles.statusText}>{status.replace('_', ' ')}</ThemedText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { marginTop: 10, gap: 8 },
  title: { fontSize: 34, lineHeight: 40, fontWeight: '900' },
  copy: { fontSize: 14, lineHeight: 22, opacity: 0.66 },
  actions: { marginTop: 18, flexDirection: 'row', gap: 10 },
  action: { flex: 1, minHeight: 48 },
  list: { marginTop: 12, gap: 12 },
  empty: { opacity: 0.58 },
  card: { borderWidth: 1, borderRadius: Radius.card, padding: 14, gap: 10, backgroundColor: '#FFFFFF' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 18, lineHeight: 23, fontWeight: '900' },
  description: { fontSize: 13, lineHeight: 19, opacity: 0.7 },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 },
  statusText: { fontSize: 12, fontWeight: '700' },
});
