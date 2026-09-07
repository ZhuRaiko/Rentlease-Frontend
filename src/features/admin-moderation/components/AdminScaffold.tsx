import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';
import type { AdminNavigationSection } from '../models/AdminModeration';

const backIcon = require('../../../assets/verification/back.png');

interface AdminScaffoldProps extends PropsWithChildren {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  contentPadded?: boolean;
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
}: AdminScaffoldProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {onBack ? (
            <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack}>
              <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
            </Pressable>
          ) : <View style={styles.adminMark}><Text style={styles.adminMarkText}>A</Text></View>}
        </View>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" numberOfLines={1} style={styles.title}>{title}</Text>
          {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={[styles.headerSide, styles.headerSideRight]}>
          {actionLabel && onAction ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}>
              <Text style={styles.action}>{actionLabel}</Text>
            </Pressable>
          ) : onExit ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={onExit}>
              <Text style={styles.exit}>Exit</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, contentPadded && styles.padded]}
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
  const items = [
    { key: 'dashboard' as const, label: 'Dashboard', onPress: onDashboard },
    { key: 'queues' as const, label: 'Queues', onPress: onQueues },
    { key: 'enforcement' as const, label: 'Actions', onPress: onEnforcement },
    { key: 'audit' as const, label: 'Audit', onPress: onAudit },
  ];
  return (
    <View style={[styles.navigation, { paddingBottom: Math.max(14, insets.bottom) }]}>
      {items.map((item, index) => {
        const selected = active === item.key;
        return (
          <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={item.key} onPress={item.onPress} style={styles.navItem}>
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
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: '#E9EEEB', borderBottomWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: spacing.md },
  headerSide: { alignItems: 'flex-start', minWidth: 52 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCopy: { alignItems: 'center', flex: 1 },
  backIcon: { height: 38, width: 38 },
  adminMark: { alignItems: 'center', backgroundColor: '#173C2C', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  adminMarkText: { color: colors.white, fontFamily: typography.family, fontSize: 13, fontWeight: '900' },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 2, textAlign: 'center' },
  action: { color: colors.primary, fontFamily: typography.family, fontSize: 12, fontWeight: '800' },
  exit: { color: colors.restricted, fontFamily: typography.family, fontSize: 11, fontWeight: '900' },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  navigation: { alignItems: 'flex-start', backgroundColor: '#173C2C', flexDirection: 'row', minHeight: 64, paddingTop: 9 },
  navItem: { alignItems: 'center', flex: 1, gap: 4 },
  navIcon: { height: 22, opacity: 0.55, position: 'relative', width: 22 },
  navIconSelected: { opacity: 1 },
  navLabel: { color: '#A9BCB2', fontFamily: typography.family, fontSize: 9, fontWeight: '700' },
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
