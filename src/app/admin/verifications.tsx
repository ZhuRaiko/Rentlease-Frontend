import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { AppScreen, BrandHeader, FormInput, PrimaryAction, SectionLabel } from '@/features/listings/components';
import {
  getAdminVerificationQueue,
  reviewVerification,
} from '@/features/profile/profile-service';
import { AdminVerificationItem } from '@/features/profile/types';
import { useTheme } from '@/hooks/use-theme';

export default function AdminVerificationQueueScreen() {
  const [items, setItems] = useState<AdminVerificationItem[]>([]);
  const [reviewerNote, setReviewerNote] = useState('');

  useEffect(() => {
    let isMounted = true;

    getAdminVerificationQueue().then((nextItems) => {
      if (isMounted) {
        setItems(nextItems);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleReview(id: string, status: 'approved' | 'rejected') {
    try {
      await reviewVerification(id, status, reviewerNote);
      setReviewerNote('');
      setItems(await getAdminVerificationQueue());
    } catch (error) {
      Alert.alert('Review failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  return (
    <AppScreen>
      <BrandHeader title="Admin Queue" />
      <View style={styles.heading}>
        <ThemedText style={styles.title}>Verification reviews</ThemedText>
        <ThemedText style={styles.copy}>
          Review submitted Tier 2 IDs and Tier 3 landlord documents. Only admin accounts can update these records.
        </ThemedText>
      </View>

      <SectionLabel>Reviewer Note</SectionLabel>
      <FormInput
        value={reviewerNote}
        onChangeText={setReviewerNote}
        placeholder="Optional note shown on the verification record"
      />

      <View style={styles.list}>
        {items.length === 0 ? <ThemedText style={styles.empty}>No verification submissions available.</ThemedText> : null}
        {items.map((item) => (
          <AdminVerificationCard
            key={item.id}
            item={item}
            onApprove={() => handleReview(item.id, 'approved')}
            onReject={() => handleReview(item.id, 'rejected')}
          />
        ))}
      </View>
    </AppScreen>
  );
}

function AdminVerificationCard({
  item,
  onApprove,
  onReject,
}: {
  item: AdminVerificationItem;
  onApprove: () => void;
  onReject: () => void;
}) {
  const theme = useTheme();
  const userName = item.user?.nickname || item.user?.firstName || item.user?.email || 'Unknown user';

  return (
    <View style={[styles.card, { borderColor: theme.border }]}>
      <View style={styles.cardTop}>
        <View>
          <ThemedText style={styles.cardTitle}>{item.tier.replace('_', ' ').toUpperCase()}</ThemedText>
          <ThemedText style={styles.userName}>{userName}</ThemedText>
        </View>
        <ThemedText style={styles.status}>{item.status}</ThemedText>
      </View>
      <Info label="Role" value={item.user?.role ?? 'unknown'} />
      <Info label="Document" value={item.documentType ?? 'No type'} />
      <Info label="Reference" value={item.documentUrl ?? 'No document reference'} />
      <Info label="Notes" value={item.notes || 'No notes'} />
      {item.reviewerNote ? <Info label="Reviewer note" value={item.reviewerNote} /> : null}
      <View style={styles.actions}>
        <PrimaryAction label="Approve" tone="green" onPress={onApprove} style={styles.action} />
        <Pressable onPress={onReject} style={[styles.reject, { borderColor: theme.danger }]}>
          <ThemedText style={[styles.rejectText, { color: theme.danger }]}>Reject</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
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
    marginTop: 22,
    gap: 14,
  },
  empty: {
    opacity: 0.58,
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
    fontSize: 20,
    lineHeight: 24,
    fontWeight: '900',
  },
  userName: {
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
  infoRow: {
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
  reject: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
  },
});
