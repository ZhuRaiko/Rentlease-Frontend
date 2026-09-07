import type { PropsWithChildren } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/theme/colors';
import { spacing } from '../../../shared/theme/spacing';
import { typography } from '../../../shared/theme/typography';

const backIcon = require('../../../assets/verification/back.png');
const profileAvatar = require('../../../assets/authentication/profile-avatar.png');

interface MessagingHeaderProps {
  title: string;
  subtitle?: string | undefined;
  onBack?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
}

export function MessagingHeader({
  title,
  subtitle,
  onBack,
  onClose,
  actionLabel,
  onAction,
}: MessagingHeaderProps) {
  return (
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
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : onClose ? (
          <Pressable accessibilityLabel="Open profile" accessibilityRole="button" onPress={onClose}>
            <Image resizeMode="cover" source={profileAvatar} style={styles.profileAvatar} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

interface MessagingScaffoldProps extends PropsWithChildren, MessagingHeaderProps {
  scroll?: boolean;
  contentPadded?: boolean;
}

export function MessagingScaffold({
  children,
  scroll = true,
  contentPadded = true,
  ...headerProps
}: MessagingScaffoldProps) {
  return (
    <View style={styles.screen}>
      <MessagingHeader {...headerProps} />
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, contentPadded && styles.padded]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.staticContent, contentPadded && styles.padded]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: '#F0F0F0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    minHeight: 62,
    paddingHorizontal: spacing.md,
  },
  headerSide: { alignItems: 'flex-start', minWidth: 52 },
  headerSideRight: { alignItems: 'flex-end' },
  headerCopy: { alignItems: 'center', flex: 1 },
  backIcon: { height: 38, width: 38 },
  title: {
    color: colors.text,
    fontFamily: typography.family,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  actionLabel: {
    color: colors.primary,
    fontFamily: typography.family,
    fontSize: 12,
    fontWeight: '800',
  },
  profileAvatar: {
    borderColor: '#D69A21',
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    width: 34,
  },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xl },
  staticContent: { flex: 1 },
  padded: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
});
