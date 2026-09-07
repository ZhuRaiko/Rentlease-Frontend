import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const backIcon = require('../../../assets/verification/back.png');
const profileAvatar = require('../../../assets/authentication/profile-avatar.png');

interface NotificationScaffoldProps extends PropsWithChildren {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  contentPadded?: boolean;
}

export function NotificationScaffold({
  children,
  title,
  subtitle,
  onBack,
  onClose,
  actionLabel,
  onAction,
  contentPadded = true,
}: NotificationScaffoldProps) {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerSide}>
          {onBack ? (
            <Pressable accessibilityLabel="Back" accessibilityRole="button" onPress={onBack}>
              <Image resizeMode="contain" source={backIcon} style={styles.backIcon} />
            </Pressable>
          ) : null}
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
          ) : onClose ? (
            <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onClose}>
              <Image resizeMode="cover" source={profileAvatar} style={styles.avatar} />
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

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: '#F0F0F0', borderBottomWidth: 1, flexDirection: 'row', minHeight: 62, paddingHorizontal: spacing.md },
  headerSide: { alignItems: 'flex-start', minWidth: 70 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCopy: { alignItems: 'center', flex: 1 },
  backIcon: { height: 38, width: 38 },
  title: { color: colors.text, fontFamily: typography.family, fontSize: 18, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.textSecondary, fontFamily: typography.family, fontSize: 10, marginTop: 2, textAlign: 'center' },
  action: { color: colors.primary, fontFamily: typography.family, fontSize: 11, fontWeight: '800' },
  avatar: { borderColor: '#D69A21', borderRadius: 17, borderWidth: 1, height: 34, width: 34 },
  content: { flexGrow: 1, paddingBottom: spacing.xl },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
