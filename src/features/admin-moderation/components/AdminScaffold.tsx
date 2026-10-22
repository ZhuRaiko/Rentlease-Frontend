import { ScreenHeader } from '../../../shared/components/ScreenHeader';
import type { PropsWithChildren } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../shared/theme/colors';
import { ui } from '../../../shared/theme/ui';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { AdminNavigationSection } from '../models/AdminModeration';

interface AdminScaffoldProps extends PropsWithChildren {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  contentPadded?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshEnabled?: boolean;
}

export function AdminScaffold({
  children,
  title,
  subtitle,
  onBack,
  onExit,
  actionLabel,
  onAction,
  contentPadded = true,
  onRefresh, refreshing = false, refreshEnabled = true,
}: AdminScaffoldProps) {
  return (
    <View style={styles.screen}>
      <ScreenHeader title={title} onBack={onBack} action={actionLabel && onAction ?
        <Pressable accessibilityRole="button" onPress={onAction} style={styles.headerControl}><Text style={styles.action}>{actionLabel}</Text></Pressable>
        : onExit ? <Pressable accessibilityRole="button" onPress={onExit} style={styles.headerControl}><Text style={styles.action}>Exit</Text></Pressable> : undefined} />
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <ScrollView
        contentContainerStyle={[styles.content, contentPadded && styles.padded]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} enabled={refreshEnabled} colors={[colors.primaryAction]} tintColor={colors.primaryAction} /> : undefined}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function AdminBottomNavigation({
  active,
  onDashboard,
  onQueues,
  onEnforcement,
  onAudit,
}: {
  active: AdminNavigationSection;
  onDashboard: () => void;
  onQueues: () => void;
  onEnforcement: () => void;
  onAudit: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const largeText = width / fontScale < 280;
  const items = [
    { key: 'dashboard' as const, label: 'Dashboard', onPress: onDashboard },
    { key: 'queues' as const, label: 'Queues', onPress: onQueues },
    { key: 'enforcement' as const, label: 'Actions', onPress: onEnforcement },
    { key: 'audit' as const, label: 'Audit', onPress: onAudit },
  ];
  return (
    <View style={[styles.navigation, largeText && styles.wrappedNavigation, { paddingBottom: Math.max(14, insets.bottom) }]}>
      {items.map((item, index) => {
        const selected = active === item.key;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={item.key} onPress={item.onPress} style={[styles.navItem, largeText && styles.wrappedItem]}>
            <View style={[styles.navIcon, selected && styles.navIconSelected]}>
              {index === 0 ? <><View style={styles.gridSquare} /><View style={[styles.gridSquare, styles.gridTopRight]} /><View style={[styles.gridSquare, styles.gridBottomLeft]} /><View style={[styles.gridSquare, styles.gridBottomRight]} /></> : null}
              {index === 1 ? <><View style={styles.queueLine} /><View style={[styles.queueLine, styles.queueLineMiddle]} /><View style={[styles.queueLine, styles.queueLineBottom]} /></> : null}
              {index === 2 ? <><View style={styles.shieldTop} /><View style={styles.shieldBottom} /></> : null}
              {index === 3 ? <><View style={styles.auditLine} /><View style={[styles.auditLine, styles.auditLineTwo]} /><View style={[styles.auditLine, styles.auditLineThree]} /></> : null}
            </View>
            <Text style={[styles.navLabel, selected && styles.navLabelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrappedNavigation: { flexWrap: 'wrap', rowGap: spacing.xs },
  wrappedItem: { flexBasis: '45%', flexGrow: 1, flexShrink: 1 },
  headerControl: { justifyContent: 'center', minHeight: 48, minWidth: 48 },
  screen: { backgroundColor: colors.background, flex: 1 },
  subtitle: { ...ui.supporting, paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  action: { color: colors.primaryAction, fontFamily: typography.family, fontSize: 14, fontWeight: '700' },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  navigation: { alignItems: 'flex-start', backgroundColor: colors.accountCredentialInk, flexDirection: 'row', minHeight: 64, paddingTop: spacing.xs },
  navItem: { alignItems: 'center', flex: 1, minHeight: 48, gap: spacing.xxs },
  navIcon: { height: 22, opacity: 0.55, position: 'relative', width: 22 },
  navIconSelected: { opacity: 1 },
  navLabel: { color: colors.white, fontFamily: typography.family, fontSize: 12, fontWeight: '600', textAlign: 'center', flexShrink: 1 },
  navLabelSelected: { color: colors.white, fontWeight: '900' },
  gridSquare: { backgroundColor: colors.white, borderRadius: 1, height: 8, left: 1, position: 'absolute', top: 1, width: 8 },
  gridTopRight: { left: 13 },
  gridBottomLeft: { top: 13 },
  gridBottomRight: { left: 13, top: 13 },
  queueLine: { backgroundColor: colors.white, borderRadius: 2, height: 3, left: 1, position: 'absolute', top: 3, width: 20 },
  queueLineMiddle: { top: 10 },
  queueLineBottom: { top: 17 },
  shieldTop: { borderBottomColor: colors.white, borderBottomWidth: 10, borderLeftColor: 'transparent', borderLeftWidth: 9, borderRightColor: 'transparent', borderRightWidth: 9, height: 0, left: 2, position: 'absolute', top: 1, width: 0 },
  shieldBottom: { borderLeftColor: 'transparent', borderLeftWidth: 9, borderRightColor: 'transparent', borderRightWidth: 9, borderTopColor: colors.white, borderTopWidth: 10, height: 0, left: 2, position: 'absolute', top: 11, width: 0 },
  auditLine: { backgroundColor: colors.white, borderRadius: 2, height: 3, left: 6, position: 'absolute', top: 3, width: 15 },
  auditLineTwo: { top: 10, width: 12 },
  auditLineThree: { top: 17, width: 9 },
});
