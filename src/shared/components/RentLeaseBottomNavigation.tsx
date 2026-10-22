import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export type RentLeaseNavigationTab = 'discover' | 'listing' | 'post' | 'tenancy' | 'chat';

interface RentLeaseBottomNavigationProps {
  active: RentLeaseNavigationTab | null;
  onChat: () => void;
  onDiscover: () => void;
  onListing: () => void;
  onPost: () => void;
  onTenancy: () => void;
}

type NavigationIconName = 'home' | 'listing' | 'plus' | 'tenancy' | 'chat';

function NavigationIcon({ name, color }: { name: NavigationIconName; color: string }) {
  if (name === 'home') {
    return (
      <View style={[styles.homeBody, { borderColor: color }]}>
        <View style={[styles.homeRoof, { borderBottomColor: color }]} />
      </View>
    );
  }

  if (name === 'listing') {
    return (
      <View style={[styles.listingFrame, { borderColor: color }]}>
        {[4, 9, 14].map((top) => (
          <View key={top} style={[styles.listingLine, { backgroundColor: color, top }]} />
        ))}
      </View>
    );
  }

  if (name === 'plus') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.plusHorizontal, { backgroundColor: color }]} />
        <View style={[styles.plusVertical, { backgroundColor: color }]} />
      </View>
    );
  }

  if (name === 'tenancy') {
    return (
      <View style={styles.iconBox}>
        <View style={[styles.tenantHead, styles.tenantHeadLeft, { borderColor: color }]} />
        <View style={[styles.tenantHead, styles.tenantHeadRight, { borderColor: color }]} />
        <View style={[styles.tenantBody, styles.tenantBodyLeft, { borderColor: color }]} />
        <View style={[styles.tenantBody, styles.tenantBodyRight, { borderColor: color }]} />
      </View>
    );
  }

  return (
    <View style={[styles.chatBubble, { borderColor: color }]}>
      <View style={[styles.chatTail, { borderBottomColor: color }]} />
    </View>
  );
}

export function RentLeaseBottomNavigation({
  active,
  onChat,
  onDiscover,
  onListing,
  onPost,
  onTenancy,
}: RentLeaseBottomNavigationProps) {
  const insets = useSafeAreaInsets();
  const items = [
    { key: 'discover' as const, label: 'Discover', icon: 'home' as const, onPress: onDiscover },
    { key: 'listing' as const, label: 'Listings', icon: 'listing' as const, onPress: onListing },
    { key: 'post' as const, label: 'Post', icon: 'plus' as const, onPress: onPost, primary: true },
    { key: 'tenancy' as const, label: 'Tenancy', icon: 'tenancy' as const, onPress: onTenancy },
    { key: 'chat' as const, label: 'Chat', icon: 'chat' as const, onPress: onChat },
  ];

  return (
    <View
      style={[
        styles.navigation,
        {
          minHeight: 64 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
        },
      ]}
    >
      {items.map((item) => {
        const selected = active === item.key;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected }}
            key={item.key}
            onPress={item.onPress}
            style={styles.item}
          >
            <View style={item.primary && selected ? styles.primaryIcon : styles.standardIcon}>
              <NavigationIcon
                color={item.primary && selected ? colors.white : selected ? colors.primaryAction : colors.textSecondary}
                name={item.icon}
              />
            </View>
            <Text
              style={[
                styles.label,
                selected && styles.activeLabel,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  navigation: {
    alignItems: 'flex-start',
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: 8,
  },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minHeight: 48 },
  standardIcon: { alignItems: 'center', height: 26, justifyContent: 'center' },
  primaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.primaryAction,
    borderRadius: 3,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: typography.family,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  activeLabel: { color: colors.primaryAction, fontWeight: '700' },
  iconBox: { alignItems: 'center', height: 20, justifyContent: 'center', position: 'relative', width: 20 },
  homeBody: { borderTopWidth: 0, borderWidth: 1.8, height: 12, marginTop: 6, position: 'relative', width: 15 },
  homeRoof: { borderBottomWidth: 7, borderLeftColor: 'transparent', borderLeftWidth: 8, borderRightColor: 'transparent', borderRightWidth: 8, height: 0, left: -2, position: 'absolute', top: -8, width: 0 },
  listingFrame: { borderRadius: 2, borderWidth: 1.7, height: 19, position: 'relative', width: 16 },
  listingLine: { height: 1.4, left: 3, position: 'absolute', width: 9 },
  plusHorizontal: { borderRadius: 2, height: 2, position: 'absolute', width: 16 },
  plusVertical: { borderRadius: 2, height: 16, position: 'absolute', width: 2 },
  tenantHead: { borderRadius: 100, borderWidth: 1.6, height: 6, position: 'absolute', top: 1, width: 6 },
  tenantHeadLeft: { left: 4 },
  tenantHeadRight: { right: 2, top: 4 },
  tenantBody: { borderRadius: 100, borderWidth: 1.6, bottom: 0, position: 'absolute' },
  tenantBodyLeft: { height: 10, left: 1, width: 12 },
  tenantBodyRight: { height: 8, right: 0, width: 9 },
  chatBubble: { borderRadius: 5, borderWidth: 1.8, height: 14, marginTop: 1, position: 'relative', width: 20 },
  chatTail: { borderBottomWidth: 4, borderLeftColor: 'transparent', borderLeftWidth: 4, bottom: -4, height: 0, left: 3, position: 'absolute', width: 0 },
});
