import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '../../../shared/components/AppButton';
import { colors } from '../../../shared/theme/colors';
import { radius } from '../../../shared/theme/radius';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import { NotificationCard } from '../components/NotificationCard';
import { NotificationScaffold } from '../components/NotificationScaffold';
import type { NotificationTarget } from '../models/Notification';
import type { NotificationsViewModel } from '../viewModels/useNotificationsViewModel';

interface NotificationCenterViewProps {
  onClose: () => void;
  onOpenTarget: (target: NotificationTarget) => void;
  viewModel: NotificationsViewModel;
}

export function NotificationCenterView({
  onClose,
  onOpenTarget,
  viewModel,
}: NotificationCenterViewProps) {
  if (viewModel.screen === 'empty') {
    return (
      <NotificationScaffold
        actionLabel="Restore"
        onAction={viewModel.restorePreviewNotifications}
        onClose={onClose}
        title="Notifications"
      >
        <View style={styles.emptyState}>
          <View style={styles.bellGraphic}>
            <View style={styles.bellBody} />
            <View style={styles.bellClapper} />
          </View>
          <Text accessibilityRole="header" style={styles.emptyTitle}>You’re all caught up</Text>
          <Text style={styles.emptyBody}>
            Messages, viewing updates, maintenance progress, verification results and safety
            notices will appear here.
          </Text>
          <AppButton label="Restore preview notifications" onPress={viewModel.restorePreviewNotifications} />
        </View>
      </NotificationScaffold>
    );
  }

  const today = viewModel.filteredNotifications.filter((item) => item.dayGroup === 'Today');
  const earlier = viewModel.filteredNotifications.filter(
    (item) => item.dayGroup === 'Earlier this week',
  );

  return (
    <NotificationScaffold
      actionLabel={viewModel.unreadCount > 0 ? 'Mark all read' : 'All read'}
      onAction={viewModel.markAllRead}
      onClose={onClose}
      title="Notifications"
      subtitle={`${viewModel.unreadCount} unread`}
      contentPadded={false}
    >
      <View style={styles.intro}>
        <View style={styles.introCopy}>
          <Text style={styles.eyebrow}>YOUR RENTLEASE ACTIVITY</Text>
          <Text style={styles.heading}>Stay up to date</Text>
          <Text style={styles.headingBody}>Tap an update to open the related screen.</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countValue}>{viewModel.unreadCount}</Text>
          <Text style={styles.countLabel}>UNREAD</Text>
        </View>
      </View>

      {viewModel.notice ? <Text style={styles.notice}>{viewModel.notice}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.categories}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {viewModel.categories.map((category) => {
          const selected = category === viewModel.activeCategory;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={category}
              onPress={() => viewModel.setActiveCategory(category)}
              style={[styles.categoryPill, selected && styles.categoryPillSelected]}
            >
              <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                {category}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {viewModel.filteredNotifications.length === 0 ? (
        <View style={styles.filteredEmpty}>
          <Text style={styles.filteredEmptyTitle}>No {viewModel.activeCategory.toLowerCase()} updates</Text>
          <Text style={styles.filteredEmptyBody}>Choose another category to view recent activity.</Text>
        </View>
      ) : null}

      {today.length > 0 ? (
        <View>
          <Text style={styles.groupLabel}>TODAY</Text>
          {today.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onPress={() => onOpenTarget(viewModel.openNotification(notification.id))}
            />
          ))}
        </View>
      ) : null}

      {earlier.length > 0 ? (
        <View>
          <Text style={styles.groupLabel}>EARLIER THIS WEEK</Text>
          {earlier.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onPress={() => onOpenTarget(viewModel.openNotification(notification.id))}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.settingsCard}>
        <View style={styles.settingsCopy}>
          <Text style={styles.settingsTitle}>Push notifications</Text>
          <Text style={styles.settingsBody}>
            {viewModel.permissionState === 'granted'
              ? 'Enabled in this frontend preview'
              : 'Review how RENTLEASE asks for permission'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('permissionPrompt')}>
          <Text style={styles.settingsAction}>Review</Text>
        </Pressable>
      </View>
      <View style={styles.previewActions}>
        <Pressable accessibilityRole="button" onPress={() => viewModel.navigate('androidExample')}>
          <Text style={styles.previewAction}>View Android push example</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={viewModel.previewEmptyState}>
          <Text style={styles.previewAction}>Preview empty state</Text>
        </Pressable>
      </View>
    </NotificationScaffold>
  );
}

const styles = StyleSheet.create({
  intro: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  introCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  heading: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', marginTop: 4 },
  headingBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: 4 },
  countBadge: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: radius.card, minWidth: 66, padding: spacing.sm },
  countValue: { color: colors.primary, fontFamily: typography.family, fontSize: 22, fontWeight: '900' },
  countLabel: { color: colors.primary, fontFamily: typography.family, fontSize: 8, fontWeight: '900', marginTop: 1 },
  notice: { backgroundColor: colors.primaryPale, borderRadius: radius.sm, color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginHorizontal: spacing.lg, marginTop: spacing.md, padding: spacing.sm },
  categories: { gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  categoryPill: { backgroundColor: colors.surface, borderColor: '#E6E6E6', borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: 8 },
  categoryPillSelected: { backgroundColor: '#1D9E75', borderColor: '#1D9E75' },
  categoryLabel: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, fontWeight: '800' },
  categoryLabelSelected: { color: colors.white },
  groupLabel: { color: colors.textMuted, fontFamily: typography.family, fontSize: 9, fontWeight: '900', letterSpacing: 1, paddingBottom: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  filteredEmpty: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  filteredEmptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 16, fontWeight: '900' },
  filteredEmptyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 11, marginTop: 4, textAlign: 'center' },
  settingsCard: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.card, flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.md },
  settingsCopy: { flex: 1 },
  settingsTitle: { color: colors.text, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  settingsBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 3 },
  settingsAction: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  previewActions: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  previewAction: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  emptyState: { alignItems: 'center', flex: 1, gap: spacing.md, justifyContent: 'center', paddingBottom: spacing.xxl },
  bellGraphic: { alignItems: 'center', backgroundColor: colors.primaryPale, borderRadius: 60, height: 120, justifyContent: 'center', position: 'relative', width: 120 },
  bellBody: { borderColor: colors.primary, borderRadius: 25, borderWidth: 5, height: 47, width: 51 },
  bellClapper: { backgroundColor: colors.primary, borderRadius: 6, bottom: 30, height: 10, position: 'absolute', width: 17 },
  emptyTitle: { color: colors.text, fontFamily: typography.family, fontSize: 24, fontWeight: '900', textAlign: 'center' },
  emptyBody: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 13, lineHeight: 20, maxWidth: 320, textAlign: 'center' },
});
