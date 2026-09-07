import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { RentLeaseNotification } from '../models/Notification';

const categoryAccent: Record<RentLeaseNotification['category'], string> = {
  Messages: '#3F8DD7',
  Viewings: '#8A63C7',
  Maintenance: '#E19635',
  Verification: colors.primary,
  Listings: '#2BA47D',
  Safety: '#C45050',
};

function CategoryMark({ category }: { category: RentLeaseNotification['category'] }) {
  const accent = categoryAccent[category];
  return (
    <View style={[styles.mark, { backgroundColor: `${accent}18` }]}>
      <View style={[styles.markRing, { borderColor: accent }]}>
        <View style={[styles.markDot, { backgroundColor: accent }]} />
      </View>
    </View>
  );
}

interface NotificationCardProps {
  notification: RentLeaseNotification;
  onPress: () => void;
}

export function NotificationCard({ notification, onPress }: NotificationCardProps) {
  return (
    <Pressable
      accessibilityHint="Opens the related RENTLEASE screen"
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        !notification.read && styles.unreadCard,
        pressed && styles.pressed,
      ]}
    >
      {!notification.read ? <View style={styles.unreadDot} /> : null}
      <CategoryMark category={notification.category} />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={[styles.title, !notification.read && styles.unreadTitle]}>
            {notification.title}
          </Text>
          <Text style={styles.time}>{notification.time}</Text>
        </View>
        <Text numberOfLines={2} style={styles.body}>{notification.body}</Text>
        <Text style={[styles.category, { color: categoryAccent[notification.category] }]}>
          {notification.category.toUpperCase()}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.background, borderBottomColor: '#EEEEEE', borderBottomWidth: 1, flexDirection: 'row', minHeight: 104, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, position: 'relative' },
  unreadCard: { backgroundColor: '#F3FAF6' },
  pressed: { opacity: 0.72 },
  unreadDot: { backgroundColor: colors.primary, borderRadius: 4, height: 7, left: 5, position: 'absolute', top: 18, width: 7 },
  mark: { alignItems: 'center', borderRadius: radius.pill, height: 42, justifyContent: 'center', marginRight: spacing.sm, width: 42 },
  markRing: { alignItems: 'center', borderRadius: 8, borderWidth: 2, height: 19, justifyContent: 'center', width: 19 },
  markDot: { borderRadius: 3, height: 6, width: 6 },
  copy: { flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  title: { color: '#333333', flex: 1, fontFamily: typography.family, fontSize: 13, fontWeight: '700' },
  unreadTitle: { color: colors.text, fontWeight: '900' },
  time: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9 },
  body: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, lineHeight: 16, marginTop: 4 },
  category: { fontFamily: typography.family, fontSize: 8, fontWeight: '900', letterSpacing: 0.8, marginTop: 6 },
  chevron: { color: '#B0B0B0', fontFamily: typography.family, fontSize: 24, marginLeft: spacing.xs },
});
